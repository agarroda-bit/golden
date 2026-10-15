// Lupa solo actúa en libros: ni panel en un reloj ni botones en una búsqueda de relojes.
import { expect, test } from '@playwright/test';
import { abrirConExtension, historial, leerFixture, servirAmazon } from '../ayuda.js';

let ext;
test.beforeEach(async () => {
  ext = await abrirConExtension();
});
test.afterEach(async () => {
  await ext.cerrar();
});

test('en la ficha de un reloj no pinta nada ni guarda nada', async () => {
  await servirAmazon(ext.contexto, [[/\/dp\/B0RELOJ001/, 'ficha-sintetica-reloj.html']]);
  const p = await ext.contexto.newPage();
  await p.goto('https://www.amazon.es/dp/B0RELOJ001');
  await p.waitForTimeout(3000);
  await expect(p.locator('lupa-kdp-panel')).toHaveCount(0);
  expect(await historial(ext.sw)).toHaveLength(0);
});

test('en una búsqueda: botones solo en las tarjetas de libros; sin libros, ni barra', async () => {
  const real = leerFixture('busqueda-real-sopa.html');
  // Una tarjeta de un reloj (sin formato de libro) en medio de los libros.
  const reloj = '<div role="listitem" data-asin="B0RELOJ001" data-component-type="s-search-result" class="s-result-item s-asin"><div data-cy="title-recipe"><h2 aria-label="Reloj de pulsera para hombre"><span>Reloj de pulsera para hombre</span></h2></div><div data-cy="price-recipe"><span class="a-price"><span class="a-offscreen">39,99 €</span></span></div></div>';
  const mezcla = real.replace('<div role="listitem" data-asin="B0CVFDTJFP"', `${reloj}<div role="listitem" data-asin="B0CVFDTJFP"`);
  const soloRelojes = `<!doctype html><html><body><div class="s-main-slot">${reloj}${reloj.replaceAll('B0RELOJ001', 'B0RELOJ002')}</div></body></html>`;
  await servirAmazon(ext.contexto, [[/\/s\?k=sopa/, () => mezcla], [/\/s\?k=reloj/, () => soloRelojes]]);
  const p = await ext.contexto.newPage();
  await p.goto('https://www.amazon.es/s?k=sopa+de+letras');
  await expect(p.locator('lupa-kdp-tarjeta')).toHaveCount(21);
  await expect(p.locator('lupa-kdp-tarjeta[data-asin="B0RELOJ001"]')).toHaveCount(0);
  await p.goto('https://www.amazon.es/s?k=reloj+hombre');
  await p.waitForTimeout(2500);
  await expect(p.locator('lupa-kdp-tarjeta')).toHaveCount(0);
  await expect(p.locator('lupa-kdp-barra')).toHaveCount(0);
});

test('«Los más vendidos» de otra sección (relojes): nada', async () => {
  await servirAmazon(ext.contexto, [[/\/gp\/bestsellers\//, 'mas-vendidos-sintetica.html']]);
  const p = await ext.contexto.newPage();
  await p.goto('https://www.amazon.es/gp/bestsellers/watches/12345');
  await p.waitForTimeout(2500);
  await expect(p.locator('lupa-kdp-tarjeta')).toHaveCount(0);
  await expect(p.locator('lupa-kdp-barra')).toHaveCount(0);
});
