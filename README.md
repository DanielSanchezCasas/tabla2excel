# tabla2excel

Página web que convierte fotos de una planilla (formato conocido) en un Excel.
Todo ocurre en el navegador: **las fotos no salen del dispositivo**. Funciona en computador y
celular, y sin conexión después de la primera visita.

## Para quien la usa

1. Abre el enlace que te enviaron.
2. Toca **Tomar foto** (o **Elegir foto**) con UNA planilla.
3. Revisa la **Fecha** y las celdas amarillas (lectura dudosa) o rojas (no es un número, etc.).
   Toca una celda para corregirla; borra o añade filas si hace falta.
4. Toca **Añadir y pasar otra foto** y repite (máximo 10).
5. Toca **Exportar Excel**. El lote no se guarda: exporta antes de cerrar la página.

Consejos para la foto: de frente, buena luz sin sombras, toda la planilla (con la fecha) dentro
del encuadre, sin flash directo. En el celular puedes usar "Agregar a pantalla de inicio".

## Para el dueño: publicar

Primera vez (≈ 10 minutos):

1. Crea un repositorio público en GitHub (p. ej. `tabla2excel`) y sube el proyecto.
2. En el repositorio: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Haz push a `main`. En **Actions** verás "Publicar"; al terminar, el sitio queda en
   `https://<tu-usuario>.github.io/<nombre-del-repo>/`.
4. Envía ese enlace.

Después, cada push a `main` publica solo (pruebas → build → Pages, ~2–3 minutos). Si las pruebas
fallan, no se publica y sigue en línea la versión anterior.

### Cambiar el formato de la planilla

Edita `public/plantillas/talegas.json` (columnas, tipos, cuáles se exportan) o usa
**Crear plantilla** en la propia página y descarga el `.json`. Ver
[data-model.md](specs/001-foto-tabla-a-excel/data-model.md).

## Desarrollo

Requiere Node 22+ y pnpm.

```sh
pnpm install         # copia OpenCV y Tesseract a public/vendor/
pnpm dev             # http://localhost:5173/tabla2excel/
pnpm test            # pruebas unitarias (Vitest)
pnpm test:e2e        # pruebas en navegador (Playwright: Chromium y WebKit móvil)
pnpm build           # dist/ + informe del tamaño de descarga
pnpm fixtures        # regenera las planillas sintéticas de prueba
```

Firefox en las pruebas e2e es opcional (`E2E_FIREFOX=1 pnpm test:e2e`): el Firefox de
Playwright no arranca en algunas versiones de macOS.

**Fotos reales**: guárdalas en `fotos-reales/` (está en `.gitignore`). Tienen datos personales
y el repositorio es público: nunca las subas.

### Probar la lectura con IA local (Ollama)

1. Instala [Ollama](https://ollama.com/download) y descarga un modelo de visión, p. ej. `ollama pull qwen2.5vl:7b`.
2. Copia a `fotos-reales/` la foto y su referencia `<foto>.verdad.json` (`[["talega","carro","nombre"], ...]`).
3. Con Ollama en marcha: `node scripts/evaluar-ollama.mjs "fotos-reales/<foto>.jpeg" qwen2.5vl:7b`

Resultados y próximos pasos en [research.md](specs/001-foto-tabla-a-excel/research.md) (Decisión 7).

La especificación, el plan y las decisiones están en [`specs/001-foto-tabla-a-excel/`](specs/001-foto-tabla-a-excel/)
(ver [LEEME.md](LEEME.md)).
