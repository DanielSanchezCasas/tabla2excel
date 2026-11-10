import { defineConfig, devices } from '@playwright/test';

const PUERTO = 4173;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PUERTO}/tabla2excel/`,
    // El service worker de la PWA interfiere con la interceptación de red de las pruebas
    serviceWorkers: 'block',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Opcional: el Firefox de Playwright no arranca en algunas versiones de macOS (firma de código)
    ...(process.env.E2E_FIREFOX ? [{ name: 'firefox', use: { ...devices['Desktop Firefox'] } }] : []),
    { name: 'celular-webkit', use: { ...devices['iPhone 14'] } },
  ],
  webServer: {
    command: `pnpm build && pnpm preview --port ${PUERTO} --strictPort`,
    url: `http://localhost:${PUERTO}/tabla2excel/`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
