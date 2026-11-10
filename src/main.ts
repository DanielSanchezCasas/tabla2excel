import './ui/estilos.css';
import {
  cargarIndice,
  cargarPlantilla,
  plantillasPropias,
  recordarPlantilla,
  type IndicePlantillas,
  type Plantilla,
} from './nucleo/plantilla';
import { FakeOcrEngine, type OcrEngine, type RespuestasSimuladas } from './ocr/ocr';
import { TesseractOcr } from './ocr/tesseract';
import { detectarColumnas, ErrorFoto, procesarFoto } from './pipeline';
import { habilitarCarga, prepararCarga, prepararSelector } from './ui/carga';
import { problemaDeCompatibilidad } from './ui/compatibilidad';
import { $, mostrarAviso, ocultarAviso } from './ui/dom';
import { EditorPlantilla } from './ui/editorPlantilla';
import { VistaLote } from './ui/lote';
import { mostrarProgreso, ocultarProgreso } from './ui/progreso';
import { VistaPrevia } from './ui/vistaPrevia';
import { cargarOpenCV } from './vision/opencv';

declare global {
  interface Window {
    /** Solo en pruebas end-to-end: sustituye el OCR por respuestas predefinidas */
    __tabla2excelOcrSimulado?: RespuestasSimuladas;
  }
}

const BASE = import.meta.env.BASE_URL;
const URL_VENDOR = new URL(`${BASE}vendor/`, location.href).href;

let indice: IndicePlantillas;
let plantilla: Plantilla;
let ocr: OcrEngine | null = null;

const obtenerOcr = () =>
  (ocr ??= window.__tabla2excelOcrSimulado
    ? new FakeOcrEngine(window.__tabla2excelOcrSimulado)
    : new TesseractOcr(URL_VENDOR, plantilla.idioma_ocr));
const obtenerOpenCV = () => cargarOpenCV(`${URL_VENDOR}opencv.js`);

const mensajeDeError = (e: unknown) => {
  if (e instanceof ErrorFoto) return e.message;
  console.error(e);
  return 'Algo salió mal al procesar la foto. Prueba con otra; tu lote sigue intacto.';
};

async function iniciar() {
  const problema = problemaDeCompatibilidad();
  if (problema) {
    mostrarAviso(problema);
    habilitarCarga(false);
    return;
  }

  indice = await cargarIndice(BASE);
  const pedida = new URLSearchParams(location.search).get('plantilla');
  const cargada = await cargarPlantilla(BASE, indice, pedida);
  plantilla = cargada.plantilla;
  if (cargada.aviso) mostrarAviso(cargada.aviso, 'info');

  const vista = new VistaPrevia(() => actualizar());
  const loteUi = new VistaLote(
    () => plantilla,
    () => actualizar(),
  );
  const lote = loteUi.lote;

  const cambiarPlantilla = async (id: string) => {
    try {
      plantilla = (await cargarPlantilla(BASE, indice, id)).plantilla;
      recordarPlantilla(plantilla.id);
      ocultarAviso();
    } catch (e) {
      mostrarAviso((e as Error).message);
    }
    prepararSelector(indice, plantillasPropias(), plantilla, cambiarPlantilla);
  };
  prepararSelector(indice, plantillasPropias(), plantilla, cambiarPlantilla);

  function actualizar() {
    const foto = vista.actual;
    const motivo = foto ? lote.motivoParaNoAñadir(foto) : null;
    const anadir = $<HTMLButtonElement>('anadir-foto');
    anadir.disabled = !foto || motivo !== null;
    anadir.title = motivo ?? '';
    // Una foto a la vez: hay que añadir o descartar la actual antes de pasar otra
    habilitarCarga(!foto && !lote.lleno);
    $<HTMLSelectElement>('plantilla').disabled = lote.fotos.length > 0 || foto !== null;
    if (lote.lleno && !foto) mostrarAviso(`Llegaste al máximo de 10 fotos. Exporta el Excel.`, 'info');
  }

  prepararCarga(async (archivo) => {
    ocultarAviso();
    habilitarCarga(false);
    mostrarProgreso('Preparando…');
    try {
      const cv = await obtenerOpenCV();
      const r = await procesarFoto(archivo, plantilla, obtenerOcr(), cv, mostrarProgreso);
      vista.mostrar(r.foto, plantilla, r.cuadricula);
      if (r.foto.filas.length === 0) {
        mostrarAviso(
          'No se encontraron filas con datos. Puedes añadirlas a mano o descartar la foto.',
          'info',
        );
      }
    } catch (e) {
      mostrarAviso(mensajeDeError(e));
    } finally {
      ocultarProgreso();
      actualizar();
    }
  });

  $('anadir-foto').addEventListener('click', () => {
    const foto = vista.actual;
    if (!foto) return;
    lote.añadir(foto);
    vista.ocultar();
    loteUi.dibujar();
    actualizar();
    $('carga').scrollIntoView({ behavior: 'smooth' });
  });
  $('descartar-foto').addEventListener('click', () => {
    vista.ocultar();
    actualizar();
  });

  new EditorPlantilla(
    async (archivo) => {
      mostrarProgreso('Preparando…');
      try {
        return await detectarColumnas(archivo, obtenerOcr(), await obtenerOpenCV(), mostrarProgreso);
      } catch (e) {
        throw new Error(mensajeDeError(e));
      } finally {
        ocultarProgreso();
      }
    },
    (p) => {
      plantilla = p;
      prepararSelector(indice, plantillasPropias(), plantilla, cambiarPlantilla);
      location.hash = '';
      mostrarAviso(`Plantilla "${p.nombre}" activa en este navegador.`, 'info');
    },
  );

  const enrutar = () => {
    const editor = location.hash === '#crear-plantilla';
    $('crear-plantilla').hidden = !editor;
    $('convertir').hidden = editor;
  };
  window.addEventListener('hashchange', enrutar);
  enrutar();
  actualizar();
}

iniciar().catch((e) => {
  console.error(e);
  mostrarAviso('No se pudo iniciar la herramienta. Revisa la conexión y recarga la página.');
});
