import type { IndicePlantillas, Plantilla } from '../nucleo/plantilla';
import { $, crear } from './dom';

/** Zona de carga: cámara, elegir archivo y arrastrar. Una foto a la vez (sin `multiple`). */
export function prepararCarga(alRecibir: (archivo: File) => void) {
  const zona = $('zona');
  for (const id of ['camara', 'archivo']) {
    const input = $<HTMLInputElement>(id);
    input.addEventListener('change', () => {
      const archivo = input.files?.[0];
      input.value = '';
      if (archivo) alRecibir(archivo);
    });
  }
  zona.addEventListener('dragover', (e) => {
    e.preventDefault();
    zona.classList.add('encima');
  });
  zona.addEventListener('dragleave', () => zona.classList.remove('encima'));
  zona.addEventListener('drop', (e) => {
    e.preventDefault();
    zona.classList.remove('encima');
    const archivo = e.dataTransfer?.files[0];
    if (archivo) alRecibir(archivo);
  });
}

export function habilitarCarga(habilitada: boolean) {
  $('zona').classList.toggle('deshabilitada', !habilitada);
  for (const id of ['camara', 'archivo']) $<HTMLInputElement>(id).disabled = !habilitada;
}

/** Selector de plantilla en el encabezado (índice publicado + plantillas propias del navegador). */
export function prepararSelector(
  indice: IndicePlantillas,
  propias: Plantilla[],
  actual: Plantilla,
  alCambiar: (id: string) => void,
) {
  const select = $<HTMLSelectElement>('plantilla');
  select.replaceChildren(
    ...indice.plantillas.map((p) => crear('option', { value: p.id, textContent: p.nombre })),
    ...propias
      .filter((p) => !indice.plantillas.some((i) => i.id === p.id))
      .map((p) => crear('option', { value: p.id, textContent: `${p.nombre} (propia)` })),
  );
  if (![...select.options].some((o) => o.value === actual.id)) {
    select.append(crear('option', { value: actual.id, textContent: actual.nombre }));
  }
  select.value = actual.id;
  select.onchange = () => alCambiar(select.value);
}
