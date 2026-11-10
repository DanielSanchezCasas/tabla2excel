import type { CV, Mat } from './opencv';

export class ErrorVision extends Error {}

export interface Caja {
  x: number;
  y: number;
  ancho: number;
  alto: number;
  /**
   * Línea inferior de la fila (y absoluta). La caja se extiende por debajo porque en la planilla
   * se escribe apoyado sobre esa línea o cruzándola; solo cuentan los trazos cuyo centro queda encima.
   */
  base?: number;
  /** Línea superior de la fila (y absoluta): los trazos con el centro por encima son de la fila anterior */
  techo?: number;
}

export type ContenidoCelda = 'vacia' | 'guion' | 'tinta';

export interface TablaDetectada {
  /** Imagen en gris, ya enderezada (rotación corregida) */
  imagen: Mat;
  /** Tinta sin las líneas de la cuadrícula (blanco = tinta) */
  tinta: Mat;
  /** celdas[fila][columna]; la fila 0 es la primera del encabezado */
  celdas: Caja[][];
  cajaFecha: Caja;
  filas: number;
  columnas: number;
  /** La última fila estaba cortada por el borde de la foto */
  ultimaFilaCortada: boolean;
}

/**
 * Línea de la cuadrícula como polilínea (sigue la curvatura del papel).
 * En coordenadas (u, v): horizontal → u = x, v = y; vertical → u = y, v = x.
 */
interface Linea {
  /** Puntos ordenados por u */
  pts: { u: number; v: number }[];
  desde: number;
  hasta: number;
}

interface Segmento {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Ángulo en grados, 0–180 */
  angulo: number;
  largo: number;
}

const impar = (n: number) => (Math.round(n) % 2 === 0 ? Math.round(n) + 1 : Math.round(n));
const mediana = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};
/** Distancia entre dos ángulos de recta (módulo 180°) */
const difAngulo = (a: number, b: number) => {
  const d = Math.abs(a - b) % 180;
  return Math.min(d, 180 - d);
};

function binarizar(cv: CV, gris: Mat): Mat {
  const bin = new cv.Mat();
  const bloque = impar(Math.max(15, Math.min(gris.rows, gris.cols) / 40));
  cv.adaptiveThreshold(gris, bin, 255, cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY_INV, bloque, 12);
  return bin;
}

