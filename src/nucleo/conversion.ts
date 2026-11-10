import type { Columna, Regional } from './plantilla';

export interface Conversion {
  valor: string | number | Date | null;
  valido: boolean;
  motivo?: string;
}

/** Texto formado solo por guiones, rayas, puntos y espacios = celda vacía (no es un error). */
export const esVacio = (texto: string) => /^[\s\-—–_.·]*$/.test(texto);

const MESES = [
  ['enero'],
  ['febrero'],
  ['marzo'],
  ['abril'],
  ['mayo'],
  ['junio'],
  ['julio'],
  ['agosto'],
  ['septiembre', 'setiembre'],
  ['octubre'],
  ['noviembre'],
  ['diciembre'],
];

function distanciaEdicion(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[a.length][b.length];
}

function mesDesdePalabra(palabra: string): number | null {
  let mejor: { mes: number; distancia: number } | null = null;
  MESES.forEach((nombres, i) =>
    nombres.forEach((n) => {
      const distancia = distanciaEdicion(palabra, n);
      if (distancia <= 2 && (!mejor || distancia < mejor.distancia)) mejor = { mes: i + 1, distancia };
    }),
  );
  return (mejor as { mes: number } | null)?.mes ?? null;
}

function fechaValida(anio: number, mes: number, dia: number): Date | null {
  if (!(anio >= 1900 && anio <= 2200 && mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31)) return null;
  const f = new Date(Date.UTC(anio, mes - 1, dia));
  return f.getUTCMonth() === mes - 1 ? f : null;
}

/** Acepta "31 octubre 2026" (mes en palabras, tolera errores leves de lectura) y "31/10/2026". */
export function parsearFecha(texto: string): Date | null {
  // En la fecha manuscrita la "O" suele ser un cero; el usuario siempre la confirma después
  const t = texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/(?<=\d)o|o(?=\d)/g, '0')
    .trim();

  const numerica = t.match(/(\d{1,2})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{4})/);
  if (numerica) return fechaValida(+numerica[3], +numerica[2], +numerica[1]);

  const partes = t.split(/[^a-z0-9]+/).filter((p) => p && p !== 'de' && p !== 'del');
  const dia = partes.find((p) => /^\d{1,2}$/.test(p));
  const anio = partes.find((p) => /^\d{4}$/.test(p));
  // La franja de la fecha incluye la etiqueta impresa "Fecha:": se busca la palabra que sea un mes
  const mes = partes
    .filter((p) => /^[a-z]{3,}$/.test(p))
    .map(mesDesdePalabra)
    .find((m) => m !== null);
  if (!dia || !anio || !mes) return null;
  return fechaValida(+anio, mes, +dia);
}

function numero(texto: string, regional: Regional): number | null {
  let t = texto.replace(/[\s$]/g, '');
  if (regional.separador_miles) t = t.split(regional.separador_miles).join('');
  if (regional.separador_decimal === ',') t = t.replace(',', '.');
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null;
}

/** Convierte el texto leído al tipo de la columna. */
export function convertir(texto: string, columna: Columna, regional: Regional): Conversion {
  const t = texto.replace(/\s+/g, ' ').trim();
  if (esVacio(t)) {
    return columna.obligatoria
      ? { valor: null, valido: false, motivo: 'Esta columna es obligatoria y está vacía.' }
      : { valor: null, valido: true };
  }
  switch (columna.tipo) {
    case 'texto':
      return { valor: t, valido: true };
    case 'entero': {
      const n = numero(t, regional);
      return n !== null && Number.isInteger(n)
        ? { valor: n, valido: true }
        : { valor: null, valido: false, motivo: `"${t}" no es un número entero.` };
    }
    case 'decimal':
    case 'moneda': {
      const n = numero(t, regional);
      return n !== null
        ? { valor: n, valido: true }
        : { valor: null, valido: false, motivo: `"${t}" no es un número.` };
    }
    case 'fecha': {
      const f = parsearFecha(t);
      return f
        ? { valor: f, valido: true }
        : { valor: null, valido: false, motivo: `"${t}" no es una fecha válida.` };
    }
  }
}
