// Convierte un modelo ONNX pequeño (MNIST del ONNX Model Zoo, licencia MIT) a JSON con sus capas
// y pesos, para ejecutarlo en el navegador sin dependencias. Solo se usa en desarrollo.
// Uso: node scripts/onnx-a-json.mjs modelo.onnx salida.json
import { readFileSync, writeFileSync } from 'node:fs';

/** Decodificador mínimo del formato protobuf: devuelve los campos como [número, tipo, valor]. */
function campos(buf) {
  const res = [];
  let i = 0;
  const varint = () => {
    let v = 0n;
    let s = 0n;
    for (;;) {
      const b = buf[i++];
      v |= BigInt(b & 0x7f) << s;
      if (!(b & 0x80)) return v;
      s += 7n;
    }
  };
  while (i < buf.length) {
    const clave = Number(varint());
    const [num, tipo] = [clave >> 3, clave & 7];
    if (tipo === 0) res.push([num, tipo, varint()]);
    else if (tipo === 2) {
      const n = Number(varint());
      res.push([num, tipo, buf.subarray(i, i + n)]);
      i += n;
    } else if (tipo === 5) {
      res.push([num, tipo, buf.subarray(i, i + 4)]);
      i += 4;
    } else if (tipo === 1) {
      res.push([num, tipo, buf.subarray(i, i + 8)]);
      i += 8;
    } else throw new Error(`Tipo de campo no soportado: ${tipo}`);
  }
  return res;
}
const texto = (b) => Buffer.from(b).toString('utf-8');
const floats = (b) => Array.from(new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length)));
const ints = (b) => {
  // enteros empaquetados (varint)
  const r = [];
  for (const [, , v] of campos(Buffer.concat([Buffer.from([0x08]), Buffer.from(b)]).subarray(0, 0)))
    r.push(v);
  return r;
};

function tensor(b) {
  const t = { dims: [], datos: [] };
  for (const [n, tipo, v] of campos(b)) {
    if (n === 1) {
      if (tipo === 0) t.dims.push(Number(v));
      else {
        let i = 0;
        while (i < v.length) {
          let x = 0;
          let s = 0;
          for (;;) {
            const c = v[i++];
            x |= (c & 0x7f) << s;
            if (!(c & 0x80)) break;
            s += 7;
          }
          t.dims.push(x);
        }
      }
    }
    if (n === 8) t.nombre = texto(v);
    if (n === 9) t.datos = floats(v);
    if (n === 4 && tipo === 2) t.datos = floats(v);
    if (n === 7 && tipo === 2) {
      // int64_data empaquetado
      const r = [];
      let i = 0;
      while (i < v.length) {
        let x = 0n;
        let s = 0n;
        for (;;) {
          const c = v[i++];
          x |= BigInt(c & 0x7f) << s;
          if (!(c & 0x80)) break;
          s += 7n;
        }
        r.push(Number(BigInt.asIntN(64, x)));
      }
      t.datos = r;
    }
  }
  return t;
}

function atributo(b) {
  const a = { ints: [] };
  for (const [n, tipo, v] of campos(b)) {
    if (n === 1) a.nombre = texto(v);
    if (n === 3) a.i = Number(BigInt.asIntN(64, v));
    if (n === 4) a.s = texto(v);
    if (n === 8) {
      if (tipo === 0) a.ints.push(Number(BigInt.asIntN(64, v)));
      else {
        let i = 0;
        while (i < v.length) {
          let x = 0n;
          let s = 0n;
          for (;;) {
            const c = v[i++];
            x |= BigInt(c & 0x7f) << s;
            if (!(c & 0x80)) break;
            s += 7n;
          }
          a.ints.push(Number(BigInt.asIntN(64, x)));
        }
      }
    }
  }
  return a;
}

const modelo = campos(readFileSync(process.argv[2]));
const grafo = campos(modelo.find(([n]) => n === 7)[2]);
const nodos = grafo
  .filter(([n]) => n === 1)
  .map(([, , v]) => {
    const nodo = { entradas: [], salidas: [], atributos: {} };
    for (const [n, , x] of campos(v)) {
      if (n === 1) nodo.entradas.push(texto(x));
      if (n === 2) nodo.salidas.push(texto(x));
      if (n === 4) nodo.op = texto(x);
      if (n === 5) {
        const a = atributo(x);
        nodo.atributos[a.nombre] = a.ints.length ? a.ints : (a.i ?? a.s);
      }
    }
    return nodo;
  });
const pesos = Object.fromEntries(
  grafo
    .filter(([n]) => n === 5)
    .map(([, , v]) => tensor(v))
    .map((t) => [t.nombre, { dims: t.dims, datos: t.datos }]),
);
for (const n of nodos) {
  console.log(n.op, n.entradas.join(','), '→', n.salidas.join(','), JSON.stringify(n.atributos));
}
for (const [k, v] of Object.entries(pesos)) console.log('  peso', k, JSON.stringify(v.dims), v.datos.length);
if (process.argv[3]) writeFileSync(process.argv[3], JSON.stringify({ nodos, pesos }));
