# tabla2excel

Página web para convertir fotos de una tabla con formato conocido en un Excel.
Funciona 100 % en el navegador (las fotos no se suben a ningún lado) y se publica gratis
en GitHub Pages: la otra persona solo necesita el enlace, en computador o celular.

Proyecto inicializado con Spec Kit (`specify init --integration claude`, v1.3.4).

## Documentos
```
.specify/memory/constitution.md        principios (web estática, privada, publicación en un paso)
.specify/feature.json                  apunta a la funcionalidad activa
specs/001-foto-tabla-a-excel/
  spec.md          qué y por qué (5 historias, requisitos, criterios de éxito)
  plan.md          cómo (Vite + TS, OpenCV.js, Tesseract.js, ExcelJS, GitHub Pages)
  research.md      decisiones y alternativas
  data-model.md    plantilla JSON y entidades
  contracts/ui.md  pantallas, URLs, Excel y publicación
  quickstart.md    guía para quien usa y para quien publica
  tasks.md         49 tareas (publicación primero; MVP = Fases 1–3 + US1, T001–T028)
  checklists/
public/plantillas/ indice.json + talegas.json (plantilla real, por defecto) + ejemplo.json
```

## Siguientes pasos
1. `/speckit-implement` → construye la herramienta (spec aclarada, plan, tareas y análisis ya hechos).
2. Publica: repo en GitHub → Settings → Pages → Source: **GitHub Actions** → merge a `main`.
   Comparte `https://<tu-usuario>.github.io/tabla2excel/`.
