import { describe, it, expect } from 'vitest';
import { parsePatientDni, parsePatientName, parseAppointmentDate } from '../src/utils/parser';

describe('Parser de DNI/Cédula', () => {
  it('debe extraer DNI simple de 8 dígitos', () => {
    expect(parsePatientDni('12345678')).toBe('12345678');
    expect(parsePatientDni('  12345678  ')).toBe('12345678');
  });

  it('debe retornar null para DNI con letras, prefijos, espacios o longitud diferente a 8', () => {
    expect(parsePatientDni('1029384756')).toBeNull(); // 10 dígitos
    expect(parsePatientDni('1234567')).toBeNull(); // 7 dígitos
    expect(parsePatientDni('V-12345678')).toBeNull(); // Prefijo con guión
    expect(parsePatientDni('e-7654321')).toBeNull(); // Prefijo corto
    expect(parsePatientDni('v12345678')).toBeNull(); // Prefijo sin guión
    expect(parsePatientDni('123a4567')).toBeNull(); // Letra en el medio
    expect(parsePatientDni('1234 5678')).toBeNull(); // Espacio en el medio
    expect(parsePatientDni('Mi número de documento es 18273645 gracias')).toBeNull(); // Texto extra
    expect(parsePatientDni('abc')).toBeNull();
  });
});

describe('Parser de Nombre de Paciente', () => {
  it('debe normalizar nombre y apellido con capitalización correcta', () => {
    expect(parsePatientName('carlos pÉrez')).toBe('Carlos Pérez');
    expect(parsePatientName('MARIA JOSE GONZALEZ')).toBe('Maria Jose Gonzalez');
  });

  it('debe limpiar prefijos comunes y requerir al menos dos palabras', () => {
    expect(parsePatientName('me llamo Juan Pérez')).toBe('Juan Pérez');
    expect(parsePatientName('Mi nombre es Pedro Gómez')).toBe('Pedro Gómez');
    expect(parsePatientName('soy Ana Rivera')).toBe('Ana Rivera');
    expect(parsePatientName('nombre: Luis Miguel')).toBe('Luis Miguel');
  });

  it('debe retornar null para nombres de una sola palabra', () => {
    expect(parsePatientName('juan')).toBeNull();
    expect(parsePatientName('Carlos')).toBeNull();
    expect(parsePatientName('Me llamo carlos')).toBeNull();
    expect(parsePatientName('soy jorge')).toBeNull();
  });

  it('debe retornar null si la entrada es demasiado corta o inválida', () => {
    expect(parsePatientName('a')).toBeNull();
    expect(parsePatientName('   ')).toBeNull();
  });

  it('debe retornar null si el nombre contiene números o caracteres especiales', () => {
    expect(parsePatientName('Juan P3rez')).toBeNull();
    expect(parsePatientName('Juan Perez$')).toBeNull();
    expect(parsePatientName('Pedro Góm3z!')).toBeNull();
    expect(parsePatientName('123Juan')).toBeNull();
    expect(parsePatientName('456')).toBeNull();
  });
});

describe('Parser de Fecha de Cita', () => {
  it('debe parsear y validar una fecha correcta en el futuro', () => {
    const nextYear = new Date().getFullYear() + 1;
    const dateStr = `${nextYear}-06-15 14:30`;
    const result = parseAppointmentDate(dateStr);
    
    expect(result).toBeInstanceOf(Date);
    expect(result?.getFullYear()).toBe(nextYear);
    expect(result?.getMonth()).toBe(5); // Junio es 5
    expect(result?.getDate()).toBe(15);
    expect(result?.getHours()).toBe(14);
    expect(result?.getMinutes()).toBe(30);
  });

  it('debe retornar null para formatos incorrectos', () => {
    expect(parseAppointmentDate('15-06-2026 14:30')).toBeNull();
    expect(parseAppointmentDate('2026/06/15 14:30')).toBeNull();
    expect(parseAppointmentDate('2026-6-15 14:30')).toBeNull();
  });

  it('debe retornar null para meses o días inválidos (desbordamiento)', () => {
    expect(parseAppointmentDate('2026-13-15 14:30')).toBeNull();
    expect(parseAppointmentDate('2026-02-31 14:30')).toBeNull();
  });

  it('debe retornar null para horas o minutos inválidos', () => {
    expect(parseAppointmentDate('2026-06-15 25:30')).toBeNull();
    expect(parseAppointmentDate('2026-06-15 14:65')).toBeNull();
  });

  it('debe retornar null para fechas en el pasado', () => {
    expect(parseAppointmentDate('2020-01-01 10:00')).toBeNull();
  });
});
