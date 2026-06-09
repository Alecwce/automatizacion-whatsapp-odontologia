import pkg, {
  useMultiFileAuthState,
  DisconnectReason,
  WASocket,
  ConnectionState,
  MessageUpsertType,
  fetchLatestWaWebVersion
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { UserSession } from '../types.js';
import { parsePatientName, parsePatientDni } from '../utils/parser.js';
import { appendPatientData } from './sheets.js';
import { createAppointment, checkAvailability } from './calendar.js';
import { extractDateFromIntent, analyzeInitialIntent } from './ai.js';

// Adaptador de interoperabilidad ESM/CommonJS para Baileys
const makeWASocket = (pkg as any).default || pkg;

export const sessions = new Map<string, UserSession>();

/**
 * Procesa la FSM conversacional para un usuario específico ante la llegada de un mensaje de texto.
 */export async function handleUserMessage(
  senderJid: string,
  messageText: string,
  sender: { sendMessage: (jid: string, text: string) => Promise<any> }
): Promise<void> {
  // Limpiar remoteJid para evitar fragmentación de sesión y conservar número limpio
  const [user, domain] = senderJid.split('@');
  const cleanJid = (user && domain && user.includes(':')) ? `${user.split(':')[0]}@${domain}` : senderJid;

  const normalizedText = messageText.trim();
  let session = sessions.get(cleanJid);

  if (!session) {
    session = {
      state: 'IDLE',
      attempts: 0,
      lastInteraction: new Date()
    };
    sessions.set(cleanJid, session);
  }

  session.lastInteraction = new Date();

  switch (session.state) {
    case 'IDLE': {
      const analysis = await analyzeInitialIntent(normalizedText);

      if (analysis.action === 'PREGUNTA') {
        await sender.sendMessage(
          senderJid,
          analysis.reply || '🏥 *Clínica Dental JOMOVAK*\n\n¡Hola! Bienvenido al consultorio odontológico. ¿En qué podemos ayudarte hoy? 🦷'
        );
        return;
      }

      if (analysis.action === 'AGENDAR') {
        if (analysis.dateIso) {
          session.patientDate = new Date(analysis.dateIso);
          session.state = 'AWAITING_NAME';
          session.attempts = 0;
          sessions.set(cleanJid, session);
          await sender.sendMessage(
            senderJid,
            `🏥 *Clínica Dental JOMOVAK*\n\n¡Hola! Bienvenido a nuestra recepción virtual. Soy tu asistente automatizado disponible 24/7. Tengo disponibilidad para registrar tu cita.\n\nPara comenzar, por favor confírmame tu *Nombre y Apellido* por este medio: 🦷`
          );
        } else {
          session.state = 'AWAITING_NAME';
          session.attempts = 0;
          sessions.set(cleanJid, session);
          await sender.sendMessage(
            senderJid,
            `🏥 *Clínica Dental JOMOVAK*\n\n¡Hola! Bienvenido a nuestra recepción virtual. Soy tu asistente automatizado disponible 24/7. Para ayudarte a agendar una cita rápidamente, por favor confírmame tu *Nombre y Apellido* por este medio: 🦷`
          );
        }
      }
      break;
    }

    case 'AWAITING_NAME': {
      const parsedName = parsePatientName(normalizedText);
      if (!parsedName) {
        await sender.sendMessage(
          senderJid,
          '❌ *Nombre no válido.* Por favor, ingresa tu Nombre y Apellido completos (ej: Carlos Pérez). Ambos deben tener al menos 3 letras cada uno: 🦷'
        );
        return;
      }

      session.patientName = parsedName;
      session.state = 'AWAITING_DNI';
      session.attempts = 0;
      sessions.set(cleanJid, session);

      await sender.sendMessage(
        senderJid,
        `✨ *¡Excelente!* \n\nMuchas gracias, *${parsedName}*. Ahora, para poder registrar tu ficha de atención de forma correcta en nuestro sistema, por favor bríndame tu número de *DNI* (debe contener exactamente 8 dígitos numéricos):`
      );
      break;
    }

    case 'AWAITING_DNI': {
      const parsedDni = parsePatientDni(normalizedText);
      
      if (!parsedDni) {
        session.attempts += 1;
        if (session.attempts >= 3) {
          sessions.delete(cleanJid);
          await sender.sendMessage(
            senderJid,
            '❌ Se ha superado el número máximo de intentos. El registro se ha cancelado. Puedes volver a escribir "Hola" para iniciar de nuevo: 🦷'
          );
          return;
        }

        sessions.set(cleanJid, session);
        await sender.sendMessage(
          senderJid,
          `⚠️ *DNI inválido.* Por favor, ingresa tu número de DNI que contenga exactamente 8 dígitos numéricos (ej. 12345678). Intentos restantes: ${3 - session.attempts}:`
        );
        return;
      }

      session.patientDni = parsedDni;

      if (session.patientDate) {
        session.state = 'AWAITING_REASON';
        session.attempts = 0;
        sessions.set(cleanJid, session);

        await sender.sendMessage(
          senderJid,
          '🦷 *¡Perfecto!* Ya casi terminamos. ¿Cuál es el motivo principal de tu consulta (ej. limpieza, dolor, control)?'
        );
      } else {
        session.state = 'AWAITING_DATE';
        session.attempts = 0;
        sessions.set(cleanJid, session);

        await sender.sendMessage(
          senderJid,
          '📅 *¡DNI verificado con éxito!* Ahora, para finalizar: *¿Qué día y a qué hora te gustaría agendar tu cita?* (ej: "mañana a las 3:30 pm", "el próximo lunes a las 10am"): 🦷'
        );
      }
      break;
    }

    case 'AWAITING_DATE': {
      const parsedDateStr = await extractDateFromIntent(normalizedText);

      if (!parsedDateStr) {
        session.attempts += 1;
        if (session.attempts >= 3) {
          sessions.delete(cleanJid);
          await sender.sendMessage(
            senderJid,
            '❌ Se ha superado el número máximo de intentos. El registro se ha cancelado. Puedes volver a escribir "Hola" para iniciar de nuevo: 🦷'
          );
          return;
        }

        sessions.set(cleanJid, session);
        await sender.sendMessage(
          senderJid,
          `🤔 No logré comprender la fecha u hora indicada. Por favor, sé más específico sobre el día y la hora de tu preferencia (ej: "mañana a las 3:30 pm" o "este viernes a las 10:00 am"). Intentos restantes: ${3 - session.attempts}:`
        );
        return;
      }

      const parsedDate = new Date(parsedDateStr);

      session.patientDate = parsedDate;
      session.state = 'AWAITING_REASON';
      session.attempts = 0;
      sessions.set(cleanJid, session);

      await sender.sendMessage(
        senderJid,
        '🦷 *¡Perfecto!* Ya casi terminamos. ¿Cuál es el motivo principal de tu consulta (ej. limpieza, dolor, control)?'
      );
      break;
    }

    case 'AWAITING_REASON': {
      session.patientReason = normalizedText;

      const patientDate = session.patientDate;
      if (!patientDate) {
        session.state = 'AWAITING_DATE';
        session.attempts = 0;
        sessions.set(cleanJid, session);
        await sender.sendMessage(
          senderJid,
          '⚠️ Tuvimos un inconveniente al recordar el horario. Por favor, indícame nuevamente el día y la hora de tu preferencia: 🦷'
        );
        return;
      }

      const isAvailable = await checkAvailability(patientDate);

      if (!isAvailable) {
        session.state = 'AWAITING_DATE';
        session.attempts = 0;
        sessions.set(cleanJid, session);
        await sender.sendMessage(
          senderJid,
          '🗓️ Lo siento mucho, pero ese horario ya se encuentra reservado. ¿Podrías indicarme otro día u hora de tu preferencia? 🦷'
        );
        return;
      }

      const patientName = session.patientName || 'Paciente';
      const patientDni = session.patientDni || '';
      const phoneClean = cleanJid.split('@')[0];
      const timestamp = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });
      const appointmentDateStr = patientDate.toLocaleString('es-PE', { timeZone: 'America/Lima' });

      const sheetsPromise = appendPatientData({
        timestamp,
        phone: phoneClean,
        name: patientName,
        dni: patientDni,
        appointmentDate: appointmentDateStr,
        patientReason: session.patientReason
      });

      const calendarPromise = createAppointment(patientName, patientDate, session.patientReason);

      const [sheetsSuccess, calendarSuccess] = await Promise.all([
        sheetsPromise,
        calendarPromise
      ]);

      const dateReadable = patientDate.toLocaleString('es-PE', {
        timeZone: 'America/Lima',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      if (sheetsSuccess && calendarSuccess) {
        await sender.sendMessage(
          senderJid,
          `✅ *¡CITA AGENDADA CON ÉXITO!* 📄\n\nTu espacio clínico ha sido reservado de forma correcta en nuestra Sede Principal de Huancayo.\n\n📅 *Fecha y Hora:* ${dateReadable}\n🪥 *Especialidad / Motivo:* ${session.patientReason}\n\n¡Muchas gracias por tu confianza! Por favor, recuerda asistir 10 minutos antes de tu turno. ¡Te esperamos! 🦷✨`
        );
      } else {
        if (sheetsSuccess && !calendarSuccess) {
          await sender.sendMessage(
            senderJid,
            `🦷 *¡Excelente!* Hemos registrado tus datos de forma correcta, pero tuvimos un retraso técnico temporal al reservar el espacio en nuestro calendario digital.\n\nNo te preocupes, tu solicitud está recibida y un asesor humano se contactará contigo de inmediato para confirmar tu horario. ¡Te esperamos! ✨`
          );
          console.warn(`[WARN] Cita de Google Calendar falló pero Sheets tuvo éxito: Nombre: ${patientName}, Fecha: ${dateReadable}`);
        } else if (!sheetsSuccess && calendarSuccess) {
          await sender.sendMessage(
            senderJid,
            `📅 *¡Perfecto!* Tu cita para el *${dateReadable}* ha sido agendada con éxito en nuestro calendario, pero tuvimos una demora al guardar tu ficha técnica. Tu cita está asegurada. ¡Te esperamos! 🦷✨`
          );
          console.warn(`[WARN] Registro en Sheets falló pero Google Calendar tuvo éxito: Nombre: ${patientName}, Fecha: ${dateReadable}`);
        } else {
          await sender.sendMessage(
            senderJid,
            `⚠️ Disculpa el inconveniente, tuvimos un problema técnico al procesar tu agenda. Sin embargo, hemos capturado tu información para asignarte tu cita de forma manual. ¡Un asesor te contactará en breve! 🦷`
          );
          console.error(`[FALTO CRÍTICO] Falló Sheets y Calendar: Teléfono: ${phoneClean}, Nombre: ${patientName}, DNI: ${patientDni}, Fecha: ${dateReadable}`);
        }
      }

      sessions.delete(cleanJid);
      break;
    }
  }
}

/**
 * Inicializa y conecta el cliente de WhatsApp con Baileys.
 */
export async function startWhatsAppBot(): Promise<WASocket> {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

  const { version, isLatest } = await fetchLatestWaWebVersion({});
  console.log(`[WhatsApp] Inicializando cliente. Versión de WA Web: ${version.join('.')}, ¿Es la última?: ${isLatest}`);

  const sock = makeWASocket({
    auth: state,
    version,
    printQRInTerminal: true,
    browser: ['Clínica Bot', 'Chrome', '1.0.0'],
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update: Partial<ConnectionState>) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'close') {
      const shouldReconnect =
        (lastDisconnect?.error as Boom)?.output?.statusCode !==
        DisconnectReason.loggedOut;
      
      console.log('La conexión de WhatsApp se cerró. ¿Reconectando?:', shouldReconnect);

      if (shouldReconnect) {
        startWhatsAppBot().catch((err) =>
          console.error('Error al intentar reconectar WhatsApp:', err)
        );
      }
    } else if (connection === 'open') {
      console.log('¡Conexión de WhatsApp abierta exitosamente!');
    }
  });

  sock.ev.on('messages.upsert', async (m: { messages: any[]; type: MessageUpsertType }) => {
    if (m.type !== 'notify') return;

    for (const msg of m.messages) {
      if (msg.key.fromMe || !msg.message) continue;

      let jid = msg.key.remoteJid;
      if (!jid) continue;

      // Normalizar remoteJid para evitar fragmentación de sesión y conservar número limpio
      const [user, domain] = jid.split('@');
      if (user && domain && user.includes(':')) {
        jid = `${user.split(':')[0]}@${domain}`;
      }

      // Extrae el texto del mensaje entrante
      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        '';

      if (!text) continue;

      // Adaptador para interactuar con Baileys de forma asíncrona
      const senderAdapter = {
        sendMessage: async (targetJid: string, replyText: string) => {
          return sock.sendMessage(targetJid, { text: replyText });
        }
      };

      try {
        await handleUserMessage(jid, text, senderAdapter);
      } catch (err) {
        console.error(`Error procesando mensaje de usuario (${jid}):`, err);
      }
    }
  });

  return sock;
}
