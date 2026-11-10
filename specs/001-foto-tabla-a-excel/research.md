# Investigación: Foto de tabla → Excel

## Decisión 0: Tipo de aplicación
- **Decisión**: web estática que procesa todo en el navegador.
- **Motivo**: otra persona debe usarla con solo un enlace, también en celular (cámara directa); publicación gratuita.
- **Alternativas descartadas**: CLI en Python (exige instalar Python + Tesseract); ejecutable PyInstaller (~150 MB, avisos de antivirus, una versión por SO); web con backend (servidor de pago y subir fotos → viola principio I).

## Decisión 1: OCR
- **Decisión**: Tesseract.js v7 con `spa` **4.0.0_best_int** (LSTM cuantizado a enteros, paquete `@tesseract.js-data/spa`), autoalojado, y solo las variantes LSTM del core.
- **Motivo**: WebAssembly, confianza por palabra, listas blancas de caracteres. `best_int` conserva casi toda la precisión de `best` con un tamaño similar a `fast`.
- **Por qué `best_int` y no `best`**: la prioridad es la fiabilidad. `best` (float, 13,6 MB) es más lento y usa más memoria, lo que en celulares de gama media arriesga cuelgues y el objetivo de < 30 s (CE-003), con una ganancia de precisión mínima. Se puede probar `best` en T028 si los resultados con manuscrito lo justifican.
- **Tamaños medidos (2026-11-10)**: `tessdata_best/spa` 13,6 MB; `best_int` 2,1 MB (.gz); `tessdata_fast/spa` 2,3 MB (alternativa si `best_int` rinde igual); `tesseract-core-simd-lstm.wasm` 2,9 MB; `opencv.js` (@techstark 5.0.0) 13,3 MB → 3,7 MB gzip.
- **Alternativas**: PaddleOCR / TrOCR vía ONNX Runtime Web o transformers.js (mejores con manuscrito, pero modelos de 20–250 MB → rompen el presupuesto de carga); APIs en la nube (violan principio I). La interfaz `OcrEngine` permite cambiarlo después.

## Decisión 2: Visión (perspectiva y cuadrícula)
- **Decisión (revisada con fotos reales)**: en vez de buscar el contorno exterior y enderezar la perspectiva, se endereza la rotación (ángulo dominante con Hough, normalizado a ±90°; si el encabezado —la fila más alta— queda abajo, se gira 180°) y se detecta **cada línea por franjas** (picos del perfil en 12 franjas, unidos entre franjas vecinas), lo que sigue la curvatura del papel. Se descartan las líneas que no cruzan las de la otra familia y las filas finas de los extremos. Las celdas se amplían por encima y por debajo de sus líneas (se escribe sobre ellas) y solo cuentan los trazos cuyo centro cae dentro de la fila.
- **Decisión original**: OpenCV.js (`@techstark/opencv-js` 5, 13,3 MB / 3,7 MB gzip) en el **hilo principal**, cargado con `<script>` solo al procesar la primera foto y cacheado por el service worker.
- **Motivo**: la planilla tiene cuadrícula completa (aclaración 1) → la detección morfológica de líneas es fiable. Se descartó el Web Worker durante la implementación: Vite exige cargar `opencv.js` de forma distinta en desarrollo y en build (worker módulo vs clásico), lo que es frágil; la detección tarda < 1 s y se muestra el progreso, así que congelar la página ese instante es aceptable. El OCR (lo lento) sí va en workers.
- **Notas de OpenCV.js 5**: el módulo es una promesa; `Mat.clone()` sobre un ROI devuelve ceros (usar `copyTo`); no trae `findNonZero`.
- **Alternativa**: implementación propia en JS de umbral/proyecciones (más liviana, menos robusta). Descartada: se prioriza fiabilidad sobre tamaño.

## Decisión 3: Excel
- **Decisión**: ExcelJS. **Motivo**: estilos, comentarios, formatos y varias hojas en el navegador (SheetJS gratis no escribe estilos).

## Decisión 4: Hosting
- **Decisión**: GitHub Pages + GitHub Actions, sitio público (aclaración 3).
- **Motivo**: gratis, HTTPS, despliegue automático, URL estable. Ya no hace falta capa de acceso (Cloudflare Access descartado).

## Decisión 5: Plantilla
- **Decisión**: JSON en `public/plantillas/`; la plantilla real `talegas.json` describe las 14 columnas físicas con `exportar` (7 en `true`) y `caracteres` (lista blanca por columna).
- **Motivo**: hay que conocer las 14 columnas para validar la cuadrícula, pero solo se leen las exportadas (menos OCR, menos revisión). Sin columnas "quemadas" en el código (principio III).

## Decisión 6: Precisión general
Lista blanca por columna (`0123456789` en enteros; `A-Z0-9` en Carro No.; letras y espacios en Nombre), modo línea única, ×2 en celdas pequeñas, borrar líneas de cuadrícula antes del OCR, reducir la foto a ~2000 px. Un contenido de solo guiones/rayas (`-`, `—`, `–`) se interpreta como vacío antes del OCR si la celda tiene una sola componente horizontal, y después del OCR por expresión regular.

