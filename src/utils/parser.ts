const NAME_PREFIXES = [
  'me llamo',
  'mi nombre es',
  'soy',
  'mi nombre',
  'nombre:'
];

/**
 * Valida y extrae el DNI a partir del texto ingresado por el paciente.
 * Exige exactamente 8 dígitos numéricos, sin letras ni espacios.
 */
export function parsePatientDni(text: string): string | null {
  const cleaned = text.trim();
  if (/^\d{8}$/.test(cleaned)) {
    return cleaned;
  }
  return null;
}

/**
 * Limpia y valida el nombre proporcionado por el paciente.
 * Exige al menos dos palabras formadas únicamente por letras y separadas por espacio.
 */
export function parsePatientName(text: string): string | null {
  let cleaned = text.trim();
  
  const lowerText = cleaned.toLowerCase();
  for (const prefix of NAME_PREFIXES) {
    if (lowerText.startsWith(prefix)) {
      cleaned = cleaned.slice(prefix.length).trim();
      break;
    }
  }

  // Filtro militar: no debe contener ningún número ni carácter especial (solo letras y espacios)
  if (/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/.test(cleaned)) {
    return null;
  }

  // Regex para exigir al menos dos palabras separadas por espacios, conteniendo solo letras y con mínimo 3 caracteres cada una.
  const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]{3,}(?:\s+[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]{3,})+$/;
  if (!nameRegex.test(cleaned)) {
    return null;
  }

  return capitalizeName(cleaned);
}

/**
 * Capitaliza cada palabra de un nombre (ej: "juan perez" -> "Juan Perez")
 */
