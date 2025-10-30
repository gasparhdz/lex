# 📘 LexManager

Sistema completo de gestión jurídica con control de clientes, casos, finanzas, agenda, tareas, recordatorios y archivos adjuntos integrados con Google Drive.

## 🚀 Características Principales

- **👥 Gestión de Clientes y Casos**: Base de datos completa de clientes y sus casos jurídicos
- **💰 Finanzas**: Control de honorarios, ingresos, gastos y planes de pago con conversión a JUS
- **📅 Agenda**: Calendario de eventos con recordatorios automáticos
- **✅ Tareas**: Sistema de gestión de tareas con asignación y seguimiento
- **📧 Recordatorios**: Envío automático de recordatorios por email y WhatsApp
- **📎 Adjuntos**: Integración con Google Drive para archivos de clientes y casos
- **🔐 Autenticación**: Sistema JWT con roles y permisos granulares (RBAC)
- **📊 Dashboard**: Resúmenes y estadísticas en tiempo real
- **📈 Reportes**: Generación de reportes de finanzas y vencimientos

## 🛠️ Stack Tecnológico

### Backend
- **Node.js** + **Express 5**
- **PostgreSQL** + **Prisma ORM**
- **JWT** para autenticación
- **Nodemailer** para emails
- **WhatsApp Web.js** para recordatorios
- **Google Drive API** para adjuntos
- **Node-cron** para tareas programadas

### Frontend
- **React 19** + **Vite**
- **Material-UI (MUI)** para componentes
- **React Router** para navegación
- **React Query** para manejo de estado del servidor
- **React Hook Form** + **Joi** para validaciones
- **Date-fns** para manejo de fechas
- **FullCalendar** para agenda

## 📋 Requisitos Previos

- **Node.js** 18+ y npm
- **PostgreSQL** 14+
- **Google Cloud** cuenta (para adjuntos de Drive)
- **Gmail** cuenta (para emails - recomendado)
- **WhatsApp** activo (opcional, para recordatorios)

## 🔧 Instalación

### 1. Clonar el repositorio
```bash
git clone <url-del-repositorio>
cd lex
```

### 2. Configurar Backend

```bash
cd backend
npm install
```

#### Configurar Base de Datos
1. Crear base de datos PostgreSQL:
```sql
CREATE DATABASE lexmanager;
```

2. Copiar archivo de configuración:
```bash
cp .env.example .env
```

3. Editar `.env` con tus credenciales:
```env
DATABASE_URL="postgresql://usuario:password@localhost:5432/lexmanager?schema=public"
JWT_SECRET="tu_secret_jwt_muy_seguro"
PORT=4000
NODE_ENV=development
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu_email@gmail.com
SMTP_PASS=tu_contraseña_de_aplicacion
```

4. Ejecutar migraciones:
```bash
npx prisma migrate deploy
npx prisma generate
```

5. (Opcional) Poblar datos iniciales:
```bash
npm run seed
```

### 3. Configurar Frontend

```bash
cd ../frontend
npm install
```

### 4. Configurar Google Drive (Adjuntos)

Ver documentación completa: [backend/GUIDE_GOOGLE_DRIVE.md](backend/GUIDE_GOOGLE_DRIVE.md)

**Resumen rápido:**
1. Crear proyecto en Google Cloud Console
2. Habilitar Google Drive API
3. Crear cuenta de servicio
4. Descargar `credentials.json` a `backend/`
5. Crear carpeta en Drive llamada "LexManager"
6. Compartir carpeta con el email de la cuenta de servicio
7. Agregar `DRIVE_ROOT_FOLDER_ID` en `.env`

### 5. Configurar WhatsApp (Opcional)

Ver documentación completa: [backend/WHATSAPP.md](backend/WHATSAPP.md)

**Para deshabilitar:**
```env
WHATSAPP_DISABLED=true
```

## 🚀 Uso

### Iniciar Backend
```bash
cd backend
npm run dev
```

El servidor inicia en `http://localhost:4000`

### Iniciar Frontend
```bash
cd frontend
npm run dev
```

La aplicación abre en `http://localhost:5173`

### Credenciales por Defecto
Si ejecutaste `npm run seed`, usa:
- **Email**: `admin@lex.com`
- **Contraseña**: `admin123`

