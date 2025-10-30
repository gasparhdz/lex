import prisma from '../utils/prisma.js';
import {
  sendEmail,
  sendWhatsApp,
  generateEventReminderHTML,
  generateTaskReminderHTML,
  generateEventReminderWhatsApp,
  generateTaskReminderWhatsApp,
  getPhoneForUsuario,
} from '../services/email.service.js';
import dayjs from 'dayjs';

/**
 * Busca y envía recordatorios pendientes
 */
export async function enviarRecordatorios(req, res) {
  const esRequestHTTP = !!res;
  
  try {
    const ahora = dayjs();
    // Buscar recordatorios del minuto actual (sin ventana de tiempo)
    const inicioRange = ahora.startOf('minute').toDate();
    const finRange = ahora.endOf('minute').toDate();

    console.log(`[${ahora.format('YYYY-MM-DD HH:mm:ss')}] Iniciando envío de recordatorios...`);

    // Buscar eventos con recordatorio pendiente para el minuto actual
    const eventosParaRecordar = await prisma.evento.findMany({
      where: {
        activo: true,
        recordatorio: {
          gte: inicioRange,
          lte: finRange,
        },
        recordatorioEnviado: false,
        createdBy: { not: null }, // Solo eventos creados por un usuario
      },
      include: {
        tipo: true,
        estado: true,
        cliente: true,
        caso: true,
      },
    });

    // Obtener usuarios creadores de los eventos
    const userIds = eventosParaRecordar.map(e => e.createdBy).filter(Boolean);
    const usuarios = await prisma.usuario.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, nombre: true, apellido: true, telefono: true },
    });
    const usuariosMap = new Map(usuarios.map(u => [u.id, u]));

    // Buscar tareas con recordatorio pendiente para el minuto actual
    const tareasParaRecordar = await prisma.tarea.findMany({
      where: {
        activo: true,
        completada: false,
        recordatorio: {
          gte: inicioRange,
          lte: finRange,
        },
        recordatorioEnviado: false,
        createdBy: { not: null }, // Solo tareas creadas por un usuario
      },
      include: {
        prioridad: true,
        cliente: true,
        caso: true,
        asignado: true,
      },
    });

    // Obtener usuarios creadores de las tareas (para fallback si no tienen asignado)
    const userIdsTareas = tareasParaRecordar.map(t => t.createdBy).filter(Boolean);
    const usuariosTareas = await prisma.usuario.findMany({
      where: { id: { in: userIdsTareas } },
      select: { id: true, email: true, nombre: true, apellido: true, telefono: true },
    });
    const usuariosTareasMap = new Map(usuariosTareas.map(u => [u.id, u]));

    console.log(`Encontrados ${eventosParaRecordar.length} eventos y ${tareasParaRecordar.length} tareas para recordar`);

    const resultados = {
      eventos: { total: eventosParaRecordar.length, enviados: 0, errores: [] },
      tareas: { total: tareasParaRecordar.length, enviados: 0, errores: [] },
    };

    // Enviar recordatorios de eventos
    for (const evento of eventosParaRecordar) {
      try {
        // Obtener email y teléfono del usuario creador
        const usuario = usuariosMap.get(evento.createdBy);
        const emailUsuario = usuario?.email;
        const telefonoUsuario = getPhoneForUsuario(usuario);
        
        console.log(`🔍 Evento ${evento.id} - Usuario creador ID: ${evento.createdBy}, Email: ${emailUsuario}, Teléfono: ${telefonoUsuario}`);
        
        if (!emailUsuario && !telefonoUsuario) {
          console.log(`Evento ${evento.id} - No tiene email ni teléfono del usuario creador`);
          resultados.eventos.errores.push({
            id: evento.id,
            error: 'No tiene email ni teléfono del usuario creador',
          });
          continue;
        }

        // Intentar enviar WhatsApp primero (prioridad)
        let whatsappEnviado = false;
        if (telefonoUsuario) {
          try {
            const textoWhatsApp = generateEventReminderWhatsApp(evento);
            const result = await sendWhatsApp({
              to: telefonoUsuario,
              body: textoWhatsApp,
            });
            if (result.success) {
              console.log(`  📱 WhatsApp enviado a ${telefonoUsuario}`);
              whatsappEnviado = true;
            } else {
              console.warn(`  ⚠️ WhatsApp no enviado a ${telefonoUsuario}: ${result.error}`);
            }
          } catch (error) {
            console.warn(`  ⚠️ Error al intentar enviar WhatsApp a ${telefonoUsuario}:`, error.message);
          }
        }

        // Enviar email solo si WhatsApp NO se envió (fallback)
        if (!whatsappEnviado && emailUsuario) {
          const html = generateEventReminderHTML(evento);
          const subject = '📅 Recordatorio de evento';

          await sendEmail({
            to: emailUsuario,
            subject,
            text: `Recordatorio de evento\n\nFecha: ${new Date(evento.fechaInicio).toLocaleString('es-AR')}\n${evento.descripcion || ''}`,
            html,
          });
          console.log(`  📧 Email enviado a ${emailUsuario} (fallback, WhatsApp no disponible)`);
        }

        // Marcar como enviado
        await prisma.evento.update({
          where: { id: evento.id },
          data: { recordatorioEnviado: true },
        });

        resultados.eventos.enviados++;
        console.log(`✓ Recordatorio de evento ${evento.id} enviado`);
      } catch (error) {
        console.error(`✗ Error enviando recordatorio de evento ${evento.id}:`, error);
        resultados.eventos.errores.push({
          id: evento.id,
          error: error.message,
        });
      }
    }

    // Enviar recordatorios de tareas
    for (const tarea of tareasParaRecordar) {
      try {
        // Intentar obtener email y teléfono del usuario asignado, o del creador como fallback
        let emailDestinatario = null;
        let telefonoDestinatario = null;
        let nombreDestinatario = 'Usuario';

        if (tarea.asignado?.email || tarea.asignado?.telefono) {
          // Si tiene usuario asignado, enviar a ese usuario
          emailDestinatario = tarea.asignado.email;
          telefonoDestinatario = getPhoneForUsuario(tarea.asignado);
          nombreDestinatario = `${tarea.asignado.nombre || ''} ${tarea.asignado.apellido || ''}`.trim();
          console.log(`🔍 Tarea ${tarea.id} - Usuario asignado ID: ${tarea.asignado.id}, Email: ${emailDestinatario}, Teléfono: ${telefonoDestinatario}, Nombre: ${nombreDestinatario}`);
        } else {
          // Si no tiene usuario asignado, enviar al creador
          const creador = usuariosTareasMap.get(tarea.createdBy);
          if (creador) {
            emailDestinatario = creador.email;
            telefonoDestinatario = getPhoneForUsuario(creador);
            nombreDestinatario = `${creador.nombre || ''} ${creador.apellido || ''}`.trim();
            console.log(`🔍 Tarea ${tarea.id} - Usuario creador ID: ${tarea.createdBy}, Email: ${emailDestinatario}, Teléfono: ${telefonoDestinatario}, Nombre: ${nombreDestinatario}`);
          }
        }

        if (!emailDestinatario && !telefonoDestinatario) {
          console.log(`Tarea ${tarea.id} - No tiene email ni teléfono disponible`);
          resultados.tareas.errores.push({
            id: tarea.id,
            error: 'No tiene email ni teléfono disponible',
          });
          continue;
        }

        // Intentar enviar WhatsApp primero (prioridad)
        let whatsappEnviado = false;
        if (telefonoDestinatario) {
          try {
            const textoWhatsApp = generateTaskReminderWhatsApp(tarea);
            const result = await sendWhatsApp({
              to: telefonoDestinatario,
              body: textoWhatsApp,
            });
            if (result.success) {
              console.log(`  📱 WhatsApp enviado a ${telefonoDestinatario}`);
              whatsappEnviado = true;
            } else {
              console.warn(`  ⚠️ WhatsApp no enviado a ${telefonoDestinatario}: ${result.error}`);
            }
          } catch (error) {
            console.warn(`  ⚠️ Error al intentar enviar WhatsApp a ${telefonoDestinatario}:`, error.message);
          }
        }

        // Enviar email solo si WhatsApp NO se envió (fallback)
        if (!whatsappEnviado && emailDestinatario) {
          const html = generateTaskReminderHTML(tarea);
          const subject = '📌 Recordatorio de tarea';

          await sendEmail({
            to: emailDestinatario,
            subject,
            text: `Recordatorio de tarea\n\n${tarea.titulo}\n\nFecha Límite: ${tarea.fechaLimite ? new Date(tarea.fechaLimite).toLocaleDateString('es-AR') : 'No especificada'}\n${tarea.descripcion || ''}`,
            html,
          });
          console.log(`  📧 Email enviado a ${emailDestinatario} (fallback, WhatsApp no disponible)`);
        }

        // Marcar como enviado
        await prisma.tarea.update({
          where: { id: tarea.id },
          data: { recordatorioEnviado: true },
        });

        resultados.tareas.enviados++;
        console.log(`✓ Recordatorio de tarea ${tarea.id} enviado a ${emailDestinatario} (${nombreDestinatario})`);
      } catch (error) {
        console.error(`✗ Error enviando recordatorio de tarea ${tarea.id}:`, error);
        resultados.tareas.errores.push({
          id: tarea.id,
          error: error.message,
        });
      }
    }

    console.log(`Proceso finalizado. Eventos: ${resultados.eventos.enviados}/${resultados.eventos.total}, Tareas: ${resultados.tareas.enviados}/${resultados.tareas.total}`);

    const respuesta = {
      success: true,
      timestamp: ahora.toISOString(),
      resultados,
    };

    if (esRequestHTTP) {
      res.json(respuesta);
    }

    return respuesta;
  } catch (error) {
    console.error('Error en enviarRecordatorios:', error);
    
    if (esRequestHTTP) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
    
    throw error;
  }
}

