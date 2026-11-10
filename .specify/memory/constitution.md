# Constitución del proyecto: tabla2excel

**Versión**: 2.1.0 | **Ratificada**: 2026-11-10 | **Última enmienda**: 2026-11-10
**Motivo de la enmienda 2.1.0**: el límite de 15 MB no era un requisito del dueño; sus prioridades
son fiabilidad y publicación fácil → el tamaño pasa de restricción dura a criterio de diseño.
**Motivo de la enmienda 2.0.0**: la herramienta debe poder publicarse fácilmente para que la use
otra persona → se cambia de CLI en Python a aplicación web estática (principio VII nuevo, II y VI ajustados).

## Principios fundamentales

### I. Local y privado primero
Las fotos y los datos extraídos NUNCA se suben a un servidor. Todo el procesamiento
(detección de tabla, OCR, generación del Excel) ocurre dentro del navegador del usuario.
No hay backend ni APIs en la nube.

### II. Simple por encima de completo
Es una herramienta pequeña: una sola página, sin cuentas de usuario, sin base de datos,
sin servidor propio. Cada dependencia nueva debe justificarse en `plan.md`.

### III. Basada en plantillas (formato conocido)
La herramienta está pensada para UN formato de tabla conocido (o unos pocos). El formato
se describe en un archivo de plantilla (JSON) que viene publicado con la página y que el
usuario puede editar o importar. El código no debe tener columnas fijas "quemadas".

### IV. Nunca perder ni inventar datos
- Si una celda no se puede leer con confianza, se marca (no se adivina).
- Las celdas de baja confianza o inválidas se resaltan en el Excel para revisión humana.
- El usuario puede corregir celdas en pantalla antes de descargar.

### V. Pruebas primero en la lógica central (NO NEGOCIABLE)
Detección de cuadrícula, conversión de valores, validación y escritura del Excel tienen
pruebas automáticas (fixtures de imágenes) antes de darse por terminadas. El OCR se aísla
detrás de una interfaz para poder simularlo en pruebas.

### VI. Cero instalación para quien la usa
La persona que recibe la herramienta solo necesita un enlace y un navegador moderno
(Chrome, Edge, Safari, Firefox; escritorio o celular). Mensajes en español, que dicen qué
pasó y qué hacer. Un archivo con error no detiene el lote.

### VII. Publicación en un paso
Publicar una nueva versión debe ser un solo paso (push a `main` → despliegue automático
en un hosting estático gratuito). Todos los recursos (modelos de OCR, idioma español,
OpenCV) se sirven desde el mismo sitio, sin depender de CDNs de terceros, para que siga
funcionando aunque cambien.

## Restricciones técnicas
- Sitio estático (HTML/CSS/JS). Sin servidor.
- Prioridad: fiabilidad (que funcione siempre, también en celular y sin conexión) y publicación fácil.
  El tamaño de carga no es un límite duro: se mantiene razonable y se cachea tras la primera visita;
  ante la duda se elige la opción más fiable, no la más liviana.
- Procesar una foto típica (≤ 12 MP, ≤ 30 filas) en < 15 s en un portátil normal y < 30 s en un celular de gama media.
- Funciona sin conexión después de la primera visita (PWA).

## Flujo de desarrollo
- Spec Kit: constitution → specify → clarify → plan → tasks → analyze → implement.
- Cada cambio de formato o de comportamiento visible se refleja primero en `spec.md`.

## Gobernanza
Esta constitución prevalece sobre cualquier otra práctica. Las enmiendas requieren
actualizar la versión (SemVer) y anotar el motivo.
