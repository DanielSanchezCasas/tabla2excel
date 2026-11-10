// Genera planillas SINTÉTICAS (nombres inventados) con el formato de talegas.json, para pruebas.
// Las fotos reales no se suben al repositorio (tienen datos personales).
// Uso: pnpm fixtures
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const require = createRequire(import.meta.url);
const cv = await require('@techstark/opencv-js');
const aqui = dirname(fileURLToPath(import.meta.url));
const salida = join(aqui, 'imagenes');
mkdirSync(salida, { recursive: true });

const plantilla = JSON.parse(readFileSync(join(aqui, '../../public/plantillas/talegas.json'), 'utf-8'));
const columnas = plantilla.columnas;

// Pseudoaleatorio determinista para que las fixtures no cambien entre ejecuciones
let semilla = 7;
const azar = () => ((semilla = (semilla * 16807) % 2147483647) - 1) / 2147483646;
const elegir = (lista) => lista[Math.floor(azar() * lista.length)];

const NOMBRES = ['Ana', 'Luis', 'Marta', 'Pedro', 'Sofia', 'Diego', 'Elena', 'Tomas', 'Clara', 'Ivan'];
const APELLIDOS = ['Rojas', 'Mora', 'Vega', 'Pinto', 'Lara', 'Soto', 'Navas', 'Ruiz', 'Gil', 'Paz'];
const INICIALES = ['SA', 'NC', 'CF', 'GV', 'JM', 'DC'];

const FILAS_CON_DATOS = 16;
const FILAS_VACIAS = 6;
const filas = [];
for (let i = 0; i < FILAS_CON_DATOS; i++) {
  filas.push({
    Hora: '/NS',
    'Talega No.': String(100 + Math.floor(azar() * 800)),
    'Carro No.': i % 4 === 2 ? '-' : elegir(['', 'NC', 'E', 'SP']) + (10 + Math.floor(azar() * 400)),
    Tacos: String(elegir([13, 14, 14, 14, 15])),
    Fundas: String(1 + Math.floor(azar() * 7)),
    Paraguas: '1',
    Varas: i % 5 === 1 ? '2' : '',
    'Nombre del Socio': `${elegir(NOMBRES)} ${elegir(APELLIDOS)}`,
    'Entrega Cuarto de Tacos': elegir(INICIALES),
    'Recibe Socio / Caddie': 'cp',
    'No. Caddie': '-',
    'Recibe Cuarto de Tacos': elegir(INICIALES),
    'Entrega Socio / Caddie': 'ok',
    Observaciones: elegir(['', 'GV', 'DC', '14-3-1']),
  });
}

// Geometría de la planilla
const ANCHO = 1700;
const ALTO = 1300;
const X0 = 50;
const Y0 = 150;
const PESOS = [85, 75, 80, 35, 40, 35, 35, 260, 80, 105, 55, 75, 105, 300];
const ANCHO_TABLA = 1600;
const anchos = PESOS.map((p) => Math.round((p / PESOS.reduce((a, b) => a + b)) * ANCHO_TABLA));
const ALTO_ENCABEZADO = 80;
const ALTO_FILA = 42;
const xs = anchos.reduce((acc, w) => [...acc, acc.at(-1) + w], [X0]);
const ys = [Y0, Y0 + ALTO_ENCABEZADO];
for (let i = 0; i < FILAS_CON_DATOS + FILAS_VACIAS; i++) ys.push(ys.at(-1) + ALTO_FILA);

const NEGRO = new cv.Scalar(20, 20, 20, 255);
const TINTA = new cv.Scalar(70, 40, 20, 255);

function dibujarPlanilla() {
  const m = new cv.Mat(ALTO, ANCHO, cv.CV_8UC4, new cv.Scalar(250, 250, 248, 255));
  const texto = (t, x, y, escala, color, grosor, fuente = cv.FONT_HERSHEY_SIMPLEX) =>
    cv.putText(m, t, new cv.Point(x, y), fuente, escala, color, grosor, cv.LINE_AA);

  texto('Fecha:', X0, 110, 0.8, NEGRO, 2);
  texto('31 octubre 2026', X0 + 110, 105, 1.3, TINTA, 2, cv.FONT_HERSHEY_SCRIPT_SIMPLEX);
  cv.line(m, new cv.Point(X0 + 100, 115), new cv.Point(X0 + 420, 115), NEGRO, 1);

  // Cuadrícula completa
  for (const x of xs) cv.line(m, new cv.Point(x, ys[0]), new cv.Point(x, ys.at(-1)), NEGRO, 2);
  for (const y of ys) cv.line(m, new cv.Point(xs[0], y), new cv.Point(xs.at(-1), y), NEGRO, 2);

  columnas.forEach((c, j) => {
    const palabras = c.nombre.replace('No.', 'No').split(' ');
    palabras.slice(0, 3).forEach((p, k) => texto(p, xs[j] + 4, ys[0] + 22 + k * 18, 0.42, NEGRO, 1));
  });
  filas.forEach((f, i) => {
    columnas.forEach((c, j) => {
      const v = f[c.nombre];
      const y = ys[i + 1] + ALTO_FILA - 10;
      if (v === '-') {
        cv.line(m, new cv.Point(xs[j] + 12, y - 12), new cv.Point(xs[j] + 30, y - 13), TINTA, 2);
      } else if (v) {
        texto(v, xs[j] + 6, y, 0.95, TINTA, 2, cv.FONT_HERSHEY_SCRIPT_SIMPLEX);
      }
    });
  });
  return m;
}

