# Modelo de datos

## Plantilla (`public/plantillas/<id>.json`)
| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | texto | sí | Identificador usado en `?plantilla=<id>` y en el nombre del Excel |
| `nombre` | texto | sí | Nombre visible del formato |
| `idioma_ocr` | texto | no (`spa`) | Idioma(s) de Tesseract |
| `regional.separador_decimal` | `,` o `.` | no (`,`) | |
| `regional.separador_miles` | `.` `,` o `""` | no (`.`) | |
| `regional.formato_fecha` | texto | no (`dd/MM/yyyy`) | Formato numérico; además se aceptan meses en palabras |
| `filas_encabezado` | entero ≥ 0 | no (1) | Filas de la tabla a ignorar |
| `umbral_confianza` | 0–100 | no (70) | Por debajo se resalta |
| `columnas[]` | lista | sí | TODAS las columnas físicas, izquierda a derecha (su número valida la cuadrícula) |
| `columnas[].nombre` | texto | sí | Encabezado en el Excel |
| `columnas[].tipo` | `texto` `entero` `decimal` `moneda` `fecha` | sí | |
| `columnas[].exportar` | bool | no (true) | `false` → no se lee ni se muestra ni se exporta |
| `columnas[].caracteres` | texto | no (según tipo) | Lista blanca de caracteres para el OCR |
| `columnas[].obligatoria` | bool | no (false) | Vacía → inválida |
| `columnas[].ancho_relativo` | número | no | Ayuda si faltan líneas |

Validación al cargar: ≥ 1 columna con `exportar` ≠ false; nombres únicos; tipos válidos; si falla,
mensaje claro y se usa la plantilla por defecto.

Plantilla real: [`public/plantillas/talegas.json`](../../public/plantillas/talegas.json) (14 columnas, 7 exportadas).

## `public/plantillas/indice.json`
`{ "defecto": "talegas", "plantillas": [{ "id": "talegas", ... }, { "id": "ejemplo", ... }] }`

## TablaDetectada
`filas`, `columnas` (debe igualar `plantilla.columnas.length`), `celdas: Celda[]`, `caja_fecha` (región sobre la tabla).

## Celda
- `fila`, `columna` (índice físico, 0-based) · `caja` {x, y, ancho, alto}
- `texto_crudo`, `confianza` (0–100)
- `valor`: string | number | Date | null
- `estado`: `ok` | `baja_confianza` | `invalida` | `vacia`
- `motivo`, `editada` (bool)

Reglas: texto formado solo por `- — – _ .` y espacios → `vacia` (no es error). Al editar, la celda
se revalida contra su tipo; si es válida pasa a `ok`.

## FotoProcesada (vista previa de la foto actual)
- `nombre_archivo`, `fecha`: Date | null, `fecha_texto_crudo`, `fecha_confianza`
- `filas: Fila[]` — `Fila = { celdas: Celda[] (solo columnas exportadas), añadida_a_mano: bool }`
- Filas cuyas celdas exportadas son todas `vacia` se descartan al construirla.
- Se puede borrar una fila o añadir una fila vacía editable.
- **Puede añadirse al lote** solo si `fecha` ≠ null y el lote tiene < 10 fotos.

## Lote (solo en memoria)
- `fotos: FotoAñadida[]` (máx. 10) — `FotoAñadida = FotoProcesada + numero` (1..n)
- `numero` = posición actual; al quitar una foto se renumeran las siguientes (sin huecos).
- `hay_sin_exportar`: bool → activa el aviso `beforeunload`; pasa a false al exportar.
- Transiciones: `vacío` → (añadir) → `con fotos` → (exportar) → `exportado` (puede seguir añadiendo; vuelve a `con fotos`) · (quitar última) → `vacío`. "Empezar de nuevo" vacía el lote (pide confirmación si hay sin exportar).

## Resultado (Excel)
- Hoja **Datos**: `Fecha` | `N.º foto` | columnas con `exportar` ≠ false en orden de la plantilla.
- Hoja **Revisión**: `N.º foto | fila | columna | texto_leído | confianza | motivo` (celdas no `ok` sin corregir).

## Almacenamiento local (`localStorage`)
- `tabla2excel.plantilla_actual`: id
- `tabla2excel.plantillas_propias`: Plantilla[] creadas en el editor
- (El lote NO se guarda — RF-016.)
