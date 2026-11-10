import { expect, test } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { validarPlantilla } from '../../src/nucleo/plantilla';
import { FIXTURES } from './ayuda';

test('crea una plantilla desde una foto, la descarga e importa', async ({ page }, info) => {
  await page.addInitScript(() => (window.__tabla2excelOcrSimulado = { celdas: {} }));
  await page.goto('./#crear-plantilla');
  await page.locator('#editor-foto').setInputFiles(`${FIXTURES}/imagenes/recta.png`);
  await expect(page.locator('#editor-columnas tbody tr')).toHaveCount(14, { timeout: 45_000 });

  await page.getByLabel('Tipo de la columna 2', { exact: true }).selectOption('entero');
  await page.getByLabel('exportar columna 1', { exact: true }).uncheck();
  await page.locator('#editor-id').fill('prueba');

  const [descarga] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Descargar plantilla.json' }).click(),
  ]);
  const json = JSON.parse(readFileSync((await descarga.path())!, 'utf-8'));
  const r = validarPlantilla(json);
  expect(r.ok).toBe(true);
  expect(json.columnas).toHaveLength(14);
  expect(json.columnas[0].exportar).toBe(false);
  expect(json.columnas[1].tipo).toBe('entero');

  // Importar un JSON inválido: mensaje y no cambia nada
  const invalido = info.outputPath('invalida.json');
  writeFileSync(invalido, '{"id":"x"}');
  await page.locator('#editor-importar').setInputFiles(invalido);
  await expect(page.getByRole('alert')).toContainText('no es válida');

  // Importar el JSON descargado: queda activa en este navegador
  const valido = info.outputPath('prueba.json');
  writeFileSync(valido, JSON.stringify(json));
  await page.locator('#editor-importar').setInputFiles(valido);
  await expect(page.getByRole('alert')).toContainText('activa en este navegador');
  await expect(page.locator('#plantilla')).toHaveValue('prueba');
  await expect(page.locator('#convertir')).toBeVisible();
});
