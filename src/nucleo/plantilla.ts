// Plantilla: describe el formato de la tabla (data-model.md). El código no tiene columnas fijas.

export const TIPOS = ['texto', 'entero', 'decimal', 'moneda', 'fecha'] as const;
export type TipoColumna = (typeof TIPOS)[number];

export interface Columna {
  nombre: string;
  tipo: TipoColumna;
  exportar: boolean;
  caracteres?: string;
  obligatoria: boolean;
  ancho_relativo?: number;
}

export interface Regional {
  separador_decimal: ',' | '.';
  separador_miles: '.' | ',' | '';
  formato_fecha: string;
}

export interface Plantilla {
  id: string;
  nombre: string;
  idioma_ocr: string;
  regional: Regional;
  filas_encabezado: number;
  umbral_confianza: number;
  columnas: Columna[];
}

export type ResultadoValidacion = { ok: true; plantilla: Plantilla } | { ok: false; error: string };

const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

export function validarPlantilla(datos: unknown): ResultadoValidacion {
  const error = (mensaje: string): ResultadoValidacion => ({ ok: false, error: mensaje });
  if (!esObjeto(datos)) return error('El archivo no contiene una plantilla.');
  if (typeof datos.id !== 'string' || !datos.id) return error('Falta el "id" de la plantilla.');
  if (typeof datos.nombre !== 'string' || !datos.nombre) return error('Falta el "nombre" de la plantilla.');
  if (!Array.isArray(datos.columnas) || datos.columnas.length === 0) {
    return error('La plantilla no tiene columnas.');
  }

  const columnas: Columna[] = [];
  for (const [i, c] of datos.columnas.entries()) {
    if (!esObjeto(c) || typeof c.nombre !== 'string' || !c.nombre) {
      return error(`La columna ${i + 1} no tiene nombre.`);
    }
    if (!TIPOS.includes(c.tipo as TipoColumna)) {
      return error(`La columna "${c.nombre}" tiene un tipo no válido (usa: ${TIPOS.join(', ')}).`);
    }
    if (columnas.some((otra) => otra.nombre === c.nombre)) {
      return error(`La columna "${c.nombre}" está repetida.`);
    }
    columnas.push({
      nombre: c.nombre,
      tipo: c.tipo as TipoColumna,
      exportar: c.exportar !== false,
      caracteres: typeof c.caracteres === 'string' ? c.caracteres : undefined,
      obligatoria: c.obligatoria === true,
      ancho_relativo: typeof c.ancho_relativo === 'number' ? c.ancho_relativo : undefined,
    });
  }
  if (!columnas.some((c) => c.exportar)) return error('La plantilla no exporta ninguna columna.');

  const regional = esObjeto(datos.regional) ? datos.regional : {};
  const umbral = Number(datos.umbral_confianza ?? 70);
  const filas = Number(datos.filas_encabezado ?? 1);
  if (!(umbral >= 0 && umbral <= 100)) return error('"umbral_confianza" debe estar entre 0 y 100.');
  if (!(Number.isInteger(filas) && filas >= 0)) return error('"filas_encabezado" debe ser un entero ≥ 0.');

  return {
    ok: true,
    plantilla: {
      id: datos.id,
      nombre: datos.nombre,
      idioma_ocr: typeof datos.idioma_ocr === 'string' ? datos.idioma_ocr : 'spa',
      regional: {
        separador_decimal: regional.separador_decimal === '.' ? '.' : ',',
        separador_miles: (['.', ',', ''] as const).find((s) => s === regional.separador_miles) ?? '.',
        formato_fecha: typeof regional.formato_fecha === 'string' ? regional.formato_fecha : 'dd/MM/yyyy',
      },
      filas_encabezado: filas,
      umbral_confianza: umbral,
      columnas,
    },
  };
}

export const columnasExportadas = (p: Plantilla): Columna[] => p.columnas.filter((c) => c.exportar);

// --- Carga en el navegador ---------------------------------------------------------------

const CLAVE_ACTUAL = 'tabla2excel.plantilla_actual';
const CLAVE_PROPIAS = 'tabla2excel.plantillas_propias';

export interface IndicePlantillas {
  defecto: string;
  plantillas: { id: string; nombre: string }[];
}

const leerStorage = (clave: string): string | null => {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
};

const escribirStorage = (clave: string, valor: string) => {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    // Sin almacenamiento (modo privado): la elección no se recuerda, pero la herramienta sigue funcionando.
  }
};

export function plantillasPropias(): Plantilla[] {
  try {
    const lista: unknown = JSON.parse(leerStorage(CLAVE_PROPIAS) ?? '[]');
    if (!Array.isArray(lista)) return [];
    return lista.flatMap((p) => {
      const r = validarPlantilla(p);
      return r.ok ? [r.plantilla] : [];
    });
  } catch {
    return [];
  }
}

export function guardarPlantillaPropia(p: Plantilla) {
  const otras = plantillasPropias().filter((o) => o.id !== p.id);
  escribirStorage(CLAVE_PROPIAS, JSON.stringify([...otras, p]));
}

export const recordarPlantilla = (id: string) => escribirStorage(CLAVE_ACTUAL, id);

export async function cargarIndice(base: string): Promise<IndicePlantillas> {
  const r = await fetch(`${base}plantillas/indice.json`);
  if (!r.ok) throw new Error('No se pudo cargar la lista de plantillas.');
  return r.json();
}

/** Orden: `?plantilla=` → plantilla recordada → defecto del índice. Si falla, cae al defecto. */
export async function cargarPlantilla(
  base: string,
  indice: IndicePlantillas,
  pedida: string | null,
): Promise<{ plantilla: Plantilla; aviso?: string }> {
  const propias = plantillasPropias();
  const obtener = async (id: string): Promise<Plantilla> => {
    const propia = propias.find((p) => p.id === id);
    if (propia) return propia;
    if (!indice.plantillas.some((p) => p.id === id)) throw new Error(`No existe la plantilla "${id}".`);
    const r = await fetch(`${base}plantillas/${encodeURIComponent(id)}.json`);
    if (!r.ok) throw new Error(`No se pudo cargar la plantilla "${id}".`);
    const v = validarPlantilla(await r.json());
    if (!v.ok) throw new Error(`La plantilla "${id}" no es válida: ${v.error}`);
    return v.plantilla;
  };

  const id = pedida ?? leerStorage(CLAVE_ACTUAL) ?? indice.defecto;
  try {
    return { plantilla: await obtener(id) };
  } catch (e) {
    if (id === indice.defecto) throw e;
    return {
      plantilla: await obtener(indice.defecto),
      aviso: `${(e as Error).message} Se usa la plantilla por defecto.`,
    };
  }
}
