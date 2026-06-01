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
    const range = 'Sheet1!A:D';

    const values = [
      [
        data.timestamp,
        data.phone,
        data.name,
        data.dni
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
