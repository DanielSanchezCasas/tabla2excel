import ExcelJS from 'exceljs';
import type { FotoAñadida } from './foto';
import { columnasExportadas, type Columna, type Plantilla } from './plantilla';
import { pendiente, type Celda } from './validacion';

const AMARILLO = 'FFFFF2CC';
const ROJO = 'FFF8CBAD';

const FORMATOS: Record<Columna['tipo'], string | undefined> = {
  texto: undefined,
  entero: '0',
  decimal: '#,##0.00',
  moneda: '"$"#,##0.00',
  fecha: 'dd/mm/yyyy',
};

const relleno = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

const nota = (c: Celda) =>
  c.estado === 'invalida'
    ? `${c.motivo} Leído: "${c.texto_crudo}".`
    : `Leído: "${c.texto_crudo}" (${Math.round(c.confianza)} %).`;

/** Genera el .xlsx de un conjunto de fotos (en US1, una sola; en US4, todo el lote). */
export async function generarExcel(
  fotos: readonly FotoAñadida[],
  plantilla: Plantilla,
): Promise<ArrayBuffer> {
  const columnas = columnasExportadas(plantilla);
  const libro = new ExcelJS.Workbook();
  libro.creator = 'tabla2excel';
  libro.created = new Date();

  const datos = libro.addWorksheet('Datos', { views: [{ state: 'frozen', ySplit: 1 }] });
  datos.addRow(['Fecha', 'N.º foto', ...columnas.map((c) => c.nombre)]);
  datos.getRow(1).font = { bold: true };

  const revision: (string | number)[][] = [];
  for (const foto of fotos) {
    foto.filas.forEach((fila, i) => {
      const fecha = foto.fecha ?? '';
      const row = datos.addRow([
        fecha,
        foto.numero,
        // Lo inválido se escribe como texto leído para no perder el dato (principio IV)
        ...fila.celdas.map((c) => (c.estado === 'invalida' ? c.texto_crudo : (c.valor ?? null))),
      ]);
      row.getCell(1).numFmt = 'dd/mm/yyyy';
      fila.celdas.forEach((c, k) => {
        const cell = row.getCell(k + 3);
        const formato = FORMATOS[columnas[k].tipo];
        if (formato && c.estado !== 'invalida') cell.numFmt = formato;
        if (!pendiente(c)) return;
        cell.fill = relleno(c.estado === 'invalida' ? ROJO : AMARILLO);
        cell.note = nota(c);
        revision.push([
          foto.numero,
          i + 1,
          columnas[k].nombre,
          c.texto_crudo,
          Math.round(c.confianza),
          c.motivo ?? '',
        ]);
      });
    });
  }

  datos.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnas.length + 2 } };
  datos.columns.forEach((col, k) => {
    let largo = 8;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const v = cell.value;
      largo = Math.max(largo, v instanceof Date ? 10 : String(v ?? '').length);
    });
    col.width = Math.min(50, largo + 2 + (k === 0 ? 1 : 0));
  });

  const hojaRevision = libro.addWorksheet('Revisión', { views: [{ state: 'frozen', ySplit: 1 }] });
  hojaRevision.addRow(['N.º foto', 'fila', 'columna', 'texto_leído', 'confianza', 'motivo']);
  hojaRevision.getRow(1).font = { bold: true };
  revision.forEach((r) => hojaRevision.addRow(r));
  hojaRevision.columns.forEach((col, k) => (col.width = [9, 6, 20, 20, 11, 45][k]));

  return (await libro.xlsx.writeBuffer()) as ArrayBuffer;
}

const dos = (n: number) => String(n).padStart(2, '0');

export const nombreArchivo = (plantilla: Plantilla, hoy = new Date()) =>
  `${plantilla.id}_${hoy.getFullYear()}-${dos(hoy.getMonth() + 1)}-${dos(hoy.getDate())}.xlsx`;
