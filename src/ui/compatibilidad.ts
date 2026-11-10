/** Devuelve un mensaje si al navegador le falta algo imprescindible, o null si es compatible. */
export function problemaDeCompatibilidad(): string | null {
  const falta =
    typeof WebAssembly !== 'object' ||
    typeof Worker !== 'function' ||
    typeof createImageBitmap !== 'function' ||
    typeof Blob !== 'function';
  return falta ? 'Este navegador no es compatible. Usa Chrome, Edge, Safari o Firefox actualizados.' : null;
}
