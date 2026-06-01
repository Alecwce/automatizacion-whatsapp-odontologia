const DNI_REGEX = /(?:[VEve]-?[0-9]{7,9}|[0-9]{7,10})/i;

const NAME_PREFIXES = [
  'me llamo',
  'mi nombre es',
  'soy',
  'mi nombre',
  'nombre:'
];

/**
 * Valida y extrae el DNI o Cédula a partir del texto ingresado por el paciente.
 * Soporta números de 7 a 10 dígitos y formatos tradicionales como V-12345678 o E-1234567.
 */
export function parsePatientDni(text: string): string | null {
  const match = text.match(DNI_REGEX);
  if (!match) {
    return null;
  }
  
  const extracted = match[0].trim();
  if (/^[VEve]/i.test(extracted)) {
    const letter = extracted[0].toUpperCase();
    const rest = extracted.slice(1).replace(/^-/, '');
    return `${letter}-${rest}`;
  }
  
  return extracted;
}

/**
 * Limpia y valida el nombre proporcionado por el paciente.
 * Remueve frases introductorias comunes y valida longitud mínima.
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

  if (cleaned.length < 2 || /^\d/.test(cleaned)) {
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
