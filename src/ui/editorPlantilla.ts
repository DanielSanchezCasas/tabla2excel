import {
  guardarPlantillaPropia,
  recordarPlantilla,
  TIPOS,
  validarPlantilla,
  type Columna,
  type Plantilla,
} from '../nucleo/plantilla';
import { $, crear, descargar, mostrarAviso, ocultarAviso } from './dom';

/** Pantalla "Crear plantilla" (#crear-plantilla). */
export class EditorPlantilla {
  private columnas: Columna[] = [];
  private base: Plantilla | null = null;

  constructor(
    detectar: (archivo: File) => Promise<string[]>,
    private alUsar: (p: Plantilla) => void,
  ) {
    const foto = $<HTMLInputElement>('editor-foto');
    foto.addEventListener('change', async () => {
      const archivo = foto.files?.[0];
      foto.value = '';
      if (!archivo) return;
      ocultarAviso();
      try {
        const nombres = await detectar(archivo);
        this.cargar(
          null,
          nombres.map((nombre) => ({ nombre, tipo: 'texto', exportar: true, obligatoria: false })),
        );
      } catch (e) {
        mostrarAviso((e as Error).message);
      }
    });

    const importar = $<HTMLInputElement>('editor-importar');
    importar.addEventListener('change', async () => {
      const archivo = importar.files?.[0];
      importar.value = '';
      if (!archivo) return;
      let datos: unknown;
      try {
        datos = JSON.parse(await archivo.text());
      } catch {
        datos = null;
      }
      const r = validarPlantilla(datos);
      if (!r.ok) {
        mostrarAviso(`Esta plantilla no es válida: ${r.error} Se mantiene la actual.`);
        return;
      }
      ocultarAviso();
      this.cargar(r.plantilla, r.plantilla.columnas);
      this.usar();
    });

    $('editor-usar').addEventListener('click', () => this.usar());
    $('editor-descargar').addEventListener('click', () => {
      const p = this.construir();
      if (p) descargar(JSON.stringify(p, null, 2) + '\n', `${p.id}.json`, 'application/json');
    });
  }

  private cargar(base: Plantilla | null, columnas: Columna[]) {
    this.base = base;
    this.columnas = columnas.map((c) => ({ ...c }));
    $<HTMLInputElement>('editor-id').value = base?.id ?? 'mi-plantilla';
    $<HTMLInputElement>('editor-nombre').value = base?.nombre ?? 'Mi planilla';
    $('editor-formulario').hidden = false;
    this.dibujar();
  }

  private dibujar() {
    const filas = this.columnas.map((c, i) => {
      const nombre = crear('input', { value: c.nombre });
      nombre.setAttribute('aria-label', `Nombre de la columna ${i + 1}`);
      nombre.addEventListener('input', () => (c.nombre = nombre.value.trim()));
      const tipo = crear('select', {}, ...TIPOS.map((t) => crear('option', { value: t, textContent: t })));
      tipo.value = c.tipo;
      tipo.setAttribute('aria-label', `Tipo de la columna ${i + 1}`);
      tipo.addEventListener('change', () => (c.tipo = tipo.value as Columna['tipo']));
      const casilla = (clave: 'exportar' | 'obligatoria') => {
        const input = crear('input', { type: 'checkbox', checked: c[clave] });
        input.setAttribute('aria-label', `${clave} columna ${i + 1}`);
        input.addEventListener('change', () => (c[clave] = input.checked));
        return input;
      };
      return crear(
        'tr',
        {},
        crear('td', { textContent: String(i + 1) }),
        crear('td', {}, nombre),
        crear('td', {}, tipo),
        crear('td', {}, casilla('exportar')),
        crear('td', {}, casilla('obligatoria')),
      );
    });
    const titulos = ['#', 'Nombre', 'Tipo', 'Exportar', 'Obligatoria'];
    $('editor-columnas').replaceChildren(
      crear('thead', {}, crear('tr', {}, ...titulos.map((t) => crear('th', { textContent: t })))),
      crear('tbody', {}, ...filas),
    );
  }

  private construir(): Plantilla | null {
    const r = validarPlantilla({
      ...(this.base ?? {}),
      id: $<HTMLInputElement>('editor-id').value.trim(),
      nombre: $<HTMLInputElement>('editor-nombre').value.trim(),
      columnas: this.columnas,
    });
    if (!r.ok) {
      mostrarAviso(r.error);
      return null;
    }
    ocultarAviso();
    return r.plantilla;
  }

  private usar() {
    const p = this.construir();
    if (!p) return;
    guardarPlantillaPropia(p);
    recordarPlantilla(p.id);
    this.alUsar(p);
  }
}
