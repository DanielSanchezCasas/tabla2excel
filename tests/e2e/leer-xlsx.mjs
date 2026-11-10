// Lee un .xlsx y lo imprime como JSON. Se ejecuta en un proceso aparte porque el cargador
// de módulos de Playwright no puede cargar ExcelJS.
import ExcelJS from 'exceljs';

const libro = new ExcelJS.Workbook();
await libro.xlsx.readFile(process.argv[2]);
const hojas = {};
libro.eachSheet((hoja) => {
  const filas = [];
  hoja.eachRow((row) => {
    filas.push(
      row.values.slice(1).map((v) => (v instanceof Date ? { fecha: v.toISOString() } : (v ?? null))),
    );
  });
  hojas[hoja.name] = {
    filas,
    rellenos: Object.fromEntries(
      filas.flatMap((_, i) =>
        Array.from({ length: hoja.columnCount }, (_, k) => {
          const celda = hoja.getRow(i + 1).getCell(k + 1);
          return celda.fill?.fgColor?.argb ? [[celda.address, celda.fill.fgColor.argb]] : [];
        }).flat(),
      ),
    ),
  };
});
console.log(JSON.stringify(hojas));
