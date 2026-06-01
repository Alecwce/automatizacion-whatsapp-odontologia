import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import * as fs from 'fs';
import * as path from 'path';
import { env } from '../config/env.js';

let calendarClient: any = null;

/**
 * Obtiene o inicializa de forma asíncrona y diferida (lazy) el cliente de Google Calendar.
 */
function getCalendarClient() {
  if (calendarClient) {
    return calendarClient;
  }

  const credentialsPath = path.resolve(process.cwd(), env.googleApplicationCredentials);

  if (!fs.existsSync(credentialsPath)) {
    throw new Error(`No se encontró el archivo de credenciales en la ruta: ${credentialsPath}`);
  }

  const credentialsRaw = fs.readFileSync(credentialsPath, 'utf8');
  const credentials = JSON.parse(credentialsRaw);

  const auth = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });

  calendarClient = google.calendar({ version: 'v3', auth });
  return calendarClient;
}

/**
 * Agenda una cita odontológica de 1 hora en Google Calendar para un paciente.
 */
export async function createAppointment(patientName: string, date: Date): Promise<boolean> {
  try {
    const calendar = getCalendarClient();
    
    const startDateTime = date.toISOString();
    const endDateTime = new Date(date.getTime() + 60 * 60 * 1000).toISOString(); // +1 hora

    const response = await calendar.events.insert({
      calendarId: env.calendarId,
      requestBody: {
        summary: `Cita Odontológica - ${patientName}`,
        description: `Cita odontológica agendada automáticamente para el paciente: ${patientName}.`,
        start: {
          dateTime: startDateTime,
          timeZone: 'America/Bogota', // Zona horaria por defecto para odontología en Bogotá/Colombia
        },
        end: {
          dateTime: endDateTime,
          timeZone: 'America/Bogota',
        },
      },
    });

    return Boolean(response.status === 200);
  } catch (error) {
    console.error('Error al registrar cita en Google Calendar:', error instanceof Error ? error.message : error);
    return false;
  }
}
