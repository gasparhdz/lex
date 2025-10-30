import whatsappWeb from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';

const { Client, LocalAuth } = whatsappWeb;

/**
 * Cliente de WhatsApp global (Singleton)
 */
let whatsappClient = null;
let isReady = false;
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
let currentQR = null; // QR code actual para mostrar en el frontend
let linkedPhoneNumber = null; // Número vinculado (el que escaneó el QR)

// Sesión fuera del repo (según plataforma)
const SESSION_PATH = process.platform === 'win32' 
  ? 'C:/lex-wa-session'
  : '/var/lib/lex-wa-session';

/**
 * Obtiene la instancia única del cliente (Singleton pattern)
 */
export function getWaClient() {
  return whatsappClient;
}

/**
 * Inicializa el cliente de WhatsApp
 */
export function initializeWhatsApp() {
  if (whatsappClient) {
    console.log('⚠️ WhatsApp ya está inicializado');
    return whatsappClient;
  }

  // Verificar si WhatsApp Web está disponible (solo intentar en producción o si está habilitado)
  if (process.env.WHATSAPP_DISABLED === 'true') {
    console.log('ℹ️ WhatsApp deshabilitado por configuración');
    return null;
  }

  try {
    console.log('🔌 Inicializando WhatsApp...');
    console.log(`📁 Sesión guardada en: ${SESSION_PATH}`);

    whatsappClient = new Client({
      authStrategy: new LocalAuth({
        dataPath: SESSION_PATH,
        clientId: 'lexmanager',
      }),
      // Endurecer el cliente con opciones avanzadas
      restartOnAuthFail: true,
      takeoverOnConflict: true,
      takeoverTimeoutMs: 0,
      webVersionCache: {
        type: 'local',
      },
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-background-networking',
          '--disable-sync',
          '--disable-translate',
          '--hide-scrollbars',
          '--metrics-recording-only',
          '--mute-audio',
          '--no-default-browser-check',
          '--no-pings',
          '--disable-default-apps',
          '--disable-features=TranslateUI',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-breakpad',
          '--disable-component-extensions-with-background-pages',
          '--disable-ipc-flooding-protection',
          '--disable-renderer-backgrounding',
        ],
      },
    });

  // Event: QR Code
  whatsappClient.on('qr', (qr) => {
    currentQR = qr; // Guardar QR para el frontend
    console.log('📱 Escanea este código QR con WhatsApp:');
    qrcode.generate(qr, { small: true });
    console.log(`\n⚠️ IMPORTANTE: La sesión solo se establece UNA VEZ.`);
    console.log(`📁 Sesión guardada en: ${SESSION_PATH}`);
    console.log('💡 Tips:');
    console.log('   - Desactiva ahorro de batería para WhatsApp Business');
    console.log('   - Mantén multi-device activado');
    console.log('   - No abras otra sesión Web en otra PC');
  });

  // Event: Autenticado
  whatsappClient.on('authenticated', () => {
    console.log('✅ WhatsApp autenticado correctamente');
  });

  // Event: Listo para usar
  whatsappClient.on('ready', async () => {
    console.log('✅ WhatsApp listo para enviar mensajes!');
    isReady = true;
    isConnected = true;
    reconnectAttempts = 0; // Reset contador al reconectar exitosamente
    currentQR = null; // Limpiar QR cuando está conectado
    
    // Obtener el número vinculado (el que escaneó el QR)
    try {
      const info = whatsappClient.info;
      if (info && info.wid) {
        linkedPhoneNumber = info.wid.user; // Ej: "543476655720"
        console.log(`📱 Número vinculado a WhatsApp Web: +${linkedPhoneNumber}`);
      }
    } catch (error) {
      console.warn('⚠️ No se pudo obtener el número vinculado:', error.message);
    }
  });

  // Event: Sesión guardada
  whatsappClient.on('auth_failure', (msg) => {
    console.error('❌ Error de autenticación de WhatsApp:', msg);
    isReady = false;
    isConnected = false;
    attemptReconnect();
  });

  // Event: Desconectado - NO borrar sesión, solo re-initialize (nunca logout)
  whatsappClient.on('disconnected', (reason) => {
    console.log('⚠️ WhatsApp desconectado. Razón:', reason);
    isReady = false;
    isConnected = false;
    linkedPhoneNumber = null; // Limpiar número vinculado al desconectarse
    
    // NUNCA llamar logout() - solo reinitialize
    const delay = calculateBackoffDelay(reconnectAttempts);
    console.log(`🔄 Reintentando en ${delay}ms con backoff exponencial...`);
    
    setTimeout(() => {
      if (whatsappClient) {
        console.log('🔄 Re-inicializando cliente...');
        whatsappClient.initialize().catch((err) => {
          console.error('❌ Error al re-inicializar:', err.message);
          attemptReconnect();
        });
      } else {
        // Si el cliente fue destruido, crear uno nuevo
        whatsappClient = null;
        initializeWhatsApp();
      }
    }, delay);
  });
  
  // Event: Error (mejorado para no crashar el servidor)
  whatsappClient.on('error', (error) => {
    console.error('❌ Error de WhatsApp:', error.message || error);
    isReady = false;
    isConnected = false;
    // No crashear el servidor, solo marcar como desconectado
  });

    // Iniciar cliente
    whatsappClient.initialize().catch((error) => {
      console.error('❌ Error al inicializar WhatsApp:', error);
    });

    return whatsappClient;
  } catch (error) {
    console.error('❌ Error creando cliente de WhatsApp:', error);
    console.log('ℹ️ WhatsApp no disponible, el sistema continuará sin WhatsApp');
    whatsappClient = null;
    return null;
  }
}