function segmentos(cv: CV, bin: Mat, fraccionMinima = 0.12, hueco = 15): Segmento[] {
  const m = new cv.Mat();
  const minimo = Math.min(bin.rows, bin.cols) * fraccionMinima;
  cv.HoughLinesP(bin, m, 1, Math.PI / 360, Math.round(minimo * 0.6), minimo, hueco);
  const d = m.data32S;
  const res: Segmento[] = [];
  for (let i = 0; i < d.length / 4; i++) {
    const [x1, y1, x2, y2] = [d[i * 4], d[i * 4 + 1], d[i * 4 + 2], d[i * 4 + 3]];
    const angulo = ((Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI + 180) % 180;
    res.push({ x1, y1, x2, y2, angulo, largo: Math.hypot(x2 - x1, y2 - y1) });
  }
  m.delete();
  return res;
}

/** Ángulo de la familia de líneas con más longitud total (las filas: más numerosas y largas). */
function anguloDominante(segs: Segmento[]): number {
  const hist = new Array<number>(180).fill(0);
  for (const s of segs) hist[Math.round(s.angulo) % 180] += s.largo;
  const suave = hist.map((_, i) => hist[(i + 179) % 180] + hist[i] + hist[(i + 1) % 180]);
  const pico = suave.indexOf(Math.max(...suave));
  // Promedio fino de los segmentos cercanos al pico (con cuidado en el salto 179°→0°)
  let suma = 0;
  let peso = 0;
  for (const s of segs) {
    if (difAngulo(s.angulo, pico) > 2) continue;
    let a = s.angulo;
    if (a - pico > 90) a -= 180;
    if (pico - a > 90) a += 180;
    suma += a * s.largo;
    peso += s.largo;
  }
  return peso ? suma / peso : pico;
}

/** Rota (antihorario, en grados) ampliando el lienzo para no recortar; el fondo queda blanco. */
function rotar(cv: CV, gris: Mat, grados: number, fondo = 255): Mat {
  const rad = (grados * Math.PI) / 180;
  const [c, s] = [Math.abs(Math.cos(rad)), Math.abs(Math.sin(rad))];
  const ancho = Math.round(gris.cols * c + gris.rows * s);
  const alto = Math.round(gris.cols * s + gris.rows * c);
  const m = cv.getRotationMatrix2D(new cv.Point(gris.cols / 2, gris.rows / 2), grados, 1);
  m.data64F[2] += ancho / 2 - gris.cols / 2;
  m.data64F[5] += alto / 2 - gris.rows / 2;
  const salida = new cv.Mat();
  cv.warpAffine(
    gris,
    salida,
    m,
    new cv.Size(ancho, alto),
    cv.INTER_LINEAR,
    cv.BORDER_CONSTANT,
    new cv.Scalar(fondo),
  );
  m.delete();
  return salida;
}

/**
 * Binariza la imagen girada sin los bordes de la foto: el contorno de la foto (y del lienzo
 * ampliado al girar) parecería una línea larga de la tabla.
 */
function binarizarSinBordes(cv: CV, original: Mat, imagen: Mat, grados: number): Mat {
  const bin = binarizar(cv, imagen);
  const unos = new cv.Mat(original.rows, original.cols, cv.CV_8UC1, new cv.Scalar(255));
  const valida = rotar(cv, unos, grados, 0);
  const margen = Math.max(5, Math.round(Math.min(original.rows, original.cols) * 0.005));
  const k = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(margen * 2 + 1, margen * 2 + 1));
  cv.erode(valida, valida, k);
  cv.bitwise_and(bin, valida, bin);
  [unos, valida, k].forEach((x) => x.delete());
  return bin;
}

/**
 * Deja solo los trazos largos y rectos en una dirección: la escritura (✓, "/NS", números)
 * desaparece. Engrosar un poco antes tolera líneas finas algo inclinadas o curvas.
 */
function mascaraDireccional(cv: CV, bin: Mat, horizontal: boolean): Mat {
  const largo = Math.max(20, Math.round(Math.min(bin.rows, bin.cols) / 40));
  const grueso = cv.getStructuringElement(cv.MORPH_RECT, horizontal ? new cv.Size(1, 3) : new cv.Size(3, 1));
  const k = cv.getStructuringElement(
    cv.MORPH_RECT,
    horizontal ? new cv.Size(largo, 1) : new cv.Size(1, largo),
  );
  const m = new cv.Mat();
  cv.dilate(bin, m, grueso);
  cv.morphologyEx(m, m, cv.MORPH_OPEN, k);
  [grueso, k].forEach((x) => x.delete());
  return m;
}

/** Valor v de la línea en u: interpola entre sus puntos y extrapola con la pendiente de los extremos. */
function valor(l: Linea, u: number): number {
  const p = l.pts;
  if (p.length === 1) return p[0].v;
  let i = p.findIndex((q) => q.u >= u);
  if (i === -1) i = p.length - 1;
  if (i === 0) i = 1;
  const [a, b] = [p[i - 1], p[i]];
  return a.v + ((b.v - a.v) * (u - a.u)) / (b.u - a.u || 1);
}

/**
 * Encuentra las líneas de una dirección por franjas: dentro de una franja estrecha la curvatura
 * y la perspectiva casi no se notan, así que cada línea es un pico claro del perfil. Después se
 * unen los picos de franjas vecinas.
 */
