# Sistema de Adjuntos - Google Drive

El sistema de adjuntos permite gestionar archivos vinculados a Clientes y Casos mediante integración con Google Drive.

## 📋 Características

- ✅ Subida de archivos a Google Drive
- ✅ Vinculación de carpetas existentes
- ✅ Sincronización con archivos ya existentes en Drive
- ✅ Listado de adjuntos desde la base de datos
- ✅ Visualización y descarga de archivos
- ✅ Eliminación de adjuntos (baja lógica)
- ✅ Estructura de carpetas organizada por Cliente y Caso

## 🏗️ Arquitectura

### Base de Datos

**Modelo Adjunto:**
- `scope`: CLIENTE o CASO
- `scopeId`: ID del cliente o caso
- Metadatos del archivo (nombre, tipo, tamaño)
- Información de Google Drive (fileId, folderId, links)

**Campos agregados:**
- `Cliente.driveFolderId`: Carpeta raíz del cliente en Drive
- `Caso.driveFolderId`: Carpeta del caso en Drive
- `Caso.numeroDrive`: Número correlativo (01, 02, 03...)

### Estructura de Carpetas

```
LexManager/                    ← Carpeta raíz configurada
 ├── Pérez, Juana/             ← Carpeta del Cliente
 │   ├── 01 - Divorcio/        ← Carpeta del Caso
 │   ├── 02 - Alimentos/
 │   └── archivo.pdf            ← Archivos del cliente
 └── Gómez, Mario/
     └── 01 - Cobro de pesos/
```

## ⚙️ Configuración

### Variables de Entorno

Agregar al `.env`:

```env
# Google Drive
DRIVE_ROOT_FOLDER_ID=<id_carpeta_raiz_LexManager>

# Credenciales de Google OAuth
GOOGLE_CLIENT_ID=<client_id>
GOOGLE_CLIENT_SECRET=<client_secret>
GOOGLE_REFRESH_TOKEN=<refresh_token>
```

### Obtener Credenciales

1. Crear proyecto en [Google Cloud Console](https://console.cloud.google.com/)
2. Habilitar Google Drive API
3. Crear credenciales OAuth 2.0
4. Obtener refresh_token mediante [oauth2l](https://github.com/google/oauth2l)

## 🚀 Uso

### Crear Carpeta de Cliente

```bash
POST /api/drive/clientes/:id/create
```

Crea la carpeta "Apellido, Nombre" en Drive y guarda el ID en BD.

### Crear Carpeta de Caso

```bash
POST /api/drive/casos/:id/create
```

Crea la carpeta "NN - Carátula" dentro del cliente (con numeración correlativa).

### Subir Archivo

```bash
POST /api/adjuntos/upload
Content-Type: multipart/form-data

file: <archivo>
scope: CLIENTE|CASO
scopeId: <id>
```

### Listar Adjuntos

```bash
GET /api/adjuntos?scope=CLIENTE&scopeId=8
```

### Sincronizar con Drive

```bash
GET /api/adjuntos/indexar?scope=CLIENTE&scopeId=8
```

Indexa archivos existentes en Drive que no están en BD.

### Eliminar Adjunto

```bash
DELETE /api/adjuntos/:id
```

Mueve a papelera en Drive y marca como eliminado en BD.

## 📁 Frontend

### Componentes

- `ClienteAdjuntos`: Muestra adjuntos de un cliente
- `CasoAdjuntos`: Muestra adjuntos de un caso

### Características

- Botón "Subir archivo" con validación de tipos
- Botón "Actualizar desde Drive" para sincronizar
- Tabla con lista de archivos
- Acciones: Ver, Descargar, Eliminar

## 🔒 Permisos y Límites

- **Tipos permitidos**: PDF, JPG, PNG, DOCX, XLSX, ZIP
- **Tamaño máximo**: 50 MB por archivo
- **Visibilidad**: Privada (no compartida por enlace)
- **Autenticación**: Requiere usuario autenticado

## 📝 Notas Técnicas

- Usa `googleapis` para integración con Drive
- Almacenamiento en memoria con `multer`
- Baja lógica (no se elimina físicamente)
- Los archivos se almacenan en Drive, BD solo guarda metadatos
- Carpetas no se renombran si cambia el nombre/carátula

## 🐛 Solución de Problemas

### Error "DRIVE_ROOT_FOLDER_ID no configurado"

Verificar que la variable de entorno esté configurada.

### Error de autenticación

Verificar credenciales de Google OAuth y refresh token válido.

### No aparecen archivos en Drive

Usar "Actualizar desde Drive" para indexar archivos existentes.

### No se puede subir archivo

Verificar que el cliente/caso tenga carpeta creada en Drive.

## ✅ Estado Actual

- ✅ Backend implementado
- ✅ Frontend implementado
- ⏳ Configuración de variables de entorno pendiente
- ⏳ Pruebas de integración pendientes

