import 'dotenv/config';

interface Config {
  spreadsheetId: string;
  googleApplicationCredentials: string;
  calendarId: string;
  geminiApiKey: string;
}

function validateEnv(): Config {
  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error('La variable de entorno SPREADSHEET_ID es requerida pero no está definida.');
  }

  const calendarId = process.env.CALENDAR_ID;
  if (!calendarId) {
    throw new Error('La variable de entorno CALENDAR_ID es requerida pero no está definida.');
  }

  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    throw new Error('La variable de entorno GEMINI_API_KEY es requerida pero no está definida.');
  }

  const googleApplicationCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS || 'service-account.json';

  return {
    spreadsheetId,
    calendarId,
    geminiApiKey,
    googleApplicationCredentials,
  };
}

export const env = validateEnv();
