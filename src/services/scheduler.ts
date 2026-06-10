import { getUnnotifiedAppointments, markAsNotified } from './sheets.js';

/**
 * Parsea un string de fecha en formato es-PE proveniente de Google Sheets.
 * Ejemplos de entrada esperados:
 *   "10/6/2026, 3:00:00 p. m."
 *   "10/6/2026, 11:30:00 a. m."
 *   "10/6/2026 15:00:00"
 * Construye el objeto Date de forma manual para evitar fallos del parser nativo
 * de JavaScript con formatos localizados de 12 horas en español.
 */
function parseLocaleDateString(dateStr: string): Date | null {
  try {
    if (!dateStr || !dateStr.trim()) return null;

    // Normalizar: quitar comas de separación y colapsar espacios múltiples
    const normalized = dateStr.replace(/,/g, '').trim();

    // Detectar si es formato de 12h (tiene 'a' o 'p' al final como indicador AM/PM)
    // Los separadores en español pueden ser: "a. m.", "p. m.", "a.m.", "p.m.", "am", "pm"
    const ampmMatch = normalized.match(/([ap])\.?\s*m\.?/i);
    const isPm = ampmMatch ? ampmMatch[1].toLowerCase() === 'p' : false;
    const isAmPm = Boolean(ampmMatch);

    // Quitar el bloque AM/PM del string para parsear solo la parte numérica
    const numericPart = normalized.replace(/[ap]\.?\s*m\.?/gi, '').trim();
    const parts = numericPart.split(/\s+/);

    if (parts.length < 2) return null;

    // Parte de fecha: DD/MM/YYYY
    const [datePart, timePart] = parts;
    const dateSubparts = datePart.split('/');
    if (dateSubparts.length !== 3) return null;

    const day   = parseInt(dateSubparts[0], 10);
    const month = parseInt(dateSubparts[1], 10) - 1; // 0-indexed en JS
    const year  = parseInt(dateSubparts[2], 10);

    // Parte de hora: HH:mm:ss o HH:mm
    const timeSubparts = timePart.split(':');
    if (timeSubparts.length < 2) return null;

    let hours   = parseInt(timeSubparts[0], 10);
    const minutes = parseInt(timeSubparts[1], 10);
    const seconds = timeSubparts[2] ? parseInt(timeSubparts[2], 10) : 0;

    // Convertir formato 12h a 24h
    if (isAmPm) {
      if (isPm && hours < 12) hours += 12;   // 3 PM -> 15
      if (!isPm && hours === 12) hours = 0;  // 12 AM -> 0
    }

    // Validar rangos antes de construir el Date
    if (
      isNaN(day) || isNaN(month) || isNaN(year) ||
      isNaN(hours) || isNaN(minutes) || isNaN(seconds) ||
      month < 0 || month > 11 ||
      day < 1 || day > 31 ||
      hours < 0 || hours > 23 ||
      minutes < 0 || minutes > 59
    ) {
      return null;
    }

    const result = new Date(year, month, day, hours, minutes, seconds);

    // Guardar contra desbordamientos de fecha en JS (ej: 31 de Febrero -> 3 de Marzo)
    if (
      result.getFullYear() !== year ||
      result.getMonth() !== month ||
      result.getDate() !== day
    ) {
      return null;
    }

    return result;
  } catch (err) {
    console.error(`[Scheduler] Error al parsear fecha de cita "${dateStr}":`, err);
    return null;
  }
}

/**
 * Ejecuta el ciclo de revisión de recordatorios.
 * Exportada para permitir su ejecución manual desde comandos de prueba.
 */
