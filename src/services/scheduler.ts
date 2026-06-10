import { getUnnotifiedAppointments, markAsNotified } from './sheets.js';
import { parseLocaleDateString } from '../utils/parser.js';

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
📍 *Sede Central:* Jr. Loreto 217, Huancayo (Cerca de Plaza Constitución, por el Parque 15 de Junio)

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
