import ExcelJS from 'exceljs';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { generarExcel, nombreArchivo } from '../../src/nucleo/excel';
import type { FotoAñadida, Fila } from '../../src/nucleo/foto';
import { columnasExportadas, validarPlantilla } from '../../src/nucleo/plantilla';
import { evaluarCelda } from '../../src/nucleo/validacion';

const r = validarPlantilla(JSON.parse(readFileSync('public/plantillas/talegas.json', 'utf-8')));
if (!r.ok) throw new Error(r.error);
const plantilla = r.plantilla;
const exportadas = columnasExportadas(plantilla);

const fila = (i: number, textos: string[], confianzas: number[] = []): Fila => ({
  añadida_a_mano: false,
  celdas: exportadas.map((col, k) =>
    evaluarCelda(
      {
        fila: i,
        columna: plantilla.columnas.indexOf(col),
        texto: textos[k] ?? '',
        confianza: confianzas[k] ?? 95,
      },
      col,
      plantilla,
    ),
  ),
});

const foto = (numero: number, filas: Fila[]): FotoAñadida => ({
  numero,
  nombre_archivo: `foto${numero}.jpg`,
  fecha: new Date(Date.UTC(2026, 9, 30 + numero)),
  fecha_texto_crudo: '',
  fecha_confianza: 90,
  filas,
});

async function leer(fotos: FotoAñadida[]) {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(await generarExcel(fotos, plantilla));
  return libro;
}

const valores = (hoja: ExcelJS.Worksheet, n: number) => (hoja.getRow(n).values as unknown[]).slice(1);

describe('generarExcel', () => {
  it('hoja Datos: Fecha, N.º foto y las 7 columnas exportadas, con tipos reales', async () => {
    const libro = await leer([foto(1, [fila(0, ['356', 'NC33', '14', '3', '1', '', 'Ana Mora'])])]);
    const datos = libro.getWorksheet('Datos')!;
    expect(valores(datos, 1)).toEqual([
      'Fecha',
      'N.º foto',
      'Talega No.',
      'Carro No.',
      'Tacos',
      'Fundas',
      'Paraguas',
      'Varas',
      'Nombre del Socio',
    ]);
    const v = valores(datos, 2);
    expect(v[0]).toEqual(new Date(Date.UTC(2026, 9, 31)));
    expect(v.slice(1, 7)).toEqual([1, 356, 'NC33', 14, 3, 1]);
    expect(v[7]).toBeUndefined(); // Varas vacía
    expect(v[8]).toBe('Ana Mora');
    expect(datos.getCell('A2').numFmt).toBe('dd/mm/yyyy');
    expect(datos.getRow(1).font?.bold).toBe(true);
    expect(datos.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    expect(datos.autoFilter).toBeTruthy();
  });

  it('un lote de 3 fotos lleva su N.º foto en cada fila', async () => {
    const libro = await leer([
      foto(1, [fila(0, ['1']), fila(1, ['2'])]),
      foto(2, [fila(0, ['3'])]),
      foto(3, [fila(0, ['4'])]),
    ]);
    const datos = libro.getWorksheet('Datos')!;
    expect([2, 3, 4, 5].map((n) => valores(datos, n)[1])).toEqual([1, 1, 2, 3]);
    expect([2, 3, 4, 5].map((n) => valores(datos, n)[2])).toEqual([1, 2, 3, 4]);
  });

  it('resalta lo dudoso y lo inválido con comentario, y lo lista en Revisión', async () => {
    const libro = await leer([foto(1, [fila(0, ['356', 'NC33', '1A', '3'], [95, 50, 95, 95])])]);
    const datos = libro.getWorksheet('Datos')!;
    const carro = datos.getCell('D2');
    const tacos = datos.getCell('E2');
    expect((carro.fill as ExcelJS.FillPattern).fgColor?.argb).toBe('FFFFF2CC');
    expect((tacos.fill as ExcelJS.FillPattern).fgColor?.argb).toBe('FFF8CBAD');
    expect(tacos.value).toBe('1A'); // el texto leído no se pierde
    expect(JSON.stringify(tacos.note)).toContain('entero');

    const revision = libro.getWorksheet('Revisión')!;
    expect(valores(revision, 1)).toEqual([
      'N.º foto',
      'fila',
      'columna',
      'texto_leído',
      'confianza',
      'motivo',
    ]);
    expect(revision.rowCount).toBe(3);
    expect(valores(revision, 2).slice(0, 5)).toEqual([1, 1, 'Carro No.', 'NC33', 50]);
    expect(valores(revision, 3).slice(0, 4)).toEqual([1, 1, 'Tacos', '1A']);
  });

  it('lo corregido a mano ya no se resalta ni va a Revisión', async () => {
    const f = fila(0, ['356', 'NC33'], [95, 50]);
    f.celdas[1] = { ...f.celdas[1], estado: 'ok', editada: true, confianza: 100 };
    const libro = await leer([foto(1, [f])]);
    expect(libro.getWorksheet('Datos')!.getCell('D2').fill).toBeUndefined();
    expect(libro.getWorksheet('Revisión')!.rowCount).toBe(1);
  });
});

it('nombreArchivo usa el id de la plantilla y la fecha de hoy', () => {
  expect(nombreArchivo(plantilla, new Date(2026, 10, 10))).toBe('talegas_2026-11-10.xlsx');
});
