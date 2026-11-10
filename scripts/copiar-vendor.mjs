// Copia a public/vendor/ los recursos pesados para servirlos desde el propio sitio (principio VII).
import { cpSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const destino = join(process.cwd(), 'public', 'vendor');
mkdirSync(destino, { recursive: true });

const raiz = (paquete, desde = require) => dirname(desde.resolve(`${paquete}/package.json`));
const copiar = (origen, nombre) => cpSync(origen, join(destino, nombre));

// Worker de Tesseract
copiar(join(raiz('tesseract.js'), 'dist', 'worker.min.js'), 'worker.min.js');

// Solo los cores LSTM (el modelo best_int es solo LSTM); tesseract.js elige uno según el navegador
const core = raiz('tesseract.js-core', createRequire(require.resolve('tesseract.js/package.json')));
for (const variante of ['relaxedsimd-lstm', 'simd-lstm', 'lstm']) {
  copiar(join(core, `tesseract-core-${variante}.wasm.js`), `tesseract-core-${variante}.wasm.js`);
}

// Idioma español, modelo 4.0.0_best_int (research.md, Decisión 1)
copiar(join(raiz('@tesseract.js-data/spa'), '4.0.0_best_int', 'spa.traineddata.gz'), 'spa.traineddata.gz');

// OpenCV.js (wasm embebido)
copiar(join(raiz('@techstark/opencv-js'), 'dist', 'opencv.js'), 'opencv.js');

console.log('Recursos copiados a public/vendor/');
