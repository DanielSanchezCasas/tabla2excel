import { sinFilasVacias, type Fila, type FotoProcesada } from './nucleo/foto';
import { columnasExportadas, type Columna, type Plantilla } from './nucleo/plantilla';
import { parsearFecha } from './nucleo/conversion';
import { evaluarCelda, type Lectura } from './nucleo/validacion';
import type { OcrEngine } from './ocr/ocr';
import {
  analizarCelda,
  detectarTabla,
  recorteParaOcr,
  type Caja,
  type TablaDetectada,
} from './vision/cuadricula';
import type { CV, Mat } from './vision/opencv';

export class ErrorFoto extends Error {}

export type Progreso = (mensaje: string, hecho?: number, total?: number) => void;

const LADO_MAXIMO = 2000;
const TIPOS_ACEPTADOS = ['image/jpeg', 'image/png', 'image/webp'];

/** Lista blanca por defecto según el tipo de columna */
const CARACTERES_POR_TIPO: Partial<Record<Columna['tipo'], string>> = {
  entero: '0123456789',
  decimal: '0123456789.,',
  moneda: '0123456789.,$',
  fecha: '0123456789/-.',
};

/** Deja que el navegador pinte el progreso antes de un paso pesado. */
const siguienteCuadro = () => new Promise((r) => setTimeout(r, 0));

export async function abrirImagen(archivo: File): Promise<ImageBitmap> {
  const nombre = archivo.name.toLowerCase();
  if (archivo.type === 'image/heic' || archivo.type === 'image/heif' || /\.hei[cf]$/.test(nombre)) {
    throw new ErrorFoto(
      "Este archivo es HEIC y este navegador no lo abre. Usa 'Tomar foto' o conviértelo a JPG.",
    );
  }
  if (archivo.type && !TIPOS_ACEPTADOS.includes(archivo.type)) {
    throw new ErrorFoto('Formato no compatible. Usa una foto JPG, PNG o WEBP.');
  }
  try {
    // Respeta la orientación EXIF de las fotos del celular
    return await createImageBitmap(archivo, { imageOrientation: 'from-image' });
  } catch {
    throw new ErrorFoto('No se pudo abrir la imagen. Prueba con otra foto (JPG, PNG o WEBP).');
  }
}

function aMat(cv: CV, imagen: ImageBitmap): Mat {
  // Las fotos de 12–48 MP se reducen antes de procesar para no agotar la memoria del celular
  const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.width, imagen.height));
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(imagen.width * escala);
  lienzo.height = Math.round(imagen.height * escala);
  const ctx = lienzo.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
  return cv.matFromImageData(ctx.getImageData(0, 0, lienzo.width, lienzo.height));
}

function aLienzo(cv: CV, mat: Mat): HTMLCanvasElement {
  const lienzo = document.createElement('canvas');
  cv.imshow(lienzo, mat);
  return lienzo;
}

/** Imagen enderezada con la cuadrícula detectada dibujada encima ("Ver cuadrícula detectada"). */
function dibujarCuadricula(cv: CV, tabla: TablaDetectada, plantilla: Plantilla): HTMLCanvasElement {
  const color = new cv.Mat();
  cv.cvtColor(tabla.imagen, color, cv.COLOR_GRAY2RGBA);
  const caja = (c: Caja, rgba: number[], grosor = 2) =>
    cv.rectangle(
      color,
      new cv.Point(c.x, c.y),
      new cv.Point(c.x + c.ancho, c.y + c.alto),
      new cv.Scalar(...rgba),
      grosor,
    );
  tabla.celdas.forEach((fila, f) =>
    fila.forEach((c, k) => {
      const leida = f >= plantilla.filas_encabezado && plantilla.columnas[k]?.exportar;
      caja(c, leida ? [31, 111, 67, 255] : [180, 180, 180, 255], leida ? 2 : 1);
    }),
  );
  caja(tabla.cajaFecha, [200, 120, 0, 255]);
  const lienzo = aLienzo(cv, color);
  color.delete();
  return lienzo;
}

export interface ResultadoFoto {
  foto: FotoProcesada;
  cuadricula: HTMLCanvasElement;
}

