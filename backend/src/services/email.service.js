import nodemailer from 'nodemailer';
import { sendWhatsApp as sendWhatsAppMessage } from '../utils/whatsapp.js';

// Configurar transporter de nodemailer
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true para 465, false para otros puertos
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Envía un email de recordatorio
 * @param {Object} options - Opciones del email
 * @param {string} options.to - Email del destinatario
 * @param {string} options.subject - Asunto del email
 * @param {string} options.text - Contenido del email (texto plano)
 * @param {string} options.html - Contenido del email (HTML, opcional)
 * @returns {Promise<Object>} Información del email enviado
 */
export async function sendEmail({ to, subject, text, html }) {
  try {
    const info = await transporter.sendMail({
      from: `Lexmanager <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html: html || text, // Si no hay HTML, usa el texto plano
    });

    return {
      success: true,
      messageId: info.messageId,
      response: info.response,
    };
  } catch (error) {
    console.error('Error enviando email:', error);
    throw {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Genera el HTML para un recordatorio de evento
 */
export function generateEventReminderHTML(evento) {
  const { descripcion, fechaInicio, ubicacion, tipo } = evento;
  
  return `
    <div style="font-family: Roboto, sans-serif; font-size:14px; color:#333;">
      <h2 style="color:#2c3e50;">📅 Recordatorio de evento</h2>
      <p>Tenés un evento próximo agendado:</p>
      <table style="border-collapse: collapse;">
        <tr><td style="padding: 4px 8px;"><strong>Descripción:</strong></td><td>${descripcion || '—'}</td></tr>
        <tr><td style="padding: 4px 8px;"><strong>Tipo:</strong></td><td>${tipo?.nombre || '—'}</td></tr>
        ${evento.cliente ? `<tr><td style="padding: 4px 8px;"><strong>Cliente:</strong></td><td>${evento.cliente.apellido || evento.cliente.razonSocial || '—'}</td></tr>` : ''}
        ${evento.caso ? `<tr><td style="padding: 4px 8px;"><strong>Expediente:</strong></td><td>${evento.caso.nroExpte || '—'}</td></tr>` : ''}
        <tr><td style="padding: 4px 8px;"><strong>Inicio:</strong></td><td>${new Date(fechaInicio).toLocaleString('es-AR')}</td></tr>
      </table>
      <p style="margin-top:12px;">Podés ver todos tus eventos en <strong>LexManager</strong>.</p>
    </div>
  `;
}

/**
 * Genera el HTML para un recordatorio de tarea
 */
export function generateTaskReminderHTML(tarea) {
  const { titulo, descripcion, fechaLimite, prioridad, cliente, caso } = tarea;
  
  return `
    <div style="font-family: Roboto, sans-serif; font-size:14px; color:#333;">
      <p>Tenés una tarea pendiente con los siguientes detalles:</p>
      <table style="border-collapse: collapse;">
        <tr><td style="padding: 4px 8px;"><strong>Título:</strong></td><td>${titulo}</td></tr>
        ${cliente ? `<tr><td style="padding: 4px 8px;"><strong>Cliente:</strong></td><td>${cliente.apellido || cliente.razonSocial || '—'}</td></tr>` : ''}
        ${caso ? `<tr><td style="padding: 4px 8px;"><strong>Expediente:</strong></td><td>${caso.nroExpte || '—'}</td></tr>` : ''}
        ${fechaLimite ? `<tr><td style="padding: 4px 8px;"><strong>Fecha límite:</strong></td><td>${new Date(fechaLimite).toLocaleString('es-AR')}</td></tr>` : ''}
      </table>
      <p style="margin-top:12px;">Por favor, revisá tu panel de tareas en <strong>LexManager</strong>.</p>
    </div>
  `;
}

/**
 * Obtiene el email del usuario y del cliente
 */
export function getEmailForUsuario(usuario) {
  return usuario.email;
}

export function getEmailForCliente(cliente) {
  return cliente.email;
}

/**
 * Obtiene el teléfono del cliente para WhatsApp
 */
export function getPhoneForCliente(cliente) {
  // Probar primero el celular, luego el fijo
  return cliente.telCelular || cliente.telFijo;
}

export function getPhoneForUsuario(usuario) {
  return usuario.telefono;
}

/**
 * Envía un mensaje por WhatsApp usando whatsapp-web.js
 * @param {string} to - Número de destino (ej: +5491123456789)
 * @param {string} body - Contenido del mensaje
 * @returns {Promise<Object>} Información del mensaje enviado
 */
export async function sendWhatsApp({ to, body }) {
  try {
    const result = await sendWhatsAppMessage(to, body);
    
    // Si el resultado indica que falló, no lanzar excepción pero loguear
    if (!result.success) {
      console.warn(`⚠️ WhatsApp no enviado a ${to}: ${result.error}`);
      return result;
    }
    
    return result;
  } catch (error) {
    console.error(`❌ Error enviando WhatsApp a ${to}:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Genera el texto para WhatsApp de un recordatorio de evento
 */
export function generateEventReminderWhatsApp(evento) {
  let texto = `📅 *Recordatorio de evento*\n\n`;
  texto += `*Tipo:* ${evento.tipo?.nombre || 'Sin tipo'}\n`;
  texto += `*Fecha:* ${new Date(evento.fechaInicio).toLocaleString('es-AR')}\n`;
  if (evento.cliente) {
    texto += `*Cliente:* ${evento.cliente.apellido || evento.cliente.razonSocial || '—'}\n`;
  }
  if (evento.caso) {
    texto += `*Expediente:* ${evento.caso.nroExpte}\n`;
  }
  if (evento.descripcion) {
    texto += `\n${evento.descripcion}\n`;
  }
  return texto;
}

/**
 * Genera el texto para WhatsApp de un recordatorio de tarea
 */
export function generateTaskReminderWhatsApp(tarea) {
  let texto = `📌 *Recordatorio de tarea*\n\n`;
  texto += `*Título:* ${tarea.titulo}\n`;
  if (tarea.cliente) {
    texto += `*Cliente:* ${tarea.cliente.apellido || tarea.cliente.razonSocial || '—'}\n`;
  }
  if (tarea.caso) {
    texto += `*Expediente:* ${tarea.caso.nroExpte}\n`;
  }
  if (tarea.fechaLimite) {
    texto += `*Fecha límite:* ${new Date(tarea.fechaLimite).toLocaleString('es-AR')}\n`;
  }
  if (tarea.descripcion) {
    texto += `\n${tarea.descripcion}\n`;
  }
  return texto;
}

