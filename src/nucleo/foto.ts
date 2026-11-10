import { columnasExportadas, type Plantilla } from './plantilla';
import { evaluarCelda, pendiente, type Celda } from './validacion';

export interface Fila {
  /** Solo las columnas exportadas, en orden de la plantilla */
  celdas: Celda[];
  añadida_a_mano: boolean;
}

export interface FotoProcesada {
  nombre_archivo: string;
  fecha: Date | null;
  fecha_texto_crudo: string;
  fecha_confianza: number;
  filas: Fila[];
}

export interface FotoAñadida extends FotoProcesada {
  /** Posición actual en el lote (1..n) */
  numero: number;
}

export const filaVacia = (f: Fila) => f.celdas.every((c) => c.estado === 'vacia');

/** Las filas sin nada en las columnas exportadas se descartan (RF-007). */
export const sinFilasVacias = (filas: Fila[]) => filas.filter((f) => !filaVacia(f));

export function nuevaFila(plantilla: Plantilla, indice: number): Fila {
  return {
    añadida_a_mano: true,
    celdas: columnasExportadas(plantilla).map((col) =>
      evaluarCelda(
        { fila: indice, columna: plantilla.columnas.indexOf(col), texto: '', confianza: 100 },
        col,
        plantilla,
        true,
      ),
    ),
  };
}

export const celdasPendientes = (foto: FotoProcesada) =>
  foto.filas.reduce((n, f) => n + f.celdas.filter(pendiente).length, 0);
