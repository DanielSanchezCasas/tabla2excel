import { $ } from './dom';

export function mostrarProgreso(mensaje: string, hecho?: number, total?: number) {
  $('progreso').hidden = false;
  $('progreso-texto').textContent = mensaje;
  const barra = $<HTMLProgressElement>('progreso-barra');
  if (hecho !== undefined && total) {
    barra.max = total;
    barra.value = hecho;
  } else {
    barra.removeAttribute('value');
  }
}

export const ocultarProgreso = () => ($('progreso').hidden = true);
