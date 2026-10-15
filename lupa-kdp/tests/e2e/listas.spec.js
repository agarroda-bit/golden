// Simulacro de búsquedas y «Los más vendidos»: «Ver ventas» y «Analizar página».
import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { abrirConExtension, esperarEnSW, fichaPara, fichasPedidas, historial, leerFixture, servirAmazon } from '../ayuda.js';

let ext;
test.beforeEach(async () => {
  ext = await abrirConExtension();
});
test.afterEach(async () => {
  await ext.cerrar();
});

const BUSQUEDA = 'https://www.amazon.es/s?k=sopa+de+letras+letra+grande&i=stripbooks';
const bsrDe = (asin) => 1000 + (parseInt(asin.slice(-4), 36) % 40) * 500;

async function pausaCorta() {
  await ext.sw.evaluate(() => chrome.storage.local.set({ modoPruebas: { pausa: [150, 250] } }));
}

test('búsqueda real: un botón «Ver ventas» por libro y la estimación debajo, sin salir de la página', async () => {
  const registro = [];
  await servirAmazon(ext.contexto, [[/\/s\?k=/, 'busqueda-real-sopa.html'], [/\/dp\/([A-Z0-9]{10})/, (url) => fichaPara(url.match(/\/dp\/([A-Z0-9]{10})/)[1], 1315)]], { registro });
  const p = await ext.contexto.newPage();
  await p.goto(BUSQUEDA);
  await expect(p.locator('lupa-kdp-tarjeta')).toHaveCount(21);
  await expect(p.locator('lupa-kdp-barra [data-cuenta]')).toHaveText('21 libros');
  const tarjeta = p.locator('lupa-kdp-tarjeta[data-asin="B0DZ2439GN"]');
  await tarjeta.locator('[data-ver]').click();
  await expect(tarjeta.locator('.resultado')).toContainText('≈ 23 al día · 687 al mes · BSR nº 1.315 · regalía 0,40 €');
  await expect(tarjeta.locator('.chip')).toHaveText('EE. UU. sin calibrar');
  expect(p.url()).toBe(BUSQUEDA);
  expect(fichasPedidas(registro).map((x) => x.asin)).toEqual(['B0DZ2439GN']);
  const [h] = await historial(ext.sw);
  expect(h.lecturas[0]).toMatchObject({ bsr: 1315, precio: 5.99, origen: 'ver-ventas' });
});

