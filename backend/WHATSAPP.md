# Sistema de WhatsApp - whatsapp-web.js

El sistema usa **whatsapp-web.js** para enviar mensajes de WhatsApp de forma gratuita, conectándose a WhatsApp Web.

## 🚀 Configuración Inicial

### 1. Primera vez que ejecutas el backend

Al iniciar el servidor, verás un código QR en la consola:

```
📱 Escanea este código QR con WhatsApp:
═══════════════════════════════════
████████████████████████████████
████████████████████████████████
████████████████████████████████
═══════════════════════════════════
```

**Pasos:**
1. Abre WhatsApp en tu teléfono
2. Ve a Configuración → Dispositivos vinculados → Vincular un dispositivo
3. Escanea el código QR que aparece en la consola
4. ✅ **¡Listo!** La sesión queda guardada y no necesitarás volver a escanear

### 2. Sesión persistente (fuera del repo)

La sesión se guarda **fuera del repositorio** para evitar problemas:

- **Windows**: `C:/lex-wa-session`
- **Linux/Mac**: `/var/lib/lex-wa-session`

**⚠️ IMPORTANTE:**
- La sesión es **persistente** y está fuera del repo
- Solo necesitas escanear el QR **UNA VEZ**
- Nodemon está configurado para **ignorar** esta carpeta
- La sesión **no se borra** al desconectarse (solo se re-inicializa)

## 📱 Uso

### Envío automático de recordatorios

El sistema envía recordatorios por **WhatsApp** además de email cuando:
- El usuario tiene teléfono configurado (`usuario.telefono`)
- WhatsApp está conectado y listo

### Formato de números

Los números deben incluir el código de país:

**Ejemplos:**
- Argentina: `+5491112345678`
- Con el `+` al principio
- Código de país: `54` (Argentina)
- Número sin el `0` inicial

## 🛠️ Funciones del módulo

### `sendWhatsApp(to, message)`

Envía un mensaje de WhatsApp.

```javascript
import { sendWhatsApp } from '../utils/whatsapp.js';

const result = await sendWhatsApp('+5491112345678', 'Hola! Este es un mensaje de prueba');
console.log(result);
// { success: true, messageId: 'true_xxx...', to: '+5491112345678' }
```

### `getWhatsAppStatus()`

Obtiene el estado de la conexión.

```javascript
import { getWhatsAppStatus } from '../utils/whatsapp.js';

const status = getWhatsAppStatus();
console.log(status);
// {
//   isReady: true,
//   isConnected: true,
//   isInitialized: true,
//   sessionPath: './whatsapp-session'
// }
```

## 📋 Estados y manejo de errores

### Estados de conexión

- **`isReady`**: true cuando WhatsApp está listo para enviar mensajes
- **`isConnected`**: true cuando hay una sesión activa
- **`isInitialized`**: true cuando el cliente fue inicializado

### Reconexión automática con backoff exponencial

Si la conexión se cae, el sistema intentará reconectarse automáticamente con **backoff exponencial** (2s → 4s → 8s → 16s → 32s, máx 60s).

**Logs típicos:**
```
⚠️ WhatsApp desconectado. Razón: CONNECTION_LOST
🔄 Reintentando en 2000ms con backoff exponencial...
🔄 Re-inicializando cliente...
✅ WhatsApp listo para enviar mensajes!
```

**Características del sistema:**
- ✅ **Singleton pattern**: Una sola instancia del cliente
- ✅ **Nunca llama `logout()`**: Solo `reinitialize()` al desconectarse
- ✅ **Backoff exponencial**: Reintentos con delay creciente
- ✅ **Configuración endurecida**: `restartOnAuthFail`, `takeoverOnConflict`, `webVersionCache`

### Problemas comunes y soluciones

**1. "WhatsApp no está conectado"**
- Escanea el QR nuevamente
- Verifica que la sesión no se haya cerrado desde WhatsApp
- Revisa que el teléfono tenga conexión a Internet

**2. "Error de autenticación"**
- Borra la carpeta de sesión (`C:/lex-wa-session` en Windows)
- Reinicia el servidor y escanea el QR nuevamente

**3. "Sesión cerrada frecuentemente"**
- Verifica la configuración del teléfono (ver sección "Configuración del teléfono")
- Revisa que no tengas otra sesión Web abierta en otra PC
- Excluye la carpeta de sesión del antivirus/OneDrive/Indexado

**4. "Desconexiones constantes"**
- El sistema se reconecta automáticamente con backoff exponencial
- Si persiste, verifica la estabilidad de tu conexión a Internet

## 🔍 Logs del sistema

