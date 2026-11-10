// Interfaz del OCR: permite simularlo en pruebas y cambiar de motor sin tocar el resto (principio V).

export interface ContextoOcr {
  /** 'fecha' = la fecha escrita sobre la tabla; 'celda' = una celda de datos */
  tipo: 'fecha' | 'celda';
  /** Fila de datos (0 = primera fila tras el encabezado) y columna física (0-based) */
  fila?: number;
  columna?: number;
  /** Lista blanca de caracteres permitidos */
  caracteres?: string;
}

export interface LecturaOcr {
  texto: string;
  /** 0–100 */
  confianza: number;
}

export interface OcrEngine {
  leer(imagen: HTMLCanvasElement | OffscreenCanvas, contexto: ContextoOcr): Promise<LecturaOcr>;
  terminar(): Promise<void>;
}

/** Respuestas predefinidas: `celdas["fila,columna"]` y `fecha`. Lo no definido se lee como vacío. */
export interface RespuestasSimuladas {
  fecha?: LecturaOcr | string;
  celdas: Record<string, LecturaOcr | string>;
}

export class FakeOcrEngine implements OcrEngine {
  constructor(private respuestas: RespuestasSimuladas) {}

  async leer(_imagen: unknown, contexto: ContextoOcr): Promise<LecturaOcr> {
    const r =
      contexto.tipo === 'fecha'
        ? this.respuestas.fecha
        : this.respuestas.celdas[`${contexto.fila},${contexto.columna}`];
    if (r === undefined) return { texto: '', confianza: 0 };
    return typeof r === 'string' ? { texto: r, confianza: 95 } : r;
  }

  async terminar() {}
}
