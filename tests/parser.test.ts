import { describe, it, expect } from 'vitest';
import { parsePatientDni, parsePatientName, parseAppointmentDate } from '../src/utils/parser';

describe('Parser de DNI/Cédula', () => {
  it('debe extraer DNI simple de 8 dígitos', () => {
    expect(parsePatientDni('12345678')).toBe('12345678');
  });

  it('debe extraer DNI de 10 dígitos', () => {
    expect(parsePatientDni('1029384756')).toBe('1029384756');
  });

  it('debe extraer e internacionalizar cédulas con prefijo con guión', () => {
    expect(parsePatientDni('V-12345678')).toBe('V-12345678');
    expect(parsePatientDni('e-7654321')).toBe('E-7654321');
  });

  it('debe extraer y normalizar cédulas con prefijo sin guión', () => {
    expect(parsePatientDni('v12345678')).toBe('V-12345678');
    expect(parsePatientDni('E9876543')).toBe('E-9876543');
  });

  it('debe extraer DNI incrustado en una frase ruidosa', () => {
    expect(parsePatientDni('Mi número de documento es 18273645 gracias')).toBe('18273645');
    expect(parsePatientDni('Cedula: V-19283746')).toBe('V-19283746');
  });

  it('debe retornar null para DNI muy cortos o inválidos', () => {
    expect(parsePatientDni('123456')).toBeNull();
    expect(parsePatientDni('123a4567')).toBeNull();
    expect(parsePatientDni('abc')).toBeNull();
  });
});

describe('Parser de Nombre de Paciente', () => {
  it('debe normalizar un nombre simple', () => {
    expect(parsePatientName('juan')).toBe('Juan');
  });

  it('debe normalizar nombre y apellido con capitalización correcta', () => {
    expect(parsePatientName('carlos pÉrez')).toBe('Carlos Pérez');
    expect(parsePatientName('MARIA JOSE GONZALEZ')).toBe('Maria Jose Gonzalez');
  });

  it('debe limpiar prefijos comunes "me llamo"', () => {
    expect(parsePatientName('me llamo Juan Pérez')).toBe('Juan Pérez');
    expect(parsePatientName('Me llamo carlos')).toBe('Carlos');
  });

  it('debe limpiar prefijos comunes "mi nombre es"', () => {
    expect(parsePatientName('mi nombre es María')).toBe('María');
    expect(parsePatientName('Mi nombre es Pedro Gómez')).toBe('Pedro Gómez');
  });

  it('debe limpiar prefijos comunes "soy"', () => {
    expect(parsePatientName('soy Ana Rivera')).toBe('Ana Rivera');
    expect(parsePatientName('Soy jorge')).toBe('Jorge');
  });

  it('debe limpiar prefijos comunes "nombre:"', () => {
    expect(parsePatientName('nombre: Luis Miguel')).toBe('Luis Miguel');
  });

  it('debe retornar null si la entrada es demasiado corta o inválida', () => {
    expect(parsePatientName('a')).toBeNull();
    expect(parsePatientName('   ')).toBeNull();
  });

  it('debe retornar null si el nombre empieza con un número', () => {
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
