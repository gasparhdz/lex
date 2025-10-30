# Guía de Configuración - Google Drive

Esta guía explica cómo configurar la integración con Google Drive para el sistema de adjuntos.

## 🎯 Método Recomendado: Cuenta de Servicio

### Paso 1: Crear Proyecto en Google Cloud

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Anota el nombre del proyecto

### Paso 2: Habilitar Google Drive API

1. En la barra de búsqueda, busca "Google Drive API"
2. Haz clic en "HABILITAR"
3. Espera a que se habilite (puede tardar unos segundos)

### Paso 3: Crear Cuenta de Servicio

1. Ve a **APIs y servicios** → **Credenciales** (menú lateral)
2. Haz clic en **+ CREAR CREDENCIALES**
3. Selecciona **Cuenta de servicio**
4. Completa:
   - **Nombre**: `lex-manager-drive`
   - **ID**: se genera automáticamente
   - **Descripción**: `Cuenta de servicio para LexManager Drive Integration`
5. Haz clic en **Crear y continuar**
6. En **Rol**, selecciona "Editor" o no asignes ningún rol (no es necesario)
7. Haz clic en **Continuar**
8. Haz clic en **Listo**

### Paso 4: Crear y Descargar Credenciales

1. Busca la cuenta de servicio que acabas de crear en la lista
2. Haz clic en ella
3. Ve a la pestaña **CLAVES**
4. Haz clic en **AGREGAR CLAVE** → **Crear nueva clave**
5. Selecciona **JSON** y haz clic en **Crear**
6. Se descargará automáticamente un archivo JSON

### Paso 5: Configurar el Archivo de Credenciales

1. Renombra el archivo descargado a `credentials.json`
2. Mueve el archivo a la carpeta `backend/`
3. Tu estructura debería ser:
   ```
   backend/
     └── credentials.json  ← Aquí
   ```

### Paso 6: Compartir Carpeta con la Cuenta de Servicio

1. Crea una carpeta en Drive llamada "LexManager" (o la que prefieras)
2. Haz clic derecho en la carpeta → **Compartir**
3. Pega el **email de la cuenta de servicio** (está en el archivo JSON, campo `client_email`)
   - Ejemplo: `lex-manager-drive@mi-proyecto.iam.gserviceaccount.com`
4. Da permisos de **Editor** o **Administrador**
5. Haz clic en **Enviar**

### Paso 7: Configurar Variable de Entorno

1. En el archivo `.env` del backend, agrega:
   ```env
   DRIVE_ROOT_FOLDER_ID=<id_de_la_carpeta>
   ```

2. Para obtener el ID de la carpeta:
   - Abre la carpeta en Drive
   - La URL será algo como: `https://drive.google.com/drive/folders/1ABC123...`
   - El ID es la parte después de `folders/`: `1ABC123...`

### Paso 8: Probar la Conexión

1. Reinicia el backend
2. Verás en la consola: `✅ Usando cuenta de servicio desde credentials.json`
3. Prueba crear una carpeta de cliente desde el frontend

## 🔒 Seguridad

### ⚠️ IMPORTANTE: No subir credentials.json a Git

El archivo `credentials.json` ya está en `.gitignore`, pero verifica que:

1. No esté en el repositorio
2. No se suba por accidente
3. Se mantenga local y seguro

### Alternativa: Variables de Entorno

Si preferís no usar el archivo `credentials.json`, podés configurar las variables:

```env
GOOGLE_CLIENT_ID=<tu_client_id>
GOOGLE_CLIENT_SECRET=<tu_client_secret>
GOOGLE_REFRESH_TOKEN=<tu_refresh_token>
```

**Nota**: Usar cuenta de servicio es más simple y seguro para aplicaciones de servidor.

## 📋 Resumen de Variables

### Método 1: Cuenta de Servicio (Recomendado)
```env
DRIVE_ROOT_FOLDER_ID=<id_carpeta_lexmanager>
```
+ Archivo `backend/credentials.json` descargado

### Método 2: OAuth 2.0
```env
DRIVE_ROOT_FOLDER_ID=<id_carpeta_lexmanager>
GOOGLE_CLIENT_ID=<client_id>
GOOGLE_CLIENT_SECRET=<client_secret>
GOOGLE_REFRESH_TOKEN=<refresh_token>
```

## ✅ Verificación

Para verificar que todo funciona:

1. Iniciá el backend
2. En el frontend, andá a un cliente
3. Tab "Adjuntos"
4. Si no tiene carpeta, hacé clic en **"Crear carpeta"**
5. Debería crearse la carpeta en Drive

## 🐛 Solución de Problemas

### Error: "The caller does not have permission"
- Verificá que compartiste la carpeta con el email de la cuenta de servicio
- Revisá que los permisos sean de Editor o Administrador

### Error: "File not found"
- Verificá que el `DRIVE_ROOT_FOLDER_ID` sea correcto
- Revisá que la carpeta exista y sea accesible

### Error: "Invalid credentials"
- Verificá que el archivo `credentials.json` esté en `backend/`
- Revisá que no esté corrompido
- Intentá descargar las credenciales nuevamente

## 📖 Más Información

- [Documentación de Google Drive API](https://developers.google.com/drive/api/v3/about-auth)
- [Cuentas de Servicio](https://cloud.google.com/iam/docs/service-accounts)
- [Scopes de Drive API](https://developers.google.com/drive/api/v3/about-auth#OAuth2Authorizing)

