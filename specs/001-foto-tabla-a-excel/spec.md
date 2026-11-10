# Especificación de funcionalidad: Foto de tabla → Excel

**Rama**: `001-foto-tabla-a-excel`
**Creada**: 2026-11-10 · **Actualizada**: 2026-11-10 (debe poder publicarse para otra persona)
**Estado**: Borrador
**Entrada**: "Una pequeña herramienta que me permita escanear fotos con un cierto formato (una tabla)
y poder pasarlo a un Excel. Necesito poder publicarlo fácilmente para que lo use otra persona."

## Aclaraciones

### Sesión 2026-11-10
- P: ¿La tabla tiene líneas visibles en todos los bordes de las celdas? → R: Sí, cuadrícula completa (líneas entre todas las filas y columnas, y borde exterior).
- P: ¿El contenido es impreso, escrito a mano o mixto? → R: Mixto: encabezados impresos y datos escritos a mano.
- P: ¿La herramienta puede ser pública o debe restringirse? → R: Pública: cualquiera con el enlace, sin contraseña ni cuentas.
- P: ¿Cuáles son las columnas reales de la tabla y su tipo? → R: Planilla de entrega/recepción de talegas (foto real aportada): 14 columnas, 1 fila de encabezado; ver "Plantilla" en Entidades clave.
- P: ¿Qué se hace con la "Fecha" escrita arriba de la tabla y cómo se procesan varias fotos? → R: Flujo foto por foto: se procesa una, el usuario verifica/corrige y se añade a una lista acumulada; se repite hasta terminar (máx. 10 fotos) y se exporta un solo Excel. Cada fila lleva las columnas "Fecha" (de la planilla, editable) y "N.º foto".
- P: Si la página se recarga o cierra a mitad del lote, ¿se conservan las fotos ya añadidas? → R: No se guardan; se avisa antes de salir o recargar si hay fotos sin exportar.
- P: ¿Se pueden borrar/añadir filas en la vista previa y quitar fotos ya añadidas? → R: Sí: las filas vacías se descartan solas; se pueden borrar y añadir filas, y quitar una foto del lote (los N.º foto se renumeran).
- P: ¿Qué columnas deben leerse y salir en el Excel? → R: Solo Talega No., Carro No., Tacos, Fundas, Paraguas, Varas y Nombre del Socio (+ Fecha y N.º foto); las demás columnas de la planilla se ignoran.
- P: ¿Se usa una lista de socios para corregir los nombres leídos? → R: No por ahora: el nombre se lee tal cual y se corrige a mano en la vista previa.
- P: ¿Se marcan para revisión Tacos/Fundas/Paraguas/Varas fuera de un rango normal? → R: No: solo se valida que sea un número entero.

## Escenarios de usuario y pruebas *(obligatorio)*

### Historia de usuario 1 — Convertir una foto en un Excel (Prioridad: P1)

Como usuario, abro el enlace de la herramienta, subo (o tomo con el celular) una foto de una
hoja con la tabla de formato conocido y descargo un Excel con sus filas y las columnas exportadas
de la plantilla, sin transcribir a mano.

**Por qué esta prioridad**: es el valor central.

**Prueba independiente**: con una foto de ejemplo y la plantilla publicada, se descarga un
`.xlsx` cuyo contenido coincide con la tabla esperada.

**Escenarios de aceptación**:
1. **Dado** una foto nítida y la plantilla por defecto, **cuando** la subo, **entonces** veo una
   vista previa de la tabla y puedo descargar un `.xlsx` con "Fecha", "N.º foto" y las columnas exportadas de la plantilla.
2. **Dado** que estoy en el celular, **cuando** toco "Tomar foto", **entonces** se abre la cámara
   y la foto tomada se procesa igual que una subida.
3. **Dado** una foto inclinada o en perspectiva (hasta ~15°), **cuando** la proceso,
   **entonces** la tabla se endereza y se extrae igual.
4. **Dado** una foto sin tabla, **cuando** la proceso, **entonces** veo un mensaje claro y no se
   genera un Excel vacío engañoso.

---

### Historia de usuario 2 — Compartir la herramienta (Prioridad: P1)

Como dueño de la herramienta, quiero publicarla y mandarle un enlace a otra persona para que la
use sin instalar nada ni crear cuentas.

