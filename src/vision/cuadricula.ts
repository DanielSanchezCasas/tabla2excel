import type { CV, Mat } from './opencv';
import { encontrarTabla, enderezar, ErrorVision } from './perspectiva';

export interface Caja {
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

export type ContenidoCelda = 'vacia' | 'guion' | 'tinta';

export interface TablaDetectada {
  /** Imagen enderezada en gris (incluye el margen superior con la fecha) */
  imagen: Mat;
  /** Tinta sin las líneas de la cuadrícula (blanco = tinta) */
  tinta: Mat;
  /** celdas[fila][columna]; la fila 0 es la primera del encabezado */
  celdas: Caja[][];
  cajaFecha: Caja;
  filas: number;
  columnas: number;
}

const impar = (n: number) => (Math.round(n) % 2 === 0 ? Math.round(n) + 1 : Math.round(n));

function binarizar(cv: CV, gris: Mat): Mat {
  const bin = new cv.Mat();
  const bloque = impar(Math.max(15, Math.min(gris.rows, gris.cols) / 40));
  cv.adaptiveThreshold(gris, bin, 255, cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY_INV, bloque, 12);
  return bin;
}

/** Posiciones (centro) de las bandas donde el perfil supera el umbral; une bandas muy cercanas. */
export function picos(perfil: number[], umbral: number, separacionMinima: number): number[] {
  const bandas: [number, number][] = [];
  perfil.forEach((v, i) => {
    if (v < umbral) return;
    const ultima = bandas.at(-1);
    if (ultima && i - ultima[1] <= separacionMinima) ultima[1] = i;
    else bandas.push([i, i]);
  });
  return bandas.map(([a, b]) => Math.round((a + b) / 2));
}

function lineas(cv: CV, bin: Mat, horizontal: boolean): Mat {
  const largo = Math.max(10, Math.round((horizontal ? bin.cols : bin.rows) / 25));
  const k = cv.getStructuringElement(
    cv.MORPH_RECT,
    horizontal ? new cv.Size(largo, 1) : new cv.Size(1, largo),
  );
  const m = new cv.Mat();
  cv.morphologyEx(bin, m, cv.MORPH_OPEN, k);
  k.delete();
  return m;
}

function perfil(m: Mat, porFilas: boolean, desde = 0): number[] {
  const res = new Array<number>(porFilas ? m.rows : m.cols).fill(0);
  const d = m.data;
  for (let y = desde; y < m.rows; y++) {
    for (let x = 0; x < m.cols; x++) {
      if (d[y * m.cols + x]) res[porFilas ? y : x]++;
    }
  }
  return res;
}

/**
 * Detecta la tabla en una imagen RGBA: endereza la perspectiva y encuentra la cuadrícula.
 * Con `columnasEsperadas` = null acepta cualquier número de columnas (editor de plantillas).
 * Lanza ErrorVision con un mensaje para el usuario si no lo logra.
 */
export function detectarTabla(cv: CV, rgba: Mat, columnasEsperadas: number | null): TablaDetectada {
  const gris = new cv.Mat();
  cv.cvtColor(rgba, gris, cv.COLOR_RGBA2GRAY);
  const binOriginal = binarizar(cv, gris);
  // Cierra pequeños cortes de las líneas para que la cuadrícula quede conectada
  const k = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
  cv.dilate(binOriginal, binOriginal, k);
  k.delete();

  let esquinas;
  try {
    esquinas = encontrarTabla(cv, binOriginal);
  } finally {
    binOriginal.delete();
  }
  const { imagen, margenSuperior } = enderezar(cv, gris, esquinas);
  gris.delete();

  const bin = binarizar(cv, imagen);
  const hor = lineas(cv, bin, true);
  const ver = lineas(cv, bin, false);

  const alto = imagen.rows - margenSuperior;
  const ancho = imagen.cols;
  const ys = picos(perfil(hor, true, margenSuperior), ancho * 0.45, Math.max(3, alto * 0.006)).filter(
    (y) => y >= margenSuperior - 3,
  );
  const perfilVertical = perfil(ver, false, margenSuperior);
  const xs = picos(perfilVertical, alto * 0.45, Math.max(3, ancho * 0.004));

  const columnas = xs.length - 1;
  const filas = ys.length - 1;
  if (columnasEsperadas !== null && columnas !== columnasEsperadas) {
    [bin, hor, ver, imagen].forEach((m) => m.delete());
    throw new ErrorVision(
      `Se detectaron ${Math.max(columnas, 0)} columnas, pero la planilla tiene ${columnasEsperadas}. ` +
        'Revisa que se vean todas las líneas.',
    );
  }
  if (filas < 2 || columnas < 1) {
    [bin, hor, ver, imagen].forEach((m) => m.delete());
    throw new ErrorVision(
      'No se pudieron distinguir las filas de la tabla. Revisa que se vean todas las líneas.',
    );
  }

  // Tinta sin líneas: binaria menos las líneas engrosadas
  const lineasTodas = new cv.Mat();
  cv.bitwise_or(hor, ver, lineasTodas);
  const k2 = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
  cv.dilate(lineasTodas, lineasTodas, k2);
  k2.delete();
  const tinta = new cv.Mat();
  cv.subtract(bin, lineasTodas, tinta);
  [bin, hor, ver, lineasTodas].forEach((m) => m.delete());

  const margen = 3;
  const celdas = ys.slice(0, -1).map((y, f) =>
    xs.slice(0, -1).map((x, c) => ({
      x: x + margen,
      y: y + margen,
      ancho: Math.max(1, xs[c + 1] - x - margen * 2),
      alto: Math.max(1, ys[f + 1] - y - margen * 2),
    })),
  );

  return {
    imagen,
    tinta,
    celdas,
    cajaFecha: { x: 0, y: 0, ancho: Math.round(ancho * 0.5), alto: Math.max(1, ys[0] - 4) },
    filas,
    columnas,
  };
}

/** Clasifica una celda antes del OCR: vacía, solo un guion (= vacía) o con tinta. */
export function analizarCelda(cv: CV, tinta: Mat, caja: Caja): ContenidoCelda {
  const roi = tinta.roi(new cv.Rect(caja.x, caja.y, caja.ancho, caja.alto));
  // clone() de un ROI no copia bien en OpenCV.js 5; copyTo sí
  const celda = new cv.Mat();
  roi.copyTo(celda);
  roi.delete();
  try {
    const d = celda.data;
    let n = 0;
    let [x0, y0, x1, y1] = [Infinity, Infinity, -1, -1];
    for (let y = 0; y < celda.rows; y++) {
      for (let x = 0; x < celda.cols; x++) {
        if (!d[y * celda.cols + x]) continue;
        n++;
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
    }
    if (n < caja.ancho * caja.alto * 0.006) return 'vacia';
    const alto = y1 - y0 + 1;
    // Trazo bajo y alargado: un guion o una raya
    if (alto < caja.alto * 0.22 && x1 - x0 + 1 > alto * 2.5) return 'guion';
    return 'tinta';
  } finally {
    celda.delete();
  }
}

/** Recorte listo para el OCR: texto negro sobre blanco, sin líneas, con borde blanco y escalado. */
export function recorteParaOcr(cv: CV, tinta: Mat, caja: Caja, altoMinimo = 48): Mat {
  const roi = tinta.roi(new cv.Rect(caja.x, caja.y, caja.ancho, caja.alto));
  const invertida = new cv.Mat();
  cv.bitwise_not(roi, invertida);
  roi.delete();
  const escala = caja.alto < altoMinimo ? altoMinimo / caja.alto : 1;
  if (escala > 1) {
    cv.resize(invertida, invertida, new cv.Size(0, 0), escala, escala, cv.INTER_CUBIC);
  }
  const conBorde = new cv.Mat();
  cv.copyMakeBorder(
    invertida,
    conBorde,
    12,
    12,
    12,
    12,
    cv.BORDER_CONSTANT,
    new cv.Scalar(255, 255, 255, 255),
  );
  invertida.delete();
  return conBorde;
}

export { ErrorVision };
