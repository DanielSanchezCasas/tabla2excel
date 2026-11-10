export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export function crear<K extends keyof HTMLElementTagNameMap>(
  etiqueta: K,
  propiedades: Partial<HTMLElementTagNameMap[K]> = {},
  ...hijos: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const el = Object.assign(document.createElement(etiqueta), propiedades);
  el.append(...hijos);
  return el;
}

export function mostrarAviso(texto: string, tipo: 'error' | 'info' = 'error') {
  const aviso = $('aviso');
  aviso.textContent = texto;
  aviso.className = `aviso ${tipo}`;
  aviso.hidden = false;
  aviso.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

export const ocultarAviso = () => ($('aviso').hidden = true);

/** Fecha (UTC) ↔ valor de un <input type="date"> */
export const fechaAInput = (f: Date | null) => (f ? f.toISOString().slice(0, 10) : '');
export function inputAFecha(valor: string): Date | null {
  const m = valor.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
}
export const fechaLegible = (f: Date | null) =>
  f ? f.toLocaleDateString('es', { timeZone: 'UTC' }) : 'sin fecha';

export function descargar(datos: BlobPart, nombre: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([datos], { type: tipo }));
  const a = crear('a', { href: url, download: nombre });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
