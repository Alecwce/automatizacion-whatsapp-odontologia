import pkg, {
  useMultiFileAuthState,
  DisconnectReason,
  WASocket,
  ConnectionState,
  MessageUpsertType,
  fetchLatestWaWebVersion,
  jidNormalizedUser
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { UserSession } from '../types.js';
import { parsePatientName, parsePatientDni, isWithinBusinessHours, parseLocaleDateString } from '../utils/parser.js';
import { appendPatientData, getAllAppointments } from './sheets.js';
import { createAppointment, checkAvailability } from './calendar.js';
import { extractDateFromIntent, analyzeInitialIntent } from './ai.js';
import { checkAndSendReminders } from './scheduler.js';

// Adaptador de interoperabilidad ESM/CommonJS para Baileys
const makeWASocket = (pkg as any).default || pkg;

export const sessions = new Map<string, UserSession>();
export const lidToJidMap = new Map<string, string>();

/**
 * Procesa la FSM conversacional para un usuario específico ante la llegada de un mensaje de texto.
 */export async function handleUserMessage(
  senderJid: string,
  messageText: string,
  sender: { sendMessage: (jid: string, text: string) => Promise<any> },
  resolvedPhone?: string
): Promise<void> {
  // Limpiar remoteJid para evitar fragmentación de sesión y conservar número limpio
  const [user, domain] = senderJid.split('@');
  const cleanJid = (user && domain) ? `${user.split(':')[0].split(':')[0]}@${domain}` : senderJid;

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

  if (resolvedPhone) {
    session.phone = resolvedPhone;
  }

  session.lastInteraction = new Date();

  switch (session.state) {
    case 'IDLE': {
      const analysis = await analyzeInitialIntent(normalizedText);

      if (analysis.action === 'PREGUNTA') {
        await sender.sendMessage(
          senderJid,
          analysis.reply || '🏥 *Consultorio Sánchez*\n\n¡Hola! Bienvenido al consultorio odontológico. ¿En qué podemos ayudarte hoy? 🦷'
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
            `🏥 *Consultorio Sánchez*\n\n¡Hola! Bienvenido a nuestra recepción virtual. Soy tu asistente automatizado disponible 24/7. Tengo disponibilidad para registrar tu cita.\n\nPara comenzar, por favor confírmame tu *Nombre y Apellido* por este medio: 🦷`
          );
        } else {
          session.state = 'AWAITING_NAME';
          session.attempts = 0;
          sessions.set(cleanJid, session);
          await sender.sendMessage(
            senderJid,
            `🏥 *Consultorio Sánchez*\n\n¡Hola! Bienvenido a nuestra recepción virtual. Soy tu asistente automatizado disponible 24/7. Para ayudarte a agendar una cita rápidamente, por favor confírmame tu *Nombre y Apellido* por este medio: 🦷`
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
      session.state = 'AWAITING_PHONE';
      session.attempts = 0;
      sessions.set(cleanJid, session);

      await sender.sendMessage(
        senderJid,
        "Por favor, ingresa tu número de teléfono celular de contacto (9 dígitos) para que la doctora pueda comunicarse contigo si es necesario. 📱"
      );
      break;
    }

    case 'AWAITING_PHONE': {
      const phoneRegex = /^9\d{8}$/;
      const parsedPhone = normalizedText.replace(/\s+/g, '');

      if (!phoneRegex.test(parsedPhone)) {
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
          `El número ingresado no es válido. ⚠️ Por favor, asegúrate de escribir los 9 dígitos de tu celular (ej: 987654321). Intentos restantes: ${3 - session.attempts}:`
        );
        return;
      }

      session.userPhone = parsedPhone;

      if (session.patientDate) {
        session.state = 'AWAITING_REASON';
        session.attempts = 0;
        sessions.set(cleanJid, session);
      } else {
        session.state = 'AWAITING_DATE';
        session.attempts = 0;
        sessions.set(cleanJid, session);

        await sender.sendMessage(
          senderJid,
          '📅 *¡Teléfono celular verificado con éxito!* Ahora, para finalizar: *¿Qué día y a qué hora te gustaría agendar tu cita?* (ej: "mañana a las 3:30 pm", "el próximo lunes a las 10am"): 🦷'
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

      // Validación militar de horario comercial: L-S, 09:00-13:00 y 15:00-20:00
      if (!isWithinBusinessHours(parsedDate)) {
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
        console.warn(`[WARN] Hora fuera de horario comercial rechazada para ${cleanJid}: ${parsedDate.toISOString()}`);
        await sender.sendMessage(
          senderJid,
          `Lo siento, nuestro horario de atención es de Lunes a Sábado, de 9:00 AM a 1:00 PM y de 3:00 PM a 8:00 PM. 🕒 Por favor, indícame una hora dentro de este rango. Intentos restantes: ${3 - session.attempts}:`
        );
        return;
      }

      // Validación estricta de colisiones de horarios contra Google Sheets (rango de 60 minutos)
      const allAppts = await getAllAppointments();
      const proposedTime = parsedDate.getTime();
      let hasCollision = false;

      for (const appt of allAppts) {
        if (!appt.appointmentDate) continue;
        const apptDate = parseLocaleDateString(appt.appointmentDate);
        if (!apptDate) continue;

        // Comprobación de colisión: diferencia absoluta de menos de 1 hora (3,600,000 milisegundos)
        if (Math.abs(proposedTime - apptDate.getTime()) < 3600000) {
          hasCollision = true;
          break;
        }
      }

      if (hasCollision) {
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
        console.warn(`[WARN] Colisión de horario detectada para ${cleanJid}: ${parsedDate.toLocaleString('es-PE')}`);
        await sender.sendMessage(
          senderJid,
          `Ese horario ya se encuentra reservado para esa fecha. ⚠️ Por favor, intenta con otra hora o selecciona un día diferente. Intentos restantes: ${3 - session.attempts}:`
        );
        return;
      }

      session.patientDate = parsedDate;
      session.state = 'AWAITING_REASON';
      session.attempts = 0;
      sessions.set(cleanJid, session);

      await sender.sendMessage(
        senderJid,
        '🦷 *Por favor, selecciona el número del tratamiento que deseas realizarte:*\n\n1️⃣ Diagnóstico General\n2️⃣ Estética Dental\n3️⃣ Odontopediatría\n4️⃣ Ortodoncia Avanzada\n5️⃣ Cirugía e Implantes\n6️⃣ Odontología Integral'
      );
      break;
    }

    case 'AWAITING_REASON': {
      const selection = normalizedText.trim();
      const optionMap: Record<string, string> = {
        '1': 'Diagnóstico General',
        '2': 'Estética Dental',
        '3': 'Odontopediatría',
        '4': 'Ortodoncia Avanzada',
        '5': 'Cirugía e Implantes',
        '6': 'Odontología Integral'
      };

      if (!optionMap[selection]) {
        await sender.sendMessage(
          senderJid,
          '⚠️ *Opción no válida.* Por favor, selecciona el número del tratamiento que deseas realizarte (responde únicamente con un número del 1 al 6):\n\n1️⃣ Diagnóstico General\n2️⃣ Estética Dental\n3️⃣ Odontopediatría\n4️⃣ Ortodoncia Avanzada\n5️⃣ Cirugía e Implantes\n6️⃣ Odontología Integral'
        );
        return;
      }

      session.patientReason = optionMap[selection];

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
      const phoneClean = session.userPhone || '';
      const timestamp = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });
      const appointmentDateStr = patientDate.toLocaleString('es-PE', { timeZone: 'America/Lima' });

      const sheetsPromise = appendPatientData({
        timestamp,
        phone: phoneClean,
        name: patientName,
        dni: patientDni,
        appointmentDate: appointmentDateStr,
        patientReason: session.patientReason,
        whatsappId: cleanJid
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
    syncFullHistory: true,
  });

  sock.ev.on('creds.update', saveCreds);

  // Registrar mapeos de LID a Phone JID
  sock.ev.on('contacts.upsert', (contacts: any[]) => {
    for (const contact of contacts) {
      if (contact.id && contact.lid) {
        lidToJidMap.set(contact.lid, contact.id);
        console.log(`[LID_MAP] Mapeo guardado (contacts.upsert): ${contact.lid} -> ${contact.id}`);
      }
    }
  });

  sock.ev.on('contacts.update', (updates: any[]) => {
    for (const update of updates) {
      if (update.id && update.lid) {
        lidToJidMap.set(update.lid, update.id);
        console.log(`[LID_MAP] Mapeo guardado (contacts.update): ${update.lid} -> ${update.id}`);
      }
    }
  });

  sock.ev.on('chats.phoneNumberShare', (share: any) => {
    if (share.lid && share.jid) {
      lidToJidMap.set(share.lid, share.jid);
      console.log(`[LID_MAP] Mapeo guardado (chats.phoneNumberShare): ${share.lid} -> ${share.jid}`);
    }
  });

  sock.ev.on('messaging-history.set', ({ contacts }: any) => {
    if (contacts) {
      for (const contact of contacts) {
        if (contact.id && contact.lid) {
          lidToJidMap.set(contact.lid, contact.id);
          console.log(`[LID_MAP] Mapeo guardado (messaging-history.set): ${contact.lid} -> ${contact.id}`);
        }
      }
    }
  });

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

      // Desofuscar el JID usando la utilidad oficial de Baileys.
      // jidNormalizedUser convierte cualquier @lid (LID interno de dispositivos vinculados)
      // al MSISDN real en formato @s.whatsapp.net. En mensajes de grupo, extrae el
      // participante individual correcto.
      const remoteJid: string = msg.key.remoteJid || '';
      const isGroupMessage = remoteJid.endsWith('@g.us');
      const rawForNormalization = isGroupMessage
        ? (msg.key.participant || msg.participant || remoteJid)
        : remoteJid;

      if (!rawForNormalization) continue;

      // jidNormalizedUser elimina la máscara @lid y devuelve el número real @s.whatsapp.net
      let jid = jidNormalizedUser(rawForNormalization);
      let resolvedPhone: string | undefined = undefined;

      if (jid.endsWith('@lid')) {
        // 1. Intentar resolver desde el mapa en memoria lidToJidMap
        const mappedJid = lidToJidMap.get(jid);
        if (mappedJid) {
          jid = mappedJid;
        } else {
          // 2. Intentar buscar en propiedades alternativas del mensaje
          const altJid = (msg.key as any).senderPn || (msg as any).senderPn || (msg.key as any).remoteJidAlt || (msg as any).participantAlt;
          if (altJid) {
            jid = jidNormalizedUser(altJid);
          }
        }
      }

      // Si se resolvió a un JID de WhatsApp normal, extraer el número telefónico real purificado
      if (jid.endsWith('@s.whatsapp.net')) {
        resolvedPhone = jid.split('@')[0].replace(/\D/g, '');
      }

      // Extrae el texto del mensaje entrante
      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        '';

      if (!text) continue;

      // Adaptador para interactuar con Baileys de forma asíncrona
      const senderAdapter = {
        sendMessage: async (targetJid: string, replyText: string | { text: string }) => {
          const textStr = typeof replyText === 'string' ? replyText : replyText.text;
          return sock.sendMessage(targetJid, { text: textStr });
        }
      };

      try {
        await handleUserMessage(jid, text, senderAdapter, resolvedPhone);
      } catch (err) {
        console.error(`Error procesando mensaje de usuario (${jid}):`, err);
      }
    }
  });

  return sock;
}