⚠️ **Cambiar inmediatamente en producción**

## 📁 Estructura del Proyecto

```
lex/
├── backend/              # API Node.js + Express
│   ├── prisma/          # Schema y migraciones de BD
│   ├── src/
│   │   ├── controllers/ # Lógica de negocio
│   │   ├── routes/      # Rutas de API
│   │   ├── middlewares/ # Auth, validación, RBAC
│   │   ├── utils/       # Utilidades (Drive, WhatsApp, etc.)
│   │   ├── services/    # Servicios (Email)
│   │   └── validators/  # Schemas de validación Joi
│   ├── .env.example     # Plantilla de variables de entorno
│   ├── GUIDE_GOOGLE_DRIVE.md
│   ├── WHATSAPP.md
│   └── RECORDATORIOS.md
│
├── frontend/            # Aplicación React
│   ├── src/
│   │   ├── api/        # Clientes HTTP
│   │   ├── auth/       # Context de autenticación
│   │   ├── components/ # Componentes reutilizables
│   │   ├── pages/      # Páginas principales
│   │   ├── theme/      # Tema MUI
│   │   └── utils/      # Utilidades
│   └── vite.config.js
│
└── README.md           # Este archivo
```

## 🔐 Autenticación y Permisos

El sistema usa **JWT** con 3 niveles de roles:

- **ADMIN**: Acceso total
- **ABOGADO**: Gestión de casos y clientes
- **ASISTENTE**: Lectura y tareas limitadas

Cada rol tiene permisos granulares por módulo (VER, CREAR, EDITAR, ELIMINAR).

## 📖 Módulos Principales

### Clientes
- Alta, baja y modificación de clientes
- Personas físicas y jurídicas
- Historial completo de modificaciones
- Notas y eventos relacionados

### Casos
- Gestión de casos asociados a clientes
- Estados (Activo, Cerrado, Archivado, etc.)
- Presupuesto y facturación
- Timeline de eventos

### Finanzas
- **Honorarios**: Acuerdos y vencimientos
- **Ingresos**: Cobros y aplicaciones
- **Gastos**: Gastos procesales
- **Planes de Pago**: Cuotas asociadas a honorarios
- Conversión automática JUS/ARS

### Agenda
- Calendario mensual/semanal
- Eventos de casos y clientes
- Recordatorios configurables
- Vista timeline

### Tareas
- Tareas asignadas a usuarios
- Estados (Pendiente, En Proceso, Completada)
- Prioridad y vencimientos
- Subtareas

### Adjuntos
- Integración con Google Drive
- Organización por cliente/caso
- Sincronización automática
- Subida desde múltiples pantallas

## 🧪 Desarrollo

### Scripts Backend
```bash
npm run dev      # Desarrollo con nodemon
npm start        # Producción
npm run prisma:gen    # Generar cliente Prisma
npm run seed     # Poblar BD con datos de prueba
```

### Scripts Frontend
```bash
npm run dev      # Desarrollo con Vite
npm run build    # Build de producción
npm run preview  # Preview del build
npm run lint     # Linter
```

## 📦 Producción

### Backend
```bash
# Usar PM2 o similar para mantener el proceso vivo
pm2 start npm --name "lex-backend" -- start
pm2 save
```

### Frontend
```bash
# Build de producción
npm run build

# Servir con nginx/apache
# Archivos en frontend/dist/
```

## 🐛 Solución de Problemas

Ver documentación específica:
- **Adjuntos**: [backend/GUIDE_GOOGLE_DRIVE.md](backend/GUIDE_GOOGLE_DRIVE.md)
- **WhatsApp**: [backend/WHATSAPP.md](backend/WHATSAPP.md)
- **Recordatorios**: [backend/RECORDATORIOS.md](backend/RECORDATORIOS.md)

## 📝 Notas Importantes

- **Seguridad**: Nunca subas `.env` o `credentials.json` a Git
- **Backups**: Configurar backups automáticos de PostgreSQL
- **WhatsApp**: El QR se escanea una sola vez, luego se mantiene la sesión
- **Drive**: La sesión se puede desvincular desde Google Cloud Console

## 📄 Licencia

ISC

## 👥 Contacto

Para soporte o consultas, contactar al desarrollador.

---

**Desarrollado con ❤️ para estudios jurídicos**

