import { defineConfig } from '@playwright/test';

// Tres grupos de pruebas (como RADAR):
//  - lectores: el lector contra fichas y listas reales de Amazon guardadas (tests/fixtures).
//  - extension: la extensión cargada de verdad en Chromium con Amazon simulado (sin internet).
//  - real: Amazon.es de verdad (solo con «npm run test:real»; ventana visible y perfil temporal).
export default defineConfig({
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  outputDir: '.tmp/resultados-pruebas',
  use: {
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'lectores', testMatch: /tests[\\/]lectores[\\/].*\.spec\.js$/ },
    { name: 'extension', testMatch: /tests[\\/]e2e[\\/].*\.spec\.js$/ },
    { name: 'real', testMatch: /tests[\\/]real[\\/].*\.spec\.js$/, timeout: 30 * 60 * 1000 },
  ],
});
