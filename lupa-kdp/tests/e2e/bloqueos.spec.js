// Simulacro de las defensas de Amazon: la pantalla de verificación del navegador (Akamai, real) y la
// comprobación de robot (captcha, real). Lupa nunca intenta saltarlas: se para, avisa y espera.
import { expect, test } from '@playwright/test';
import { abrirConExtension, esperarEnSW, fichaPara, fichasPedidas, leerFixture, servirAmazon } from '../ayuda.js';

let ext;
test.beforeEach(async () => {
  ext = await abrirConExtension();
});
test.afterEach(async () => {
  await ext.cerrar();
});

const BUSQUEDA = 'https://www.amazon.es/s?k=sopa+de+letras+letra+grande&i=stripbooks';
const insignia = () => ext.sw.evaluate(() => chrome.action.getBadgeText({}));
const ultimoBloqueo = () => ext.sw.evaluate(async () => (await chrome.storage.local.get('ultimoBloqueo')).ultimoBloqueo || null);

test('pantalla de verificación en una pestaña: Lupa no pinta ni avisa (el navegador la pasa solo); el captcha sí se avisa', async () => {
  await servirAmazon(ext.contexto, [
    // La prueba de JavaScript de la pantalla: aquí no recarga nada.
    [/\/_sec\/verify/, () => '{"reload": false}'],
    [/bm-verify=|\/dp\/B0DZ2439GN/, 'verificacion-amazon.html'],
    [/\/dp\/B0R0B0T000/, 'robot-seguir-comprando.html'],
  ]);
  const p = await ext.contexto.newPage();
  await p.goto('https://www.amazon.es/dp/B0DZ2439GN');
  await p.waitForTimeout(3000);
  await expect(p.locator('lupa-kdp-panel')).toHaveCount(0);
  expect(await insignia()).toBe('');
  expect(await ultimoBloqueo()).toBeNull();
  // El captcha clásico sí: «!» en el icono y la hora apuntada.
  await p.goto('https://www.amazon.es/dp/B0R0B0T000');
  await esperarEnSW(ext.sw, async () => (await chrome.action.getBadgeText({})) === '!');
  await expect(p.locator('lupa-kdp-panel')).toHaveCount(0);
  expect((await ultimoBloqueo()).url).toBe('https://www.amazon.es/dp/B0R0B0T000');
});

test('«Analizar página» se para si una ficha llega como pantalla de verificación (no la intenta pasar)', async () => {
  await ext.sw.evaluate(() => chrome.storage.local.set({ modoPruebas: { pausa: [150, 250] } }));
  const registro = [];
  let n = 0;
  await servirAmazon(ext.contexto, [[/\/s\?k=/, 'busqueda-real-sopa.html'], [/\/dp\/([A-Z0-9]{10})/, (url) => (++n === 2 ? leerFixture('verificacion-amazon.html') : fichaPara(url.match(/\/dp\/([A-Z0-9]{10})/)[1], 1500))]], { registro });
  const p = await ext.contexto.newPage();
  await p.goto(BUSQUEDA);
  await p.locator('lupa-kdp-barra [data-accion="analizar"]').click();
  await expect(p.locator('lupa-kdp-barra [data-alerta]')).toContainText('Amazon ha pedido comprobar que eres una persona. Lupa se ha parado', { timeout: 30_000 });
  await p.waitForTimeout(1500);
  expect(fichasPedidas(registro)).toHaveLength(2);
  // Ni la prueba de JavaScript de la pantalla ni su recarga: Lupa no hace nada más.
  expect(registro.filter((r) => /_sec\/verify|bm-verify/.test(r.url))).toEqual([]);
  expect(await insignia()).toBe('!');
});

test('tras una comprobación de robot, «Analizar página» espera media hora; «Ver ventas» sí; luego una ficha buena quita el «!»', async () => {
  await ext.sw.evaluate(() => chrome.storage.local.set({ modoPruebas: { pausa: [150, 250] } }));
  const registro = [];
  await servirAmazon(
    ext.contexto,
    [
      [/\/s\?k=/, 'busqueda-real-sopa.html'],
      [/\/dp\/B0R0B0T000/, 'robot-seguir-comprando.html'],
      [/\/dp\/([A-Z0-9]{10})/, (url) => fichaPara(url.match(/\/dp\/([A-Z0-9]{10})/)[1], 1315)],
    ],
    { registro },
  );
  const p = await ext.contexto.newPage();
  await p.goto('https://www.amazon.es/dp/B0R0B0T000');
  await esperarEnSW(ext.sw, async () => (await chrome.action.getBadgeText({})) === '!');

  // Media hora sin «Analizar página»: lo dice con la hora y no pide nada a Amazon.
  await p.goto(BUSQUEDA);
  registro.length = 0;
  await p.locator('lupa-kdp-barra [data-accion="analizar"]').click();
  await expect(p.locator('lupa-kdp-barra [data-alerta]')).toContainText(/Amazon pidió comprobar que eras una persona a las \d\d:\d\d\. Para no volver a molestarle, «Analizar página» no funciona hasta las \d\d:\d\d/);
  await p.waitForTimeout(1000);
  expect(fichasPedidas(registro)).toHaveLength(0);
  // «Ver ventas» libro a libro sí.
  const tarjeta = p.locator('lupa-kdp-tarjeta[data-asin="B0DZ2439GN"]');
  await tarjeta.locator('[data-ver]').click();
  await expect(tarjeta.locator('.resultado')).toContainText('BSR nº 1.315');
  expect(fichasPedidas(registro)).toHaveLength(1);

  // Una ficha buena antes de la media hora no quita el «!».
  await p.goto('https://www.amazon.es/dp/B0DZ2439GN');
  await expect(p.locator('lupa-kdp-panel')).toHaveCount(1);
  await p.waitForTimeout(500);
  expect(await insignia()).toBe('!');
  // Pasada la media hora (se adelanta el reloj del bloqueo), la siguiente ficha buena sí.
  await ext.sw.evaluate(async () => {
    const { ultimoBloqueo } = await chrome.storage.local.get('ultimoBloqueo');
    await chrome.storage.local.set({ ultimoBloqueo: { ...ultimoBloqueo, fecha: new Date(Date.now() - 31 * 60000).toISOString() } });
  });
  await p.reload();
  await expect(p.locator('lupa-kdp-panel')).toHaveCount(1);
  await esperarEnSW(ext.sw, async () => (await chrome.action.getBadgeText({})) === '' && !(await chrome.storage.local.get('ultimoBloqueo')).ultimoBloqueo);
  // Y «Analizar página» vuelve a funcionar.
  await p.goto(BUSQUEDA);
  registro.length = 0;
  await p.locator('lupa-kdp-barra [data-accion="analizar"]').click();
  await expect.poll(() => fichasPedidas(registro).length, { timeout: 30_000 }).toBeGreaterThan(1);
  await p.locator('lupa-kdp-barra [data-accion="parar"]').click();
});