function lineasPorFranjas(mascara: Mat, horizontal: boolean, tolerancia: number): Linea[] {
  const largoU = horizontal ? mascara.cols : mascara.rows;
  const largoV = horizontal ? mascara.rows : mascara.cols;
  const franjas = 12;
  const anchoFranja = largoU / franjas;
  const perfiles = Array.from({ length: franjas }, () => new Float32Array(largoV));
  const d = mascara.data;
  for (let y = 0; y < mascara.rows; y++) {
    for (let x = 0; x < mascara.cols; x++) {
      if (!d[y * mascara.cols + x]) continue;
      const [u, v] = horizontal ? [x, y] : [y, x];
      perfiles[Math.min(franjas - 1, Math.floor(u / anchoFranja))][v]++;
    }
  }

  // Picos de cada franja: tramos de perfil por encima del umbral, uno por línea
  const picos = perfiles.map((perfil) => {
    const umbral = anchoFranja * 0.35;
    const res: number[] = [];
    let v = 0;
    while (v < largoV) {
      if (perfil[v] < umbral) {
        v++;
        continue;
      }
      let [suma, peso] = [0, 0];
      while (v < largoV && perfil[v] >= umbral * 0.5) {
        suma += v * perfil[v];
        peso += perfil[v];
        v++;
      }
      const centro = suma / peso;
      if (res.length && centro - res[res.length - 1] < tolerancia)
        res[res.length - 1] = (res[res.length - 1] + centro) / 2;
      else res.push(centro);
    }
    return res;
  });

  // Une los picos de franjas vecinas (se permite saltar una franja, p. ej. tapada por escritura)
  const lineas: (Linea & { ultima: number })[] = [];
  picos.forEach((lista, k) => {
    const u = (k + 0.5) * anchoFranja;
    const usadas = new Set<number>();
    for (const v of lista) {
      let mejor = -1;
      let menor = tolerancia;
      lineas.forEach((l, i) => {
        if (usadas.has(i) || k - l.ultima > 2) return;
        const error = Math.abs(valor(l, u) - v);
        if (error < menor) {
          menor = error;
          mejor = i;
        }
      });
      if (mejor >= 0) {
        lineas[mejor].pts.push({ u, v });
        lineas[mejor].ultima = k;
        usadas.add(mejor);
      } else {
        lineas.push({ pts: [{ u, v }], desde: 0, hasta: 0, ultima: k });
        usadas.add(lineas.length - 1);
      }
    }
  });
  return lineas.map(({ pts }) => ({
    pts,
    desde: Math.max(0, pts[0].u - anchoFranja / 2),
    hasta: Math.min(largoU - 1, pts[pts.length - 1].u + anchoFranja / 2),
  }));
}

/** Intersección de una horizontal y una vertical (iterando: ambas son casi perpendiculares). */
function interseccion(h: Linea, v: Linea) {
  let x = valor(v, valor(h, valor(v, 0)));
  let y = valor(h, x);
  for (let i = 0; i < 4; i++) {
    x = valor(v, y);
    y = valor(h, x);
  }
  return { x, y };
}

interface Cuadricula {
  hs: Linea[];
  vs: Linea[];
}

/** ¿La horizontal h y la vertical v se cruzan (con algo de holgura en los extremos)? */
function seCruzan(h: Linea, v: Linea, holguraX: number, holguraY: number) {
  const { x, y } = interseccion(h, v);
  return (
    x >= h.desde - holguraX && x <= h.hasta + holguraX && y >= v.desde - holguraY && y <= v.hasta + holguraY
  );
}

const alturas = (hs: Linea[], x: number) => hs.slice(1).map((h, i) => valor(h, x) - valor(hs[i], x));

const medio = (l: Linea) => valor(l, (l.desde + l.hasta) / 2);

