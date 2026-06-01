import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../config/env.js';

let genAI: GoogleGenerativeAI | null = null;

function getAIClient(): GoogleGenerativeAI {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(env.geminiApiKey);
  }
  return genAI;
}
/**
 * Genera dinámicamente un string con el mapeo de los próximos 7 días a partir de una fecha base en la zona horaria de Bogotá.
 * Retorna un string formateado como: 'Lunes: 2026-06-01, Martes: 2026-06-02...'
 */
function getNext7DaysReference(baseDate: Date): string {
  const parts: string[] = [];
  
  for (let i = 0; i < 7; i++) {
    const targetDate = new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000);
    
    const formatter = new Intl.DateTimeFormat('es-ES', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'long'
    });
    
    const formattedParts = formatter.formatToParts(targetDate);
    const year = formattedParts.find(p => p.type === 'year')?.value;
    const month = formattedParts.find(p => p.type === 'month')?.value;
    const day = formattedParts.find(p => p.type === 'day')?.value;
    let weekday = formattedParts.find(p => p.type === 'weekday')?.value || '';
    
    if (weekday) {
      weekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
    }
    
    parts.push(`${weekday}: ${year}-${month}-${day}`);
  }
  
  return parts.join(', ');
}

/**
 * Procesa el mensaje del usuario en lenguaje natural mediante Gemini AI para extraer la fecha y hora deseadas.
 * Devuelve la fecha calculada en formato ISO 8601 si es una fecha futura válida, o null en caso contrario.
 */
export async function extractDateFromIntent(userMessage: string): Promise<string | null> {
  try {
    const ai = getAIClient();
    const currentDate = new Date();
    
    // Formatear la fecha local de Bogotá/Colombia como contexto temporal de referencia
    const currentDateStr = currentDate.toLocaleString('es-ES', { 
      timeZone: 'America/Bogota',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const daysReference = getNext7DaysReference(currentDate);

    const systemInstruction = `
Eres un sistema de inteligencia artificial especializado en extraer fechas y horas de citas médicas a partir de mensajes de texto en lenguaje natural en español.

Contexto temporal real de referencia en el servidor:
- Fecha y hora actual del sistema: ${currentDateStr} (Zona horaria: America/Bogota)

Utiliza la siguiente referencia de los próximos 7 días para mapear con precisión absoluta cualquier fecha relativa (como 'mañana', 'el jueves', etc.) y evitar errores de cálculo de calendario: [${daysReference}]

Instrucciones estrictas de comportamiento:
1. Analiza el mensaje del usuario e identifica la fecha y hora de la cita que desea agendar.
2. Resuelve referencias relativas ("hoy", "mañana", "pasado mañana", "el viernes a las 3", "este lunes a las 10:30 am", etc.) calculando la fecha exacta basándote en el contexto temporal de referencia provisto arriba.
3. Tu respuesta debe consistir EXCLUSIVAMENTE de la fecha y hora calculada en formato ISO 8601 local (ejemplo: '2026-06-01T15:30:00.000Z' o con offset local '2026-06-01T15:30:00.000-05:00') o la palabra literal 'null' si el texto no contiene información clara de fecha y hora, si es ambiguo, o si no se puede determinar.
4. Queda estrictamente PROHIBIDO incluir explicaciones, comentarios, saltos de línea ni formato markdown (prohibido usar bloques de código con comillas invertidas como \`\`\`json o \`\`\`text). La respuesta debe ser únicamente el string ISO o la palabra 'null'.
    `.trim();

    // Inicializar el modelo obligatorio especificado: gemini-3.1-flash-lite
    const model = ai.getGenerativeModel({
      model: 'gemini-3.1-flash-lite',
      systemInstruction: systemInstruction,
    });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: userMessage }] }]
    });

    const responseText = result.response.text().trim().replace(/```[a-z]*|```/g, '').trim();

    if (!responseText || responseText.toLowerCase() === 'null') {
      return null;
    }

    const parsedDate = new Date(responseText);

    // Validar que represente una fecha válida y que no se desborde o sea inválida
    if (isNaN(parsedDate.getTime())) {
      return null;
    }

    // Verificar que sea una fecha en el futuro (tolerancia de 2 minutos para el procesamiento)
    if (parsedDate.getTime() <= currentDate.getTime() - 2 * 60 * 1000) {
      return null;
    }

    return parsedDate.toISOString();
  } catch (error) {
    console.error('Error al procesar la intención con Gemini AI:', error instanceof Error ? error.message : error);
    return null;
  }
}

export interface IntentAnalysis {
  action: 'AGENDAR' | 'PREGUNTA';
  dateIso: string | null;
  reply: string | null;
}

/**
 * Analiza el mensaje inicial en IDLE para clasificar la intención en agendar o realizar una pregunta.
 * Devolverá un objeto estructurado según la clasificación de Gemini AI.
 */
