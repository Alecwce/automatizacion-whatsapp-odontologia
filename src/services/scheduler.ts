import { getUnnotifiedAppointments, markAsNotified } from './sheets.js';

/**
 * Parsea un string de fecha en formato regional es-PE (ej. '10/6/2026 23:45:00' o '10/6/2026, 23:45:00')
 * a un objeto Date interpretado localmente.
 */
function parseLocaleDateString(dateStr: string): Date | null {
  try {
    const normalized = dateStr.replace(/,/g, '').trim();
    const parts = normalized.split(/\s+/);
    if (parts.length < 2) return null;

    const [datePart, timePart] = parts;
    const dateSubparts = datePart.split('/');
    if (dateSubparts.length !== 3) return null;

    const day = parseInt(dateSubparts[0], 10);
    const month = parseInt(dateSubparts[1], 10) - 1; // 0-indexed en JS
    const year = parseInt(dateSubparts[2], 10);

    const timeSubparts = timePart.split(':');
    if (timeSubparts.length < 2) return null;

    const hours = parseInt(timeSubparts[0], 10);
    const minutes = parseInt(timeSubparts[1], 10);
    const seconds = timeSubparts[2] ? parseInt(timeSubparts[2], 10) : 0;

    return new Date(year, month, day, hours, minutes, seconds);
  } catch (err) {
    console.error(`[Scheduler] Error al parsear fecha de cita "${dateStr}":`, err);
    return null;
  }
}

/**
 * Ejecuta el ciclo de revisión de recordatorios.
 * Exportada para permitir su ejecución manual desde comandos de prueba.
 */
export async function checkAndSendReminders(socket: any): Promise<void> {
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
      const apptDate = parseLocaleDateString(appt.appointmentDate);
      if (!apptDate) {
        console.warn(`[Scheduler] No se pudo parsear la fecha de cita para el paciente ${appt.name}: "${appt.appointmentDate}"`);
        continue;
      }

      const diffMs = apptDate.getTime() - now.getTime();
      const diffMinutes = diffMs / (60 * 1000);

      console.log(`[Scheduler] Cita de ${appt.name} para ${appt.appointmentDate} está a ${diffMinutes.toFixed(1)} minutos de distancia.`);

      // Ventana de 15 a 35 minutos antes de la cita (captura ideal de los 30 minutos)
      if (diffMinutes >= 15 && diffMinutes <= 35) {
        console.log(`[Scheduler] Cita de ${appt.name} califica para notificación (diferencia: ${diffMinutes.toFixed(1)} min). Enviando WhatsApp...`);

        const phoneClean = appt.phone.trim();
        const phoneJid = phoneClean.includes('@') ? phoneClean : `${phoneClean}@s.whatsapp.net`;

        const horaCita = apptDate.toLocaleTimeString('es-PE', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });

        const message = `⏰ *RECORDATORIO DE CITA MÉDICA* 🦷

Hola *${appt.name}*, te saludamos del *Consultorio Sánchez*.

Te recordamos que tu cita odontológica está programada para dentro de *30 minutos*.

📅 *Horario:* ${horaCita}
👩⚕️ *Especialista:* Dra. Luisa Sánchez
📍 *Sede Principal:* Av. Julio C. Tello 456, El Tambo (Huancayo)

Por favor, procura asistir 10 minutos antes de tu turno. ¡Te esperamos para cuidar tu sonrisa! ✨`;

        try {
          await socket.sendMessage(phoneJid, { text: message });
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
