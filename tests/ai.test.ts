import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractDateFromIntent, analyzeInitialIntent } from '../src/services/ai.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

vi.mock('@google/generative-ai', () => {
  const mockGenerateContent = vi.fn();
  
  const mockGetGenerativeModel = vi.fn().mockReturnValue({
    generateContent: mockGenerateContent,
  });

  return {
    GoogleGenerativeAI: vi.fn().mockImplementation(() => {
      return {
        getGenerativeModel: mockGetGenerativeModel,
      };
    }),
  };
});

describe('Servicio de Inteligencia Artificial (Gemini)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe inicializar el cliente e invocar exitosamente gemini-2.5-flash retornando una fecha válida en el futuro', async () => {
    const nextYear = new Date().getFullYear() + 1;
    const mockIsoString = `${nextYear}-06-15T14:30:00.000-05:00`;
    
    const genAIInstance = new GoogleGenerativeAI('test-key');
    const modelInstance = genAIInstance.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    vi.mocked(modelInstance.generateContent).mockResolvedValueOnce({
      response: {
        text: () => mockIsoString,
      },
    } as any);

    const result = await extractDateFromIntent('quiero cita mañana a las dos y media de la tarde');

    expect(result).toBeTypeOf('string');
    
    const resultDate = new Date(result as string);
    expect(resultDate.getFullYear()).toBe(nextYear);
    expect(resultDate.getMonth()).toBe(5); // Junio
    expect(resultDate.getDate()).toBe(15);
    expect(resultDate.getHours()).toBe(14);
    expect(resultDate.getMinutes()).toBe(30);

    expect(genAIInstance.getGenerativeModel).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-2.5-flash',
        systemInstruction: expect.stringContaining('Contexto temporal real de referencia'),
      })
    );
  });

  it('debe retornar null si la IA devuelve "null" o no comprende la intención', async () => {
    const genAIInstance = new GoogleGenerativeAI('test-key');
    const modelInstance = genAIInstance.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    vi.mocked(modelInstance.generateContent).mockResolvedValueOnce({
      response: {
        text: () => 'null',
      },
    } as any);

    const result = await extractDateFromIntent('quiero cualquier cosa');
    expect(result).toBeNull();
  });

  it('debe retornar null si la IA responde con una fecha en el pasado', async () => {
    const genAIInstance = new GoogleGenerativeAI('test-key');
    const modelInstance = genAIInstance.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    vi.mocked(modelInstance.generateContent).mockResolvedValueOnce({
      response: {
        text: () => '2020-01-01T10:00:00.000Z',
      },
    } as any);

    const result = await extractDateFromIntent('ayer a las diez');
    expect(result).toBeNull();
  });

  describe('Clasificador de Intenciones Iniciales (analyzeInitialIntent)', () => {
    it('debe clasificar una pregunta informativa de forma exitosa y retornar PREGUNTA', async () => {
      const genAIInstance = new GoogleGenerativeAI('test-key');
      const modelInstance = genAIInstance.getGenerativeModel({ model: 'gemini-2.5-flash' });
      
      const mockJsonResponse = JSON.stringify({
        action: 'PREGUNTA',
        dateIso: null,
        reply: 'Atendemos de Lunes a Viernes de 9am a 1pm y de 3pm a 7pm.'
      });

      vi.mocked(modelInstance.generateContent).mockResolvedValueOnce({
        response: {
          text: () => mockJsonResponse,
        },
      } as any);

      const result = await analyzeInitialIntent('¿en qué horario atienden?');

      expect(result.action).toBe('PREGUNTA');
      expect(result.dateIso).toBeNull();
      expect(result.reply).toBe('Atendemos de Lunes a Viernes de 9am a 1pm y de 3pm a 7pm.');
    });

    it('debe clasificar una peticion de cita con fecha valida y retornar AGENDAR con fecha ISO', async () => {
      const nextYear = new Date().getFullYear() + 1;
      const mockIsoString = `${nextYear}-06-15T10:00:00.000-05:00`;
      
      const genAIInstance = new GoogleGenerativeAI('test-key');
      const modelInstance = genAIInstance.getGenerativeModel({ model: 'gemini-2.5-flash' });
      
      const mockJsonResponse = JSON.stringify({
        action: 'AGENDAR',
        dateIso: mockIsoString,
        reply: null
      });

      vi.mocked(modelInstance.generateContent).mockResolvedValueOnce({
        response: {
          text: () => mockJsonResponse,
        },
      } as any);

      const result = await analyzeInitialIntent('quiero una cita para el proximo año a las 10 am');

      expect(result.action).toBe('AGENDAR');
      expect(result.dateIso).toBe(mockIsoString);
      expect(result.reply).toBeNull();
    });

    it('debe retornar dateIso null si la cita cae fuera del horario laboral o en domingo', async () => {
      const genAIInstance = new GoogleGenerativeAI('test-key');
      const modelInstance = genAIInstance.getGenerativeModel({ model: 'gemini-2.5-flash' });
      
      const mockJsonResponse = JSON.stringify({
        action: 'AGENDAR',
        dateIso: null,
        reply: null
      });

      vi.mocked(modelInstance.generateContent).mockResolvedValueOnce({
        response: {
          text: () => mockJsonResponse,
        },
      } as any);

      const result = await analyzeInitialIntent('quiero cita el domingo a las 3 am');

      expect(result.action).toBe('AGENDAR');
      expect(result.dateIso).toBeNull();
      expect(result.reply).toBeNull();
    });
  });
});