```
🔌 Iniciando WhatsApp...
📱 Escanea este código QR con WhatsApp:
[Código QR aquí]
✅ WhatsApp autenticado correctamente
✅ WhatsApp listo para enviar mensajes!
📤 Enviando mensaje a +5491112345678...
✅ Mensaje enviado correctamente a +5491112345678
```

## 📍 Dónde se guarda la sesión

La sesión se guarda **fuera del repositorio** para evitar conflictos:

**Windows:**
```
C:/lex-wa-session/
  ├── Default/
  │   ├── Cookies
  │   ├── Local Storage
  │   └── Session Storage
  └── auth_info_baileys/
      ├── creds.json      ← Credenciales de autenticación
      └── app-state.json  ← Estado de la sesión
```

**Linux:**
```
/var/lib/lex-wa-session/
  └── [misma estructura]
```

**⚠️ IMPORTANTE:**
- ✅ **Excluir del antivirus/OneDrive**: Evita bloqueos de archivos
- ✅ **Excluir del indexado**: Windows Search puede bloquear archivos
- ✅ NO borres esta carpeta a menos que tengas problemas graves
- ✅ NO subas esta carpeta a Git (ya está en .gitignore)
- ✅ La sesión es específica para tu servidor, no la muevas entre máquinas

## 📱 Configuración del teléfono

Para evitar desconexiones frecuentes, configura tu teléfono:

**WhatsApp Business:**
1. ✅ **Desactiva ahorro de batería** para WhatsApp Business
2. ✅ **Mantén multi-device activado** (necesario para WhatsApp Web)
3. ✅ **Datos/Wi-Fi estables**: Asegúrate de tener conexión constante
4. ❌ **NO abras otra sesión Web** en otra PC (expulsa a la actual)

**Windows (si la sesión está en C:/lex-wa-session):**
1. Excluye `C:/lex-wa-session` del **antivirus**
2. Excluye `C:/lex-wa-session` del **OneDrive** (si usas sincronización)
3. Excluye `C:/lex-wa-session` del **indexado de Windows Search**

## 🚨 Seguridad

- La sesión está vinculada a TU número de WhatsApp
- Solo TÚ puedes usar este número para enviar mensajes
- No uses tu número personal para producción (considera un número dedicado)

## 📝 Notas para producción

En el VPS (Ubuntu 22.04):

1. **Asegúrate de escanear el QR antes de cerrar la terminal**
   - Si cierras la terminal antes de escanear, el proceso de WhatsApp se detiene

2. **Usa PM2 o similar para mantener el proceso vivo**
   ```bash
   npm install -g pm2
   pm2 start npm --name "lex-backend" -- start
   pm2 save
   pm2 startup
   ```

3. **Para ver los logs en producción:**
   ```bash
   pm2 logs lex-backend
   ```

## 🔄 Reiniciar la sesión

Si necesitas reiniciar WhatsApp desde cero:

**Windows:**
```powershell
# Detener el servidor
pm2 stop lex-backend

# Borrar la sesión
Remove-Item -Recurse -Force C:/lex-wa-session

# Reiniciar
pm2 start lex-backend
pm2 logs lex-backend  # Ver los logs para escanear el QR
```

**Linux:**
```bash
# Detener el servidor
pm2 stop lex-backend

# Borrar la sesión
sudo rm -rf /var/lib/lex-wa-session

# Reiniciar
pm2 start lex-backend
pm2 logs lex-backend  # Ver los logs para escanear el QR
```

## ✅ Resumen de mejoras aplicadas

**Arquitectura:**
- ✅ **Singleton**: Una sola instancia del cliente (`getWaClient()`)
- ✅ **Nunca `logout()`**: Solo `reinitialize()` al desconectarse
- ✅ **Sesión fuera del repo**: `C:/lex-wa-session` (Windows) o `/var/lib/lex-wa-session` (Linux)
- ✅ **Nodemon configurado**: Ignora la carpeta de sesión para evitar reinicios innecesarios

**Robustez:**
- ✅ **Configuración endurecida**: `restartOnAuthFail`, `takeoverOnConflict`, `takeoverTimeoutMs: 0`
- ✅ **WebVersionCache**: `type: 'remote'` para evitar rupturas por cambios de Web
- ✅ **Backoff exponencial**: Reintentos con delay creciente (2s → 4s → 8s → 16s → 32s)

**Funcionalidad:**
- ✅ **Gratis**: No necesita Twilio ni WhatsApp Business API
- ✅ **Persistente**: La sesión se mantiene activa
- ✅ **Automático**: Integrado con el sistema de recordatorios
- ✅ **Reconexión inteligente**: Intenta reconectar con backoff si se cae
- ⚠️ **Requiere escanear QR** la primera vez

