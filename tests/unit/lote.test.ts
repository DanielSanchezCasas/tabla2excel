import { describe, expect, it } from 'vitest';
import type { FotoProcesada } from '../../src/nucleo/foto';
import { Lote, MAXIMO_FOTOS } from '../../src/nucleo/lote';

const foto = (nombre: string, fecha: Date | null = new Date(Date.UTC(2026, 9, 31))): FotoProcesada => ({
  nombre_archivo: nombre,
  fecha,
  fecha_texto_crudo: '',
  fecha_confianza: 90,
  filas: [],
});

describe('Lote', () => {
  it('numera las fotos al añadir y marca que hay algo sin exportar', () => {
    const l = new Lote();
    l.añadir(foto('a'));
    l.añadir(foto('b'));
    expect(l.fotos.map((f) => f.numero)).toEqual([1, 2]);
    expect(l.hay_sin_exportar).toBe(true);
  });

  it('no añade sin fecha', () => {
    const l = new Lote();
    expect(l.motivoParaNoAñadir(foto('a', null))).toContain('fecha');
    expect(() => l.añadir(foto('a', null))).toThrow();
  });

  it(`no añade más de ${MAXIMO_FOTOS} fotos`, () => {
    const l = new Lote();
    for (let i = 0; i < MAXIMO_FOTOS; i++) l.añadir(foto(String(i)));
    expect(l.lleno).toBe(true);
    expect(l.motivoParaNoAñadir(foto('x'))).toContain('máximo');
    expect(() => l.añadir(foto('x'))).toThrow();
  });

  it('al quitar una foto renumera las siguientes sin huecos', () => {
    const l = new Lote();
    ['a', 'b', 'c'].forEach((n) => l.añadir(foto(n)));
    l.quitar(2);
    expect(l.fotos.map((f) => [f.numero, f.nombre_archivo])).toEqual([
      [1, 'a'],
      [2, 'c'],
    ]);
  });

  it('exportar limpia el aviso; añadir o quitar lo vuelve a activar', () => {
    const l = new Lote();
    l.añadir(foto('a'));
    l.añadir(foto('b'));
    l.marcarExportado();
    expect(l.hay_sin_exportar).toBe(false);
    l.quitar(1);
    expect(l.hay_sin_exportar).toBe(true);
    l.marcarExportado();
    l.añadir(foto('c'));
    expect(l.hay_sin_exportar).toBe(true);
  });

  it('empezar de nuevo vacía el lote', () => {
    const l = new Lote();
    l.añadir(foto('a'));
    l.vaciar();
    expect(l.fotos).toHaveLength(0);
    expect(l.hay_sin_exportar).toBe(false);
  });
});