function capitalizeName(name: string): string {
  return name
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Valida y parsea la fecha y hora ingresada por el paciente para la cita médica.
 * Formato esperado: YYYY-MM-DD HH:mm (ej: 2026-06-15 14:30)
 * La fecha debe ser futura y válida en el calendario.
 */
export function parseAppointmentDate(text: string): Date | null {
  const normalizedText = text.trim();
  const dateRegex = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/;
  const match = normalizedText.match(dateRegex);
  
  if (!match) {
    return null;
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  const hour = parseInt(match[4], 10);
  const minute = parseInt(match[5], 10);

  // El mes en el constructor de Date de JS es 0-indexed (0 = Enero, 11 = Diciembre)
  const parsedDate = new Date(year, month - 1, day, hour, minute);

  // Evitar desbordamiento de fecha de JS (ej: 31 de Febrero -> 3 de Marzo)
  if (
    parsedDate.getFullYear() !== year ||
    parsedDate.getMonth() !== month - 1 ||
    parsedDate.getDate() !== day ||
    parsedDate.getHours() !== hour ||
    parsedDate.getMinutes() !== minute
  ) {
    return null;
  }

  // Comprobar que la fecha sea futura
  if (parsedDate.getTime() <= Date.now()) {
    return null;
  }

  return parsedDate;
}

/**
 * Valida que una fecha cumpla con el horario comercial estricto del Consultorio Sánchez:
 * - Días válidos: Lunes (1) a Sábado (6). Domingo (0) está CERRADO.
 * - Turno Mañana: 09:00 a 13:00 (hora de inicio 09, fin antes de 13:00).
 * - Turno Tarde: 15:00 a 20:00 (hora de inicio 15, fin antes de 20:00).
 * Usa la zona horaria de Perú (America/Lima) para la comparación.
 */
export function isWithinBusinessHours(date: Date): boolean {
  // Obtener día de la semana y hora en la zona horaria de Lima, Perú
  const formatter = new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const weekday = parts.find(p => p.type === 'weekday')?.value?.toLowerCase() ?? '';

  // Reconstruir hora y minutos desde las partes
  const hourPart = parts.find(p => p.type === 'hour')?.value ?? '0';
  const minutePart = parts.find(p => p.type === 'minute')?.value ?? '0';
  const totalMinutes = parseInt(hourPart, 10) * 60 + parseInt(minutePart, 10);

  // Domingo no se atiende en ningún caso
  const CLOSED_DAYS = ['dom', 'sun'];
  if (CLOSED_DAYS.some(d => weekday.startsWith(d))) {
    return false;
  }

  // Turno Mañana: 09:00 (540 min) a 13:00 (780 min), exclusivo del límite superior
  const MORNING_START = 9 * 60;   // 540
  const MORNING_END   = 13 * 60;  // 780

  // Turno Tarde: 15:00 (900 min) a 20:00 (1200 min), exclusivo del límite superior
  const AFTERNOON_START = 15 * 60; // 900
  const AFTERNOON_END   = 20 * 60; // 1200

  const inMorning   = totalMinutes >= MORNING_START && totalMinutes < MORNING_END;
  const inAfternoon = totalMinutes >= AFTERNOON_START && totalMinutes < AFTERNOON_END;

  return inMorning || inAfternoon;
}

/**
 * Parsea un string de fecha en formato es-PE proveniente de Google Sheets.
 * Ejemplos de entrada esperados:
 *   "10/6/2026, 3:00:00 p. m."
 *   "10/6/2026, 11:30:00 a. m."
 *   "10/6/2026 15:00:00"
 * Construye el objeto Date de forma manual para evitar fallos del parser nativo
 * de JavaScript con formatos localizados de 12 horas en español.
 */
export function parseLocaleDateString(dateStr: string): Date | null {
  try {
    if (!dateStr || !dateStr.trim()) return null;

    // Normalizar: quitar comas de separación y colapsar espacios múltiples
    const normalized = dateStr.replace(/,/g, '').trim();

    // Detectar si es formato de 12h (tiene 'a' o 'p' al final como indicador AM/PM)
    // Los separadores en español pueden ser: "a. m.", "p. m.", "a.m.", "p.m.", "am", "pm"
    const ampmMatch = normalized.match(/([ap])\.?\s*m\.?/i);
    const isPm = ampmMatch ? ampmMatch[1].toLowerCase() === 'p' : false;
    const isAmPm = Boolean(ampmMatch);

    // Quitar el bloque AM/PM del string para parsear solo la parte numérica
    const numericPart = normalized.replace(/[ap]\.?\s*m\.?/gi, '').trim();
    const parts = numericPart.split(/\s+/);

    if (parts.length < 2) return null;

    // Parte de fecha: DD/MM/YYYY
    const [datePart, timePart] = parts;
    const dateSubparts = datePart.split('/');
    if (dateSubparts.length !== 3) return null;

    const day   = parseInt(dateSubparts[0], 10);
    const month = parseInt(dateSubparts[1], 10) - 1; // 0-indexed en JS
    const year  = parseInt(dateSubparts[2], 10);

    // Parte de hora: HH:mm:ss o HH:mm
    const timeSubparts = timePart.split(':');
    if (timeSubparts.length < 2) return null;

    let hours   = parseInt(timeSubparts[0], 10);
    const minutes = parseInt(timeSubparts[1], 10);
    const seconds = timeSubparts[2] ? parseInt(timeSubparts[2], 10) : 0;

    // Convertir formato 12h a 24h
    if (isAmPm) {
      if (isPm && hours < 12) hours += 12;   // 3 PM -> 15
      if (!isPm && hours === 12) hours = 0;  // 12 AM -> 0
    }

    // Validar rangos antes de construir el Date
    if (
      isNaN(day) || isNaN(month) || isNaN(year) ||
      isNaN(hours) || isNaN(minutes) || isNaN(seconds) ||
      month < 0 || month > 11 ||
      day < 1 || day > 31 ||
      hours < 0 || hours > 23 ||
      minutes < 0 || minutes > 59
    ) {
      return null;
    }

    const result = new Date(year, month, day, hours, minutes, seconds);

    // Guardar contra desbordamientos de fecha en JS (ej: 31 de Febrero -> 3 de Marzo)
    if (
      result.getFullYear() !== year ||
      result.getMonth() !== month ||
      result.getDate() !== day
    ) {
      return null;
    }

    return result;
  } catch (err) {
    console.error(`[Parser] Error al parsear fecha de cita "${dateStr}":`, err);
    return null;
  }
}
