# Tareas: Foto de tabla → Excel (web estática)

**Entrada**: documentos en `specs/001-foto-tabla-a-excel/`
**Prerrequisitos**: plan.md, spec.md, research.md, data-model.md, contracts/ui.md, quickstart.md

**Pruebas**: incluidas — la constitución (principio V, NO NEGOCIABLE) exige pruebas automáticas de
cuadrícula, conversión, validación y Excel antes de dar por terminada cada parte. Se escriben
primero y deben fallar antes de implementar.

Formato: `- [ ] [ID] [P?] [Historia] Descripción con ruta` — `[P]` = paralelizable (archivos
distintos, sin dependencias pendientes). Historias: US1 Convertir una foto · US2 Compartir ·
US3 Revisar y corregir · US4 Acumular varias fotos · US5 Crear plantilla.

---

## Fase 1: Preparación

- [X] T001 Crear proyecto Vite + TypeScript vanilla con pnpm en la raíz (`package.json`, `tsconfig.json`, `index.html`, `src/main.ts`) y la estructura de carpetas de plan.md
- [X] T002 Instalar dependencias con pnpm: `tesseract.js@5`, `@techstark/opencv-js`, `exceljs`, `vite-plugin-pwa`; dev: `vitest`, `@playwright/test`, `prettier`; scripts `dev`, `build`, `test`, `test:e2e` en `package.json`
- [X] T003 [P] Añadir `fotos-reales/`, `node_modules/`, `dist/` a `.gitignore` (las fotos reales tienen nombres de socios y el repo es público)
- [X] T004 [P] Crear `scripts/copiar-vendor.mjs` que copia a `public/vendor/` el worker de Tesseract, SOLO los cores LSTM (`tesseract-core-simd-lstm.*` y `tesseract-core-lstm.*` de `tesseract.js-core`), `spa.traineddata.gz` de `@tesseract.js-data/spa/4.0.0_best_int/` (no `tessdata_best`: más lento y pesado en celular, ver research.md Decisión 1) y `opencv.js`; ejecutarlo en `postinstall` en `package.json` (añadir `@tesseract.js-data/spa` como dependencia)
- [X] T005 [P] Configurar `vite.config.ts` con `base: '/tabla2excel/'` y `vite-plugin-pwa` (precache de `vendor/` y `plantillas/`)
- [X] T006 [P] Crear `scripts/informe-tamano.mjs` que imprime el tamaño de descarga (gzip) de `dist/` con desglose por archivo, SIN bloquear el build; engancharlo al script `build` en `package.json`

---

## Fase 2: Fundamentos (bloquea todas las historias)

- [X] T007 [P] Test `tests/unit/plantilla.test.ts`: carga `public/plantillas/talegas.json` (14 columnas, 7 con `exportar` ≠ false); rechaza plantilla sin columnas exportadas, con nombres repetidos o tipo fuera de `texto` `entero` `decimal` `moneda` `fecha`; defaults `idioma_ocr`=`spa`, `filas_encabezado`=1, `umbral_confianza`=70, `exportar`=true
- [X] T008 Implementar `src/nucleo/plantilla.ts`: tipos de data-model.md, validación ("≥ 1 columna con `exportar` ≠ false; nombres únicos; tipos válidos; si falla, mensaje claro y se usa la plantilla por defecto") y carga (`?plantilla=`, `localStorage` `tabla2excel.plantilla_actual`, `defecto` de `indice.json`)
- [X] T009 [P] Crear `src/ocr/ocr.ts`: interfaz `OcrEngine.leer(imagen, { caracteres }) → { texto, confianza }` y `FakeOcrEngine` (respuestas predefinidas por celda) para pruebas
- [X] T010 [P] Crear `tests/fixtures/generar.mjs`: dibuja planillas SINTÉTICAS de 14 columnas con los encabezados de `talegas.json`, fecha arriba ("31 octubre 2026"), nombres inventados en fuente tipo manuscrito, guiones en algunas celdas y filas vacías al final; variantes recta, rotada 15°, en perspectiva y con sombra; más una foto sin tabla; cada una con su `.csv` esperado de las 7 columnas exportadas
- [X] T011 [P] Crear `src/ui/estilos.css` y la estructura base de `index.html` (diseño adaptable a celular, pie "Tus fotos no salen de este dispositivo. El lote no se guarda: exporta antes de cerrar.")

