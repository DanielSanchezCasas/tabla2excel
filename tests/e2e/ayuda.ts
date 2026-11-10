import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { expect, type Download, type Page } from '@playwright/test';

export const FIXTURES = 'tests/fixtures';
export const simulado = JSON.parse(readFileSync(`${FIXTURES}/ocr-simulado.json`, 'utf-8'));
export const esperado = readFileSync(`${FIXTURES}/esperado.csv`, 'utf-8')
  .trim()
  .split('\n')
  .map((l) => l.split(';'));

/** Abre la herramienta con el OCR simulado (respuestas de las fixtures, con cambios opcionales). */
export async function abrir(page: Page, cambios: Record<string, unknown> = {}) {
  const respuestas = { ...simulado, celdas: { ...simulado.celdas, ...cambios } };
  await page.addInitScript((r) => (window.__tabla2excelOcrSimulado = r), respuestas);
  await page.goto('./');
  await page.getByText('Lote: 0 de 10 fotos').waitFor();
}

export async function subir(page: Page, imagen: string) {
  // La carga se habilita cuando la app termina de iniciar
  await expect(page.locator('#archivo')).toBeEnabled();
  await page.locator('#archivo').setInputFiles(`${FIXTURES}/imagenes/${imagen}`);
}

export async function subirYEsperarVista(page: Page, imagen: string) {
  await subir(page, imagen);
  await page.locator('#vista').waitFor({ state: 'visible', timeout: 45_000 });
}

export async function exportar(page: Page) {
  const [descarga] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exportar Excel' }).click(),
  ]);
  return leerExcel(descarga);
}

interface Hoja {
  filas: unknown[][];
  /** dirección de celda → color ARGB */
  rellenos: Record<string, string>;
}

export async function leerExcel(descarga: Download) {
  const salida = execFileSync('node', ['tests/e2e/leer-xlsx.mjs', (await descarga.path())!], {
    encoding: 'utf-8',
  });
  const hojas: Record<string, Hoja> = JSON.parse(salida);
  return { hojas, nombre: descarga.suggestedFilename(), filas: hojas['Datos'].filas };
}

export const fechaExcel = (anio: number, mes: number, dia: number) => ({
  fecha: new Date(Date.UTC(anio, mes - 1, dia)).toISOString(),
});

/** Texto como queda en el CSV esperado (vacío = '') */
export const comoTexto = (v: unknown) => (v === undefined || v === null ? '' : String(v));
