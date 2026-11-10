import { celdasPendientes, nuevaFila, type FotoProcesada } from '../nucleo/foto';
import { columnasExportadas, type Plantilla } from '../nucleo/plantilla';
import { editarCelda, type Celda } from '../nucleo/validacion';
import { $, crear, fechaAInput, inputAFecha } from './dom';

const titulo = (c: Celda) => {
  if (c.estado === 'invalida') return `${c.motivo} Leído: "${c.texto_crudo}"`;
  if (c.estado === 'baja_confianza') return `Leído: "${c.texto_crudo}" (${Math.round(c.confianza)} %)`;
  return '';
};

const textoVisible = (c: Celda) =>
  c.estado === 'invalida' || c.valor === null ? c.texto_crudo : String(c.valor);

/** Vista previa editable de la foto actual: fecha, celdas, borrar y añadir filas. */
export class VistaPrevia {
  private foto: FotoProcesada | null = null;
  private plantilla: Plantilla | null = null;

  constructor(private alCambiar: () => void) {
    $('fecha').addEventListener('input', () => {
      if (!this.foto) return;
      this.foto.fecha = inputAFecha($<HTMLInputElement>('fecha').value);
      this.alCambiar();
    });
    $('anadir-fila').addEventListener('click', () => {
      if (!this.foto || !this.plantilla) return;
      this.foto.filas.push(nuevaFila(this.plantilla, this.foto.filas.length));
      this.dibujarTabla();
      const inputs = $('tabla').querySelectorAll<HTMLInputElement>('tbody tr:last-child input');
      inputs[0]?.focus();
      this.alCambiar();
    });
    $('ver-cuadricula').addEventListener('click', () => {
      const caja = $('cuadricula');
      caja.hidden = !caja.hidden;
      $('ver-cuadricula').textContent = caja.hidden ? 'Ver cuadrícula detectada' : 'Ocultar cuadrícula';
    });
  }

  get actual() {
    return this.foto;
  }

  mostrar(foto: FotoProcesada, plantilla: Plantilla, cuadricula: HTMLCanvasElement) {
    this.foto = foto;
    this.plantilla = plantilla;
    $<HTMLInputElement>('fecha').value = fechaAInput(foto.fecha);
    $('fecha-leida').textContent = foto.fecha_texto_crudo
      ? `Leído: "${foto.fecha_texto_crudo}"${foto.fecha ? '' : ' — no se pudo interpretar, escríbela.'}`
      : 'No se pudo leer la fecha. Escríbela para continuar.';
    $('cuadricula').replaceChildren(cuadricula);
    $('cuadricula').hidden = true;
    $('ver-cuadricula').textContent = 'Ver cuadrícula detectada';
    this.dibujarTabla();
    $('vista').hidden = false;
    $('vista').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  ocultar() {
    this.foto = null;
    $('vista').hidden = true;
    $('tabla').replaceChildren();
    $('cuadricula').replaceChildren();
  }

  pendientes() {
    return this.foto ? celdasPendientes(this.foto) : 0;
  }

  private dibujarTabla() {
    const foto = this.foto!;
    const plantilla = this.plantilla!;
    const columnas = columnasExportadas(plantilla);
    const encabezado = crear(
      'thead',
      {},
      crear('tr', {}, ...columnas.map((c) => crear('th', { textContent: c.nombre })), crear('th')),
    );
    const cuerpo = crear('tbody');
    foto.filas.forEach((fila, i) => {
      const tr = crear('tr');
      fila.celdas.forEach((celda, k) => {
        const clase = (estado: string) => (columnas[k].tipo === 'texto' ? `${estado} texto` : estado);
        const td = crear('td', { className: clase(celda.estado) });
        const input = crear('input', {
          value: textoVisible(celda),
          title: titulo(celda),
          inputMode: columnas[k].tipo === 'texto' ? 'text' : 'numeric',
        });
        input.setAttribute('aria-label', `${columnas[k].nombre}, fila ${i + 1}`);
        input.addEventListener('change', () => {
          const nueva = editarCelda(fila.celdas[k], input.value, columnas[k], plantilla);
          fila.celdas[k] = nueva;
          td.className = clase(nueva.estado);
          input.title = titulo(nueva);
          this.alCambiar();
        });
        td.append(input);
        tr.append(td);
      });
      const borrar = crear('button', { type: 'button', textContent: '✕', title: 'Borrar fila' });
      borrar.setAttribute('aria-label', `Borrar fila ${i + 1}`);
      borrar.addEventListener('click', () => {
        foto.filas.splice(i, 1);
        this.dibujarTabla();
        this.alCambiar();
      });
      tr.append(crear('td', { className: 'borrar' }, borrar));
      cuerpo.append(tr);
    });
    $('tabla').replaceChildren(encabezado, cuerpo);
  }
}
