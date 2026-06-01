import 'dotenv/config';

interface Config {
  spreadsheetId: string;
  googleApplicationCredentials: string;
}

function validateEnv(): Config {
  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error('La variable de entorno SPREADSHEET_ID es requerida pero no está definida.');
  }

  const googleApplicationCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS || 'service-account.json';

  return {
    spreadsheetId,
    googleApplicationCredentials,
  };
}

export const env = validateEnv();
