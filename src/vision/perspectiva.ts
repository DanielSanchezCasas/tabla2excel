import type { CV, Mat } from './opencv';

export class ErrorVision extends Error {}

export interface Punto {
  x: number;
  y: number;
}

/** Ordena 4 puntos como arriba-izquierda, arriba-derecha, abajo-derecha, abajo-izquierda. */
export function ordenarEsquinas(puntos: Punto[]): [Punto, Punto, Punto, Punto] {
  const porSuma = [...puntos].sort((a, b) => a.x + a.y - (b.x + b.y));
  const porResta = [...puntos].sort((a, b) => a.y - a.x - (b.y - b.x));
  return [porSuma[0], porResta[0], porSuma[3], porResta[3]];
}

/**
 * Busca el contorno de la tabla: la cuadrícula completa forma un único componente grande.
 * Devuelve sus 4 esquinas en la imagen original.
 */
export function encontrarTabla(cv: CV, binaria: Mat): [Punto, Punto, Punto, Punto] {
  const contornos = new cv.MatVector();
  const jerarquia = new cv.Mat();
  try {
    cv.findContours(binaria, contornos, jerarquia, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    let mayor = -1;
    let areaMayor = 0;
    for (let i = 0; i < contornos.size(); i++) {
      const c = contornos.get(i);
      const area = cv.contourArea(c);
      if (area > areaMayor) {
        areaMayor = area;
        mayor = i;
      }
      c.delete();
    }
    // La tabla debe ocupar una parte apreciable de la foto
    if (mayor < 0 || areaMayor < binaria.rows * binaria.cols * 0.08) {
      throw new ErrorVision(
        'No se encontró una tabla en la foto. Tómala más de frente, con buena luz y con toda la planilla dentro.',
      );
    }
    const contorno = contornos.get(mayor);
    const casco = new cv.Mat();
    cv.convexHull(contorno, casco, false, true);
    const perimetro = cv.arcLength(casco, true);
    const aprox = new cv.Mat();
    let puntos: Punto[] = [];
    // Aumenta la tolerancia hasta quedarse con 4 esquinas
    for (const eps of [0.01, 0.02, 0.03, 0.05, 0.08]) {
      cv.approxPolyDP(casco, aprox, eps * perimetro, true);
      if (aprox.rows === 4) {
        puntos = Array.from({ length: 4 }, (_, i) => ({
          x: aprox.data32S[i * 2],
          y: aprox.data32S[i * 2 + 1],
        }));
        break;
      }
    }
    if (puntos.length !== 4) {
      // Respaldo: rectángulo mínimo que envuelve la tabla
      const rect = cv.minAreaRect(casco);
      puntos = cv.RotatedRect.points(rect).map((p: Punto) => ({ x: p.x, y: p.y }));
    }
    contorno.delete();
    casco.delete();
    aprox.delete();
    return ordenarEsquinas(puntos);
  } finally {
    contornos.delete();
    jerarquia.delete();
  }
}

const distancia = (a: Punto, b: Punto) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Endereza la tabla a un rectángulo y deja un margen superior con la zona de la fecha
 * (lo que está justo encima de la tabla en el papel).
 */
export function enderezar(
  cv: CV,
  gris: Mat,
  esquinas: [Punto, Punto, Punto, Punto],
  proporcionMargen = 0.12,
): { imagen: Mat; margenSuperior: number } {
  const [ai, ad, bd, bi] = esquinas;
  const ancho = Math.round(Math.max(distancia(ai, ad), distancia(bi, bd)));
  const alto = Math.round(Math.max(distancia(ai, bi), distancia(ad, bd)));
  const margen = Math.round(alto * proporcionMargen);
  const origen = cv.matFromArray(4, 1, cv.CV_32FC2, [ai.x, ai.y, ad.x, ad.y, bd.x, bd.y, bi.x, bi.y]);
  const destino = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0,
    margen,
    ancho,
    margen,
    ancho,
    margen + alto,
    0,
    margen + alto,
  ]);
  const h = cv.getPerspectiveTransform(origen, destino);
  const imagen = new cv.Mat();
  cv.warpPerspective(
    gris,
    imagen,
    h,
    new cv.Size(ancho, alto + margen),
    cv.INTER_LINEAR,
    cv.BORDER_REPLICATE,
    new cv.Scalar(),
  );
  origen.delete();
  destino.delete();
  h.delete();
  return { imagen, margenSuperior: margen };
}
