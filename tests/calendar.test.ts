import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAppointment } from '../src/services/calendar.js';
import { google } from 'googleapis';

vi.mock('googleapis', () => {
  const mockInsert = vi.fn().mockResolvedValue({
    status: 200,
    data: {
      htmlLink: 'https://calendar.google.com/event?id=123',
    },
  });

  const mockCalendar = vi.fn().mockReturnValue({
    events: {
      insert: mockInsert,
    },
  });

  return {
    google: {
      calendar: mockCalendar,
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

describe('Servicio de Google Calendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe registrar de forma exitosa una cita de 1 hora de duración con el ID del calendario correcto', async () => {
    const testDate = new Date('2026-06-15T15:30:00.000Z');
    const result = await createAppointment('Carlos Pérez', testDate);

    expect(result).toBe(true);

    const calendarInstance = google.calendar({ version: 'v3' });
    expect(calendarInstance.events.insert).toHaveBeenCalledTimes(1);
    expect(calendarInstance.events.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        calendarId: expect.any(String),
        requestBody: {
          summary: 'Cita Odontológica - Carlos Pérez',
          description: expect.stringContaining('Carlos Pérez'),
          start: {
            dateTime: testDate.toISOString(),
            timeZone: 'America/Bogota',
          },
          end: {
            dateTime: new Date(testDate.getTime() + 60 * 60 * 1000).toISOString(),
            timeZone: 'America/Bogota',
          },
        },
      })
    );
  });

  it('debe manejar errores de la API de Google Calendar de forma segura', async () => {
    const calendarInstance = google.calendar({ version: 'v3' });
    vi.mocked(calendarInstance.events.insert).mockRejectedValueOnce(
      new Error('API quota exceeded')
    );

    const testDate = new Date('2026-06-15T15:30:00.000Z');
    const result = await createAppointment('Carlos Pérez', testDate);

    expect(result).toBe(false);
  });
});
