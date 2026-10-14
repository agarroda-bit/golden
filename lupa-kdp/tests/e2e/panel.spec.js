// Simulacro del panel flotante en la ficha: Amazon.es servido con fichas guardadas (sin internet).
import { expect, test } from '@playwright/test';
import { abrirConExtension, conBsr, esperarEnSW, historial, idPestana, leerFixture, servirAmazon } from '../ayuda.js';

let ext;
test.beforeEach(async () => {
  ext = await abrirConExtension();
});
test.afterEach(async () => {
  await ext.cerrar();
});

const SOPA = 'https://www.amazon.es/Sopa-Letras-Espa%C3%B1ol-Palabras-Adolescentes/dp/B0DZ2439GN/ref=sr_1_1';

async function abrirFicha(url, errores = []) {
  const p = await ext.contexto.newPage();
  p.on('pageerror', (e) => errores.push(String(e)));
  await p.goto(url);
  await expect(p.locator('lupa-kdp-panel')).toHaveCount(1);
  return p;
}

test('ficha de una sopa de letras: ventas, BSR, regalía y etiqueta EE. UU. sin calibrar', async () => {
  await servirAmazon(ext.contexto, [[/\/dp\/B0DZ2439GN/, 'ficha-sintetica-sopa.html']]);
  const errores = [];
  const p = await abrirFicha(SOPA, errores);
  const panel = p.locator('lupa-kdp-panel');
  await expect(panel.locator('[data-etiqueta]')).toHaveText('Estimación EE. UU. — sin calibrar para España');
  // Contador animado: acaba en la cifra exacta de la curva (BSR 1.315 → 22,9 al día).
  const dia = panel.locator('[data-contador="dia"]');
  await expect(dia).toHaveText('23');
  const valor = Number(await dia.getAttribute('data-valor'));
  expect(valor).toBeCloseTo(22.9, 1);
  await expect(panel.locator('[data-contador="mes"]')).toHaveText('687');
  await expect(panel.locator('[data-bsr="1315"]')).toContainText('nº 1.315 en Libros');
  await expect(panel.locator('[data-seccion="bsr"]')).toContainText('nº 3 en Sopas de letras');
  await expect(panel.locator('[data-seccion="bsr"]')).toContainText('nº 12 en Pasatiempos');
  // 5,99 € con IVA → 5,76 € sin IVA (< 9,99 → 50 %) − 2,48 € (104 págs., tamaño grande) = 0,40 €.
  await expect(panel.locator('[data-regalia]')).toHaveText('0,40 €');
  await expect(panel.locator('[data-explica]')).toContainText('50 % × 5,76 € − 2,48 € de impresión (tapa blanda, grande, 104 págs., tinta negra)');
  await expect(panel.locator('[data-regalia-mes]')).toHaveText(/^27[0-9],\d\d € al mes$/);
  await expect(panel.locator('[data-nota-regalia]')).toHaveText('Precio sin el 4 % de IVA: 5,76 €. Paga el 50 % porque el precio sin IVA no llega a 9,99 €.');
  await expect(panel.locator('[data-dato="paginas"]')).toHaveText('104');
  await expect(panel.locator('[data-dato="medidas"]')).toHaveText('grande (21,59 × 27,94 cm)');
  await expect(panel.locator('[data-dato="fechaPublicacion"]')).toHaveText('28 feb 2025');
  await expect(panel.locator('[data-dato="resenas"]')).toHaveText('494');
  await expect(panel.locator('[data-dato="nota"]')).toHaveText('4,8 de 5');
  // Las fuentes de la casa están cargadas en la página.
  expect(await p.evaluate(() => document.fonts.check('16px "Lupa Oswald"') && document.fonts.check('16px "Lupa Rubik"'))).toBe(true);
  expect(errores).toEqual([]);
});

