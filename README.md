# Sistema LEX - Gestión Legal

Sistema de gestión para estudios jurídicos desarrollado con Node.js/Express (backend) y React (frontend).

## Estructura del Proyecto

```
lex/
├── backend/          # API REST con Express y Prisma
├── frontend/         # Aplicación React con Vite
└── README.md
```

## Tecnologías

### Backend
- Node.js + Express
- Prisma ORM
- PostgreSQL
- JWT Authentication
- WhatsApp Web.js
- Google Drive API

### Frontend
- React 19
- Material-UI (MUI)
- React Router
- Axios
- React Query

## Configuración

### Backend
1. Instalar dependencias: `cd backend && npm install`
2. Configurar variables de entorno en `.env`
3. Ejecutar migraciones: `npm run prisma:migrate`
4. Generar cliente Prisma: `npm run prisma:gen`
5. Iniciar servidor: `npm run dev` o `npm start`

### Frontend
1. Instalar dependencias: `cd frontend && npm install`
2. Configurar variables de entorno si es necesario
3. Iniciar desarrollo: `npm run dev`
4. Build para producción: `npm run build`

## Variables de Entorno

El archivo `.env` debe contener (no incluido en el repositorio):
- `DATABASE_URL`: URL de conexión a PostgreSQL
- `JWT_SECRET`: Secreto para firmar tokens JWT
- Variables de Google Drive (si se usa OAuth)
- Otras configuraciones específicas del entorno

## Notas

- Los archivos sensibles (`.env`, `credentials.json`, `whatsapp-session/`) están excluidos del repositorio
- Las dependencias (`node_modules/`) no se incluyen en el repositorio