/** Una foto → FotoProcesada: tabla, fecha y solo las columnas exportadas. */
export async function procesarFoto(
  archivo: File,
  plantilla: Plantilla,
  ocr: OcrEngine,
  cv: CV,
  progreso: Progreso,
): Promise<ResultadoFoto> {
  progreso('Abriendo la foto…');
  const imagen = await abrirImagen(archivo);
  const rgba = aMat(cv, imagen);
  imagen.close();

  progreso('Buscando la tabla…');
  await siguienteCuadro();
  let tabla: TablaDetectada;
  try {
    tabla = detectarTabla(cv, rgba, plantilla.columnas.length);
  } catch (e) {
    throw new ErrorFoto((e as Error).message);
  } finally {
    rgba.delete();
  }

  try {
    if (tabla.filas <= plantilla.filas_encabezado) {
      throw new ErrorFoto('La tabla no tiene filas de datos. Revisa que salga completa en la foto.');
    }
    const exportadas = columnasExportadas(plantilla);
    const filasDatos = tabla.filas - plantilla.filas_encabezado;
    const lecturas: Promise<Lectura>[] = [];
    const total = filasDatos * exportadas.length + 1;
    let hecho = 0;
    const avanzar = () => progreso(`Leyendo celda ${++hecho} de ${total}`, hecho, total);

    const recorte = (caja: Caja) => {
      const m = recorteParaOcr(cv, tabla.tinta, caja);
      const lienzo = aLienzo(cv, m);
      m.delete();
      return lienzo;
    };

    // Fecha escrita sobre la tabla
    const lecturaFecha = ocr.leer(recorte(tabla.cajaFecha), { tipo: 'fecha' }).finally(avanzar);

    for (let f = 0; f < filasDatos; f++) {
      for (const col of exportadas) {
        const k = plantilla.columnas.indexOf(col);
        const caja = tabla.celdas[f + plantilla.filas_encabezado][k];
        const contenido = analizarCelda(cv, tabla.tinta, caja);
        if (contenido !== 'tinta') {
          // Vacía o solo un guion: no se manda al OCR (no se inventa nada)
          lecturas.push(Promise.resolve({ fila: f, columna: k, texto: '', confianza: 100 }).finally(avanzar));
          continue;
        }
        const caracteres = col.caracteres ?? CARACTERES_POR_TIPO[col.tipo];
        lecturas.push(
          ocr
            .leer(recorte(caja), { tipo: 'celda', fila: f, columna: k, caracteres })
            .then((l) => ({ fila: f, columna: k, texto: l.texto, confianza: l.confianza }))
            .finally(avanzar),
        );
      }
    }

    const [fecha, ...resto] = await Promise.all([lecturaFecha, ...lecturas]);
    const filas: Fila[] = [];
    for (let f = 0; f < filasDatos; f++) {
      filas.push({
        añadida_a_mano: false,
        celdas: exportadas.map((col, i) => evaluarCelda(resto[f * exportadas.length + i], col, plantilla)),
      });
    }

    return {
      foto: {
        nombre_archivo: archivo.name,
        fecha: parsearFecha(fecha.texto),
        fecha_texto_crudo: fecha.texto,
        fecha_confianza: fecha.confianza,
        filas: sinFilasVacias(filas),
      },
      cuadricula: dibujarCuadricula(cv, tabla, plantilla),
    };
  } finally {
    tabla.imagen.delete();
    tabla.tinta.delete();
  }
}

/** Para el editor de plantillas: detecta columnas y lee el encabezado como nombre propuesto. */
export async function detectarColumnas(
  archivo: File,
  ocr: OcrEngine,
  cv: CV,
  progreso: Progreso,
): Promise<string[]> {
  progreso('Abriendo la foto…');
  const imagen = await abrirImagen(archivo);
  const rgba = aMat(cv, imagen);
  imagen.close();
  progreso('Buscando la tabla…');
  await siguienteCuadro();
  let tabla: TablaDetectada;
  try {
    tabla = detectarTabla(cv, rgba, null);
  } catch (e) {
    throw new ErrorFoto((e as Error).message);
  } finally {
    rgba.delete();
  }
  try {
    let hecho = 0;
    return await Promise.all(
      tabla.celdas[0].map(async (caja, k) => {
        if (analizarCelda(cv, tabla.tinta, caja) !== 'tinta') return `Columna ${k + 1}`;
        const m = recorteParaOcr(cv, tabla.tinta, caja);
        const lienzo = aLienzo(cv, m);
        m.delete();
        const l = await ocr.leer(lienzo, { tipo: 'celda', fila: -1, columna: k });
        progreso(`Leyendo encabezado ${++hecho} de ${tabla.columnas}`, hecho, tabla.columnas);
        return l.texto.replace(/\s+/g, ' ').trim() || `Columna ${k + 1}`;
      }),
    );
  } finally {
    tabla.imagen.delete();
    tabla.tinta.delete();
  }
}
