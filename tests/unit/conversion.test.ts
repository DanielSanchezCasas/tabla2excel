import { describe, expect, it } from 'vitest';
import { convertir, esVacio, parsearFecha } from '../../src/nucleo/conversion';
import type { Columna, Regional } from '../../src/nucleo/plantilla';

const regional: Regional = { separador_decimal: ',', separador_miles: '.', formato_fecha: 'dd/MM/yyyy' };
const col = (tipo: Columna['tipo'], extra: Partial<Columna> = {}): Columna => ({
  nombre: 'X',
  tipo,
  exportar: true,
  obligatoria: false,
  ...extra,
});
const fecha = (a: number, m: number, d: number) => new Date(Date.UTC(a, m - 1, d));

describe('esVacio', () => {
  it.each(['', '  ', '-', '—', '–', '_', '.', ' - ', '--'])('"%s" es vacío', (t) =>
    expect(esVacio(t)).toBe(true),
  );
  it.each(['0', 'a', '1-2'])('"%s" no es vacío', (t) => expect(esVacio(t)).toBe(false));
});

describe('convertir', () => {
  it('enteros', () => {
    expect(convertir('14', col('entero'), regional)).toEqual({ valor: 14, valido: true });
    expect(convertir(' 1.234 ', col('entero'), regional)).toEqual({ valor: 1234, valido: true });
    const r = convertir('1a4', col('entero'), regional);
    expect(r.valido).toBe(false);
    expect(r.motivo).toContain('entero');
  });

  it('texto alfanumérico se conserva tal cual', () => {
    expect(convertir(' NC33 ', col('texto'), regional)).toEqual({ valor: 'NC33', valido: true });
  });

  it('guiones son vacío, no error', () => {
    expect(convertir('—', col('entero'), regional)).toEqual({ valor: null, valido: true });
  });

  it('vacío en columna obligatoria es inválido', () => {
    const r = convertir('', col('texto', { obligatoria: true }), regional);
    expect(r.valido).toBe(false);
  });

  it('decimal y moneda con configuración regional', () => {
    expect(convertir('1.234,50', col('decimal'), regional).valor).toBe(1234.5);
    expect(convertir('$ 12.000', col('moneda'), regional).valor).toBe(12000);
  });

  it('fechas', () => {
    expect(convertir('31/10/2026', col('fecha'), regional).valor).toEqual(fecha(2026, 10, 31));
    expect(convertir('basura', col('fecha'), regional).valido).toBe(false);
  });
});

describe('parsearFecha', () => {
  it.each([
    ['31 octubre 2026'],
    ['31 Octubre 2026'],
    ['31 octubre 2O26'],
    ['31 ocutbre 2026'],
    ['31 de octubre de 2026'],
    ['31/10/2026'],
    ['31-10-2026'],
    ['Fecha: 31 octubre 2026'],
    ['Fecha:  31/10/2026'],
  ])('"%s" → 2026-10-31', (t) => expect(parsearFecha(t)).toEqual(fecha(2026, 10, 31)));

  it('acepta "setiembre"', () => expect(parsearFecha('5 setiembre 2026')).toEqual(fecha(2026, 9, 5)));

  it.each(['', 'hola', '31 xyzw 2026', '31/02/2026', '31 octubre'])('"%s" → null', (t) =>
    expect(parsearFecha(t)).toBeNull(),
  );
});
