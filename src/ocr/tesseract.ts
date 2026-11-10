import { createWorker, PSM, type Worker } from 'tesseract.js';
import type { ContextoOcr, LecturaOcr, OcrEngine } from './ocr';

interface Puesto {
  worker: Promise<Worker>;
  lista: string | undefined | null;
  cola: Promise<unknown>;
}

/**
 * OCR con Tesseract.js. Todos los recursos (worker, núcleo, idioma) se sirven desde el propio sitio
 * (`vendor/`), nunca desde un CDN (principio VII). Usa varios workers en paralelo.
 */
export class TesseractOcr implements OcrEngine {
  private puestos: Puesto[];
  private siguiente = 0;

  constructor(urlVendor: string, idioma = 'spa', cantidad = 2) {
    const opciones = {
      workerPath: `${urlVendor}worker.min.js`,
      corePath: urlVendor,
      langPath: urlVendor,
      workerBlobURL: false,
    };
    this.puestos = Array.from({ length: cantidad }, () => ({
      worker: createWorker(idioma, undefined, opciones),
      lista: null,
      cola: Promise.resolve(),
    }));
  }

  leer(imagen: HTMLCanvasElement | OffscreenCanvas, contexto: ContextoOcr): Promise<LecturaOcr> {
    const puesto = this.puestos[this.siguiente++ % this.puestos.length];
    const tarea = puesto.cola.then(async () => {
      const worker = await puesto.worker;
      // La lista blanca cambia por columna: solo se reconfigura si es distinta
      if (puesto.lista !== contexto.caracteres) {
        await worker.setParameters({
          tessedit_char_whitelist: contexto.caracteres ?? '',
          tessedit_pageseg_mode: PSM.SINGLE_LINE,
        });
        puesto.lista = contexto.caracteres;
      }
      const { data } = await worker.recognize(imagen as HTMLCanvasElement);
      return { texto: data.text.trim(), confianza: data.confidence };
    });
    puesto.cola = tarea.catch(() => undefined);
    return tarea;
  }

  async terminar() {
    await Promise.all(this.puestos.map(async (p) => (await p.worker).terminate()));
  }
}
