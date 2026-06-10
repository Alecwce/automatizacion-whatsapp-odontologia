import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import * as fs from 'fs';
import * as path from 'path';
import { env } from '../config/env.js';
import { PatientData } from '../types.js';

let sheetsClient: any = null;

/**
 * Obtiene o inicializa de forma asíncrona y diferida (lazy) el cliente de Google Sheets.
 */
function getSheetsClient() {
  if (sheetsClient) {
    return sheetsClient;
  }

  const credentialsPath = path.resolve(process.cwd(), env.googleApplicationCredentials);

  if (!fs.existsSync(credentialsPath)) {
    throw new Error(`No se encontró el archivo de credenciales de Google Sheets en la ruta: ${credentialsPath}`);
  }

  const credentialsRaw = fs.readFileSync(credentialsPath, 'utf8');
  const credentials = JSON.parse(credentialsRaw);

  const auth = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

/**
 * Registra los datos de un paciente en una nueva fila de la hoja de Google Sheets.
 * Estructura de columnas requerida: [Fecha/Hora Registro] | [Número Teléfono] | [Nombre del Paciente] | [DNI]
 */
export async function appendPatientData(data: PatientData): Promise<boolean> {
  try {
    const sheets = getSheetsClient();
    const range = 'Sheet1!A:H';

    const values = [
      [
        data.timestamp,
        data.phone,
        data.name,
        data.dni,
        data.appointmentDate || '',
        data.patientReason || '',
        '', // Columna G: Notificado (inicialmente vacío)
        data.whatsappId || '' // Columna H: WhatsApp ID
      ]
    ];

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: env.spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values,
      },
    });

    return Boolean(response.status === 200);
  } catch (error) {
    console.error('Error al registrar datos en Google Sheets:', error instanceof Error ? error.message : error);
    return false;
  }
}

export interface AppointmentRow {
  rowNumber: number;
  timestamp: string;
  phone: string;
  name: string;
  dni: string;
  appointmentDate: string;
  patientReason: string;
  notified: string;
  whatsappId: string;
}

/**
 * Lee todas las citas de Sheets y retorna aquellas que no han sido notificadas (columna G vacía o diferente de SI/SÍ).
 */
export async function getUnnotifiedAppointments(): Promise<AppointmentRow[]> {
  try {
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: env.spreadsheetId,
      range: 'Sheet1!A2:H',
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return [];
    }

    const appointments: AppointmentRow[] = [];
    rows.forEach((row: any[], index: number) => {
      const rowNumber = index + 2; // Fila real en la hoja de cálculo (A2 es índice 0 -> fila 2)
      const notified = row[6] ? String(row[6]).trim().toUpperCase() : '';

      // Si no ha sido notificado ("SI" o "SÍ") y cuenta con una fecha de cita
      if (notified !== 'SI' && notified !== 'SÍ' && row[4]) {
        appointments.push({
          rowNumber,
          timestamp: row[0] || '',
          phone: row[1] || '',
          name: row[2] || '',
          dni: row[3] || '',
          appointmentDate: row[4] || '',
          patientReason: row[5] || '',
          notified,
          whatsappId: row[7] || ''
        });
      }
    });

    return appointments;
  } catch (error) {
    console.error('Error al obtener citas no notificadas de Google Sheets:', error instanceof Error ? error.message : error);
    return [];
  }
}

/**
 * Escribe "SI" en la columna G (Notificado) de la fila correspondiente.
 */
export async function markAsNotified(rowNumber: number): Promise<boolean> {
  try {
    const sheets = getSheetsClient();
    const range = `Sheet1!G${rowNumber}`;
    const values = [['SI']];

    const response = await sheets.spreadsheets.values.update({
      spreadsheetId: env.spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values,
      },
    });

    return Boolean(response.status === 200);
  } catch (error) {
    console.error(`Error al marcar fila ${rowNumber} como notificado en Google Sheets:`, error instanceof Error ? error.message : error);
    return false;
  }
}
