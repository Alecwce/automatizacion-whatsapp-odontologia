import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleUserMessage, sessions } from '../src/services/whatsapp.js';
import * as sheetsService from '../src/services/sheets.js';
import * as calendarService from '../src/services/calendar.js';

vi.mock('../src/services/sheets.js', () => {
  return {
    appendPatientData: vi.fn().mockResolvedValue(true)
  };
});

vi.mock('../src/services/calendar.js', () => {
  return {
    createAppointment: vi.fn().mockResolvedValue(true),
    checkAvailability: vi.fn().mockImplementation((date: Date) => {
      if (date.getFullYear() === 2030) {
        return Promise.resolve(false);
      }
      return Promise.resolve(true);
    })
  };
});

vi.mock('../src/services/ai.js', () => {
  return {
    extractDateFromIntent: vi.fn().mockImplementation((msg: string) => {
      if (msg.includes('invalido') || msg.includes('fallo') || msg.includes('invalida')) {
        return Promise.resolve(null);
      }
      if (msg.includes('choque') || msg.includes('ocupado') || msg.includes('2030')) {
        return Promise.resolve('2030-06-15T14:30:00.000-05:00');
      }
      const nextYear = new Date().getFullYear() + 1;
      return Promise.resolve(`${nextYear}-06-15T14:30:00.000-05:00`);
    }),
    analyzeInitialIntent: vi.fn().mockImplementation((msg: string) => {
      if (msg.includes('horario') || msg.includes('informacion') || msg.includes('hola bot') || msg.includes('pregunta')) {
        return Promise.resolve({
          action: 'PREGUNTA',
          dateIso: null,
          reply: 'Atendemos de Lunes a Viernes de 9am a 1pm y de 3pm a 7pm, y Sábados de 9am a 1pm.'
        });
      }
      if (msg.includes('agendar') || msg.includes('cita')) {
        if (msg.includes('choque') || msg.includes('ocupado')) {
          return Promise.resolve({
            action: 'AGENDAR',
            dateIso: '2030-06-15T10:00:00.000-05:00',
            reply: null
          });
        }
        if (msg.includes('mañana') || msg.includes('10am') || msg.includes('con fecha')) {
          const nextYear = new Date().getFullYear() + 1;
          return Promise.resolve({
            action: 'AGENDAR',
            dateIso: `${nextYear}-06-15T10:00:00.000-05:00`,
            reply: null
          });
        }
        return Promise.resolve({
          action: 'AGENDAR',
          dateIso: null,
          reply: null
        });
      }
      return Promise.resolve({
        action: 'AGENDAR',
        dateIso: null,
        reply: null
      });
    })
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

  it('debe responder una pregunta y mantenerse en estado IDLE', async () => {
    await handleUserMessage(testJid, 'hola bot', mockSender);

    expect(mockSender.sendMessage).toHaveBeenCalledTimes(1);
    expect(mockSender.sendMessage).toHaveBeenCalledWith(
      testJid,
      expect.stringContaining('Atendemos de Lunes a Viernes')
    );

    const session = sessions.get(testJid);
    expect(session?.state).toBe('IDLE');
  });

  it('debe iniciar flujo clasico de agendar sin fecha transicionando a AWAITING_NAME', async () => {
    await handleUserMessage(testJid, 'quiero agendar', mockSender);

    expect(mockSender.sendMessage).toHaveBeenCalledTimes(1);
    expect(mockSender.sendMessage).toHaveBeenCalledWith(
      testJid,
      expect.stringContaining('por favor dime tu nombre completo')
    );

    const session = sessions.get(testJid);
    expect(session?.state).toBe('AWAITING_NAME');
    expect(session?.patientDate).toBeUndefined();
  });

  it('debe ejecutar el atajo inteligente completo (flujo corto Fase 4)', async () => {
    // 1. Enviar cita con fecha inicial -> transiciona a AWAITING_NAME guardando la fecha
    await handleUserMessage(testJid, 'quiero cita mañana a las 10am', mockSender);

    expect(mockSender.sendMessage).toHaveBeenCalledWith(
      testJid,
      expect.stringContaining('¿cuál es tu nombre completo?')
    );

    const sessionAfterInit = sessions.get(testJid);
    expect(sessionAfterInit?.state).toBe('AWAITING_NAME');
    expect(sessionAfterInit?.patientDate).toBeInstanceOf(Date);

    // 2. Enviar nombre -> transiciona a AWAITING_DNI
    await handleUserMessage(testJid, 'Carlos Pérez', mockSender);

    expect(mockSender.sendMessage).toHaveBeenCalledWith(
      testJid,
      expect.stringContaining('ingresa tu número de *DNI o Cédula*')
    );

    const sessionAfterName = sessions.get(testJid);
    expect(sessionAfterName?.state).toBe('AWAITING_DNI');
    expect(sessionAfterName?.patientName).toBe('Carlos Pérez');

    // 3. Enviar DNI -> detecta patientDate pre-existente, guarda en Sheets y Calendar en paralelo y vuelve a IDLE
    mockSender.sendMessage.mockClear();
    await handleUserMessage(testJid, '12345678', mockSender);

    expect(sheetsService.appendPatientData).toHaveBeenCalledTimes(1);
    expect(sheetsService.appendPatientData).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: '57300112233',
        name: 'Carlos Pérez',
        dni: '12345678',
        appointmentDate: expect.any(String)
      })
    );

    expect(calendarService.createAppointment).toHaveBeenCalledTimes(1);

    expect(mockSender.sendMessage).toHaveBeenCalledTimes(1);
    expect(mockSender.sendMessage).toHaveBeenCalledWith(
      testJid,
      expect.stringContaining('agendados de forma exitosa')
    );

    expect(sessions.has(testJid)).toBe(false);
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

  it('debe verificar DNI y transicionar a AWAITING_DATE al recibir un DNI válido en AWAITING_DNI', async () => {
    sessions.set(testJid, {
      state: 'AWAITING_DNI',
      patientName: 'Carlos Pérez',
      attempts: 0,
      lastInteraction: new Date()
    });

    await handleUserMessage(testJid, '12345678', mockSender);

    expect(mockSender.sendMessage).toHaveBeenCalledTimes(1);
    expect(mockSender.sendMessage).toHaveBeenCalledWith(
      testJid,
      expect.stringContaining('DNI verificado con éxito')
    );
    expect(mockSender.sendMessage).toHaveBeenCalledWith(
      testJid,
      expect.stringContaining('¿Qué día y a qué hora')
    );

    const session = sessions.get(testJid);
    expect(session?.state).toBe('AWAITING_DATE');
    expect(session?.patientDni).toBe('12345678');
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

  it('debe agendar en Calendar, guardar en Sheets (5 columnas) y confirmar éxito al recibir fecha válida en AWAITING_DATE', async () => {
    sessions.set(testJid, {
      state: 'AWAITING_DATE',
      patientName: 'Carlos Pérez',
      patientDni: '12345678',
      attempts: 0,
      lastInteraction: new Date()
    });

    await handleUserMessage(testJid, 'mañana a las 2:30 pm', mockSender);

    // Debe persistir de forma paralela en Sheets (con 5 columnas) y Calendar
    expect(sheetsService.appendPatientData).toHaveBeenCalledTimes(1);
    expect(sheetsService.appendPatientData).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: '57300112233',
        name: 'Carlos Pérez',
        dni: '12345678',
        appointmentDate: expect.any(String) // 5ta columna
      })
    );

    expect(calendarService.createAppointment).toHaveBeenCalledTimes(1);
    expect(calendarService.createAppointment).toHaveBeenCalledWith(
      'Carlos Pérez',
      expect.any(Date)
    );

    // Debe enviar mensaje de confirmación de éxito de ambos servicios
    expect(mockSender.sendMessage).toHaveBeenCalledTimes(1);
    expect(mockSender.sendMessage).toHaveBeenCalledWith(
      testJid,
      expect.stringContaining('agendados de forma exitosa')
    );

    // Debe resetear la sesión
    expect(sessions.has(testJid)).toBe(false);
  });

  it('debe gestionar reintentos de fecha inválida y cancelar tras 3 fallos en AWAITING_DATE', async () => {
    sessions.set(testJid, {
      state: 'AWAITING_DATE',
      patientName: 'Carlos Pérez',
      patientDni: '12345678',
      attempts: 0,
      lastInteraction: new Date()
    });

    // Intento 1: Fallido
    await handleUserMessage(testJid, 'fecha-invalida', mockSender);
    expect(mockSender.sendMessage).toHaveBeenCalledWith(
      testJid,
      expect.stringContaining('Intentos restantes: 2')
    );
    expect(sessions.get(testJid)?.attempts).toBe(1);

    // Intento 2: Fallido
    await handleUserMessage(testJid, 'invalida-otra-vez', mockSender);
    expect(mockSender.sendMessage).toHaveBeenCalledWith(
      testJid,
      expect.stringContaining('Intentos restantes: 1')
    );
    expect(sessions.get(testJid)?.attempts).toBe(2);

    // Intento 3: Fallido final
    await handleUserMessage(testJid, 'ultimo-fallo-fecha', mockSender);
    expect(mockSender.sendMessage).toHaveBeenCalledWith(
      testJid,
      expect.stringContaining('registro se ha cancelado')
    );
    expect(sessions.has(testJid)).toBe(false);
  });

  it('debe detectar choque de citas en flujo clasico (AWAITING_DATE) y solicitar otra fecha sin guardar datos', async () => {
    sessions.set(testJid, {
      state: 'AWAITING_DATE',
      patientName: 'Carlos Pérez',
      patientDni: '12345678',
      attempts: 0,
      lastInteraction: new Date()
    });

    // Enviar una fecha que choque (usando texto que retorne el año 2030 en el mock)
    await handleUserMessage(testJid, 'mañana a la hora de choque', mockSender);

    // No debe persistir en Sheets ni en Calendar
    expect(sheetsService.appendPatientData).not.toHaveBeenCalled();
    expect(calendarService.createAppointment).not.toHaveBeenCalled();

    // Debe responder indicando que el horario está reservado
    expect(mockSender.sendMessage).toHaveBeenCalledTimes(1);
    expect(mockSender.sendMessage).toHaveBeenCalledWith(
      testJid,
      expect.stringContaining('ese horario ya se encuentra reservado')
    );

    // Debe mantenerse en AWAITING_DATE para intentar otra fecha
    const session = sessions.get(testJid);
    expect(session?.state).toBe('AWAITING_DATE');
    expect(session?.attempts).toBe(0); // Intentos restablecidos
  });

  it('debe detectar choque de citas en flujo de atajo inteligente (AWAITING_DNI) al registrar DNI, y redirigir a AWAITING_DATE sin guardar datos', async () => {
    // 1. Enviar mensaje inicial en IDLE que pida cita ocupada (que causará choque)
    await handleUserMessage(testJid, 'quiero agendar ocupado', mockSender);

    const sessionInit = sessions.get(testJid);
    expect(sessionInit?.state).toBe('AWAITING_NAME');
    expect(sessionInit?.patientDate?.getFullYear()).toBe(2030); // Validar que guardó la fecha de choque

    // 2. Enviar nombre
    await handleUserMessage(testJid, 'Carlos Pérez', mockSender);

    const sessionName = sessions.get(testJid);
    expect(sessionName?.state).toBe('AWAITING_DNI');

    // 3. Enviar DNI -> Al validar DNI se realiza la persistencia del atajo, detecta el choque, bloquea el guardado y transiciona a AWAITING_DATE
    mockSender.sendMessage.mockClear();
    await handleUserMessage(testJid, '12345678', mockSender);

    // No debe persistir nada
    expect(sheetsService.appendPatientData).not.toHaveBeenCalled();
    expect(calendarService.createAppointment).not.toHaveBeenCalled();

    // Debe responder con el mensaje de choque y pedir nueva fecha
    expect(mockSender.sendMessage).toHaveBeenCalledTimes(1);
    expect(mockSender.sendMessage).toHaveBeenCalledWith(
      testJid,
      expect.stringContaining('ese horario ya se encuentra reservado')
    );

    // Debe transicionar al estado clásico AWAITING_DATE para que ingrese otra fecha
    const sessionDni = sessions.get(testJid);
    expect(sessionDni?.state).toBe('AWAITING_DATE');
    expect(sessionDni?.attempts).toBe(0);
  });

  it('debe responder amablemente a un mensaje de cortesia o despedida clasificado como PREGUNTA y mantenerse en IDLE', async () => {
    await handleUserMessage(testJid, 'muchas gracias por la informacion', mockSender);

    expect(mockSender.sendMessage).toHaveBeenCalledTimes(1);
    expect(mockSender.sendMessage).toHaveBeenCalledWith(
      testJid,
      expect.stringContaining('Atendemos de Lunes a Viernes') // Reply del mock de pregunta en FSM
    );

    const session = sessions.get(testJid);
    expect(session?.state).toBe('IDLE');
  });
});
