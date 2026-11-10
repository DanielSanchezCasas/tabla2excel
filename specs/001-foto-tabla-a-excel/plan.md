# Plan de implementación: Foto de tabla → Excel

**Rama**: `001-foto-tabla-a-excel` | **Fecha**: 2026-11-10 (actualizado tras `/speckit-clarify`) | **Spec**: [spec.md](./spec.md)

## Resumen
Aplicación web estática (una página) que procesa todo en el navegador, **foto por foto**:
OpenCV.js endereza la foto y detecta la cuadrícula completa (14 columnas de la planilla de
talegas), Tesseract.js lee la fecha de la planilla y solo las 7 columnas exportadas, el usuario
revisa/corrige (celdas, filas, fecha) y añade la foto a un **lote en memoria** (máx. 10). Al
terminar, ExcelJS genera un único `.xlsx` con "Fecha" y "N.º foto" como primeras columnas.
Se publica en GitHub Pages (público) con una GitHub Action en cada push a `main`.

## Contexto técnico
- **Lenguaje/Versión**: TypeScript 5, Node 20+ (solo desarrollo/build)
- **Gestor de paquetes**: pnpm (no hay lockfile previo)
- **Build**: Vite (sitio estático en `dist/`)
- **Dependencias de ejecución** (4, justificadas en research.md):
  - `tesseract.js` v5 — OCR en el navegador (WebAssembly, Web Worker)
  - `@techstark/opencv-js` — perspectiva y cuadrícula, en un Web Worker
  - `exceljs` — `.xlsx` con estilos, comentarios y varias hojas
  - `vite-plugin-pwa` — modo sin conexión e instalable
  - Sin framework de UI: HTML + TS ligero (principio II).
- **Recursos autoalojados** (principio VII): `spa.traineddata.gz` de **4.0.0_best_int** (paquete `@tesseract.js-data/spa`, 2,1 MB), worker y core de Tesseract SOLO variantes LSTM (`tesseract-core-simd-lstm` + `tesseract-core-lstm` de respaldo, ~2,9 MB cada `.wasm`), `opencv.js` en `public/vendor/`
- **Almacenamiento**: el lote vive solo en memoria (RF-016, sin persistencia); `localStorage` solo para la plantilla elegida y plantillas propias (Historia 5)
- **Pruebas**: Vitest (unitarias: conversión, validación, lote, cuadrícula sobre fixtures, Excel) + Playwright (e2e con fixtures sintéticas, Chromium y WebKit móvil)
- **Hosting**: GitHub Pages, público (`https://<usuario>.github.io/tabla2excel/`)
- **Rendimiento**: reducir imagen a ~2000 px de lado mayor; OCR solo de 7 columnas × ~25 filas ≈ 175 celdas + fecha, 2 workers en paralelo
- **Restricciones**: nada de red salvo cargar el propio sitio (CSP `connect-src 'self'`); imagen original intacta; fotos reales nunca en el repo
- **Riesgo principal**: precisión de Tesseract con manuscrito (ver research.md, Decisión 7). Se mitiga con listas blancas por columna, revisión obligatoria y la interfaz `OcrEngine` para cambiar de motor sin tocar el resto.

## Verificación de la constitución (pre y post diseño)
| Principio | Cumple | Cómo |
|---|---|---|
| I. Local y privado | ✅ | Todo en el navegador; CSP bloquea envíos; sin lista de socios publicada |
| II. Simple | ✅ | Una página, sin backend, 4 dependencias; lote en memoria, sin base de datos |
| III. Plantillas | ✅ | Columnas, tipos, `exportar` y listas blancas en `plantillas/*.json`; "Fecha"/"N.º foto" son columnas de la herramienta, no del formato |
| IV. No inventar datos | ✅ | Confianza por celda, resaltado, edición de celdas/filas, fecha obligatoria confirmada, hoja Revisión; guion → vacío (no se adivina) |
| V. Pruebas primero | ✅ | `OcrEngine` simulable; fixtures sintéticas; Vitest + Playwright |
| VI. Cero instalación | ✅ | Solo enlace + navegador; mensajes en español; una foto con error no borra el lote |
| VII. Publicación en un paso | ✅ | GitHub Action → Pages en cada push; recursos autoalojados |
| Fiabilidad y tamaño (constitución 2.1.0) | ✅ | El tamaño ya no es límite duro. Descarga medida ≈ 8 MB gzip (opencv.js 3,7 MB; core LSTM 1,06 MB; `spa` best_int 2,1 MB; ExcelJS + app ~1 MB), cacheada por la PWA tras la primera visita |

