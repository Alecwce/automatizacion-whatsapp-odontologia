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
