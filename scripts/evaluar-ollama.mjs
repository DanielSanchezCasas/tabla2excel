// Mide cuánto acierta un modelo de visión de Ollama al leer una planilla real (Talega, Carro y Nombre).
// Las fotos y su referencia viven en fotos-reales/ (en .gitignore: tienen datos personales).
//
// Uso:  node scripts/evaluar-ollama.mjs "fotos-reales/foto.jpeg" [modelo]
// La referencia es "fotos-reales/foto.verdad.json": [["talega","carro","nombre"], ...] (una fila por línea de la planilla).
// Requiere Ollama en marcha (OLLAMA_HOST, por defecto http://localhost:11434) y el modelo descargado.
import { readFileSync } from 'node:fs';

const [foto, modelo = 'qwen2.5vl:7b'] = process.argv.slice(2);
if (!foto) {
  console.error('Uso: node scripts/evaluar-ollama.mjs "fotos-reales/foto.jpeg" [modelo]');
  process.exit(1);
}
const host = process.env.OLLAMA_HOST ?? 'http://localhost:11434';
const verdad = JSON.parse(readFileSync(foto.replace(/\.(jpe?g|png|webp)$/i, '.verdad.json'), 'utf-8'));

const normalizar = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
const distancia = (a, b) => {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
};

// La instrucción que mejor funcionó: pedir todas las columnas exportadas evita que el modelo
// rellene un "Carro No." vacío con el número de la columna de al lado
const PROMPT =
  'Esta es una planilla manuscrita en español. Transcribe TODAS las filas de datos de la tabla, de arriba abajo, ' +
  'estas columnas, en este orden de izquierda a derecha: "Talega No.", "Carro No.", "Tacos", "Fundas", "Paraguas", "Varas", "Nombre del Socio". ' +
  'Muchas celdas de "Carro No." y "Varas" están vacías: en ese caso usa "" y NO copies el valor de la columna de al lado. Un guion también es "". ' +
  'No inventes. Responde solo JSON: {"filas":[{"talega":"","carro":"","tacos":"","fundas":"","paraguas":"","varas":"","nombre":""}]}';

const inicio = Date.now();
const r = await fetch(`${host}/api/generate`, {
  method: 'POST',
  body: JSON.stringify({
    model: modelo,
    prompt: PROMPT,
    images: [readFileSync(foto).toString('base64')],
    stream: false,
    format: 'json',
    options: { temperature: 0 },
  }),
});
if (!r.ok) throw new Error(`Ollama respondió ${r.status}: ${await r.text()}`);
const respuesta = (await r.json()).response;
const segundos = (Date.now() - inicio) / 1000;

let filas = [];
try {
  filas = JSON.parse(respuesta).filas ?? [];
} catch {
  console.error('La respuesta no es JSON válido:', respuesta.slice(0, 500));
  process.exit(1);
}

const aciertos = { talega: 0, carro: 0, nombre: 0 };
let [errores, letras] = [0, 0];
verdad.forEach(([talega, carro, nombre], i) => {
  const f = filas[i] ?? {};
  if (normalizar(f.talega) === normalizar(talega)) aciertos.talega++;
  if (normalizar(f.carro) === normalizar(carro)) aciertos.carro++;
  if (normalizar(f.nombre) === normalizar(nombre)) aciertos.nombre++;
  errores += distancia(normalizar(f.nombre), normalizar(nombre));
  letras += normalizar(nombre).length;
  const marca = (ok) => (ok ? ' ' : '✗');
  console.log(
    `${String(i + 1).padStart(2)} ${marca(normalizar(f.talega) === normalizar(talega))} ${String(f.talega ?? '').padEnd(6)}` +
      ` ${marca(normalizar(f.carro) === normalizar(carro))} ${String(f.carro ?? '').padEnd(7)}` +
      ` ${marca(normalizar(f.nombre) === normalizar(nombre))} ${f.nombre ?? ''}`,
  );
});
const n = verdad.length;
console.log(
  `\n${modelo}: ${segundos.toFixed(0)} s · filas leídas ${filas.length}/${n} · ` +
    `Talega ${aciertos.talega}/${n} · Carro ${aciertos.carro}/${n} · Nombre ${aciertos.nombre}/${n} exactos ` +
    `(${Math.round((100 * errores) / Math.max(1, letras))} % de letras mal)`,
);
