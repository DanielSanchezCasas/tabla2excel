// Lectura de números escritos a mano: separa cada dígito y lo clasifica con una red pequeña
// entrenada con MNIST (research.md, Decisión 7, plan B). Todo en JavaScript, sin dependencias.
import modelo from './modelo-digitos.json';
import type { ContextoOcr, LecturaOcr, OcrEngine } from './ocr';

const LADO = 28;

/** Convolución 5×5 con relleno "same" + sesgo + ReLU. Entrada y salida en orden [canal][y][x]. */
function convolucion(entrada: Float32Array, canales: number, lado: number, pesos: number[], sesgo: number[]) {
  const filtros = sesgo.length;
  const salida = new Float32Array(filtros * lado * lado);
  for (let f = 0; f < filtros; f++) {
    for (let y = 0; y < lado; y++) {
      for (let x = 0; x < lado; x++) {
        let s = sesgo[f];
        for (let c = 0; c < canales; c++) {
          for (let ky = 0; ky < 5; ky++) {
            const yy = y + ky - 2;
            if (yy < 0 || yy >= lado) continue;
            for (let kx = 0; kx < 5; kx++) {
              const xx = x + kx - 2;
              if (xx < 0 || xx >= lado) continue;
              s += entrada[(c * lado + yy) * lado + xx] * pesos[((f * canales + c) * 5 + ky) * 5 + kx];
            }
          }
        }
        salida[(f * lado + y) * lado + x] = Math.max(0, s);
      }
    }
  }
  return salida;
}

/** Máximo en ventanas k×k (paso k). */
function reducir(entrada: Float32Array, canales: number, lado: number, k: number) {
  const nuevo = Math.floor(lado / k);
  const salida = new Float32Array(canales * nuevo * nuevo);
  for (let c = 0; c < canales; c++) {
    for (let y = 0; y < nuevo; y++) {
      for (let x = 0; x < nuevo; x++) {
        let m = -Infinity;
        for (let dy = 0; dy < k; dy++) {
          for (let dx = 0; dx < k; dx++)
            m = Math.max(m, entrada[(c * lado + y * k + dy) * lado + x * k + dx]);
        }
        salida[(c * nuevo + y) * nuevo + x] = m;
      }
    }
  }
  return salida;
}

/** Clasifica una imagen 28×28 (dígito claro, valores 0–255, sobre fondo 0). */
export function clasificarDigito(imagen: Float32Array): { digito: number; probabilidad: number } {
  let a = convolucion(imagen, 1, LADO, modelo.conv1.pesos, modelo.conv1.sesgo);
  a = reducir(a, 8, LADO, 2);
  a = convolucion(a, 8, 14, modelo.conv2.pesos, modelo.conv2.sesgo);
  a = reducir(a, 16, 14, 3);
  const logits = modelo.densa.sesgo.map((b, j) => {
    let s = b;
    for (let i = 0; i < a.length; i++) s += a[i] * modelo.densa.pesos[i * 10 + j];
    return s;
  });
  const max = Math.max(...logits);
  const exp = logits.map((l) => Math.exp(l - max));
  const total = exp.reduce((s, e) => s + e, 0);
  const digito = logits.indexOf(max);
  return { digito, probabilidad: exp[digito] / total };
}

interface Componente {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  pixeles: number[];
}

/** Componentes conexos (8-vecindad) de una imagen binaria. */
function componentes(bin: Uint8Array, ancho: number, alto: number): Componente[] {
  const visto = new Uint8Array(bin.length);
  const res: Componente[] = [];
  for (let i = 0; i < bin.length; i++) {
    if (!bin[i] || visto[i]) continue;
    const c: Componente = { x0: Infinity, y0: Infinity, x1: -1, y1: -1, pixeles: [] };
    const pila = [i];
    visto[i] = 1;
    while (pila.length) {
      const p = pila.pop()!;
      const [x, y] = [p % ancho, Math.floor(p / ancho)];
      c.pixeles.push(p);
      c.x0 = Math.min(c.x0, x);
      c.x1 = Math.max(c.x1, x);
      c.y0 = Math.min(c.y0, y);
      c.y1 = Math.max(c.y1, y);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const [nx, ny] = [x + dx, y + dy];
          if (nx < 0 || ny < 0 || nx >= ancho || ny >= alto) continue;
          const q = ny * ancho + nx;
          if (bin[q] && !visto[q]) {
            visto[q] = 1;
            pila.push(q);
          }
        }
      }
    }
    res.push(c);
  }
  return res;
}

