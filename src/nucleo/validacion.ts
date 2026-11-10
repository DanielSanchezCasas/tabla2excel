import { convertir } from './conversion';
import type { Columna, Plantilla } from './plantilla';

export type EstadoCelda = 'ok' | 'baja_confianza' | 'invalida' | 'vacia';

export interface Celda {
  /** Fila de datos (0 = primera tras el encabezado) y columna física (0-based) */
  fila: number;
  columna: number;
  texto_crudo: string;
  /** 0–100 */
  confianza: number;
  valor: string | number | Date | null;
  estado: EstadoCelda;
  motivo?: string;
  editada: boolean;
}

export interface Lectura {
  fila: number;
  columna: number;
  texto: string;
  confianza: number;
}

/** Convierte y valida una lectura del OCR: nunca acepta en silencio lo dudoso (principio IV). */
export function evaluarCelda(
  lectura: Lectura,
  columna: Columna,
  plantilla: Plantilla,
  editada = false,
): Celda {
  const conv = convertir(lectura.texto, columna, plantilla.regional);
  const base = {
    fila: lectura.fila,
    columna: lectura.columna,
    texto_crudo: lectura.texto,
    confianza: lectura.confianza,
    valor: conv.valor,
    editada,
  };
  if (!conv.valido) return { ...base, estado: 'invalida', motivo: conv.motivo };
  if (conv.valor === null) return { ...base, estado: 'vacia' };
  if (lectura.confianza < plantilla.umbral_confianza) {
    return {
      ...base,
      estado: 'baja_confianza',
      motivo: `Lectura dudosa (${Math.round(lectura.confianza)} %).`,
    };
  }
  return { ...base, estado: 'ok' };
}

/** Edición manual: el texto escrito por la persona tiene confianza total y se revalida. */
export const editarCelda = (celda: Celda, texto: string, columna: Columna, plantilla: Plantilla): Celda =>
  evaluarCelda({ fila: celda.fila, columna: celda.columna, texto, confianza: 100 }, columna, plantilla, true);

/** Celdas que necesitan revisión humana. */
export const pendiente = (c: Celda) => c.estado === 'baja_confianza' || c.estado === 'invalida';
