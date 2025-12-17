// src/server.js
// Silenciar mensajes de dotenv antes de cargar
const originalLog = console.log;
const originalInfo = console.info;
const filterDotenv = (...args) => {
  const msg = args[0]?.toString?.() || '';
  if (msg.includes('[dotenv@')) return;
  originalLog(...args);
};

console.log = filterDotenv;
console.info = filterDotenv;

import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pino from 'pino-http';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth.routes.js';
import usuarioRoutes from './routes/usuario.routes.js';
import clienteRoutes from './routes/cliente.routes.js';
import casoRoutes from './routes/caso.routes.js';
import parametroRoutes from './routes/parametro.routes.js';
import localidadRoutes from './routes/localidad.routes.js';
import eventoRoutes from './routes/evento.routes.js';
import tareaRoutes from './routes/tarea.routes.js';
import agendaRoutes from './routes/agenda.routes.js';
import valorJusRoutes from './routes/valorjus.routes.js';
import dashboardRoutes from "./routes/dashboard.routes.js";
import finanzasRouter from './routes/finanzas/index.js';
import paisRoutes from './routes/pais.routes.js';
import provinciaRoutes from './routes/provincia.routes.js';
import codigopostalRoutes from './routes/codigopostal.routes.js';
import recordatorioRoutes from './routes/recordatorio.routes.js';
import driveRoutes from './routes/drive.routes.js';
import adjuntoRoutes from './routes/adjunto.routes.js';

import { errorHandler } from './middlewares/error.js';
import { enviarRecordatorios } from './controllers/recordatorio.controller.js';
import { initializeWhatsApp, destroyWhatsApp } from './utils/whatsapp.js';
import cron from 'node-cron';

const ALLOWED = [
  'http://localhost:5173',
  'http://192.168.100.183:5173',
];

const app = express();
app.use(helmet());

// CORS
app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    if (ALLOWED.includes(origin)) return cb(null, true);
    return cb(new Error('CORS not allowed'));
  },
  credentials: false, // usás Bearer, no cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600,
}));

app.use(express.json({ limit: '10mb' }));
app.use(pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'warn', // Solo warnings y errores en dev
  redact: {
    paths: ['req.headers.authorization'],
    censor: '[REDACTED]',
  },
}));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // máximo 1000 requests por IP en la ventana de tiempo (aumentado para desarrollo)
  message: 'Demasiadas solicitudes desde esta IP, intentá de nuevo en unos minutos.',
  standardHeaders: true, // Retornar rate limit info en headers
  legacyHeaders: false, // Deshabilitar headers antiguos
  // No aplicar rate limiting en desarrollo local
  skip: (req) => {
    const devIPs = ['127.0.0.1', '::1', '192.168.100.183', 'localhost'];
    const ip = req.ip || req.connection.remoteAddress;
    return devIPs.some(devIP => ip === devIP || ip?.includes(devIP));
  },
});

app.use('/api/', limiter);

app.get('/healthz', (_req, res) => res.json({ ok: true }));

// Rutas base
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/clientes', clienteRoutes);
app.use('/api/casos', casoRoutes);
app.use('/api/parametros', parametroRoutes);
app.use('/api/localidades', localidadRoutes);
app.use('/api/agenda', agendaRoutes);
app.use('/api/eventos', eventoRoutes);
app.use('/api/tareas', tareaRoutes);
app.use('/api/valorjus', valorJusRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use('/api/finanzas', finanzasRouter);
app.use('/api/paises', paisRoutes);
app.use('/api/provincias', provinciaRoutes);
app.use('/api/codigospostales', codigopostalRoutes);
app.use('/api/recordatorios', recordatorioRoutes);
app.use('/api/drive', driveRoutes);
app.use('/api/adjuntos', adjuntoRoutes);

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => console.log(`API up on ${PORT}`));

// Inicializar WhatsApp (de forma asíncrona para no bloquear el servidor)
console.log('🔌 Iniciando WhatsApp...');
setTimeout(() => {
  try {
    initializeWhatsApp();
  } catch (error) {
    console.error('⚠️ Error inicializando WhatsApp:', error.message);
    console.log('ℹ️ WhatsApp no disponible, pero el sistema seguirá funcionando con email solamente');
  }
}, 2000); // Espera 2 segundos para que el servidor termine de iniciarse

// Configurar cron job para enviar recordatorios automáticamente
// Se ejecuta cada minuto
cron.schedule('*/1 * * * *', async () => {
  console.log('Ejecutando envío automático de recordatorios...');
  try {
    await enviarRecordatorios(null, null);
    console.log('✓ Recordatorios enviados exitosamente');
  } catch (error) {
    console.error('✗ Error en cron de recordatorios:', error);
  }
}, {
  scheduled: true,
  timezone: 'America/Argentina/Buenos_Aires'
});

console.log('Cron de recordatorios configurado (se ejecuta cada 1 minuto)');

// Manejo limpio de cierre del servidor
process.on('SIGINT', async () => {
  console.log('\n\n👋 Cerrando servidor de forma limpia...');
  try {
    await destroyWhatsApp();
  } catch (error) {
    console.error('Error al cerrar WhatsApp:', error);
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n\n👋 Cerrando servidor de forma limpia (SIGTERM)...');
  try {
    await destroyWhatsApp();
  } catch (error) {
    console.error('Error al cerrar WhatsApp:', error);
  }
  process.exit(0);
});
