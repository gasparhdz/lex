// src/utils/drive.js
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import path from 'path';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Obtiene una instancia autenticada de Google Drive
 * Soporta dos modos:
 * 1. Cuenta de servicio (recomendado): archivo credentials.json
 * 2. OAuth 2.0: client_id, client_secret, refresh_token
 */
export function getDriveClient() {
  const credentialsPath = path.join(__dirname, '../../credentials.json');
  
  let auth;
  
  // Intentar usar cuenta de servicio si existe el archivo
  try {
    const fs = require('fs');
    if (fs.existsSync(credentialsPath)) {
      auth = new google.auth.GoogleAuth({
        keyFile: credentialsPath,
        scopes: ['https://www.googleapis.com/auth/drive'],
      });
      console.log('✅ Usando cuenta de servicio desde credentials.json');
    } else {
      throw new Error('No credentials file');
    }
  } catch (error) {
    // Fallback a OAuth 2.0
    console.log('⚠️ No se encontró credentials.json, usando OAuth 2.0');
    
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    
    if (!clientId || !clientSecret || !refreshToken) {
      console.error('❌ Error: Faltan credenciales de OAuth 2.0');
      console.error('   Variables necesarias: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN');
      throw new Error('Credenciales de Google Drive no configuradas');
    }
    
    const oauth2Client = new OAuth2Client(
      clientId,
      clientSecret,
      'http://localhost:3001/oauth2callback'
    );
    
    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });
    
    auth = oauth2Client;
  }

  const drive = google.drive({ version: 'v3', auth });
  return drive;
}

/**
 * Crea una carpeta en Google Drive
 * @param {string} nombre - Nombre de la carpeta
 * @param {string} parentFolderId - ID de la carpeta padre
 * @returns {Promise<Object>} { id, name }
 */
export async function crearCarpeta(nombre, parentFolderId = null) {
  try {
    console.log('📁 Creando carpeta:', nombre);
    console.log('📁 Parent folder ID:', parentFolderId);
    
    const drive = getDriveClient();

    const folderMetadata = {
      name: nombre,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentFolderId && { parents: [parentFolderId] }),
    };

    console.log('📁 Metadata:', folderMetadata);

    const folder = await drive.files.create({
      requestBody: folderMetadata,
      fields: 'id, name',
    });

    console.log('✅ Carpeta creada:', folder.data);

    return {
      id: folder.data.id,
      name: folder.data.name,
    };
  } catch (error) {
    console.error('❌ Error creando carpeta:', error.message);
    console.error('❌ Stack:', error.stack);
    if (error.response) {
      console.error('❌ Response data:', error.response.data);
    }
    throw error;
  }
}

/**
 * Lista archivos en una carpeta de Drive
 * @param {string} folderId - ID de la carpeta
 * @returns {Promise<Array>} Array de archivos con { id, name, mimeType, size, webViewLink, webContentLink }
 */
export async function listarArchivos(folderId) {
  try {
    console.log('📋 Listando archivos en carpeta:', folderId);
    
    const drive = getDriveClient();

    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'files(id, name, mimeType, size, webViewLink, webContentLink, modifiedTime)',
      orderBy: 'modifiedTime desc',
    });

    const files = response.data.files || [];
    console.log(`✅ Se encontraron ${files.length} archivos`);
    
    return files;
  } catch (error) {
    console.error('❌ Error listando archivos:', error.message);
    console.error('❌ Stack:', error.stack);
    if (error.response) {
      console.error('❌ Response data:', error.response.data);
    }
    throw error;
  }
}

/**
 * Busca una carpeta por nombre dentro de otra carpeta
 * @param {string} nombre - Nombre de la carpeta a buscar
 * @param {string} parentFolderId - ID de la carpeta padre
 * @returns {Promise<Object|null>} { id, name } o null si no existe
 */
export async function buscarCarpetaPorNombre(nombre, parentFolderId) {
  try {
    const drive = getDriveClient();

    const response = await drive.files.list({
      q: `'${parentFolderId}' in parents and name='${nombre}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
    });

    return response.data.files && response.data.files.length > 0
      ? { id: response.data.files[0].id, name: response.data.files[0].name }
      : null;
  } catch (error) {
    console.error('❌ Error buscando carpeta por nombre:', error.message);
    throw error;
  }
}

/**
 * Sube un archivo a Google Drive
 * @param {Buffer} fileBuffer - Contenido del archivo
 * @param {string} nombre - Nombre del archivo
 * @param {string} mimeType - Tipo MIME del archivo
 * @param {string} folderId - ID de la carpeta destino
 * @returns {Promise<Object>} { id, name, mimeType, size, webViewLink, webContentLink }
 */
export async function subirArchivo(fileBuffer, nombre, mimeType, folderId) {
  try {
    console.log('📤 Subiendo archivo:', nombre);
    console.log('📤 Tipo:', mimeType);
    console.log('📤 Carpeta destino:', folderId);
    
    const drive = getDriveClient();

    // Convertir Buffer a Stream
    const stream = Readable.from(fileBuffer);

    const media = {
      mimeType,
      body: stream,
    };

    const fileMetadata = {
      name: nombre,
      parents: [folderId],
    };

    const file = await drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: 'id, name, mimeType, size, webViewLink, webContentLink',
    });

    console.log('✅ Archivo subido correctamente:', file.data.name);

    return {
      id: file.data.id,
      name: file.data.name,
      mimeType: file.data.mimeType,
      size: file.data.size ? parseInt(file.data.size) : null,
      webViewLink: file.data.webViewLink,
      webContentLink: file.data.webContentLink,
    };
  } catch (error) {
    console.error('❌ Error subiendo archivo:', error.message);
    console.error('❌ Stack:', error.stack);
    if (error.response) {
      console.error('❌ Response data:', error.response.data);
    }
    throw error;
  }
}

/**
 * Elimina un archivo de Google Drive (mueve a papelera)
 * @param {string} fileId - ID del archivo
 * @returns {Promise<void>}
 */
export async function eliminarArchivo(fileId) {
  try {
    console.log('🗑️ Eliminando archivo:', fileId);
    
    const drive = getDriveClient();

    await drive.files.delete({
      fileId,
    });

    console.log('✅ Archivo eliminado correctamente');
  } catch (error) {
    console.error('❌ Error eliminando archivo:', error.message);
    console.error('❌ Stack:', error.stack);
    if (error.response) {
      console.error('❌ Response data:', error.response.data);
    }
    throw error;
  }
}

/**
 * Obtiene información de un archivo en Drive
 * @param {string} fileId - ID del archivo
 * @returns {Promise<Object>} Información del archivo
 */
export async function obtenerArchivo(fileId) {
  try {
    console.log('📄 Obteniendo archivo:', fileId);
    
    const drive = getDriveClient();

    const file = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType, size, webViewLink, webContentLink, modifiedTime',
    });

    console.log('✅ Archivo obtenido:', file.data.name);

    return {
      id: file.data.id,
      name: file.data.name,
      mimeType: file.data.mimeType,
      size: file.data.size ? parseInt(file.data.size) : null,
      webViewLink: file.data.webViewLink,
      webContentLink: file.data.webContentLink,
    };
  } catch (error) {
    console.error('❌ Error obteniendo archivo:', error.message);
    console.error('❌ Stack:', error.stack);
    if (error.response) {
      console.error('❌ Response data:', error.response.data);
    }
    throw error;
  }
}

