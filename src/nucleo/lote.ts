import type { FotoAñadida, FotoProcesada } from './foto';

export const MAXIMO_FOTOS = 10;

/** Lote de fotos verificadas. Vive solo en memoria: no se guarda entre sesiones (RF-016). */
export class Lote {
  private _fotos: FotoAñadida[] = [];
  private _sinExportar = false;

  get fotos(): readonly FotoAñadida[] {
    return this._fotos;
  }

  get hay_sin_exportar() {
    return this._sinExportar;
  }

  get lleno() {
    return this._fotos.length >= MAXIMO_FOTOS;
  }

  /** Motivo por el que no se puede añadir la foto, o null si se puede. */
  motivoParaNoAñadir(foto: FotoProcesada): string | null {
    if (this.lleno) return `Llegaste al máximo de ${MAXIMO_FOTOS} fotos. Exporta el Excel.`;
    if (!foto.fecha) return 'Escribe la fecha de la planilla para continuar.';
    return null;
  }

  añadir(foto: FotoProcesada): FotoAñadida {
    const motivo = this.motivoParaNoAñadir(foto);
    if (motivo) throw new Error(motivo);
    const añadida = { ...foto, numero: this._fotos.length + 1 };
    this._fotos.push(añadida);
    this._sinExportar = true;
    return añadida;
  }

  /** Quita la foto con ese número y renumera las siguientes sin huecos. */
  quitar(numero: number) {
    this._fotos = this._fotos.filter((f) => f.numero !== numero).map((f, i) => ({ ...f, numero: i + 1 }));
    this._sinExportar = this._fotos.length > 0;
  }

  marcarExportado() {
    this._sinExportar = false;
  }

  vaciar() {
    this._fotos = [];
    this._sinExportar = false;
  }
}