**Por qué esta prioridad**: es requisito explícito; sin esto la herramienta no le sirve a la otra persona.

**Prueba independiente**: tras un push a `main`, el sitio se actualiza solo y el enlace funciona en
un navegador limpio (sin sesión) en escritorio y celular.

**Escenarios de aceptación**:
1. **Dado** un cambio en el repositorio, **cuando** lo subo a `main`, **entonces** la nueva versión
   queda publicada en la misma URL en pocos minutos, sin pasos manuales.
2. **Dado** que la otra persona abre el enlace por primera vez, **cuando** carga, **entonces** la
   herramienta está lista para usar sin instalar nada.
3. **Dado** que ya la abrió antes, **cuando** no tiene internet, **entonces** la herramienta sigue
   funcionando (y puede "instalarla" en el celular como app, opcional).

---

### Historia de usuario 3 — Revisar y corregir celdas dudosas (Prioridad: P1)

Como usuario quiero ver qué celdas pudo leer mal la herramienta y corregirlas antes de descargar.

**Escenarios de aceptación**:
1. **Dado** una celda con confianza baja, **cuando** veo la vista previa, **entonces** aparece
   resaltada en amarillo y puedo editarla haciendo clic.
2. **Dado** un valor que no cumple el tipo de columna, **cuando** veo la vista previa,
   **entonces** aparece en rojo con el motivo.
3. **Dado** que descargo sin corregir, **entonces** el Excel conserva los resaltados y una hoja
   "Revisión" que lista las celdas pendientes.

---

### Historia de usuario 4 — Acumular varias fotos en un solo Excel (Prioridad: P1)

Como usuario, paso las planillas una por una: verifico cada foto, la añado a la lista y, al
terminar, descargo un único Excel con todas las filas.

**Escenarios de aceptación**:
1. **Dado** una foto procesada, **cuando** veo la vista previa, **entonces** aparece un campo
   "Fecha" precargado con lo que leyó el OCR de la planilla (o vacío si no lo pudo leer) que debo
   confirmar o corregir antes de añadirla.
2. **Dado** que verifiqué la foto, **cuando** pulso "Añadir y pasar otra foto", **entonces** sus
   filas se suman a la lista acumulada con su "Fecha" y su "N.º foto" (1, 2, 3…), y puedo subir la siguiente.
3. **Dado** que ya añadí 10 fotos, **entonces** no puedo añadir más y se me indica que exporte.
4. **Dado** una lista con fotos añadidas, **cuando** pulso "Exportar Excel", **entonces** descargo
   un único `.xlsx` con todas las filas, con "Fecha" y "N.º foto" como primeras columnas.
5. **Dado** que una foto falla (sin tabla, ilegible), **entonces** veo un mensaje claro, la lista
   acumulada no se pierde y puedo pasar otra foto.
6. **Dado** una foto ya añadida al lote, **cuando** la quito, **entonces** sus filas desaparecen de
   la lista y las fotos restantes se renumeran (1, 2, 3…) sin huecos.

---

### Historia de usuario 5 — Ajustar la plantilla sin programar (Prioridad: P3)

Como dueño, quiero definir o cambiar las columnas desde la propia página (o con un archivo JSON)
y que la otra persona reciba esa plantilla por defecto.

**Escenarios de aceptación**:
1. **Dado** una foto de ejemplo, **cuando** uso "Crear plantilla", **entonces** la herramienta
   detecta las columnas, propone nombres desde el encabezado y me deja elegir el tipo de cada una.
2. **Dado** una plantilla creada, **cuando** la exporto como `plantilla.json` y la pongo en el
   repositorio, **entonces** queda como plantilla por defecto para todos tras publicar.
3. **Dado** un enlace con `?plantilla=<nombre>`, **entonces** se carga esa plantilla (para varios formatos).

