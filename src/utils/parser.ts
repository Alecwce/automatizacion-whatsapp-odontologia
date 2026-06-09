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
