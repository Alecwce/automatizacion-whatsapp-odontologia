import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleUserMessage, sessions } from '../src/services/whatsapp.js';
import * as sheetsService from '../src/services/sheets.js';

vi.mock('../src/services/sheets.js', () => {
  return {
    appendPatientData: vi.fn().mockResolvedValue(true)
  };
});

describe('Máquina de Estados Finita (FSM) del Bot Conversacional', () => {
  const testJid = '57300112233@s.whatsapp.net';
  let mockSender: { sendMessage: any };

  beforeEach(() => {
    sessions.clear();
    vi.clearAllMocks();
    mockSender = {
      sendMessage: vi.fn().mockResolvedValue({})
    };
  });

  it('debe iniciar el flujo conversacional al recibir un saludo en estado IDLE', async () => {
    await handleUserMessage(testJid, 'hola bot', mockSender);

    expect(mockSender.sendMessage).toHaveBeenCalledTimes(1);
    expect(mockSender.sendMessage).toHaveBeenCalledWith(
      testJid,
      expect.stringContaining('Bienvenido al consultorio odontológico')
    );

    const session = sessions.get(testJid);
    expect(session).toBeDefined();
    expect(session?.state).toBe('AWAITING_NAME');
  });

  it('debe capturar el nombre y solicitar el DNI al estar en AWAITING_NAME', async () => {
    sessions.set(testJid, {
      state: 'AWAITING_NAME',
      attempts: 0,
      lastInteraction: new Date()
    });

    await handleUserMessage(testJid, 'me llamo Carlos Pérez', mockSender);

    expect(mockSender.sendMessage).toHaveBeenCalledTimes(1);
    expect(mockSender.sendMessage).toHaveBeenCalledWith(
      testJid,
      expect.stringContaining('Carlos Pérez')
    );
    expect(mockSender.sendMessage).toHaveBeenCalledWith(
      testJid,
      expect.stringContaining('ingresa tu número de *DNI o Cédula*')
    );

    const session = sessions.get(testJid);
    expect(session?.state).toBe('AWAITING_DNI');
    expect(session?.patientName).toBe('Carlos Pérez');
  });

  it('debe registrar en Sheets y confirmar éxito al recibir un DNI válido en AWAITING_DNI', async () => {
    sessions.set(testJid, {
      state: 'AWAITING_DNI',
      patientName: 'Carlos Pérez',
      attempts: 0,
      lastInteraction: new Date()
    });

    await handleUserMessage(testJid, '12345678', mockSender);

    expect(sheetsService.appendPatientData).toHaveBeenCalledTimes(1);
    expect(sheetsService.appendPatientData).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: '57300112233',
        name: 'Carlos Pérez',
        dni: '12345678'
      })
    );

    expect(mockSender.sendMessage).toHaveBeenCalledTimes(1);
    expect(mockSender.sendMessage).toHaveBeenCalledWith(
      testJid,
      expect.stringContaining('registrados exitosamente')
    );

    expect(sessions.has(testJid)).toBe(false);
  });

  it('debe gestionar reintentos de DNI inválido y cancelar el registro tras 3 fallos', async () => {
    sessions.set(testJid, {
      state: 'AWAITING_DNI',
      patientName: 'Carlos Pérez',
      attempts: 0,
      lastInteraction: new Date()
    });

    await handleUserMessage(testJid, 'documento-invalido', mockSender);
    expect(mockSender.sendMessage).toHaveBeenCalledWith(
      testJid,
      expect.stringContaining('Intentos restantes: 2')
    );
    expect(sessions.get(testJid)?.attempts).toBe(1);

    await handleUserMessage(testJid, 'otro-invalido', mockSender);
    expect(mockSender.sendMessage).toHaveBeenCalledWith(
      testJid,
      expect.stringContaining('Intentos restantes: 1')
    );
    expect(sessions.get(testJid)?.attempts).toBe(2);

    await handleUserMessage(testJid, 'ultimo-fallo', mockSender);
    expect(mockSender.sendMessage).toHaveBeenCalledWith(
      testJid,
      expect.stringContaining('registro se ha cancelado')
    );
    expect(sessions.has(testJid)).toBe(false);
  });
});