### Casos borde
- Sombras, reflejos, poca luz; tabla que ocupa solo parte de la foto.
- Celdas vacías (deben quedar vacías), celdas combinadas, encabezados de dos niveles.
- Fotos grandes de celular (12–48 MP): se reducen antes de procesar para no agotar memoria.
- HEIC de iPhone (Safari lo convierte al usar la cámara; si se sube un archivo HEIC en otro navegador, mensaje claro).
- Números `1.234,50` y fechas `dd/mm/aaaa`.
- Cuadrícula incompleta (líneas borrosas, cortadas o ausentes en parte de la tabla): si no se puede reconstruir la cuadrícula, mensaje claro que pide una foto donde se vean todas las líneas; nunca se inventan filas o columnas.
- Guion (`-`, `—`) en una celda significa "vacío": la celda queda vacía, no se marca como error de tipo.
- Encabezados impresos en vertical (Tacos, Fundas, Paraguas, Varas): los nombres vienen de la plantilla, no del OCR.
- Marcas fuera de la cuadrícula (márgenes, sello o firma a la derecha) se ignoran.
- Recarga o cierre accidental con fotos sin exportar: aviso de confirmación del navegador; si el usuario confirma, el lote se pierde (no hay recuperación). En celular el sistema operativo puede cerrar la pestaña sin aviso; se recomienda exportar al terminar.
- Navegador antiguo sin soporte (mensaje claro de qué navegador usar).

## Requisitos *(obligatorio)*

### Requisitos funcionales
- **RF-001**: El sistema DEBE aceptar imágenes JPG, PNG y WEBP (subidas, arrastradas o tomadas con la cámara del celular).
- **RF-002**: El sistema DEBE detectar la región de la tabla y corregir perspectiva e inclinación.
- **RF-003**: El sistema DEBE detectar la cuadrícula (filas y columnas) a partir de las líneas de la tabla, asumiendo cuadrícula completa (líneas entre todas las filas y columnas, y borde exterior). Tablas sin líneas o con líneas solo en un sentido quedan fuera de alcance.
- **RF-004**: El sistema DEBE leer el texto de cada celda con OCR en el navegador, en español por defecto. Los encabezados son impresos y los datos están escritos a mano; el OCR de los datos es asistido: toda celda manuscrita por debajo del umbral de confianza se marca para revisión (nunca se acepta en silencio).
- **RF-005**: El sistema DEBE usar una plantilla (JSON) que define nombre, orden y tipo de cada columna (texto, entero, decimal, moneda, fecha), si la columna se exporta o se ignora, filas de encabezado y configuración regional.
- **RF-006**: El sistema DEBE convertir los valores al tipo de la columna (`1.234,50` → 1234.5; `05/03/2026` → fecha).
- **RF-007**: El sistema DEBE mostrar una vista previa editable de la tabla extraída: editar celdas, borrar filas y añadir filas. Las filas cuyas columnas exportadas quedan todas vacías (tras tratar guiones como vacío) se descartan automáticamente.
- **RF-008**: El sistema DEBE generar y descargar un `.xlsx` con tipos de celda reales, anchos legibles, resaltado de celdas dudosas y hoja "Revisión".
- **RF-009**: El sistema DEBE procesar las fotos de una en una: tras verificar cada foto, sus filas se añaden a una lista acumulada (máximo 10 fotos por exportación) y al final se exporta un único `.xlsx`. Cada fila incluye "Fecha" (leída de la planilla, editable y obligatoria antes de añadir) y "N.º foto" (orden de añadido).
- **RF-010**: El sistema NO DEBE enviar imágenes ni datos a ningún servidor.
- **RF-011**: El sistema DEBE publicarse como sitio estático público (accesible por enlace, sin contraseña ni cuentas) con despliegue automático al subir cambios a `main`.
- **RF-012**: El sistema DEBE funcionar sin conexión después de la primera visita.
- **RF-013**: El sistema DEBE ofrecer "Crear plantilla" desde una foto de ejemplo y exportar/importar `plantilla.json`.
- **RF-014**: El sistema DEBE mostrar el progreso del procesamiento (p. ej. "Leyendo celda 34 de 150").
- **RF-015**: El sistema DEBE funcionar en pantallas de celular (diseño adaptable).
- **RF-016**: El sistema NO DEBE guardar el lote entre sesiones; si hay fotos añadidas sin exportar, DEBE pedir confirmación del navegador antes de recargar o cerrar la página.

