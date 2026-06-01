import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appendPatientData } from '../src/services/sheets.js';
import { google } from 'googleapis';

vi.mock('googleapis', () => {
  const mockAppend = vi.fn().mockResolvedValue({
    status: 200,
    data: {
      updates: {
        updatedCells: 4,
      },
    },
  });

  const mockSheets = vi.fn().mockReturnValue({
    spreadsheets: {
      values: {
        append: mockAppend,
      },
    },
  });

  return {
    google: {
      sheets: mockSheets,
    },
  };
});

vi.mock('google-auth-library', () => {
  return {
    JWT: vi.fn().mockImplementation(() => {
      return {};
    }),
  };
});

describe('Servicio de Google Sheets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe registrar exitosamente los datos del paciente en Google Sheets con el formato y orden correcto', async () => {
    const mockData = {
      timestamp: '2026-05-31T16:30:00Z',
      phone: '34600112233',
      name: 'Juan Pérez',
      dni: '12345678',
    };

    const result = await appendPatientData(mockData);

    expect(result).toBe(true);

    const sheetsInstance = google.sheets({ version: 'v4' });
    expect(sheetsInstance.spreadsheets.values.append).toHaveBeenCalledTimes(1);
    expect(sheetsInstance.spreadsheets.values.append).toHaveBeenCalledWith(
      expect.objectContaining({
        spreadsheetId: expect.any(String),
        range: 'Sheet1!A:D',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [
            [
              mockData.timestamp,
              mockData.phone,
              mockData.name,
              mockData.dni,
            ],
          ],
        },
      })
    );
  });

  it('debe manejar errores de la API de Google Sheets de manera segura sin crashear', async () => {
    const sheetsInstance = google.sheets({ version: 'v4' });
    vi.mocked(sheetsInstance.spreadsheets.values.append).mockRejectedValueOnce(
      new Error('API quota exceeded')
    );

    const mockData = {
      timestamp: '2026-05-31T16:30:00Z',
      phone: '34600112233',
      name: 'Juan Pérez',
      dni: '12345678',
    };

    const result = await appendPatientData(mockData);
    expect(result).toBe(false);
  });
});