## Decisión 7: Datos escritos a mano (riesgo principal)
- **Contexto**: encabezados impresos, datos manuscritos (aclaración 2). Tesseract no está entrenado para manuscrito: se espera precisión media en números y baja en nombres.
- **Decisión**: aceptar OCR **asistido** (como dice la spec): umbral de confianza en la plantilla (inicial 70, a calibrar), todo lo dudoso se resalta, la revisión es parte normal del flujo. Validar al inicio con las fotos reales en `fotos-reales/` (sin subirlas) y medir: % de celdas correctas por columna y tiempo de revisión por foto (CE-006).
- **Plan B si los números quedan por debajo de ~80 %**: clasificador de dígitos pequeño (ONNX, < 1 MB, tipo MNIST) solo para columnas `entero`, detrás de `OcrEngine`. Requiere justificar `onnxruntime-web` como dependencia nueva.
- **Descartado**: lista de socios y rangos numéricos (aclaraciones 9 y 10, decisión del usuario).
- **Primera medición (2026-11-10, fixture SINTÉTICA, no manuscrito real)**: con el OCR real en Chromium, 102/112 celdas correctas (91 %), fecha "31 octubre 2026" leída bien, foto completa en ~2 s en portátil. Es solo una referencia: la letra sintética es mucho más regular que la manuscrita real. La medición que decide (T028) requiere las fotos reales en `fotos-reales/`.

### Resultados con fotos reales (2026-11-10, fotos de WhatsApp de ~1600 px)
- **Detección de la tabla**: reescrita (ver Decisión 2) → encuentra las 14 columnas y todas las filas en las 5 fotos reales probadas (de lado, al revés, papel curvado, pinza, marcas fuera de la tabla, última fila cortada).
- **Tesseract** con manuscrito: inservible. Números ~3/16 aun con buenos recortes; nombres ilegibles.
- **Plan B aplicado**: clasificador de dígitos MNIST (ONNX Model Zoo, MIT) ejecutado en JS puro (`src/ocr/digitos.ts`, sin dependencias) para columnas `entero`. Talega ~5/13 en una foto. La seguridad se mide con 7 variantes por dígito (la red sola da >70 % aunque se equivoque): ~88 % de los errores quedan resaltados.
- **TrOCR en el navegador** (transformers.js, small 64 MB y base 340 MB): 0/25 nombres; inventa frases en inglés. Descartado.
- **Ollama + `qwen2.5vl:7b` (foto entera, una sola petición, JSON)** en Mac M2 16 GB, ~70 s/foto: **Talega 25/25, Carro 18/25, Nombre 11/25 exactos** (~18 % de letras mal; el resto casi bien). Celda por celda es peor y más lento. La instrucción que mejor funciona está en `scripts/evaluar-ollama.mjs` (pedir todas las columnas exportadas evita que un Carro vacío se rellene con la columna vecina).

### Próximos pasos (decisión del dueño: probar Ollama en PC con Windows, RTX 3060 12 GB, 16 GB RAM)
1. Comparar modelos que caben en 12 GB de VRAM con `node scripts/evaluar-ollama.mjs "fotos-reales/<foto>" <modelo>`: `qwen3-vl:8b`, `gemma4` (variante 9,5 GB), `deepseek-ocr`, `glm-ocr`, frente a `qwen2.5vl:7b`.
2. Integrar en la app, solo en PC: si la página detecta Ollama en `localhost`, ofrecer "Leer con IA local". Requiere `OLLAMA_ORIGINS=https://danielsanchezcasas.github.io`, añadir `http://localhost:11434` a `connect-src` de la CSP y anotar en la constitución que las conexiones a `localhost` están permitidas (los datos no salen del equipo).
3. Nombres exactos: lista de socios cargada en el dispositivo (talega → nombre), aprovechando que la talega se lee bien. Pendiente saber si cada socio tiene talega fija y si existe la lista.

## Decisión 8: Fecha de la planilla
- **Decisión**: OCR de la franja entre el borde superior de la página corregida y el borde superior de la tabla; parser que acepta `d mes aaaa` con nombres de mes en español (con tolerancia a errores: distancia de edición ≤ 2 contra los 12 meses) y `dd/mm/aaaa`. Siempre editable y obligatoria antes de añadir la foto.
- **Motivo**: la fecha está fuera de la cuadrícula y escrita a mano; la confirmación humana evita fechas inventadas (principio IV).

## Decisión 9: Lote
- **Decisión**: estado en memoria (arreglo de `FotoAñadida`), máx. 10; aviso `beforeunload` si hay fotos sin exportar; sin `localStorage` ni IndexedDB.
- **Motivo**: aclaración 6 (el usuario prefirió no guardar). Más simple y sin datos personales en el dispositivo.

## Decisión 10: Privacidad de las pruebas
- **Decisión**: fixtures generadas (planillas sintéticas dibujadas con nombres inventados y fuentes tipo manuscrito); fotos reales solo en `fotos-reales/` (en `.gitignore`).
- **Motivo**: la foto real tiene nombres de socios y el repositorio es público.