**Punto de control**: plantilla cargada y validada, OCR simulable, fixtures disponibles.

---

## Fase 3: US2 — Compartir la herramienta (P1) 🚀

**Objetivo**: el enlace público existe desde el primer día y cada push lo actualiza.
**Prueba independiente**: tras un push a `main`, la URL carga en un navegador limpio de escritorio y celular.

- [X] T012 [US2] Crear `.github/workflows/publicar.yml`: push a `main` → `pnpm/action-setup` → `pnpm install --frozen-lockfile` → `pnpm test` → `pnpm build` (imprime informe de tamaño) → `actions/upload-pages-artifact` → `actions/deploy-pages` (permisos `pages: write`, `id-token: write`)
- [X] T013 [P] [US2] Añadir CSP en `index.html` vía `<meta>`: `default-src 'self'; connect-src 'self'; worker-src 'self' blob:; script-src 'self' 'wasm-unsafe-eval'; img-src 'self' blob: data:`
- [X] T014 [P] [US2] Crear `src/ui/compatibilidad.ts`: si faltan WebAssembly o Web Workers, mostrar "Este navegador no es compatible. Usa Chrome, Edge, Safari o Firefox actualizados."
- [ ] T015 [US2] Publicar la página mínima y verificar la URL en navegador limpio y celular (quickstart.md V7); documentar la URL en `README.md`

**Punto de control**: enlace público funcionando.

---

## Fase 4: US1 — Convertir una foto en un Excel (P1) 🎯 MVP

**Objetivo**: subir/tomar UNA foto de la planilla de talegas y descargar un `.xlsx` con Fecha, N.º foto (1) y las 7 columnas exportadas.
**Prueba independiente**: con una fixture recta y OCR simulado, el Excel coincide con el `.csv` esperado.

### Pruebas primero
- [X] T016 [P] [US1] `tests/unit/conversion.test.ts`: enteros (`14`→14), texto alfanumérico (`NC33`), celdas con solo `- — – _ .` y espacios → vacía (no error), fechas `31 octubre 2026`, `31 octubre 2O26`, `31 ocutbre 2026` (distancia de edición ≤ 2 contra los 12 meses) y `31/10/2026` → 2026-10-31; basura → null
- [X] T017 [P] [US1] `tests/unit/cuadricula.test.ts`: en cada fixture (recta, 15°, perspectiva, sombra) se detectan 14 columnas y el nº de filas esperado, y la `caja_fecha` queda sobre la tabla (OpenCV.js en Node)
- [X] T018 [P] [US1] `tests/unit/excel.test.ts`: genera el xlsx de un lote de 1 foto, lo relee con ExcelJS y llama a `generarExcel(fotos: FotoAñadida[], plantilla)` con un arreglo de 1 foto (sin depender de `Lote`) y verifica hoja "Datos" con columnas `Fecha` (formato `dd/mm/aaaa`) | `N.º foto` | Talega No. | Carro No. | Tacos | Fundas | Paraguas | Varas | Nombre del Socio, tipos reales y encabezado fijado
- [X] T019 [P] [US1] `tests/e2e/una-foto.spec.ts` (Playwright, OCR simulado): subir fixture recta → escribir/confirmar Fecha → exportar → comparar con `.csv`; foto sin tabla → mensaje "No se encontró una tabla en la foto…" y sin descarga

