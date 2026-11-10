import { generarExcel, nombreArchivo } from '../nucleo/excel';
import { celdasPendientes } from '../nucleo/foto';
import { Lote, MAXIMO_FOTOS } from '../nucleo/lote';
import type { Plantilla } from '../nucleo/plantilla';
import { $, crear, descargar, fechaLegible, mostrarAviso } from './dom';

const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Lista del lote, exportar y aviso al salir (RF-016). */
export class VistaLote {
  readonly lote = new Lote();

  constructor(
    private plantilla: () => Plantilla,
    private alCambiar: () => void,
  ) {
    $('exportar').addEventListener('click', () => this.exportar());
    $('empezar').addEventListener('click', () => {
      if (
        this.lote.hay_sin_exportar &&
        !confirm('Hay fotos sin exportar. ¿Seguro que quieres empezar de nuevo?')
      ) {
        return;
      }
      this.lote.vaciar();
      this.dibujar();
      this.alCambiar();
    });
    // Confirmación nativa del navegador si se recarga o cierra con fotos sin exportar
    window.addEventListener('beforeunload', (e) => {
      if (!this.lote.hay_sin_exportar) return;
      e.preventDefault();
      e.returnValue = '';
    });
    this.dibujar();
  }

  dibujar() {
    const fotos = this.lote.fotos;
    $('lote-lista').replaceChildren(
      ...fotos.map((f) => {
        const pendientes = celdasPendientes(f);
        const quitar = crear('button', { type: 'button', textContent: 'Quitar' });
        quitar.setAttribute('aria-label', `Quitar foto ${f.numero}`);
        quitar.addEventListener('click', () => {
          this.lote.quitar(f.numero);
          this.dibujar();
          this.alCambiar();
        });
        const resumen =
          `Foto ${f.numero} · ${fechaLegible(f.fecha)} · ${f.filas.length} filas` +
          (pendientes ? ` · ${pendientes} por revisar` : '');
        return crear('li', {}, crear('span', { textContent: resumen }), quitar);
      }),
    );
    $('lote-vacio').hidden = fotos.length > 0;
    $<HTMLButtonElement>('exportar').disabled = fotos.length === 0;
    $('contador').textContent = `Lote: ${fotos.length} de ${MAXIMO_FOTOS} fotos`;
  }

  private async exportar() {
    const boton = $<HTMLButtonElement>('exportar');
    boton.disabled = true;
    try {
      const plantilla = this.plantilla();
      descargar(await generarExcel(this.lote.fotos, plantilla), nombreArchivo(plantilla), TIPO_XLSX);
      this.lote.marcarExportado();
    } catch (e) {
      console.error(e);
      mostrarAviso('No se pudo generar el Excel. Inténtalo de nuevo; tus fotos siguen en el lote.');
    } finally {
      boton.disabled = this.lote.fotos.length === 0;
    }
  }
}