Sin violaciones. El build informa el tamaño de descarga (no bloquea la publicación).

## Estructura del proyecto

### Documentación
```
specs/001-foto-tabla-a-excel/
├── spec.md · plan.md · research.md · data-model.md · quickstart.md · tasks.md
└── contracts/ui.md
```

### Código fuente
```
index.html
src/
├── main.ts               # arranque, enrutado simple (convertir / crear plantilla)
├── ui/
│   ├── carga.ts          # subir, arrastrar, cámara (<input capture>), UNA foto a la vez
│   ├── progreso.ts
│   ├── vistaPrevia.ts    # tabla editable, borrar/añadir filas, campo Fecha
│   ├── lote.ts           # lista de fotos añadidas, quitar foto, exportar, aviso beforeunload
│   └── editorPlantilla.ts
├── nucleo/
│   ├── plantilla.ts      # tipos + validación + carga (URL ?plantilla=, localStorage, defecto)
│   ├── conversion.ts     # texto → número/fecha; guiones → vacío; fecha "31 octubre 2026"
│   ├── validacion.ts     # estados de celda
│   ├── lote.ts           # Lote: añadir (máx. 10), quitar + renumerar, filas vacías fuera
│   └── excel.ts          # ExcelJS: hoja Datos + hoja Revisión
├── vision/
│   ├── vision.worker.ts  # OpenCV.js en Web Worker
│   ├── perspectiva.ts
│   └── cuadricula.ts     # celdas + región de la fecha (franja sobre la tabla)
├── ocr/
│   ├── ocr.ts            # interfaz OcrEngine
│   └── tesseract.ts      # implementación con tesseract.js (rutas locales, listas blancas)
└── pipeline.ts           # una foto → FotoProcesada
public/
├── plantillas/
│   ├── indice.json       # defecto: "talegas"
│   ├── talegas.json      # plantilla real (14 columnas, 7 exportadas)
│   └── ejemplo.json
└── vendor/               # opencv.js, tesseract worker/core, spa.traineddata
tests/
├── fixtures/             # planillas SINTÉTICAS (nombres inventados) + .csv esperado
├── unit/
└── e2e/
fotos-reales/             # en .gitignore: fotos reales solo para validar en local
.github/workflows/publicar.yml
vite.config.ts · package.json · pnpm-lock.yaml · README.md
```

## Flujo (en el navegador, por foto)
1. **Cargar** una imagen, aplicar orientación EXIF, reducir a ~2000 px.
2. **Visión** (worker): gris → umbral adaptativo → cuadrilátero mayor → `warpPerspective` →
   morfología horizontal/vertical → líneas → celdas. Ignora todo fuera del borde exterior.
   Debe salir el número de columnas de la plantilla (14); si no, error claro.
3. **Fecha**: recorte de la franja sobre el borde superior de la tabla → OCR → `conversion.fecha`
   (acepta `31 octubre 2026`, `31/10/2026`); si falla, campo vacío.
4. **OCR por celda** solo en columnas `exportar: true` y filas tras `filas_encabezado`
   (`PSM.SINGLE_LINE`, lista blanca de la columna, recorte con margen, líneas borradas, ×2 si es pequeña).
5. **Convertir y validar**; descartar filas con todas las columnas exportadas vacías; vista previa.
6. **Usuario** corrige celdas/filas y confirma Fecha → "Añadir y pasar otra foto" → Lote.
7. **Exportar** el lote con ExcelJS → `talegas_AAAA-MM-DD.xlsx` (id de plantilla + fecha de hoy).

## Publicación
- `.github/workflows/publicar.yml`: push a `main` → `pnpm install --frozen-lockfile` → `pnpm test` → `pnpm build` (+ informe de tamaño) → `actions/upload-pages-artifact` → `actions/deploy-pages`.
- `vite.config.ts` con `base: '/tabla2excel/'`.
- Primera vez: Settings → Pages → Source: "GitHub Actions". Después, cero pasos manuales.

## Seguimiento de complejidad
Ninguna violación de la constitución.