### Implementación
- [X] T020 [US1] `src/nucleo/conversion.ts`: conversión por tipo con `regional`; regla "texto formado solo por `- — – _ .` y espacios → `vacia`"; parser de fecha `d mes aaaa` (meses en español, tolerancia distancia ≤ 2) y `dd/mm/aaaa`
- [X] T021 [US1] `src/vision/opencv.ts` + `src/vision/perspectiva.ts` (sin worker: OpenCV en el hilo principal, cargado bajo demanda — research.md Decisión 2): carga `vendor/opencv.js`, orientación EXIF, reducción a ~2000 px, cuadrilátero mayor, `warpPerspective`; error claro si no hay tabla
- [X] T022 [US1] `src/vision/cuadricula.ts`: morfología horizontal/vertical, líneas, celdas (ignora lo que está fuera del borde exterior) y `caja_fecha` (franja entre el borde superior de la página corregida y el de la tabla); si `columnas` ≠ `plantilla.columnas.length` → "Se detectaron N columnas, pero la planilla tiene 14. Revisa que se vean todas las líneas."
- [X] T023 [US1] `src/ocr/tesseract.ts`: implementación de `OcrEngine` con rutas locales (`workerPath`, `corePath`, `langPath`), 2 workers, `PSM.SINGLE_LINE`, `tessedit_char_whitelist` = `columnas[].caracteres` (o `0123456789` para `entero`), recorte con margen, líneas borradas, ×2 en celdas pequeñas
- [X] T024 [US1] `src/pipeline.ts`: imagen → `TablaDetectada` → OCR de la fecha y SOLO de columnas con `exportar` ≠ false y filas tras `filas_encabezado` → `FotoProcesada` (descartando "filas cuyas celdas exportadas son todas `vacia`"), con callback de progreso "Leyendo celda X de Y"
- [X] T025 [US1] `src/nucleo/excel.ts`: `generarExcel(fotos: FotoAñadida[], plantilla) → Blob` (recibe datos simples, NO la entidad `Lote`; en US1 se llama con `[{ ...fotoProcesada, numero: 1 }]`); hoja "Datos" (`Fecha` | `N.º foto` | columnas exportadas en orden de plantilla), tipos reales, encabezado en negrita y fijado, filtros, anchos ajustados; nombre `<id_plantilla>_AAAA-MM-DD.xlsx`
- [X] T026 [US1] `src/ui/carga.ts` y `src/ui/progreso.ts`: "Elegir foto", arrastrar y "Tomar foto" (`<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment">`, SIN `multiple`); mensaje HEIC "Este archivo es HEIC y este navegador no lo abre. Usa 'Tomar foto' o conviértelo a JPG."
- [X] T027 [US1] `src/ui/vistaPrevia.ts` (versión básica): campo Fecha precargado (vacío y en rojo si no se leyó) y tabla de solo lectura con las columnas exportadas; botón "Exportar Excel" deshabilitado sin Fecha; conectar todo en `src/main.ts`
- [ ] T028 [US1] Validación con fotos reales en local (`fotos-reales/`, NO subir; quickstart.md V6): medir % de celdas correctas por columna exportada y registrar resultados en `specs/001-foto-tabla-a-excel/research.md` (Decisión 7); si los enteros quedan < ~80 %, abrir decisión del plan B (clasificador de dígitos) ANTES de añadir dependencias

**Punto de control**: MVP publicado — una foto → Excel; riesgo del manuscrito medido.

---

## Fase 5: US3 — Revisar y corregir celdas dudosas (P1)

**Objetivo**: ver y corregir lo dudoso (celdas, filas) antes de exportar; el Excel marca lo pendiente.
**Prueba independiente**: con OCR simulado que devuelve confianza baja y un valor no entero, se resaltan en amarillo/rojo, se corrigen y el Excel refleja la corrección; lo no corregido aparece en "Revisión".

