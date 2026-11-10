import { expect, test } from '@playwright/test';
import { abrir, esperado, exportar, subirYEsperarVista } from './ayuda';

test('resalta, corrige celdas, borra y añade filas; el Excel lo refleja', async ({ page }) => {
  await abrir(page, { '0,2': { texto: 'SP125', confianza: 40 }, '0,3': '1A' });
  await subirYEsperarVista(page, 'recta.png');

  const fila1 = page.locator('#tabla tbody tr').first();
  const carro = fila1.locator('td').nth(1);
  const tacos = fila1.locator('td').nth(2);
  await expect(carro).toHaveClass(/baja_confianza/);
  await expect(tacos).toHaveClass(/invalida/);
  await expect(tacos.locator('input')).toHaveAttribute('title', /no es un número entero/);

  // Corregir la celda roja
  await tacos.locator('input').fill('14');
  await tacos.locator('input').press('Tab');
  await expect(tacos).not.toHaveClass(/invalida/);

  // Borrar la fila 2 y añadir una a mano
  await page.getByRole('button', { name: 'Borrar fila 2' }).click();
  await page.getByRole('button', { name: 'Añadir fila' }).click();
  const nueva = page.locator('#tabla tbody tr').last();
  await nueva.getByLabel(/Talega No\./).fill('999');
  await nueva.getByLabel(/Talega No\./).press('Tab');

  await page.getByRole('button', { name: 'Añadir y pasar otra foto' }).click();
  const { filas, hojas } = await exportar(page);
  expect(filas).toHaveLength(esperado.length); // -1 borrada +1 añadida
  expect(filas[1][4]).toBe(14);
  expect(filas[2][2]).toBe(Number(esperado[3][0])); // la fila 2 original ya no está
  expect(filas.at(-1)![2]).toBe(999);
  // Lo no corregido (lectura dudosa) queda en amarillo y en la hoja Revisión
  expect(hojas['Datos'].rellenos['D2']).toBe('FFFFF2CC');
  expect(hojas['Revisión'].filas).toHaveLength(2);
  expect(hojas['Revisión'].filas[1].slice(0, 4)).toEqual([1, 1, 'Carro No.', 'SP125']);
});