interface Variante {
  dx: number;
  dy: number;
  /** Lado mayor del dígito dentro de 28×28 (MNIST usa 20) */
  lado: number;
}

/** Pequeñas variaciones del mismo dígito: si la red no coincide en todas, la lectura es dudosa. */
const VARIANTES: Variante[] = [
  { dx: 0, dy: 0, lado: 20 },
  { dx: 1, dy: 0, lado: 20 },
  { dx: -1, dy: 0, lado: 20 },
  { dx: 0, dy: 1, lado: 20 },
  { dx: 0, dy: -1, lado: 20 },
  { dx: 0, dy: 0, lado: 17 },
  { dx: 0, dy: 0, lado: 23 },
];

/** Lleva un dígito al formato MNIST: lado mayor ~20 px, centrado por su centro de masa en 28×28. */
function normalizar(bin: Uint8Array, ancho: number, c: Componente, v: Variante): Float32Array {
  const [w, h] = [c.x1 - c.x0 + 1, c.y1 - c.y0 + 1];
  const escala = v.lado / Math.max(w, h);
  const [nw, nh] = [Math.max(1, Math.round(w * escala)), Math.max(1, Math.round(h * escala))];
  // Reducción por área: cada píxel destino es la fracción de tinta que cubre
  const chico = new Float32Array(nw * nh);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!bin[(c.y0 + y) * ancho + c.x0 + x]) continue;
      const [tx, ty] = [Math.min(nw - 1, Math.floor(x * escala)), Math.min(nh - 1, Math.floor(y * escala))];
      chico[ty * nw + tx] += escala * escala;
    }
  }
  let [sx, sy, sm] = [0, 0, 0];
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const val = Math.min(1, chico[y * nw + x]);
      chico[y * nw + x] = val;
      sx += x * val;
      sy += y * val;
      sm += val;
    }
  }
  const ox = Math.round(LADO / 2 - sx / Math.max(sm, 1e-6)) + v.dx;
  const oy = Math.round(LADO / 2 - sy / Math.max(sm, 1e-6)) + v.dy;
  const salida = new Float32Array(LADO * LADO);
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const [X, Y] = [x + ox, y + oy];
      if (X >= 0 && Y >= 0 && X < LADO && Y < LADO) salida[Y * LADO + X] = chico[y * nw + x] * 255;
    }
  }
  return salida;
}

/**
 * Separa los dígitos de una imagen binaria (1 = tinta): une los trazos de un mismo dígito
 * (p. ej. el 4 o el 5 en dos trazos), descarta puntos sueltos y parte los dígitos pegados.
 */
export interface DigitoSeparado {
  /** El mismo dígito normalizado con pequeñas variaciones (para medir la seguridad de la lectura) */
  variantes: Float32Array[];
  /** Salió de partir dígitos pegados: la separación puede ser imperfecta */
  partido: boolean;
}

