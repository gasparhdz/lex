# Sistema de Recordatorios

El sistema envía recordatorios automáticos por **email y WhatsApp** para eventos y tareas.

## Configuración

### 1. Variables de Entorno

Agrega estas variables a tu archivo `.env`:

```bash
# Configuración SMTP para envío de emails
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-email@gmail.com
SMTP_PASS=tu-app-password

# Configuración Twilio para WhatsApp (OPCIONAL)
TWILIO_ACCOUNT_SID=tu_account_sid
TWILIO_AUTH_TOKEN=tu_auth_token
TWILIO_WHATSAPP_FROM=+14155238886
```

### 2. Gmail Setup

Si usas Gmail, necesitas generar un "App Password":

1. Ve a tu cuenta de Google
2. Seguridad → Verificación en dos pasos (debe estar activada)
3. Contraseñas de aplicaciones → Generar nueva
4. Usa esa contraseña en `SMTP_PASS`

### 3. Otros proveedores SMTP

Para otros proveedores de email:

- **Outlook**: `smtp.live.com`, puerto `587`
- **SendGrid**: Configura tu API key
- **AWS SES**: Configura tus credenciales

## Uso

### Envío Automático

El sistema ejecuta automáticamente el envío de recordatorios todos los días a las **9:00 AM**.

Puedes cambiar la hora modificando la expresión cron en `src/server.js`:

```javascript
cron.schedule('0 9 * * *', ...) // Todos los días a las 9:00 AM
```

Algunos ejemplos:
- `'0 8 * * *'` - Todos los días a las 8:00 AM
- `'0 9 * * 1-5'` - Lunes a Viernes a las 9:00 AM
- `'0 */2 * * *'` - Cada 2 horas

### Envío Manual

También puedes ejecutar manualmente el envío de recordatorios:

```bash
# POST a /api/recordatorios/enviar
curl -X POST http://localhost:4000/api/recordatorios/enviar \
  -H "Authorization: Bearer TU_TOKEN"
```

## Lógica del Sistema

### Eventos

El sistema envía recordatorios para eventos cuando:
- `recordatorio` está dentro del rango del día actual (00:00 - 23:59)
- `recordatorioEnviado = false`
- `activo = true`

El email se envía a: **El email del cliente asociado al evento**

### Tareas

El sistema envía recordatorios para tareas cuando:
- `recordatorio` está dentro del rango del día actual
- `recordatorioEnviado = false`
- `completada = false`
- `activo = true`

El email se envía a (en orden de prioridad):
1. **El email del usuario asignado** (si existe)
2. **El email del cliente asociado** (si no hay usuario asignado)

## Emails HTML

Los emails incluyen:
- **Eventos**: Tipo, fecha/hora, ubicación (si existe), descripción
- **Tareas**: Título, cliente, caso, fecha límite, prioridad, descripción

## Monitoreo

Los logs del servidor mostrarán:

```
[YYYY-MM-DD HH:mm:ss] Iniciando envío de recordatorios...
Encontrados X eventos y Y tareas para recordar
✓ Recordatorio de evento 123 enviado a cliente@example.com
✓ Recordatorio de tarea 456 enviado a usuario@example.com
Proceso finalizado. Eventos: 5/5, Tareas: 3/3
```

### 4. WhatsApp (Gratis con whatsapp-web.js)

El sistema **usa WhatsApp Web de forma gratuita** (no requiere Twilio ni WhatsApp Business API).

**Primera vez:**
1. Inicia el backend
2. Verás un código QR en la consola
3. Escanéalo con tu WhatsApp desde el teléfono
4. ✅ **¡Listo!** La sesión queda guardada y no necesitarás reescanear

**Sesión persistente:**
- La sesión se guarda en `./whatsapp-session/`
- Se mantiene activa incluso si reinicias el servidor
- Solo necesitas escanear el QR **UNA VEZ**

**Para más detalles, ver:** [WHATSAPP.md](./WHATSAPP.md)

## Uso

### Envío Automático

El sistema ejecuta automáticamente el envío de recordatorios todos los días a las **9:00 AM**.

Puedes cambiar la hora modificando la expresión cron en `src/server.js`:

```javascript
cron.schedule('0 9 * * *', ...) // Todos los días a las 9:00 AM
```

Algunos ejemplos:
- `'0 8 * * *'` - Todos los días a las 8:00 AM
- `'0 9 * * 1-5'` - Lunes a Viernes a las 9:00 AM
- `'0 */2 * * *'` - Cada 2 horas

### Envío Manual

También puedes ejecutar manualmente el envío de recordatorios:

```bash
# POST a /api/recordatorios/enviar
curl -X POST http://localhost:4000/api/recordatorios/enviar \
  -H "Authorization: Bearer TU_TOKEN"
```

## Lógica del Sistema

### Eventos

El sistema envía recordatorios para eventos cuando:
- `recordatorio` está dentro del rango del día actual (00:00 - 23:59)
- `recordatorioEnviado = false`
- `activo = true`

**El recordatorio se envía por:**
- 📧 **Email**: Al email del cliente asociado al evento
- 📱 **WhatsApp**: Al teléfono del cliente (si está configurado Twilio)

### Tareas

El sistema envía recordatorios para tareas cuando:
- `recordatorio` está dentro del rango del día actual
- `recordatorioEnviado = false`
- `completada = false`
- `activo = true`

**El recordatorio se envía por:**
- 📧 **Email**: Al email del usuario asignado (prioridad) o del creador (fallback)
- 📱 **WhatsApp**: Al teléfono del usuario asignado (prioridad) o del creador (fallback) si está configurado

## Emails y Mensajes

### Emails HTML

Los emails incluyen:
- **Eventos**: Tipo, fecha/hora, ubicación (si existe), descripción
- **Tareas**: Título, cliente, caso, fecha límite, prioridad, descripción

### WhatsApp

Los mensajes de WhatsApp se envían con formato markdown:
- **Eventos**: Con emoji 📅, titulo, descripción, cliente, expediente, fecha
- **Tareas**: Con emoji 📌, título, cliente, expediente, fecha límite, descripción
- Usa *negrita* para destacar etiquetas

## Monitoreo

Los logs del servidor mostrarán:

```
[YYYY-MM-DD HH:mm:ss] Iniciando envío de recordatorios...
Encontrados X eventos y Y tareas para recordar
✓ Recordatorio de evento 123 enviado
  📧 Email enviado a cliente@example.com
  📱 WhatsApp enviado a +5491112345678
✓ Recordatorio de tarea 456 enviado
  📧 Email enviado a usuario@example.com
Proceso finalizado. Eventos: 5/5, Tareas: 3/3
```

## Estado Actual

- ✅ **Email**: Configurado y funcionando
- ✅ **WhatsApp**: Integrado con whatsapp-web.js (gratis)
- ✅ **Cron**: Ejecuta cada minuto
- ✅ **Templates**: Personalizados para eventos y tareas
- ✅ **Destinatarios**: Solo usuarios internos (nunca clientes)

## Próximas Mejoras

- [ ] Soporte para recordatorios múltiples (1 día antes, 3 días antes, etc.)
- [ ] Personalización de templates de email y WhatsApp
- [ ] Panel de configuración de recordatorios en el frontend
- [ ] Notificaciones push en la aplicación
- [ ] Configuración de horarios personalizados por usuario

