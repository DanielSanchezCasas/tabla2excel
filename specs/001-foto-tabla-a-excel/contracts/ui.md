# Contrato de la interfaz y de la publicación

## URL
- `https://<usuario>.github.io/tabla2excel/` → convertir con la plantilla por defecto (`talegas`)
- `…/?plantilla=<id>` → usa esa plantilla
- `…/#crear-plantilla` → editor de plantillas

## Pantalla "Convertir" (una foto a la vez)
1. **Encabezado**: nombre de la plantilla activa + selector · contador "Lote: 3 de 10 fotos".
2. **Zona de carga**: "Elegir foto", zona para arrastrar y, en celular, "Tomar foto"
   (`<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment">`, SIN `multiple`).
   Deshabilitada si el lote tiene 10 fotos ("Llegaste al máximo de 10 fotos. Exporta el Excel.").
3. **Progreso**: "Leyendo celda 34 de 175".
4. **Vista previa de la foto actual**:
   - Campo **Fecha** (precargado con lo leído; vacío y en rojo si no se pudo leer). Obligatorio.
   - Tabla editable con SOLO las columnas exportadas. Amarillo = baja confianza (tooltip con
     texto leído y %), rojo = inválida (tooltip con motivo). Clic para editar.
   - Por fila: botón "Borrar fila". Al final: "Añadir fila".
   - "Ver cuadrícula detectada" muestra la foto corregida con la cuadrícula.
   - Botones: **"Añadir y pasar otra foto"** (deshabilitado sin Fecha) · "Descartar esta foto".
5. **Lote**: lista "Foto 1 · 31/10/2026 · 24 filas · 3 por revisar [Quitar]". Al quitar, se renumera.
6. **"Exportar Excel"** (habilitado con ≥ 1 foto) · "Empezar de nuevo".
7. **Pie**: "Tus fotos no salen de este dispositivo. El lote no se guarda: exporta antes de cerrar."
8. **Salir/recargar** con fotos sin exportar → confirmación nativa del navegador (`beforeunload`).

## Mensajes de error (ejemplos)
- "No se encontró una tabla en la foto. Tómala más de frente, con buena luz y con toda la planilla dentro."
- "Se detectaron 12 columnas, pero la planilla tiene 14. Revisa que se vean todas las líneas."
- "No se pudo leer la fecha de la planilla. Escríbela para continuar."
- "Este archivo es HEIC y este navegador no lo abre. Usa 'Tomar foto' o conviértelo a JPG."
- "Este navegador no es compatible. Usa Chrome, Edge, Safari o Firefox actualizados."
Un error en una foto nunca borra el lote.

## Excel descargado (`<id_plantilla>_AAAA-MM-DD.xlsx`, p. ej. `talegas_2026-11-10.xlsx`)
- Hoja **Datos**: `Fecha` (formato `dd/mm/aaaa`) | `N.º foto` | Talega No. | Carro No. | Tacos |
  Fundas | Paraguas | Varas | Nombre del Socio. Tipos reales, encabezado en negrita y fijado,
  filtros, anchos ajustados. Amarillo/rojo como en la vista previa, con comentario.
- Hoja **Revisión**: `N.º foto | fila | columna | texto_leído | confianza | motivo` (solo celdas no corregidas).

## Pantalla "Crear plantilla"
Subir foto de ejemplo → columnas detectadas con el texto del encabezado como nombre propuesto →
elegir tipo / exportar / obligatoria por columna → "Usar en este navegador" o "Descargar plantilla.json".
También "Importar plantilla.json": se valida; si es inválida → "Esta plantilla no es válida: <motivo>. Se mantiene la actual."

## Publicación
- Push a `main` → workflow `publicar.yml` → pruebas → build → GitHub Pages (público).
- Si algo falla, no se publica (la versión anterior sigue en línea).
