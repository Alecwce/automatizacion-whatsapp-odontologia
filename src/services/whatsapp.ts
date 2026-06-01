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

// Adaptador de interoperabilidad ESM/CommonJS para Baileys
const makeWASocket = (pkg as any).default || pkg;

export const sessions = new Map<string, UserSession>();

/**
 * Procesa la FSM conversacional para un usuario específico ante la llegada de un mensaje de texto.
 */
export async function handleUserMessage(
  senderJid: string,
  messageText: string,
  sender: { sendMessage: (jid: string, text: string) => Promise<any> }
): Promise<void> {
  const normalizedText = messageText.trim();
  let session = sessions.get(senderJid);

  if (!session) {
    session = {
      state: 'IDLE',
      attempts: 0,
      lastInteraction: new Date()
    };
    sessions.set(senderJid, session);
  }

  session.lastInteraction = new Date();

  switch (session.state) {
    case 'IDLE': {
      session.state = 'AWAITING_NAME';
      session.attempts = 0;
      sessions.set(senderJid, session);
      await sender.sendMessage(
        senderJid,
        '¡Hola! Bienvenido al consultorio odontológico. Para comenzar tu registro, por favor responde con tu *Nombre Completo*.'
      );
      break;
    }

    case 'AWAITING_NAME': {
      const parsedName = parsePatientName(normalizedText);
      if (!parsedName) {
        await sender.sendMessage(
          senderJid,
          'Por favor, ingresa un nombre válido (ej: Carlos Pérez):'
        );
        return;
      }

      session.patientName = parsedName;
      session.state = 'AWAITING_DNI';
      session.attempts = 0;
      sessions.set(senderJid, session);

      await sender.sendMessage(
        senderJid,
        `Gracias, *${parsedName}*. Ahora, por favor ingresa tu número de *DNI o Cédula* (ej: 12345678 o V-12345678) para finalizar el registro.`
      );
      break;
    }

    case 'AWAITING_DNI': {
      const parsedDni = parsePatientDni(normalizedText);
      
      if (!parsedDni) {
        session.attempts += 1;
        if (session.attempts >= 3) {
          sessions.delete(senderJid);
          await sender.sendMessage(
            senderJid,
            'Se ha superado el número máximo de intentos. El registro se ha cancelado. Puedes volver a escribir "Hola" para iniciar de nuevo.'
          );
          return;
        }

        sessions.set(senderJid, session);
        await sender.sendMessage(
          senderJid,
          `El formato del DNI o Cédula ingresado no es válido. Inténtalo de nuevo (ej: 12345678 o V-12345678). Intentos restantes: ${3 - session.attempts}:`
        );
        return;
      }

      session.patientDni = parsedDni;
      const patientName = session.patientName || 'Paciente';

      // Fecha y hora local formateada para el registro
      const timestamp = new Date().toLocaleString('es-ES', { timeZone: 'America/Bogota' });
      const phoneClean = senderJid.split('@')[0];

      const success = await appendPatientData({
        timestamp,
        phone: phoneClean,
        name: patientName,
        dni: parsedDni
      });

      if (success) {
        await sender.sendMessage(
          senderJid,
          '¡Perfecto! Tus datos han sido registrados exitosamente en nuestro sistema. Te esperamos en el consultorio. ¡Que tengas un excelente día!'
        );
      } else {
        await sender.sendMessage(
          senderJid,
          'Disculpa, tuvimos un inconveniente técnico al guardar tus datos de forma automatizada. Sin embargo, los hemos registrado localmente para procesarlos manualmente. ¡Te esperamos!'
        );
        console.warn(`[WARN] Datos rescatados localmente: Teléfono: ${phoneClean}, Nombre: ${patientName}, DNI: ${parsedDni}`);
      }

      sessions.delete(senderJid);
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

      const jid = msg.key.remoteJid;
      if (!jid) continue;

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
