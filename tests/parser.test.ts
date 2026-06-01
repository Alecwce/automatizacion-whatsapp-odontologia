import { describe, it, expect } from 'vitest';
import { parsePatientDni, parsePatientName } from '../src/utils/parser';

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
