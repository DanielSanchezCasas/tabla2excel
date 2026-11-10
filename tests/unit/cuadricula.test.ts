import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { PNG } from 'pngjs';
import { beforeAll, describe, expect, it } from 'vitest';
import { analizarCelda, detectarTabla, ErrorVision } from '../../src/vision/cuadricula';
import { esperarOpenCV, type CV } from '../../src/vision/opencv';

const require = createRequire(import.meta.url);
const simulado = JSON.parse(readFileSync('tests/fixtures/ocr-simulado.json', 'utf-8'));
const esperado = readFileSync('tests/fixtures/esperado.csv', 'utf-8').trim().split('\n').slice(1);
let cv: CV;

beforeAll(async () => {
  cv = await esperarOpenCV(require('@techstark/opencv-js'));
});

const leer = (nombre: string) => {
  const png = PNG.sync.read(readFileSync(`tests/fixtures/imagenes/${nombre}`));
  return cv.matFromImageData({ data: png.data, width: png.width, height: png.height });
};

describe.each(['recta.png', 'rotada.png', 'perspectiva.png', 'sombra.png'])(
  'detectarTabla(%s)',
  (archivo) => {
    it('encuentra 14 columnas, encabezado + 22 filas y la fecha encima', () => {
      const tabla = detectarTabla(cv, leer(archivo), 14);
      expect(tabla.columnas).toBe(14);
      expect(tabla.filas).toBe(1 + simulado.filas);
      expect(tabla.cajaFecha.y + tabla.cajaFecha.alto).toBeLessThanOrEqual(tabla.celdas[0][0].y);
      expect(
        cv.countNonZero(tabla.tinta.roi(new cv.Rect(0, 0, tabla.cajaFecha.ancho, tabla.cajaFecha.alto))),
      ).toBeGreaterThan(200);
    });

    it('clasifica celdas: con tinta, guion y vacías', () => {
      const tabla = detectarTabla(cv, leer(archivo), 14);
      const filas = esperado.map((l) => l.split(';'));
      // Columna física 1 = Talega No. (siempre con número) y 2 = Carro No. (a veces guion)
      filas.forEach((_, i) => {
        expect(analizarCelda(cv, tabla.tinta, tabla.celdas[i + 1][1])).toBe('tinta');
      });
      expect(analizarCelda(cv, tabla.tinta, tabla.celdas[3][2])).toBe('guion');
      // Las últimas filas están vacías en todas las columnas exportadas
      for (const c of [1, 2, 3, 4, 5, 6, 7]) {
        expect(analizarCelda(cv, tabla.tinta, tabla.celdas[tabla.filas - 1][c])).toBe('vacia');
      }
    });
  },
);

it('rechaza una foto sin tabla', () => {
  expect(() => detectarTabla(cv, leer('sin-tabla.png'), 14)).toThrow(ErrorVision);
});