export function separarDigitos(bin: Uint8Array, ancho: number, alto: number): DigitoSeparado[] {
  let comps = componentes(bin, ancho, alto);
  if (!comps.length) return [];
  const altoTinta = Math.max(...comps.map((c) => c.y1 - c.y0 + 1));
  // Puntos, motas y rayas sueltas (restos de línea, marcas): bajos respecto al número
  comps = comps.filter((c) => c.y1 - c.y0 + 1 >= altoTinta * 0.35);

  // Une los que se solapan mucho en horizontal (trazos del mismo dígito)
  comps.sort((a, b) => a.x0 - b.x0);
  const unidos: Componente[] = [];
  for (const c of comps) {
    const u = unidos.at(-1);
    const solape = u ? Math.min(u.x1, c.x1) - Math.max(u.x0, c.x0) : -1;
    if (u && solape > Math.min(u.x1 - u.x0, c.x1 - c.x0) * 0.5) {
      u.x0 = Math.min(u.x0, c.x0);
      u.x1 = Math.max(u.x1, c.x1);
      u.y0 = Math.min(u.y0, c.y0);
      u.y1 = Math.max(u.y1, c.y1);
      u.pixeles.push(...c.pixeles);
    } else {
      unidos.push({ ...c, pixeles: [...c.pixeles] });
    }
  }

  // Dígitos pegados: un componente mucho más ancho que alto se parte en partes iguales
  const digitos: (Componente & { partido: boolean })[] = [];
  for (const c of unidos) {
    const [w, h] = [c.x1 - c.x0 + 1, c.y1 - c.y0 + 1];
    const partes = w > h * 1.2 ? Math.max(2, Math.round(w / (h * 0.85))) : 1;
    for (let k = 0; k < partes; k++) {
      const [a, b] = [c.x0 + Math.floor((w * k) / partes), c.x0 + Math.floor((w * (k + 1)) / partes) - 1];
      const pix = c.pixeles.filter((p) => p % ancho >= a && p % ancho <= b);
      if (!pix.length) continue;
      const ys = pix.map((p) => Math.floor(p / ancho));
      digitos.push({
        x0: a,
        x1: b,
        y0: Math.min(...ys),
        y1: Math.max(...ys),
        pixeles: pix,
        partido: partes > 1,
      });
    }
  }

  return digitos.map((d) => {
    const solo = new Uint8Array(bin.length);
    for (const p of d.pixeles) solo[p] = 1;
    return { variantes: VARIANTES.map((v) => normalizar(solo, ancho, d, v)), partido: d.partido };
  });
}

/** Lee un número escrito a mano en una imagen RGBA (tinta oscura sobre fondo claro). */
export function leerNumero(rgba: Uint8ClampedArray, ancho: number, alto: number): LecturaOcr {
  const bin = new Uint8Array(ancho * alto);
  for (let i = 0; i < bin.length; i++) bin[i] = rgba[i * 4] < 128 ? 1 : 0;
  const digitos = separarDigitos(bin, ancho, alto).map(({ variantes, partido }) => {
    // La red da probabilidades altas incluso cuando se equivoca: la seguridad real se mide
    // viendo si las variantes (desplazado, trazo fino o grueso) coinciden
    const lecturas = variantes.map(clasificarDigito);
    const votos = new Array<number>(10).fill(0);
    lecturas.forEach((l) => votos[l.digito]++);
    const digito = votos.indexOf(Math.max(...votos));
    const acuerdo = votos[digito] / lecturas.length;
    const prob =
      lecturas.filter((l) => l.digito === digito).reduce((s, l) => s + l.probabilidad, 0) / votos[digito];
    return { digito, confianza: acuerdo * acuerdo * prob * (partido ? 0.6 : 1) };
  });
  if (!digitos.length) return { texto: '', confianza: 0 };
  return {
    texto: digitos.map((d) => d.digito).join(''),
    // La confianza del número es la del dígito más dudoso
    confianza: Math.round(Math.min(...digitos.map((d) => d.confianza)) * 100),
  };
}

/**
 * Motor combinado: los números (lista blanca solo de dígitos) los lee el clasificador de
 * dígitos manuscritos; el resto, el OCR de texto.
 */
export class OcrConDigitos implements OcrEngine {
  constructor(private texto: OcrEngine) {}

  async leer(imagen: HTMLCanvasElement | OffscreenCanvas, contexto: ContextoOcr): Promise<LecturaOcr> {
    if (contexto.caracteres !== '0123456789') return this.texto.leer(imagen, contexto);
    const ctx = (imagen as HTMLCanvasElement).getContext('2d') as CanvasRenderingContext2D;
    const { data } = ctx.getImageData(0, 0, imagen.width, imagen.height);
    return leerNumero(data, imagen.width, imagen.height);
  }

  terminar() {
    return this.texto.terminar();
  }
}