test('«Analizar página»: lee todos los libros de la página de uno en uno, resumen con total y CSV', async () => {
  await pausaCorta();
  const registro = [];
  await servirAmazon(ext.contexto, [[/\/s\?k=/, 'busqueda-real-sopa.html'], [/\/dp\/([A-Z0-9]{10})/, (url) => { const a = url.match(/\/dp\/([A-Z0-9]{10})/)[1]; return fichaPara(a, bsrDe(a)); }]], { registro });
  const p = await ext.contexto.newPage();
  await p.goto(BUSQUEDA);
  await expect(p.locator('lupa-kdp-tarjeta')).toHaveCount(21);
  await p.locator('lupa-kdp-barra [data-accion="analizar"]').click();
  await expect(p.locator('lupa-kdp-barra [data-progreso-texto]')).toContainText('Hecho. 21 libros leídos · 21 fichas pedidas a Amazon.', { timeout: 60_000 });
  const pedidas = fichasPedidas(registro).map((x) => x.asin);
  const enPagina = await p.locator('lupa-kdp-tarjeta').evaluateAll((els) => els.map((x) => x.dataset.asin));
  // Solo fichas de libros que están en la página, cada una una vez y en su orden; nada más.
  expect(pedidas).toEqual(enPagina);
  expect(registro.filter((r) => r.tipo === 'fetch' && !/\/dp\//.test(r.url))).toEqual([]);
  // Resumen ordenado por ventas al día, con fila de total.
  const dias = await p.locator('lupa-kdp-tarjeta .resultado').evaluateAll((els) => els.map((x) => Number(x.dataset.ventasDia)));
  expect(dias.every((x) => x > 0)).toBe(true);
  await expect(p.locator('lupa-kdp-barra [data-resumen] tbody tr')).toHaveCount(22);
  await expect(p.locator('lupa-kdp-barra [data-resumen] tr.total')).toContainText('Total de la página (21 libros)');
  const totalMes = Number(await p.locator('lupa-kdp-barra [data-total-mes]').getAttribute('data-total-mes'));
  expect(totalMes).toBeCloseTo(dias.reduce((a, b) => a + b, 0) * 30, 3);
  const [descarga] = await Promise.all([p.waitForEvent('download'), p.locator('lupa-kdp-barra [data-accion="csv-pagina"]').click()]);
  expect(descarga.suggestedFilename()).toMatch(/^lupa-kdp-busqueda_.*\.csv$/);
  const csv = fs.readFileSync(await descarga.path(), 'utf8');
  expect(csv.slice(1).split('\r\n')[0]).toBe('Puesto en la lista;ASIN;Título;Autor;Formato;Precio;Moneda;Páginas;Fecha de publicación;Reseñas;Nota;BSR general;Categoría del BSR;Ventas/día estimadas;Ventas/mes estimadas;Curva usada;Regalía por ejemplar;Regalía al mes;Patrocinado;Enlace');
  expect(csv.trim().split('\r\n')).toHaveLength(22);
  expect(await historial(ext.sw)).toHaveLength(21);
});

test('como mucho 30 fichas por página: en una página de 35 libros se para en 30 y lo dice', async () => {
  await pausaCorta();
  // 35 tarjetas: las 21 reales más 14 copias con otros ASIN.
  const base = leerFixture('busqueda-real-sopa.html');
  const tarjeta = base.match(/<div role="listitem" data-asin="B0DZ2439GN"[\s\S]*?(?=<div role="listitem" data-asin="B0CVFDTJFP")/)[0];
  const extra = Array.from({ length: 14 }, (_, i) => tarjeta.replaceAll('B0DZ2439GN', `B0EXTRA${String(i).padStart(3, '0')}`)).join('');
  const grande = base.replace('<div role="listitem" data-asin="B0CVFDTJFP"', `${extra}<div role="listitem" data-asin="B0CVFDTJFP"`);
  const registro = [];
  await servirAmazon(ext.contexto, [[/\/s\?k=/, () => grande], [/\/dp\/([A-Z0-9]{10})/, (url) => fichaPara(url.match(/\/dp\/([A-Z0-9]{10})/)[1], 2000)]], { registro });
  const p = await ext.contexto.newPage();
  await p.goto(BUSQUEDA);
  await expect(p.locator('lupa-kdp-tarjeta')).toHaveCount(35);
  await p.locator('lupa-kdp-barra [data-accion="analizar"]').click();
  await expect(p.locator('lupa-kdp-barra [data-progreso-texto]')).toContainText('Se ha llegado al máximo de 30 fichas en esta página', { timeout: 90_000 });
  expect(fichasPedidas(registro)).toHaveLength(30);
  await expect(p.locator('lupa-kdp-tarjeta .resultado')).toHaveCount(30);
  // Volver a pulsar no pide ni una ficha más.
  await p.locator('lupa-kdp-barra [data-accion="analizar"]').click();
  await expect(p.locator('lupa-kdp-barra [data-progreso-texto]')).toContainText('máximo de 30 fichas');
  expect(fichasPedidas(registro)).toHaveLength(30);
});

test('si Amazon pide comprobar que eres una persona a mitad de análisis, se para del todo y avisa', async () => {
  await pausaCorta();
  const registro = [];
  let n = 0;
  await servirAmazon(ext.contexto, [[/\/s\?k=/, 'busqueda-real-sopa.html'], [/\/dp\/([A-Z0-9]{10})/, (url) => (++n === 3 ? leerFixture('robot-seguir-comprando.html') : fichaPara(url.match(/\/dp\/([A-Z0-9]{10})/)[1], 1500))]], { registro });
  const p = await ext.contexto.newPage();
  await p.goto(BUSQUEDA);
  await p.locator('lupa-kdp-barra [data-accion="analizar"]').click();
  await expect(p.locator('lupa-kdp-barra [data-alerta]')).toContainText('Amazon ha pedido comprobar que eres una persona. Lupa se ha parado', { timeout: 30_000 });
  await p.waitForTimeout(1500);
  expect(fichasPedidas(registro)).toHaveLength(3);
  await expect(p.locator('lupa-kdp-barra [data-accion="analizar"]')).toBeDisabled();
  // «Ver ventas» en otro libro tampoco pide nada a Amazon.
  await p.locator('lupa-kdp-tarjeta').nth(10).locator('[data-ver]').click();
  await expect(p.locator('lupa-kdp-tarjeta').nth(10).locator('.resultado')).toContainText('Amazon ha pedido comprobar que eres una persona');
  expect(fichasPedidas(registro)).toHaveLength(3);
  expect(await ext.sw.evaluate(() => chrome.action.getBadgeText({}))).toBe('!');
});

test('una ficha leída hace menos de 60 minutos sale del historial y no se pide a Amazon', async () => {
  await pausaCorta();
  const registro = [];
  await servirAmazon(ext.contexto, [[/\/s\?k=/, 'busqueda-real-sopa.html'], [/\/dp\/([A-Z0-9]{10})/, (url) => fichaPara(url.match(/\/dp\/([A-Z0-9]{10})/)[1], 1315)]], { registro });
  const p = await ext.contexto.newPage();
  await p.goto('https://www.amazon.es/dp/B0DZ2439GN');
  await expect(p.locator('lupa-kdp-panel')).toHaveCount(1);
  await esperarEnSW(ext.sw, async () => (await chrome.storage.local.get('h:amazon.es:B0DZ2439GN'))['h:amazon.es:B0DZ2439GN']);
  registro.length = 0;
  await p.goto(BUSQUEDA);
  const tarjeta = p.locator('lupa-kdp-tarjeta[data-asin="B0DZ2439GN"]');
  await tarjeta.locator('[data-ver]').click();
  await expect(tarjeta.locator('.resultado')).toContainText('(del historial, leída hace 0 min)');
  expect(fichasPedidas(registro)).toHaveLength(0);
});

test('«Los más vendidos»: encuentra los libros con cualquiera de sus formas de llevar el ASIN', async () => {
  await pausaCorta();
  await servirAmazon(ext.contexto, [[/\/gp\/bestsellers\//, 'mas-vendidos-sintetica.html'], [/\/dp\/([A-Z0-9]{10})/, (url) => fichaPara(url.match(/\/dp\/([A-Z0-9]{10})/)[1], 900)]]);
  const p = await ext.contexto.newPage();
  await p.goto('https://www.amazon.es/gp/bestsellers/books/902491031');
  await expect(p.locator('lupa-kdp-tarjeta')).toHaveCount(5);
  expect(await p.locator('lupa-kdp-tarjeta').evaluateAll((els) => els.map((x) => x.dataset.asin))).toEqual(['B0DZ2439GN', 'B0CFZC8PJ4', 'B09NKWGN7L', 'B0F7XHKQPX', 'B0KINDLE01']);
  await expect(p.locator('lupa-kdp-barra')).toContainText('en esta lista de «Los más vendidos»');
  await p.locator('lupa-kdp-tarjeta[data-asin="B09NKWGN7L"] [data-ver]').click();
  await expect(p.locator('lupa-kdp-tarjeta[data-asin="B09NKWGN7L"] .resultado')).toContainText('BSR nº 900');
});

test('ritmo de persona de verdad: entre ficha y ficha pasan de 4 a 6 segundos', async () => {
  test.setTimeout(90_000);
  const registro = [];
  await servirAmazon(ext.contexto, [[/\/gp\/bestsellers\//, 'mas-vendidos-sintetica.html'], [/\/dp\/([A-Z0-9]{10})/, (url) => fichaPara(url.match(/\/dp\/([A-Z0-9]{10})/)[1], 900)]], { registro });
  const p = await ext.contexto.newPage();
  await p.goto('https://www.amazon.es/gp/bestsellers/books/902491031');
  await p.locator('lupa-kdp-barra [data-accion="analizar"]').click();
  await expect(p.locator('lupa-kdp-barra [data-progreso-texto]')).toContainText('siguiente ficha en', { timeout: 10_000 });
  await expect(p.locator('lupa-kdp-barra [data-progreso-texto]')).toContainText('Hecho. 5 libros leídos · 5 fichas pedidas a Amazon.', { timeout: 60_000 });
  const horas = fichasPedidas(registro).map((x) => x.hora);
  expect(horas).toHaveLength(5);
  for (let i = 1; i < horas.length; i++) {
    const hueco = horas[i] - horas[i - 1];
    expect(hueco).toBeGreaterThanOrEqual(3900);
    expect(hueco).toBeLessThanOrEqual(6800);
  }
});
