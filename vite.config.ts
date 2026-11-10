import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Política de seguridad: solo en el build (en desarrollo bloquearía la recarga en caliente).
// connect-src 'self' impide que las fotos o los datos salgan del dispositivo (RF-010).
const CSP = [
  "default-src 'self'",
  // OpenCV.js (embind) genera funciones con new Function: necesita 'unsafe-eval'.
  // La privacidad la garantiza connect-src: ningún script puede enviar datos fuera del sitio.
  "script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'",
  "worker-src 'self' blob:",
  "connect-src 'self'",
  "img-src 'self' blob: data:",
  "style-src 'self' 'unsafe-inline'",
].join('; ');

const csp = (): Plugin => ({
  name: 'csp',
  apply: 'build',
  transformIndexHtml: (html) =>
    html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
});

export default defineConfig({
  // Debe coincidir con el nombre del repositorio en GitHub Pages
  base: process.env.BASE_PATH ?? '/tabla2excel/',
  plugins: [
    csp(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script',
      manifest: {
        name: 'tabla2excel',
        short_name: 'tabla2excel',
        description: 'Convierte fotos de planillas en un Excel, sin subir nada.',
        lang: 'es',
        theme_color: '#1f6f43',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [{ src: 'icono.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,json,svg,gz}'],
        // opencv.js pesa ~13 MB sin comprimir
        maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
      },
    }),
  ],
});