/** Detecta las líneas de la tabla en una imagen ya rotada con las filas en horizontal. */
function cuadricula(cv: CV, bin: Mat): Cuadricula {
  const [ancho, alto] = [bin.cols, bin.rows];
  const mh = mascaraDireccional(cv, bin, true);
  const mv = mascaraDireccional(cv, bin, false);
  let hs = lineasPorFranjas(mh, true, Math.max(5, alto * 0.008));
  let vs = lineasPorFranjas(mv, false, Math.max(5, ancho * 0.008));

  // Solo líneas largas: descarta subrayados, rayas a mano y marcas sueltas
  const largas = (ls: Linea[], fraccion: number) => {
    const max = Math.max(0, ...ls.map((l) => l.hasta - l.desde));
    return ls.filter((l) => l.hasta - l.desde >= max * fraccion);
  };
  hs = largas(hs, 0.4);
  vs = largas(vs, 0.3);

  // Las líneas de la tabla se cruzan con muchas de la otra familia; el borde del papel
  // o las marcas fuera de la tabla, no
  const [holguraX, holguraY] = [ancho * 0.03, alto * 0.03];
  for (let i = 0; i < 2; i++) {
    const apoyoV = vs.map((v) => hs.filter((h) => seCruzan(h, v, holguraX, holguraY)).length);
    vs = vs.filter((_, k) => apoyoV[k] >= Math.max(...apoyoV) * 0.4);
    const apoyoH = hs.map((h) => vs.filter((v) => seCruzan(h, v, holguraX, holguraY)).length);
    hs = hs.filter((_, k) => apoyoH[k] >= Math.max(...apoyoH) * 0.4);
  }
  hs.sort((a, b) => medio(a) - medio(b));
  vs.sort((a, b) => medio(a) - medio(b));

  // Fuera de la tabla (p. ej. entre el borde del papel y el de la tabla) las líneas de la otra
  // familia no pasan: se recortan las columnas y filas de los extremos que nadie cruza
  const hayTinta = (m: Mat, x: number, y: number, radio: number, horizontal: boolean) => {
    for (let d = -radio; d <= radio; d++) {
      const [px, py] = horizontal ? [Math.round(x), Math.round(y + d)] : [Math.round(x + d), Math.round(y)];
      if (px >= 0 && py >= 0 && px < m.cols && py < m.rows && m.data[py * m.cols + px]) return true;
    }
    return false;
  };
  const cubierta = (i: number, columnas: boolean) => {
    const [a, b] = columnas ? [vs[i], vs[i + 1]] : [hs[i], hs[i + 1]];
    const otras = columnas ? hs : vs;
    let n = 0;
    for (const o of otras) {
      // Se mira en el centro de la celda, sobre la línea que la cruza
      const p1 = columnas ? interseccion(o, a) : interseccion(a, o);
      const p2 = columnas ? interseccion(o, b) : interseccion(b, o);
      const [cx, cy] = [(p1.x + p2.x) / 2, (p1.y + p2.y) / 2];
      if (hayTinta(columnas ? mh : mv, cx, cy, 4, columnas)) n++;
    }
    return n / Math.max(1, otras.length);
  };
  for (const columnas of [true, false]) {
    const ls = columnas ? vs : hs;
    while (ls.length > 2 && cubierta(0, columnas) < 0.4) ls.shift();
    while (ls.length > 2 && cubierta(ls.length - 2, columnas) < 0.4) ls.pop();
  }
  [mh, mv].forEach((m) => m.delete());

  // Una "fila" mucho más fina de lo normal en un extremo no es una fila: p. ej. entre el
  // subrayado de "Fecha: ____" y la tabla, o el borde superior cortado por la foto
  const centro = ancho / 2;
  const fina = (i: number) => {
    const h = alturas(hs, centro);
    return h.length > 3 && h[i] < mediana(h) * 0.55;
  };
  while (hs.length > 4 && fina(0)) hs.shift();
  while (hs.length > 4 && fina(hs.length - 2)) hs.pop();
  return { hs, vs };
}

/**
 * Detecta la tabla en una imagen RGBA: corrige la rotación (también fotos de lado o al revés)
 * y ajusta cada línea de la cuadrícula, lo que tolera perspectiva y papel algo curvado.
 * Con `columnasEsperadas` = null acepta cualquier número de columnas (editor de plantillas).
 */
