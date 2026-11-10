import { expect, test } from '@playwright/test';
import { esperado, subirYEsperarVista } from './ayuda';

// Con el OCR REAL (Tesseract): verifica que nada sale del propio sitio y da una idea de la precisión.
test('con el OCR real, ninguna petición sale del propio sitio', async ({ page, browserName, baseURL }) => {
  test.skip(browserName !== 'chromium', 'Prueba lenta: basta con un navegador');
  test.setTimeout(240_000);
  const origen = new URL(baseURL!).origin;
  const peticiones: string[] = [];
  page.on('request', (r) => peticiones.push(r.url()));

  await page.goto('./');
  await subirYEsperarVista(page, 'recta.png').catch(async () => {
    throw new Error(`No terminó: ${await page.locator('#aviso').textContent()}`);
  });

  const externas = peticiones.filter(
    (u) => !u.startsWith(origen) && !u.startsWith('blob:') && !u.startsWith('data:'),
  );
  expect(externas).toEqual([]);

  // Precisión orientativa sobre la fixture sintética (no es el criterio de aceptación: ver T028)
  const leidas = await page
    .locator('#tabla tbody tr')
    .evaluateAll((trs) => trs.map((tr) => [...tr.querySelectorAll('input')].map((i) => i.value)));
  let bien = 0;
  let total = 0;
  esperado.slice(1).forEach((fila, i) =>
    fila.forEach((v, k) => {
      total++;
      if ((leidas[i]?.[k] ?? '') === v) bien++;
    }),
  );
  console.log(
    `OCR real sobre fixture sintética: ${bien}/${total} celdas (${Math.round((100 * bien) / total)} %)`,
  );
  console.log(`Fecha leída: ${await page.locator('#fecha-leida').textContent()}`);
});
