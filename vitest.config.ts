import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Las pruebas de tests/e2e son de Playwright (pnpm test:e2e)
    include: ['tests/unit/**/*.test.ts'],
  },
});
