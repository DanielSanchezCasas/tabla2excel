import { expect, test } from '@playwright/test';
import { abrir, exportar, subir, subirYEsperarVista } from './ayuda';

const añadir = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: 'Añadir y pasar otra foto' }).click();

test('foto por foto: quitar renumera; un error no toca el lote; un solo Excel', async ({ page }) => {
  await abrir(page);
  for (const imagen of ['recta.png', 'rotada.png']) {
    await subirYEsperarVista(page, imagen);
    await añadir(page);
  }
  // Una foto que falla a mitad: mensaje claro y el lote intacto
  await subir(page, 'sin-tabla.png');
  await expect(page.getByRole('alert')).toContainText('No se encontró una tabla');
  await expect(page.getByText('Lote: 2 de 10 fotos')).toBeVisible();

  await subirYEsperarVista(page, 'sombra.png');
  await añadir(page);
  await expect(page.locator('#lote-lista li')).toHaveCount(3);

  await page.getByRole('button', { name: 'Quitar foto 2' }).click();
  await expect(page.locator('#lote-lista li')).toHaveText([/^Foto 1 ·/, /^Foto 2 ·/]);

  const { filas } = await exportar(page);
  const numeros = new Set(filas.slice(1).map((f) => f[1]));
  expect([...numeros]).toEqual([1, 2]);
  expect(filas).toHaveLength(1 + 2 * 16);
});

test('no deja pasar más de 10 fotos', async ({ page }) => {
  test.setTimeout(120_000);
  await abrir(page);
  for (let i = 0; i < 10; i++) {
    await subirYEsperarVista(page, 'recta.png');
    await añadir(page);
  }
  await expect(page.getByText('Lote: 10 de 10 fotos')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('máximo de 10 fotos');
  await expect(page.locator('#archivo')).toBeDisabled();
});

test('avisa antes de salir con fotos sin exportar', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Solo Chromium permite probar beforeunload de forma fiable');
  await abrir(page);
  await subirYEsperarVista(page, 'recta.png');
  await añadir(page);
  const dialogo = page.waitForEvent('dialog');
  await page.close({ runBeforeUnload: true });
  const d = await dialogo;
  expect(d.type()).toBe('beforeunload');
  await d.dismiss();
});