export function detectarTabla(
  cv: CV,
  rgba: Mat,
  columnasEsperadas: number | null,
  filasEncabezado = 1,
): TablaDetectada {
  const original = new cv.Mat();
  cv.cvtColor(rgba, original, cv.COLOR_RGBA2GRAY);

  // 1. Endereza: la familia de líneas dominante (las filas) pasa a horizontal
  const binOriginal = binarizar(cv, original);
  const segsOriginal = segmentos(cv, binOriginal);
  binOriginal.delete();
  if (segsOriginal.length < 6) {
    original.delete();
    throw new ErrorVision(
      'No se encontró una tabla en la foto. Tómala más de frente, con buena luz y con toda la planilla dentro.',
    );
  }
  // Una recta no tiene sentido: 179° equivale a -1° (girar 179° pondría la foto cabeza abajo)
  const dominante = anguloDominante(segsOriginal);
  const angulo = dominante > 90 ? dominante - 180 : dominante;

  const intentar = (giro: number) => {
    const imagen = rotar(cv, original, giro);
    const bin = binarizarSinBordes(cv, original, imagen, giro);
    const g = cuadricula(cv, bin);
    return { imagen, bin, ...g };
  };

  let t = intentar(angulo);
  // 2. El encabezado (la fila más alta) va arriba: si quedó abajo, la foto estaba al revés
  if (filasEncabezado > 0 && t.hs.length >= 3) {
    const h = alturas(t.hs, t.imagen.cols / 2);
    const ultima = h.at(-1)!;
    if (ultima > h[0] * 1.15 && ultima > mediana(h) * 1.15) {
      t.imagen.delete();
      t.bin.delete();
      t = intentar(angulo + 180);
    }
  }
  original.delete();
  const { imagen, bin, vs } = t;
  let { hs } = t;

  const columnas = vs.length - 1;
  const liberar = () => [imagen, bin].forEach((m) => m.delete());
  if (hs.length < 3 || columnas < 1) {
    liberar();
    throw new ErrorVision(
      'No se encontró una tabla en la foto. Tómala más de frente, con buena luz y con toda la planilla dentro.',
    );
  }
  if (columnasEsperadas !== null && columnas !== columnasEsperadas) {
    liberar();
    throw new ErrorVision(
      `Se detectaron ${Math.max(columnas, 0)} columnas, pero la planilla tiene ${columnasEsperadas}. ` +
        'Revisa que se vean todas las líneas.',
    );
  }

  // 3. Si la tabla sigue hasta el borde de la foto, la última fila está cortada: se conserva
  const xc = imagen.cols / 2;
  const alturaFila = mediana(alturas(hs, xc).slice(filasEncabezado));
  const ultima = hs.at(-1)!;
  const ultimaFilaCortada =
    imagen.rows - 1 - valor(ultima, xc) > alturaFila * 0.5 &&
    imagen.rows - 1 - valor(ultima, xc) < alturaFila * 1.5;
  if (ultimaFilaCortada) {
    const desplazar = (v: number) => Math.min(imagen.rows - 2, v + alturaFila);
    hs = [...hs, { ...ultima, pts: ultima.pts.map((q) => ({ u: q.u, v: desplazar(q.v) })) }];
  }

  // 4. Tinta sin líneas: se borran las líneas ajustadas y lo que la morfología reconoce como línea
  const mascara = cv.Mat.zeros(imagen.rows, imagen.cols, cv.CV_8UC1);
  // Fino: la escritura suele cruzar las líneas y no conviene borrarle trozos
  const grosor = Math.max(3, Math.round(Math.min(imagen.rows, imagen.cols) / 400));
  const blanco = new cv.Scalar(255);
  const trazar = (l: Linea, horizontal: boolean) => {
    const paso = 15;
    for (let u = l.desde; u < l.hasta; u += paso) {
      const u2 = Math.min(l.hasta, u + paso);
      const [p1, p2] = horizontal
        ? [new cv.Point(u, valor(l, u)), new cv.Point(u2, valor(l, u2))]
        : [new cv.Point(valor(l, u), u), new cv.Point(valor(l, u2), u2)];
      cv.line(mascara, p1, p2, blanco, grosor);
    }
  };
  hs.forEach((h) => trazar(h, true));
  vs.forEach((v) => trazar(v, false));
  for (const k of [
    new cv.Size(Math.round(imagen.cols / 30), 1),
    new cv.Size(1, Math.round(imagen.rows / 30)),
  ]) {
    const e = cv.getStructuringElement(cv.MORPH_RECT, k);
    const m = new cv.Mat();
    cv.morphologyEx(bin, m, cv.MORPH_OPEN, e);
    cv.bitwise_or(mascara, m, mascara);
    [e, m].forEach((x) => x.delete());
  }
  const tinta = new cv.Mat();
  cv.subtract(bin, mascara, tinta);
  [bin, mascara].forEach((m) => m.delete());

  // 5. Celdas: rectángulo que envuelve las 4 intersecciones, con un pequeño margen hacia dentro
  const margen = 3;
  const recortar = (x0: number, y0: number, x1: number, y1: number, base?: number, techo?: number): Caja => {
    const x = Math.max(0, Math.min(imagen.cols - 1, Math.round(x0)));
    const y = Math.max(0, Math.min(imagen.rows - 1, Math.round(y0)));
    return {
      x,
      y,
      ancho: Math.max(1, Math.min(imagen.cols - x, Math.round(x1) - x)),
      alto: Math.max(1, Math.min(imagen.rows - y, Math.round(y1) - y)),
      base,
      techo,
    };
  };
  const celdas = hs.slice(0, -1).map((h, f) =>
    vs.slice(0, -1).map((v, c) => {
      const p = [
        interseccion(h, v),
        interseccion(h, vs[c + 1]),
        interseccion(hs[f + 1], v),
        interseccion(hs[f + 1], vs[c + 1]),
      ];
      const base = (p[2].y + p[3].y) / 2;
      const techo = (p[0].y + p[1].y) / 2;
      // La caja se amplía arriba y abajo (se escribe grande y sobre las líneas); luego solo
      // cuentan los trazos con el centro dentro de la fila
      return recortar(
        Math.max(p[0].x, p[2].x) + margen,
        Math.min(p[0].y, p[1].y) - alturaFila * 0.3,
        Math.min(p[1].x, p[3].x) - margen,
        Math.max(p[2].y, p[3].y) + alturaFila * 0.45,
        base,
        f === 0 ? undefined : techo,
      );
    }),
  );

  // 6. La fecha está escrita justo encima de la tabla, a la izquierda
  const arriba = interseccion(hs[0], vs[0]);
  const alturaEncabezado = valor(hs[1], xc) - valor(hs[0], xc);
  const derechaFecha = interseccion(hs[0], vs[Math.ceil(vs.length * 0.6)] ?? vs.at(-1)!).x;
  const cajaFecha = recortar(
    arriba.x,
    arriba.y - Math.max(alturaEncabezado, alturaFila * 2) * 1.2,
    derechaFecha,
    // La fecha manuscrita suele montarse sobre la línea superior de la tabla
    arriba.y + alturaEncabezado * 0.3,
  );

  return { imagen, tinta, celdas, cajaFecha, filas: hs.length - 1, columnas, ultimaFilaCortada };
}

