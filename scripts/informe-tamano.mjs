// Informa el tamaño de descarga (gzip) de dist/. No bloquea el build (constitución 2.1.0).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const dist = join(process.cwd(), 'dist');
const archivos = [];
const recorrer = (dir) => {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) recorrer(ruta);
    else {
      const datos = readFileSync(ruta);
      const gzip = ruta.endsWith('.gz') ? datos.length : gzipSync(datos).length;
      archivos.push({ ruta: relative(dist, ruta), gzip });
    }
  }
};
recorrer(dist);

const mb = (bytes) => (bytes / 1024 / 1024).toFixed(2) + ' MB';
archivos.sort((a, b) => b.gzip - a.gzip);
console.log('\nTamaño de descarga (gzip):');
for (const { ruta, gzip } of archivos.slice(0, 10)) console.log(`  ${mb(gzip).padStart(9)}  ${ruta}`);
console.log(`  Total: ${mb(archivos.reduce((s, a) => s + a.gzip, 0))} en ${archivos.length} archivos\n`);