test('libro nuevo sin BSR: ERROR con el motivo en ventas, sin cifra inventada', async () => {
  await servirAmazon(ext.contexto, [[/\/dp\/B0BUENRATO/, 'ficha-sintetica-sin-bsr.html']]);
  const p = await abrirFicha('https://www.amazon.es/dp/B0BUENRATO');
  const panel = p.locator('lupa-kdp-panel');
  await expect(panel.locator('[data-error="ventas"]')).toContainText('ERROR — sin puesto en ventas (BSR) no hay estimación');
  await expect(panel.locator('[data-error="bsr"]')).toContainText('ERROR — no aparece el puesto en ventas (BSR) en la ficha: Amazon no lo enseña en libros que aún no se han vendido');
  await expect(panel.locator('[data-contador]')).toHaveCount(0);
  await expect(panel.locator('[data-dato="resenas"]')).toHaveText('ninguna todavía');
  // 13,51 € con IVA = 12,99 € sin IVA → 60 % − (0,75 + 150 × 0,016) = 4,64 €; sin ventas no hay cifra al mes.
  await expect(panel.locator('[data-regalia]')).toHaveText('4,64 €');
  await expect(panel.locator('[data-seccion="regalia"]')).toContainText('sin ventas estimadas no hay cifra al mes');
  const [h] = await historial(ext.sw);
  expect(h.lecturas).toHaveLength(1);
  expect(h.lecturas[0].bsr).toBeNull();
  expect(h.lecturas[0].sinBsr).toMatch(/no aparece el puesto en ventas/);
});

test('Kindle: curva Kindle, 70 % menos la entrega por MB', async () => {
  await servirAmazon(ext.contexto, [[/\/dp\/B0KINDLE01/, 'ficha-sintetica-kindle.html']]);
  const p = await abrirFicha('https://www.amazon.es/dp/B0KINDLE01');
  const panel = p.locator('lupa-kdp-panel');
  await expect(panel.locator('[data-contador="dia"]')).toHaveText('33');
  await expect(panel.locator('[data-bsr="5432"]')).toContainText('en Tienda Kindle');
  await expect(panel.locator('[data-regalia]')).toHaveText('3,13 €');
  await expect(panel.locator('[data-explica]')).toContainText('70 % × 4,80 € − 0,23 € de entrega');
  await expect(panel.locator('[data-dato="medidas"]')).toHaveText('no aplica (Kindle)');
  await expect(panel.locator('select[data-pref="tinta"]')).toHaveCount(0);
});

test('historial: guarda cada lectura, no repite la misma y enseña la tendencia', async () => {
  let bsr = 3400;
  await servirAmazon(ext.contexto, [[/\/dp\/B0DZ2439GN/, () => conBsr(leerFixture('ficha-sintetica-sopa.html'), bsr)]]);
  const p = await abrirFicha(SOPA);
  await esperarEnSW(ext.sw, async () => (await chrome.storage.local.get('h:amazon.es:B0DZ2439GN'))['h:amazon.es:B0DZ2439GN']);
  await expect(p.locator('lupa-kdp-panel [data-tendencia]')).toContainText('Primera lectura');
  // Misma lectura enseguida: no se duplica.
  await p.reload();
  await expect(p.locator('lupa-kdp-panel [data-tendencia]')).toContainText('Primera lectura');
  // Otros días: se mueve el BSR.
  for (const nuevo of [2100, 1315]) {
    bsr = nuevo;
    await p.reload();
    await expect(p.locator(`lupa-kdp-panel [data-bsr="${nuevo}"]`)).toHaveCount(1);
  }
  await expect(p.locator('lupa-kdp-panel [data-tendencia]')).toContainText('3 lecturas desde el');
  await expect(p.locator('lupa-kdp-panel [data-tendencia]')).toContainText('mejor 1.315 · peor 3.400 · mejora un 37 % desde la anterior');
  await expect(p.locator('lupa-kdp-panel svg.grafica circle')).toHaveCount(3);
  const [h] = await historial(ext.sw);
  expect(h.lecturas.map((l) => l.bsr)).toEqual([3400, 2100, 1315]);
  expect(h.lecturas.every((l) => l.precio === 5.99 && l.f)).toBe(true);
});