export async function analyzeInitialIntent(userMessage: string): Promise<IntentAnalysis> {
  try {
    const ai = getAIClient();
    const currentDate = new Date();
    
    // Formatear la fecha local de Bogotá/Colombia como contexto temporal de referencia
    const currentDateStr = currentDate.toLocaleString('es-ES', { 
      timeZone: 'America/Bogota',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const daysReference = getNext7DaysReference(currentDate);

    const systemInstruction = `
Eres el enrutador inteligente y clasificador de intenciones iniciales del consultorio odontológico "Clínica Odontológica".

Tu rol es clasificar el mensaje entrante del usuario de forma nativa e inteligente bajo una de las dos siguientes intenciones/acciones:

1. "action": "AGENDAR"
   - Si el usuario expresa clara intención de programar, agendar, pedir, reservar, o solicitar una cita o consulta con el dentista/odontólogo.
   - Si el mensaje incluye alguna referencia de fecha y hora (ej: "quiero cita para mañana a las diez de la mañana"), debes calcular la fecha exacta en formato ISO 8601 local basándote en el contexto temporal de referencia actual provisto abajo.
   - REGLAS ESTRICTAS DE HORARIOS DE ATENCIÓN COMERCIAL:
     * Lunes a Viernes: 9:00 AM a 1:00 PM y de 3:00 PM a 7:00 PM.
     * Sábados: 9:00 AM a 1:00 PM.
     * Domingos: CERRADO (No se atiende, domingos es cerrado).
     * Si la fecha/hora calculada cae en domingo o fuera de estos rangos de horario hábiles comerciales, el mensaje DEBE clasificarse obligatoriamente con la acción "PREGUNTA" (ver reglas de PREGUNTA a continuación) y redactar en "reply" una respuesta sumamente amable y profesional en español explicando nuestro horario de atención comercial e invitándole a elegir otra fecha y hora hábil. (PROHIBIDO retornar action: AGENDAR en este caso).
     * Si el usuario no menciona ninguna fecha/hora en su mensaje pero desea agendar, retornar action: "AGENDAR" con "dateIso" en null. El campo "reply" debe ser null en este caso.

2. "action": "PREGUNTA"
   - Si el usuario realiza una pregunta informativa (horarios, servicios, ubicación, precios) o simplemente saluda ("hola", "buenos días") sin intenciones específicas de agendar de forma inmediata.
   - Si la solicitud de agendamiento cae fuera de horario laboral o en domingo (ver reglas de horarios en AGENDAR).
   - REGLA DE CORTESÍA Y DESPEDIDA: Si el usuario envía un mensaje de cortesía, agradecimiento, confirmación simple o despedida (ej: "gracias", "muchas gracias", "chao", "ok", "perfecto", "vale"), debes clasificar la acción obligatoriamente como "PREGUNTA". En el campo "reply" redactarás una respuesta de despedida o agradecimiento sumamente cortés y profesional en español (ej: "¡Gracias a ti! Que tengas un excelente día." o "¡Con gusto! Que tengas un día maravilloso.") libre de llamados a la acción o nuevas preguntas.
   - En todos los casos de PREGUNTA, debes redactar en el campo "reply" la respuesta correspondiente y el campo "dateIso" DEBE ser estrictamente null.

Contexto temporal de referencia en el servidor:
- Fecha y hora actual del sistema: ${currentDateStr} (America/Bogota)

Utiliza la siguiente referencia de los próximos 7 días para mapear con precisión absoluta cualquier fecha relativa (como 'mañana', 'el jueves', etc.) y evitar errores de cálculo de calendario: [${daysReference}]

RESTRICCIÓN ESTRICTA DE SALIDA:
Devolver EXCLUSIVAMENTE un string JSON plano y válido con la siguiente estructura, sin saltos de línea adicionales y sin bloques de formato markdown (PROHIBIDO usar bloques de código como \`\`\`json o \`\`\`):
{"action": "AGENDAR" | "PREGUNTA", "dateIso": "YYYY-MM-DDTHH:mm:ss.sssZ" | null, "reply": "Respuesta corta o nulo"}
    `.trim();

    // Inicializar el modelo obligatorio especificado: gemini-3.1-flash-lite
    const model = ai.getGenerativeModel({
      model: 'gemini-3.1-flash-lite',
      systemInstruction: systemInstruction,
    });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: userMessage }] }]
    });

    const responseText = result.response.text().trim().replace(/```[a-z]*|```/g, '').trim();

    try {
      const parsed: IntentAnalysis = JSON.parse(responseText);
      
      // Sanitizar retornos de Gemini
      if (parsed.action !== 'AGENDAR' && parsed.action !== 'PREGUNTA') {
        parsed.action = 'PREGUNTA';
      }

      // Validar fecha futura si existe
      if (parsed.action === 'AGENDAR' && parsed.dateIso) {
        const parsedDate = new Date(parsed.dateIso);
        if (isNaN(parsedDate.getTime()) || parsedDate.getTime() <= currentDate.getTime() - 2 * 60 * 1000) {
          parsed.dateIso = null;
        }
      }

      return parsed;
    } catch (parseError) {
      console.error('Error al parsear el JSON de la intención inicial de Gemini:', responseText, parseError);
      return {
        action: 'PREGUNTA',
        dateIso: null,
        reply: '¡Hola! Bienvenido a nuestra Clínica Odontológica. ¿En qué podemos ayudarte hoy?'
      };
    }
  } catch (error) {
    console.error('Error en analyzeInitialIntent:', error instanceof Error ? error.message : error);
    return {
      action: 'PREGUNTA',
      dateIso: null,
      reply: '¡Hola! Bienvenido a nuestra Clínica Odontológica. ¿En qué podemos ayudarte hoy?'
    };
  }
}
