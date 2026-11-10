import { expect, test } from '@playwright/test';
import { simulado, subirYEsperarVista } from './ayuda';

test.use({ serviceWorkers: 'allow' });

test('después de la primera visita funciona sin conexión', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'El modo sin conexión con service worker se prueba en Chromium');
  test.setTimeout(120_000);
  await page.addInitScript((r) => (window.__tabla2excelOcrSimulado = r), simulado);
  await page.goto('./');
  // Espera a que el service worker termine de guardar todo (incluidos OpenCV y el idioma)
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    if (reg.active?.state !== 'activated') {
      await new Promise((r) => reg.active?.addEventListener('statechange', r));
    }
  });

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('Lote: 0 de 10 fotos')).toBeVisible();
  await subirYEsperarVista(page, 'recta.png');
  await expect(page.locator('#fecha')).toHaveValue('2026-10-31');
});
