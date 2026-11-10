import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { columnasExportadas, validarPlantilla } from '../../src/nucleo/plantilla';

const talegas = JSON.parse(readFileSync('public/plantillas/talegas.json', 'utf-8'));

describe('validarPlantilla', () => {
  it('carga la plantilla real de talegas: 14 columnas, 7 exportadas', () => {
    const r = validarPlantilla(talegas);
    if (!r.ok) throw new Error(r.error);
    expect(r.plantilla.columnas).toHaveLength(14);
    expect(columnasExportadas(r.plantilla).map((c) => c.nombre)).toEqual([
      'Talega No.',
      'Carro No.',
      'Tacos',
      'Fundas',
      'Paraguas',
      'Varas',
      'Nombre del Socio',
    ]);
  });

  it('aplica valores por defecto', () => {
    const r = validarPlantilla({ id: 'x', nombre: 'X', columnas: [{ nombre: 'A', tipo: 'texto' }] });
    if (!r.ok) throw new Error(r.error);
    expect(r.plantilla.idioma_ocr).toBe('spa');
    expect(r.plantilla.filas_encabezado).toBe(1);
    expect(r.plantilla.umbral_confianza).toBe(70);
    expect(r.plantilla.columnas[0].exportar).toBe(true);
    expect(r.plantilla.regional).toEqual({
      separador_decimal: ',',
      separador_miles: '.',
      formato_fecha: 'dd/MM/yyyy',
    });
  });

  it('rechaza una plantilla sin columnas exportadas', () => {
    const r = validarPlantilla({
      id: 'x',
      nombre: 'X',
      columnas: [{ nombre: 'A', tipo: 'texto', exportar: false }],
    });
    expect(r.ok).toBe(false);
  });

  it('rechaza nombres de columna repetidos', () => {
    const r = validarPlantilla({
      id: 'x',
      nombre: 'X',
      columnas: [
        { nombre: 'A', tipo: 'texto' },
        { nombre: 'A', tipo: 'entero' },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('repetid');
  });

  it('rechaza un tipo desconocido', () => {
    const r = validarPlantilla({ id: 'x', nombre: 'X', columnas: [{ nombre: 'A', tipo: 'hora' }] });
    expect(r.ok).toBe(false);
  });

  it('rechaza algo que no es una plantilla', () => {
    expect(validarPlantilla(null).ok).toBe(false);
    expect(validarPlantilla({ id: 'x' }).ok).toBe(false);
  });
});