/**
 * Calcula el delay exponencial para reintentos (backoff)
 */
function calculateBackoffDelay(attemptNumber) {
  // Backoff exponencial: 2s, 4s, 8s, 16s, 32s (max 60s)
  const baseDelay = 2000; // 2 segundos
  const delay = Math.min(baseDelay * Math.pow(2, attemptNumber), 60000);
  return delay;
}

/**
 * Intenta reconectar automáticamente con backoff exponencial
 */
function attemptReconnect() {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error('❌ Máximo de intentos de reconexión alcanzado');
    console.log('ℹ️ WhatsApp no disponible. El sistema continuará con email solamente.');
    reconnectAttempts = 0; // Reset después del máximo
    return;
  }

  reconnectAttempts++;
  const delay = calculateBackoffDelay(reconnectAttempts);
  console.log(`🔄 Intentando reconectar... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
  console.log(`⏱️ Delay: ${delay}ms (backoff exponencial)`);
  console.log('ℹ️ Mientras tanto, los recordatorios se enviarán por email.');

  setTimeout(() => {
    if (whatsappClient) {
      whatsappClient.initialize().catch((error) => {
        console.error('❌ Error al reconectar:', error.message);
        attemptReconnect(); // Continuar con el siguiente intento
      });
    } else {
      whatsappClient = null;
      initializeWhatsApp();
    }
  }, delay);
}

/**
 * Envía un mensaje por WhatsApp
 * @param {string} to - Número de destino (con código de país, ej: +5491123456789)
 * @param {string} message - Mensaje a enviar
 * @returns {Promise<Object>} Resultado del envío
 */
export async function sendWhatsApp(to, message) {
  try {
    // Usar getWaClient() para obtener el singleton
    const client = getWaClient();
    if (!client) {
      throw new Error('WhatsApp no está inicializado');
    }

    if (!isReady || !isConnected) {
      throw new Error('WhatsApp no está conectado. Verifica el estado de la sesión.');
    }

    // Formatear el número de destino
    const formattedNumber = to.startsWith('+') ? to : `+${to}`;
    
    // Normalizar para comparar (remover el +)
    const destinationNumber = formattedNumber.replace('+', '');
    const linkedNumber = linkedPhoneNumber?.replace('+', '') || null;
    
    // Detectar si se está enviando al mismo número vinculado
    if (linkedNumber && destinationNumber === linkedNumber) {
      console.warn(`⚠️ Intento de envío a número propio (${formattedNumber}). WhatsApp no notifica en este caso.`);
      console.warn(`⚠️ Simulando fallo para que se envíe email como fallback.`);
      return {
        success: false,
        error: 'No se puede enviar notificaciones a tu propio número de WhatsApp Web',
        isSelfMessage: true,
      };
    }
    
    console.log(`📤 Intentando enviar a: ${formattedNumber}...`);
    console.log(`🔍 Estado de WhatsApp: ready=${isReady}, connected=${isConnected}`);

    // Intentar primero con validación del número
    let chatId;
    try {
      const numberId = await client.getNumberId(formattedNumber);
      
      if (!numberId) {
        console.warn(`⚠️ El número ${formattedNumber} no está registrado en WhatsApp. Intentando enviar directamente...`);
        // Si getNumberId falla, intentar con el formato estándar
        chatId = `${formattedNumber.replace('+', '')}@c.us`;
      } else {
        console.log(`✅ Número válido en WhatsApp. JID: ${numberId._serialized}`);
        chatId = numberId._serialized;
      }
    } catch (getNumberIdError) {
      console.warn(`⚠️ Error al validar número con getNumberId: ${getNumberIdError.message}`);
      console.warn(`⚠️ Intentando enviar sin validación...`);
      // Fallback: usar el formato estándar
      chatId = `${formattedNumber.replace('+', '')}@c.us`;
    }

    // Enviar mensaje usando el cliente singleton
    // Nota: WhatsApp Web no puede forzar notificaciones push,
    // esas dependen del dispositivo y la app de WhatsApp
    const result = await client.sendMessage(chatId, message, {
      // Opcional: Puede ayudar en algunos casos, pero no garantiza notificación
      // Las notificaciones dependen del teléfono/usuario
    });

    console.log(`✅ Mensaje enviado correctamente a ${formattedNumber}`);
    
    return {
      success: true,
      messageId: result.id._serialized,
      to: formattedNumber,
    };
  } catch (error) {
    console.error(`❌ Error enviando WhatsApp a ${to}:`, error.message);
    console.error('📋 Detalles del error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
    });
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Obtiene el estado de la conexión de WhatsApp y el QR si está disponible
 */
export function getWhatsAppStatus() {
  return {
    isReady,
    isConnected,
    isInitialized: !!whatsappClient,
    sessionPath: SESSION_PATH,
    reconnectAttempts,
    qr: currentQR, // QR code actual (null si ya está conectado)
    needsQR: !isReady && !isConnected && currentQR !== null,
  };
}

/**
 * Cierra WhatsApp de forma limpia (destruye Puppeteer pero NO borra la sesión)
 * Útil para restart del servidor
 */
export async function destroyWhatsApp() {
  if (whatsappClient) {
    try {
      // destroy() cierra Puppeteer y libera archivos, pero NO borra la sesión en disco
      await whatsappClient.destroy();
      console.log('👋 WhatsApp destruido correctamente');
      whatsappClient = null;
      isReady = false;
      isConnected = false;
    } catch (error) {
      console.error('❌ Error al destruir WhatsApp:', error);
    }
  }
}