test('casilla amarilla «TÚ: tinta»: recalcula la regalía y se recuerda para ese libro', async () => {
  await servirAmazon(ext.contexto, [[/\/dp\/B0DZ2439GN/, 'ficha-sintetica-sopa.html']]);
  const p = await abrirFicha(SOPA);
  const panel = p.locator('lupa-kdp-panel');
  await expect(panel.locator('[data-regalia]')).toHaveText('0,40 €');
  await panel.locator('select[data-pref="tinta"]').selectOption('color estándar');
  // Color estándar: 0,75 + 104 × 0,035 = 4,39 € de impresión → la regalía sale negativa y se avisa.
  await expect(panel.locator('[data-explica]')).toContainText('4,39 € de impresión (tapa blanda, grande, 104 págs., tinta color estándar)');
  await expect(panel.locator('[data-seccion="regalia"] .avisos')).toContainText('el precio no cubre la impresión');
  await p.reload();
  await expect(p.locator('lupa-kdp-panel select[data-pref="tinta"]')).toHaveValue('color estándar');
});

test('plegar, cerrar y volver a abrir con el icono; exportar el CSV desde el panel', async () => {
  await servirAmazon(ext.contexto, [[/\/dp\/B0DZ2439GN/, 'ficha-sintetica-sopa.html']]);
  const p = await abrirFicha(SOPA);
  const panel = p.locator('lupa-kdp-panel');
  await panel.locator('[data-accion="plegar"]').click();
  await expect(panel.locator('.pastilla')).toContainText('23 al día');
  await panel.locator('[data-accion="desplegar"]').click();
  await expect(panel.locator('[data-contador="dia"]')).toHaveText('23');
  await panel.locator('[data-accion="cerrar"]').click();
  await expect(panel.locator('.panel')).toBeHidden();
  const tabId = await idPestana(ext.sw, p);
  const r = await ext.sw.evaluate((id) => chrome.tabs.sendMessage(id, { tipo: 'mostrarPanel' }), tabId);
  expect(r.ok).toBe(true);
  await expect(panel.locator('.panel')).toBeVisible();
  const [descarga] = await Promise.all([p.waitForEvent('download'), panel.locator('[data-accion="csv-todo"]').click()]);
  expect(descarga.suggestedFilename()).toMatch(/^lupa-kdp-historial_\d{4}-\d{2}-\d{2}_\d{4}\.csv$/);
  const csv = await (await import('node:fs')).promises.readFile(await descarga.path(), 'utf8');
  expect(csv.charCodeAt(0)).toBe(0xfeff);
  expect(csv).toContain('Fecha;Hora;Tienda;ASIN;Título');
  expect(csv).toContain(';amazon.es;B0DZ2439GN;Sopa de Letras en Español');
  expect(csv).toContain(';1315;Libros;nº 3 en Sopas de letras | nº 12 en Pasatiempos;5,99;EUR;494;4,8;104;28/02/2025;');
  await expect(panel.locator('[data-estado-biblioteca]')).toContainText('CSV descargado: 1 lectura de 1 libro.');
});

test('si Amazon pide comprobar que eres una persona, Lupa no pinta nada y avisa en el icono', async () => {
  await servirAmazon(ext.contexto, [[/\/dp\//, 'robot-seguir-comprando.html']]);
  const p = await ext.contexto.newPage();
  await p.goto(SOPA);
  await esperarEnSW(ext.sw, async () => (await chrome.action.getBadgeText({})) === '!');
  await expect(p.locator('lupa-kdp-panel')).toHaveCount(0);
  expect(await historial(ext.sw)).toHaveLength(0);
});