- [X] T029 [P] [US3] `tests/unit/validacion.test.ts`: `estado` ∈ `ok` | `baja_confianza` | `invalida` | `vacia`; confianza < `umbral_confianza` → `baja_confianza`; texto en columna `entero` → `invalida` con motivo; `obligatoria` vacía → `invalida`; al editar se revalida y si es válida pasa a `ok` con `editada`=true
- [X] T030 [P] [US3] `tests/unit/excel-revision.test.ts`: celdas amarillas/rojas con comentario en "Datos"; hoja "Revisión" con `N.º foto | fila | columna | texto_leído | confianza | motivo` solo para celdas no `ok` sin corregir
- [X] T031 [US3] `src/nucleo/validacion.ts` según T029
- [X] T032 [US3] `src/ui/vistaPrevia.ts`: celdas editables con resaltado y tooltip (texto leído y %, o motivo); "Borrar fila" por fila y "Añadir fila" al final (fila vacía editable, `añadida_a_mano`=true); "Ver cuadrícula detectada"
- [X] T033 [US3] `src/nucleo/excel.ts`: resaltado, comentarios y hoja "Revisión" según T030
- [X] T034 [P] [US3] `tests/e2e/revision.spec.ts`: editar celda roja → pasa a normal; borrar una fila y añadir otra → el Excel lo refleja

**Punto de control**: revisión completa de una foto.

---

## Fase 6: US4 — Acumular varias fotos en un solo Excel (P1)

**Objetivo**: foto por foto → lote en memoria (máx. 10) → un único Excel con Fecha y N.º foto.
**Prueba independiente**: añadir 3 fotos, quitar la 2.ª → Excel con N.º foto 1–2 sin huecos y filas de ambas; al llegar a 10 no se puede añadir más.

- [X] T035 [P] [US4] `tests/unit/lote.test.ts`: añadir solo si "`fecha` ≠ null y el lote tiene < 10 fotos"; `numero` = posición actual y "al quitar una foto se renumeran las siguientes (sin huecos)"; `hay_sin_exportar` true tras añadir/quitar y false tras exportar; "Empezar de nuevo" vacía el lote
- [X] T036 [US4] `src/nucleo/lote.ts`: entidad `Lote` en memoria (sin `localStorage` ni IndexedDB — RF-016) según T035
- [X] T037 [US4] `src/ui/lote.ts`: "Exportar Excel" llama a `generarExcel(lote.fotos, plantilla)` (T025) con todas las fotos y marca `hay_sin_exportar` = false; añadir a `tests/unit/excel.test.ts` un caso de 3 fotos con `N.º foto` por fila
- [X] T038 [US4] `src/ui/lote.ts`: contador "Lote: N de 10 fotos"; "Añadir y pasar otra foto" (deshabilitado sin Fecha) y "Descartar esta foto"; lista "Foto N · fecha · X filas · Y por revisar [Quitar]"; "Exportar Excel" (≥ 1 foto) y "Empezar de nuevo" (con confirmación si hay sin exportar); carga deshabilitada al llegar a 10 con "Llegaste al máximo de 10 fotos. Exporta el Excel."
- [X] T039 [US4] Aviso `beforeunload` en `src/ui/lote.ts` cuando `hay_sin_exportar` es true; un error de procesamiento en una foto no toca el lote
- [X] T040 [P] [US4] `tests/e2e/lote.spec.ts`: 3 fixtures → quitar la 2.ª → exportar y verificar N.º foto 1–2; foto sin tabla a mitad → mensaje y lote intacto; recargar con fotos sin exportar dispara `beforeunload` (quickstart.md V3, V4)

**Punto de control**: flujo real completo del usuario (foto por foto hasta 10 → un Excel).

---

## Fase 7: US5 — Ajustar la plantilla sin programar (P3)

**Objetivo**: crear/cambiar plantillas desde la página o con JSON.
**Prueba independiente**: con una fixture, el editor propone 14 columnas con nombres del encabezado y descarga un `plantilla.json` válido.