/**
 * Tinta que pertenece a la celda: trazos cuyo centro queda por encima de la línea inferior
 * (la escritura apoyada en ella cuenta; la de la fila de abajo, no) y sin restos de la fila de
 * arriba que asoman por el borde superior.
 */
function tintaDeCelda(cv: CV, tinta: Mat, caja: Caja): Mat {
  const roi = tinta.roi(new cv.Rect(caja.x, caja.y, caja.ancho, caja.alto));
  // clone() de un ROI no copia bien en OpenCV.js 5; copyTo sí
  const celda = new cv.Mat();
  roi.copyTo(celda);
  roi.delete();
  if (caja.base === undefined) return celda;

  const etiquetas = new cv.Mat();
  const stats = new cv.Mat();
  const centros = new cv.Mat();
  const n = cv.connectedComponentsWithStats(celda, etiquetas, stats, centros, 8, cv.CV_32S);
  const base = caja.base - caja.y;
  const techo = caja.techo === undefined ? -Infinity : caja.techo - caja.y;
  const altoFila = base - Math.max(0, techo);
  const quitar = new Set<number>();
  for (let i = 1; i < n; i++) {
    const izq = stats.intAt(i, cv.CC_STAT_LEFT);
    const [ancho, alto] = [stats.intAt(i, cv.CC_STAT_WIDTH), stats.intAt(i, cv.CC_STAT_HEIGHT)];
    const cy = centros.doubleAt(i, 1);
    // De otra fila
    if (cy > base || cy < techo) quitar.add(i);
    // Restos finos de una línea vertical pegados al borde de la celda
    else if ((izq <= 1 || izq + ancho >= celda.cols - 1) && ancho <= Math.max(3, altoFila * 0.12))
      quitar.add(i);
    // Restos de una línea horizontal: muy anchos y muy bajos
    else if (alto <= Math.max(3, altoFila * 0.1) && ancho > altoFila * 1.5) quitar.add(i);
  }
  if (quitar.size) {
    const e = etiquetas.data32S;
    const d = celda.data;
    for (let k = 0; k < d.length; k++) if (quitar.has(e[k])) d[k] = 0;
  }
  [etiquetas, stats, centros].forEach((m) => m.delete());
  return celda;
}

