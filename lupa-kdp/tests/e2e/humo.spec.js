// Prueba de humo: la extensión carga, el service worker arranca y entrega las fuentes de la casa.
import { expect, test } from '@playwright/test';
import { abrirConExtension } from '../ayuda.js';

let ext;
test.beforeEach(async () => {
  ext = await abrirConExtension();
});
test.afterEach(async () => {
  await ext.cerrar();
});

test('carga la extensión y el service worker contesta', async () => {
  const r = await ext.sw.evaluate(async () => {
    const c = await globalThis.LUPA_SW.contexto();
    return { tieneCurvas: globalThis.LUPA.CURVAS_FABRICA.length, ajustes: c.ajustes, version: chrome.runtime.getManifest().version };
  });
  expect(r).toEqual({ tieneCurvas: 2, ajustes: {}, version: '0.1.0' });
});

test('la página de Opciones se abre sin errores y enseña las curvas de fábrica con su fuente', async () => {
  const errores = [];
  const p = await ext.contexto.newPage();
  p.on('pageerror', (e) => errores.push(String(e)));
  p.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
  await p.goto(`chrome-extension://${ext.extensionId}/opciones/opciones.html`);
  await expect(p.locator('[data-curva]')).toHaveCount(2);
  await expect(p.locator('[data-curva="ee-uu-impreso"]')).toContainText('bookcoverslab.com');
  await expect(p.locator('[data-curva="ee-uu-kindle"]')).toContainText('profitable.app');
  expect(errores).toEqual([]);
});