### Entidades clave
- **Plantilla**: formato de la tabla (columnas, tipos, configuración regional, filas de encabezado, umbral de confianza).
  Plantilla real por defecto (planilla de talegas), 1 fila de encabezado. La planilla física tiene
  14 columnas (todas se describen en la plantilla para ubicar la cuadrícula), pero solo se leen
  y exportan las marcadas "Sí". En el Excel van primero "Fecha" (fecha, de la planilla) y
  "N.º foto" (entero, añadidas por la herramienta), y luego las exportadas en este orden:

  | # | Columna de la planilla | Tipo | Exportar |
  |---|---|---|---|
  | 1 | Hora | texto | No |
  | 2 | Talega No. | entero | Sí |
  | 3 | Carro No. | texto (alfanumérico: `NC33`, `E155`, `SP157`) | Sí |
  | 4 | Tacos | entero | Sí |
  | 5 | Fundas | entero | Sí |
  | 6 | Paraguas | entero | Sí |
  | 7 | Varas | entero | Sí |
  | 8 | Nombre del Socio | texto | Sí |
  | 9 | Entrega Cuarto de Tacos | texto | No |
  | 10 | Recibe Socio / Caddie | texto | No |
  | 11 | No. Caddie | entero | No |
  | 12 | Recibe Cuarto de Tacos | texto | No |
  | 13 | Entrega Socio / Caddie | texto | No |
  | 14 | Observaciones | texto | No |

  Las columnas no exportadas no pasan por OCR ni aparecen en la vista previa.
  "Nombre del Socio" se lee tal cual, sin lista de referencia (una lista de socios queda fuera de
  alcance en esta versión: contendría datos personales y no puede publicarse).
- **Imagen de entrada**: foto original; nunca se modifica ni se sube.
- **Tabla detectada**: cuadrícula de celdas con posición.
- **Celda extraída**: texto crudo, valor convertido, confianza, estado de validación, si fue editada.
- **Lote**: lista acumulada de fotos verificadas (máx. 10), cada una con su fecha, número de foto y filas. Una foto se puede quitar del lote; el número de foto es su posición actual (se renumera al quitar).
- **Resultado**: archivo Excel descargado + resumen.

## Criterios de éxito *(obligatorio)*
- **CE-001**: Con fotos nítidas, en ≥ 95 % de las fotos del set de prueba se detectan las 14 columnas y todas las filas de la planilla sin intervención (los nombres de columna vienen de la plantilla, no del OCR). Para las celdas de datos manuscritas no se exige una tasa de acierto automática; la meta es CE-002 (nada dudoso o inválido sin resaltar) y CE-006 (ahorro de tiempo con revisión).
- **CE-002**: El 100 % de las celdas del set de prueba con confianza por debajo del umbral o con tipo inválido (p. ej. texto en una columna entera) aparecen resaltadas. Las lecturas erróneas que dan un entero válido con confianza alta (p. ej. "14" leído como "141") no se validan por rango y dependen de la revisión humana.
- **CE-003**: Una foto de hasta 30 filas se procesa en < 15 s en portátil y < 30 s en celular de gama media.
- **CE-004**: Una persona que recibe solo el enlace convierte su primera foto en < 3 minutos sin ayuda.
- **CE-005**: Publicar una nueva versión toma un solo paso (push) y < 5 minutos hasta estar en línea.
- **CE-006**: Transcribir una hoja con la herramienta + revisión toma ≥ 70 % menos tiempo que a mano.

## Supuestos
- La tabla tiene cuadrícula completa: líneas visibles entre todas las filas y columnas, y borde exterior (confirmado en aclaraciones).
- Contenido mixto: encabezados impresos y datos escritos a mano (confirmado en aclaraciones). La precisión del OCR manuscrito en el navegador es limitada, así que la revisión y corrección en pantalla (Historia 3) forma parte del flujo normal, no es una excepción.
- El dueño tiene (o puede crear) una cuenta gratuita de GitHub para publicar.
- La herramienta es pública por enlace, sin restricción de acceso (confirmado en aclaraciones); no contiene datos (los datos están en las fotos de cada usuario). Las plantillas publicadas sí son visibles para cualquiera, así que no deben incluir datos sensibles.
- Las fotos reales contienen nombres de socios (datos personales): no se suben al repositorio público; las imágenes de prueba (fixtures) deben ser sintéticas o anonimizadas.