/** Clasifica una celda antes del OCR: vacía, solo un guion (= vacía) o con tinta. */
export function analizarCelda(cv: CV, tinta: Mat, caja: Caja): ContenidoCelda {
  const celda = tintaDeCelda(cv, tinta, caja);
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
    // La referencia es la altura de la fila (hasta la línea inferior), no la de la caja ampliada
    const altoFila = caja.base !== undefined ? caja.base - caja.y : caja.alto;
    if (n < caja.ancho * altoFila * 0.006) return 'vacia';
    const alto = y1 - y0 + 1;
    // Trazo bajo y alargado: un guion o una raya
    if (alto < altoFila * 0.22 && x1 - x0 + 1 > alto * 2.5) return 'guion';
    return 'tinta';
  } finally {
    celda.delete();
  }
}

/**
 * Recorte listo para el OCR: texto negro sobre blanco, sin líneas, ajustado a la tinta,
 * escalado a un alto cómodo para el OCR y con borde blanco.
 */
export function recorteParaOcr(cv: CV, tinta: Mat, caja: Caja, altoTexto = 40): Mat {
  const celda = tintaDeCelda(cv, tinta, caja);
  const d = celda.data;
  let [x0, y0, x1, y1] = [Infinity, Infinity, -1, -1];
  for (let y = 0; y < celda.rows; y++) {
    for (let x = 0; x < celda.cols; x++) {
      if (!d[y * celda.cols + x]) continue;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  const ajustada = new cv.Mat();
  if (x1 < 0) celda.copyTo(ajustada);
  else {
    const roi = celda.roi(new cv.Rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1));
    roi.copyTo(ajustada);
    roi.delete();
  }
  celda.delete();
  const invertida = new cv.Mat();
  cv.bitwise_not(ajustada, invertida);
  ajustada.delete();
  const escala = Math.min(4, altoTexto / Math.max(1, invertida.rows));
  if (escala > 1) cv.resize(invertida, invertida, new cv.Size(0, 0), escala, escala, cv.INTER_CUBIC);
  const conBorde = new cv.Mat();
  cv.copyMakeBorder(
    invertida,
    conBorde,
    16,
    16,
    16,
    16,
    cv.BORDER_CONSTANT,
    new cv.Scalar(255, 255, 255, 255),
  );
  invertida.delete();
  return conBorde;
}