function guardar(m, nombre) {
  const png = new PNG({ width: m.cols, height: m.rows });
  png.data = Buffer.from(m.data);
  writeFileSync(join(salida, nombre), PNG.sync.write(png));
}

const blanco = new cv.Scalar(235, 235, 230, 255);
const original = dibujarPlanilla();
guardar(original, 'recta.png');

// Rotada 15°, con lienzo ampliado para no recortar esquinas
{
  const centro = new cv.Point(ANCHO / 2, ALTO / 2);
  const rot = cv.getRotationMatrix2D(centro, 15, 0.82);
  const m = new cv.Mat();
  cv.warpAffine(original, m, rot, new cv.Size(ANCHO, ALTO), cv.INTER_LINEAR, cv.BORDER_CONSTANT, blanco);
  guardar(m, 'rotada.png');
}

// En perspectiva (foto tomada desde abajo y de lado)
{
  const desde = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, ANCHO, 0, ANCHO, ALTO, 0, ALTO]);
  const hacia = cv.matFromArray(4, 1, cv.CV_32FC2, [
    150,
    80,
    ANCHO - 60,
    20,
    ANCHO - 20,
    ALTO - 30,
    60,
    ALTO - 120,
  ]);
  const h = cv.getPerspectiveTransform(desde, hacia);
  const m = new cv.Mat();
  cv.warpPerspective(original, m, h, new cv.Size(ANCHO, ALTO), cv.INTER_LINEAR, cv.BORDER_CONSTANT, blanco);
  guardar(m, 'perspectiva.png');
}

// Con sombra: oscurece en degradado la mitad izquierda
{
  const m = original.clone();
  for (let y = 0; y < m.rows; y++) {
    for (let x = 0; x < m.cols; x++) {
      const factor = 0.45 + 0.55 * Math.min(1, x / (m.cols * 0.6));
      const i = (y * m.cols + x) * 4;
      for (let k = 0; k < 3; k++) m.data[i + k] = Math.round(m.data[i + k] * factor);
    }
  }
  guardar(m, 'sombra.png');
}

// Sin tabla
{
  const m = new cv.Mat(900, 1200, cv.CV_8UC4, new cv.Scalar(250, 250, 248, 255));
  ['Lista de pendientes', 'llamar al proveedor', 'revisar inventario'].forEach((t, i) =>
    cv.putText(m, t, new cv.Point(80, 150 + i * 90), cv.FONT_HERSHEY_SCRIPT_SIMPLEX, 1.6, TINTA, 2),
  );
  guardar(m, 'sin-tabla.png');
}

// Resultado esperado: columnas exportadas de las filas con datos (guion = vacío)
const exportadas = columnas.filter((c) => c.exportar !== false);
const limpiar = (v) => (v === '-' ? '' : v);
const csv = [exportadas.map((c) => c.nombre).join(';')]
  .concat(filas.map((f) => exportadas.map((c) => limpiar(f[c.nombre])).join(';')))
  .join('\n');
writeFileSync(join(aqui, 'esperado.csv'), csv + '\n');

// Respuestas para el OCR simulado: "fila,columna física" → texto
const celdas = {};
filas.forEach((f, i) =>
  columnas.forEach((c, j) => {
    if (c.exportar !== false && f[c.nombre]) celdas[`${i},${j}`] = f[c.nombre];
  }),
);
writeFileSync(
  join(aqui, 'ocr-simulado.json'),
  JSON.stringify({ fecha: '31 octubre 2026', celdas, filas: FILAS_CON_DATOS + FILAS_VACIAS }, null, 2) + '\n',
);
console.log(`Fixtures generadas en ${salida}`);