export async function checkAndSendReminders(socket: any, isForceTest?: boolean): Promise<void> {
  try {
    console.log('[Scheduler] Iniciando ciclo de recordatorios...');
    const appointments = await getUnnotifiedAppointments();
    if (appointments.length === 0) {
      console.log('[Scheduler] No hay citas pendientes por notificar.');
      return;
    }

    const now = new Date();
    console.log(`[Scheduler] Evaluando ${appointments.length} citas no notificadas contra la hora actual: ${now.toLocaleString('es-PE')}`);

    for (const appt of appointments) {
      // Filtro de filas vacías: omitir si el nombre o la fecha no están presentes
      if (!appt.name || !appt.name.trim() || !appt.appointmentDate || !appt.appointmentDate.trim()) {
        console.warn(`[Scheduler] Fila ${appt.rowNumber} omitida: nombre o fecha vacíos.`);
        continue;
      }

      const apptDate = parseLocaleDateString(appt.appointmentDate);
      if (!apptDate) {
        console.warn(`[Scheduler] No se pudo parsear la fecha de cita para el paciente ${appt.name}: "${appt.appointmentDate}"`);
        continue;
      }

      const diffMs = apptDate.getTime() - now.getTime();
      const diffMinutes = diffMs / (60 * 1000);

      console.log(`[Scheduler] Cita de ${appt.name} para ${appt.appointmentDate} está a ${diffMinutes.toFixed(1)} minutos de distancia.`);

      // Calificar cita si isForceTest es true (bypass del reloj) o si se encuentra dentro de la ventana de 15 a 35 minutos
      const qualifies = isForceTest || (diffMinutes >= 15 && diffMinutes <= 35);

      if (qualifies) {
        if (isForceTest) {
          console.log(`[Scheduler] [TEST FORZADO] Cita de ${appt.name} califica por TEST_NOTIFICACION. Enviando WhatsApp...`);
        } else {
          console.log(`[Scheduler] Cita de ${appt.name} califica para notificación (diferencia: ${diffMinutes.toFixed(1)} min). Enviando WhatsApp...`);
        }

        const phoneClean = (appt.phone || '').trim().replace(/\D/g, '');
        const phoneJid = `51${phoneClean}@s.whatsapp.net`;

        const horaCita = apptDate.toLocaleTimeString('es-PE', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });

        const message = `⏰ *RECORDATORIO DE CITA MÉDICA* 🦷

Hola *${appt.name}*, te saludamos del *Consultorio Sánchez*.

Te recordamos que tu cita odontológica está programada para dentro de *30 minutos*.

📅 *Horario:* ${horaCita}
👩‍⚕️ *Especialista:* Dra. Luisa Sánchez
📍 *Sede Principal:* Av. Julio C. Tello 456, El Tambo (Huancayo)

Por favor, procura asistir 10 minutos antes de tu turno. ¡Te esperamos para cuidar tu sonrisa! ✨`;

        const textoRecordatorio = String(message || 'Hola, te recordamos tu cita programada.');

        try {
          await socket.sendMessage(phoneJid, { text: textoRecordatorio });
          console.log(`[Scheduler] Mensaje de recordatorio enviado con éxito a ${phoneJid}. Marcando como notificado...`);
          
          const marked = await markAsNotified(appt.rowNumber);
          if (marked) {
            console.log(`[Scheduler] Cita del paciente ${appt.name} (fila ${appt.rowNumber}) marcada correctamente como "SI" en Google Sheets.`);
          } else {
            console.warn(`[Scheduler] Alerta: No se pudo marcar como notificado en Google Sheets para el paciente ${appt.name} (fila ${appt.rowNumber}).`);
          }
        } catch (sendErr) {
          console.error(`[Scheduler] Falló el envío de WhatsApp para ${appt.name} (${phoneJid}):`, sendErr);
        }
      }
    }
  } catch (error) {
    console.error('[Scheduler] Error crítico durante el ciclo de recordatorios:', error);
  }
}

/**
 * Inicia el temporizador de recordatorios en segundo plano.
 * Configurado para ejecutarse cada 15 minutos (900000 milisegundos).
 */
export function startReminderScheduler(socket: any): void {
  // Ejecución inmediata inicial para revisión en el arranque
  checkAndSendReminders(socket).catch((err) =>
    console.error('[Scheduler] Error en la ejecución inicial de recordatorios:', err)
  );

  const intervalMs = 15 * 60 * 1000; // 15 minutos
  setInterval(() => {
    checkAndSendReminders(socket).catch((err) =>
      console.error('[Scheduler] Error en ciclo de recordatorios:', err)
    );
  }, intervalMs);

  console.log('[Scheduler] Planificador de recordatorios iniciado. Intervalo de ejecución: cada 15 minutos.');
}
