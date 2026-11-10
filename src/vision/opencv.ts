// Carga de OpenCV.js. Se tipa como `any`: la API es dinámica (Emscripten) y sus tipos no cubren todo.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CV = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Mat = any;

/** El módulo de OpenCV.js puede ser una promesa o un objeto que avisa con onRuntimeInitialized. */
export async function esperarOpenCV(modulo: CV): Promise<CV> {
  if (modulo && typeof modulo.then === 'function') return await modulo;
  if (modulo?.Mat) return modulo;
  await new Promise<void>((listo) => (modulo.onRuntimeInitialized = listo));
  return modulo;
}

let cargando: Promise<CV> | null = null;

/** En el navegador: carga `vendor/opencv.js` (servido por el propio sitio) solo cuando hace falta. */
export function cargarOpenCV(urlScript: string): Promise<CV> {
  cargando ??= new Promise<CV>((resolver, rechazar) => {
    const script = document.createElement('script');
    script.src = urlScript;
    script.async = true;
    script.onload = () => esperarOpenCV((window as unknown as { cv: CV }).cv).then(resolver, rechazar);
    script.onerror = () => {
      cargando = null;
      rechazar(new Error('No se pudo cargar el módulo de visión. Revisa la conexión y recarga la página.'));
    };
    document.head.append(script);
  });
  return cargando;
}
