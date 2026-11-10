import { expect, test } from '@playwright/test';
import { abrir, comoTexto, esperado, exportar, fechaExcel, subir, subirYEsperarVista } from './ayuda';

test('una foto recta → Excel igual al esperado', async ({ page }) => {
  await abrir(page);
  await subirYEsperarVista(page, 'recta.png');

  await expect(page.locator('#fecha')).toHaveValue('2026-10-31');
  await expect(page.locator('#tabla tbody tr')).toHaveCount(esperado.length - 1);

  await page.getByRole('button', { name: 'Añadir y pasar otra foto' }).click();
  await expect(page.getByText('Lote: 1 de 10 fotos')).toBeVisible();

  const { nombre, filas } = await exportar(page);
  expect(nombre).toMatch(/^talegas_\d{4}-\d{2}-\d{2}\.xlsx$/);
  expect(filas[0]).toEqual(['Fecha', 'N.º foto', ...esperado[0]]);
  expect(filas).toHaveLength(esperado.length);
  filas.slice(1).forEach((f, i) => {
    expect(f[0]).toEqual(fechaExcel(2026, 10, 31));
    expect(f[1]).toBe(1);
    expect(esperado[0].map((_, k) => comoTexto(f[k + 2]))).toEqual(esperado[i + 1]);
  });
});

test('una foto sin tabla muestra un mensaje claro y no genera nada', async ({ page }) => {
  await abrir(page);
  await subir(page, 'sin-tabla.png');
  await expect(page.getByRole('alert')).toContainText('No se encontró una tabla en la foto', {
    timeout: 45_000,
  });
  await expect(page.locator('#vista')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Exportar Excel' })).toBeDisabled();
});

test('sin fecha no se puede añadir la foto', async ({ page }) => {
  await page.addInitScript(() => (window.__tabla2excelOcrSimulado = { celdas: { '0,1': '356' } }));
  await page.goto('./');
  await subirYEsperarVista(page, 'recta.png');
  await expect(page.locator('#fecha')).toHaveValue('');
  const anadir = page.getByRole('button', { name: 'Añadir y pasar otra foto' });
  await expect(anadir).toBeDisabled();
  await page.locator('#fecha').fill('2026-10-31');
  await expect(anadir).toBeEnabled();
});
