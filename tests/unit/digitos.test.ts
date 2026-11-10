import { createRequire } from 'node:module';
import { beforeAll, describe, expect, it } from 'vitest';
import { leerNumero } from '../../src/ocr/digitos';
import { esperarOpenCV, type CV } from '../../src/vision/opencv';

const require = createRequire(import.meta.url);
let cv: CV;

beforeAll(async () => {
  cv = await esperarOpenCV(require('@techstark/opencv-js'));
});

/** Dibuja un número (tinta oscura sobre blanco) como lo entrega recorteParaOcr. */
function dibujar(numero: string, fuente: number, grosor: number) {
  const m = new cv.Mat(80, 40 + numero.length * 34, cv.CV_8UC4, new cv.Scalar(255, 255, 255, 255));
  cv.putText(
    m,
    numero,
    new cv.Point(14, 58),
    fuente,
    1.5,
    new cv.Scalar(20, 20, 20, 255),
    grosor,
    cv.LINE_AA,
  );
  const r = { data: new Uint8ClampedArray(m.data), ancho: m.cols, alto: m.rows };
  m.delete();
  return r;
}

describe('leerNumero', () => {
  it.each(['14', '5031', '7', '1', '498', '80'])('lee "%s"', (n) => {
    for (const fuente of [cv.FONT_HERSHEY_SIMPLEX, cv.FONT_HERSHEY_SCRIPT_SIMPLEX]) {
      const { data, ancho, alto } = dibujar(n, fuente, 3);
      expect(leerNumero(data, ancho, alto).texto).toBe(n);
    }
  });

  // Nunca un error silencioso: o lee bien, o la confianza queda por debajo del umbral (70)
  it.each(['356', '62', '233', '318', '659'])('"%s": lee bien o lo marca como dudoso', (n) => {
    for (const fuente of [cv.FONT_HERSHEY_SIMPLEX, cv.FONT_HERSHEY_SCRIPT_SIMPLEX]) {
      const { data, ancho, alto } = dibujar(n, fuente, 3);
      const r = leerNumero(data, ancho, alto);
      if (r.texto !== n) expect(r.confianza).toBeLessThan(70);
    }
  });

  it('una celda en blanco no inventa nada', () => {
    const data = new Uint8ClampedArray(60 * 40 * 4).fill(255);
    expect(leerNumero(data, 60, 40)).toEqual({ texto: '', confianza: 0 });
  });
});