- [X] T041 [P] [US5] `tests/e2e/editor-plantilla.spec.ts`: subir fixture → columnas detectadas → marcar tipo/exportar → descargar JSON que pasa la validación de `plantilla.ts`; importar ese JSON → queda como plantilla activa; importar un JSON inválido → mensaje claro y se mantiene la anterior
- [X] T042 [US5] `src/ui/editorPlantilla.ts` (ruta `#crear-plantilla`): detectar columnas, OCR del encabezado como nombre propuesto, elegir tipo / exportar / obligatoria, "Usar en este navegador" (`localStorage` `tabla2excel.plantillas_propias`), "Descargar plantilla.json" e "Importar plantilla.json" (archivo local validado con `plantilla.ts`; si falla, mensaje claro y no se cambia la activa)
- [X] T043 [US5] Selector de plantilla en el encabezado de `src/ui/carga.ts` usando `public/plantillas/indice.json` y `?plantilla=<id>`

---

## Fase 8: Pulido y transversal

- [X] T044 [P] `tests/e2e/privacidad.spec.ts`: registrar red durante el flujo completo; ninguna petición fuera del propio origen (quickstart.md V5)
- [ ] T045 [P] Verificar PWA sin conexión e "Agregar a pantalla de inicio" en celular (quickstart.md V8) — automatizado en `tests/e2e/sin-conexion.spec.ts` (Chromium); falta probar "Agregar a pantalla de inicio" en un celular real
- [X] T046 [P] `README.md`: secciones de usuario y dueño a partir de `specs/001-foto-tabla-a-excel/quickstart.md`
- [ ] T047 Medir rendimiento (CE-003: < 15 s portátil, < 30 s celular gama media) con una planilla de ~25 filas y anotar en `specs/001-foto-tabla-a-excel/research.md`
- [ ] T048 Calibrar `umbral_confianza` en `public/plantillas/talegas.json` con las fotos reales locales (CE-002) y medir el tiempo de revisión por foto frente a transcribir a mano (CE-006)
- [ ] T049 Prueba de usabilidad: enviar el enlace a otra persona sin instrucciones y cronometrar la primera foto (CE-004 < 3 min)

---

## Dependencias

- Fase 1 → Fase 2 → US2 (publicación temprana) → US1 (MVP) → US3 → US4 → Pulido.
- US5 depende solo de Fase 2 y de `vision/` (T021–T022); puede ir en paralelo a US3/US4.
- US3 extiende `vistaPrevia.ts` y `excel.ts` de US1; US4 usa la vista previa con edición de US3 (el flujo real exige revisar antes de añadir).
- Dentro de cada historia: pruebas → núcleo → UI.

## Ejecución en paralelo (ejemplos)

- **Fase 1**: T003, T004, T005, T006 a la vez tras T002.
- **Fase 2**: T007, T009, T010, T011 a la vez; luego T008.
- **US1**: T016, T017, T018, T019 a la vez; luego T020 ∥ T021 ∥ T023 (archivos distintos), después T022 → T024 → T025 → T026 → T027 → T028.
- **US3**: T029 ∥ T030 ∥ T034 (tests); luego T031 → T032 ∥ T033.
- **US4**: T035 ∥ T040 (tests); luego T036 → T037 → T038 → T039.
- **Pulido**: T044, T045, T046 a la vez.

## Estrategia de implementación

1. **Día 1**: Fases 1–3 → enlace público vacío pero funcionando.
2. **MVP (US1)**: una foto → Excel, publicado. Ejecutar T028 con fotos reales: es la decisión clave del proyecto (¿alcanza Tesseract con el manuscrito?).
3. **US3 + US4**: completan el flujo real (revisar cada foto, acumular hasta 10, un Excel). Aquí la herramienta ya sirve para el trabajo diario.
4. **US5 y pulido**: después, según necesidad.
