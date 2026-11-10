# Inicio rápido y validación

## Para quien USA la herramienta
1. Abre el enlace (computador o celular).
2. Toca **Tomar foto** (o **Elegir foto**) con UNA planilla.
3. Revisa la **Fecha** y las celdas amarillas/rojas; borra o añade filas si hace falta.
4. Toca **Añadir y pasar otra foto**. Repite (máx. 10).
5. Toca **Exportar Excel**. ¡No cierres la página antes: el lote no se guarda!

**Consejos para la foto**: de frente, buena luz sin sombras, toda la planilla (con la fecha) dentro del encuadre, sin flash directo.

## Para el DUEÑO (publicar)
### Primera vez (≈ 10 minutos)
1. Crea un repo público `tabla2excel` en GitHub y sube el proyecto.
2. **Settings → Pages → Source: GitHub Actions**.
3. Push a `main` → pestaña **Actions** → "Publicar" → sitio en `https://<tu-usuario>.github.io/tabla2excel/`.
4. Envía el enlace.

### Actualizar
Cambios → push a `main` → en ~2–5 minutos está en línea (misma URL).

### Cambiar el formato
Edita `public/plantillas/talegas.json` (ver [data-model.md](./data-model.md)) o usa **Crear plantilla** → push.

## Desarrollo local
```
pnpm install
pnpm dev        # http://localhost:5173
pnpm test       # Vitest
pnpm test:e2e   # Playwright
pnpm build      # dist/ + informe de tamaño
```

## Escenarios de validación
| # | Escenario | Cómo | Resultado esperado |
|---|---|---|---|
| V1 | Lógica central | `pnpm test` | Conversión (guiones → vacío, `31 octubre 2026`), validación, lote (máx. 10, renumerar, filas vacías), Excel: todo verde |
| V2 | Cuadrícula | `pnpm test` con fixtures sintéticas (recta, inclinada 15°, con sombra) | 14 columnas y nº de filas esperado |
| V3 | Flujo completo | `pnpm test:e2e` con OCR simulado | 3 fotos añadidas, quitar la 2 → Excel con N.º foto 1–2, Fecha y 7 columnas; hoja Revisión |
| V4 | Aviso de salida | e2e: añadir foto y recargar | Se dispara `beforeunload` |
| V5 | Privacidad | e2e con registro de red | Ninguna petición fuera del propio origen |
| V6 | Foto real (manual, local) | Fotos en `fotos-reales/` (no se suben) → `pnpm dev` | Medir % correcto por columna y minutos de revisión por foto (Decisión 7 de research.md) |
| V7 | Publicación | Push a `main` | Sitio actualizado < 5 min; enlace funciona en navegador limpio y celular |
| V8 | Sin conexión | Abrir, cortar red, recargar | Sigue funcionando |
