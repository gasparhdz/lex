# Quick Start - Google Drive

## Opción 1: Cuenta de Servicio (Más Simple) ⭐ RECOMENDADO

### 1. Descargar credenciales de cuenta de servicio

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Selecciona proyecto "lexmanager-drive-461421"
3. Ve a "APIs y servicios" → "Credenciales"
4. Crea una **"Cuenta de servicio"** (no OAuth)
5. Descarga las credenciales en formato JSON
6. Guarda el archivo como `backend/credentials.json`
7. El archivo debe tener este formato:
```json
{
  "type": "service_account",
  "project_id": "lexmanager-drive-461421",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----...",
  "client_email": "...@lexmanager-drive-461421.iam.gserviceaccount.com",
  ...
}
```

### 2. Crear carpeta en Drive

1. Abre Google Drive
2. Crea una carpeta llamada "LexManager"
3. **COMPARTE** la carpeta con el email de la cuenta de servicio (campo `client_email` del JSON)
4. Dale permisos de **Editor** o **Administrador**
5. Copia el ID de la carpeta desde la URL:
   - URL: `https://drive.google.com/drive/folders/1ABC123...`
   - ID: `1ABC123...` (la parte después de `folders/`)

### 3. Configurar variable de entorno

En `backend/.env`:
```env
DRIVE_ROOT_FOLDER_ID=1ABC123...  ← Pega el ID aquí
```

### 4. ¡Listo!

Reinicia el backend y probá crear carpetas desde el frontend.

---

## Opción 2: OAuth 2.0 (Tu archivo actual)

Si preferís usar OAuth (tu archivo actual), necesitás generar un refresh token. Esto es más complejo y **no es necesario** si usas cuenta de servicio.

---

## ¿Cuál usar?

- **Cuenta de servicio**: Más simple, más seguro, recomendado para aplicaciones de servidor
- **OAuth 2.0**: Más complejo, requiere flujo de autenticación de usuario

**Recomendación**: Usá cuenta de servicio (Opción 1) 😊

