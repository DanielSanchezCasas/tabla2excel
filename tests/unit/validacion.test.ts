import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validarPlantilla, type Plantilla } from '../../src/nucleo/plantilla';
import { editarCelda, evaluarCelda } from '../../src/nucleo/validacion';

const r = validarPlantilla(JSON.parse(readFileSync('public/plantillas/talegas.json', 'utf-8')));
if (!r.ok) throw new Error(r.error);
const plantilla: Plantilla = { ...r.plantilla, umbral_confianza: 70 };
const tacos = plantilla.columnas[3];
const lectura = (texto: string, confianza = 90) => ({ fila: 0, columna: 3, texto, confianza });

describe('evaluarCelda', () => {
  it('ok con buena confianza', () => {
    expect(evaluarCelda(lectura('14'), tacos, plantilla)).toMatchObject({
      estado: 'ok',
      valor: 14,
      editada: false,
    });
  });
  it('baja_confianza por debajo del umbral', () => {
    const c = evaluarCelda(lectura('14', 55), tacos, plantilla);
    expect(c.estado).toBe('baja_confianza');
    expect(c.motivo).toContain('55');
  });
  it('invalida si no cumple el tipo, con motivo', () => {
    const c = evaluarCelda(lectura('1A'), tacos, plantilla);
    expect(c.estado).toBe('invalida');
    expect(c.motivo).toContain('entero');
  });
  it('vacia con guion', () => {
    expect(evaluarCelda(lectura('-'), tacos, plantilla).estado).toBe('vacia');
  });
  it('invalida si la columna es obligatoria y está vacía', () => {
    expect(evaluarCelda(lectura(''), { ...tacos, obligatoria: true }, plantilla).estado).toBe('invalida');
  });
});

describe('editarCelda', () => {
  it('al corregir se revalida y pasa a ok', () => {
    const mala = evaluarCelda(lectura('1A'), tacos, plantilla);
    expect(editarCelda(mala, '14', tacos, plantilla)).toMatchObject({
      estado: 'ok',
      valor: 14,
      editada: true,
    });
  });
  it('si la corrección sigue mal, sigue inválida', () => {
    const mala = evaluarCelda(lectura('1A'), tacos, plantilla);
    expect(editarCelda(mala, 'xx', tacos, plantilla).estado).toBe('invalida');
  });
});
