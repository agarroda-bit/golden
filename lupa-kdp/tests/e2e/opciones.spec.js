// Simulacro de la página de Opciones: curvas, calibración con un informe de KDP, historial y regalía.
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { FIXTURES, abrirConExtension, servirAmazon } from '../ayuda.js';

let ext;
test.beforeEach(async () => {
  ext = await abrirConExtension();
});
test.afterEach(async () => {
  await ext.cerrar();
});

async function abrirOpciones(pestana) {
  const p = await ext.contexto.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(String(e)));
  await p.goto(`chrome-extension://${ext.extensionId}/opciones/opciones.html${pestana ? `?pestana=${pestana}` : ''}`);
  await expect(p.locator('body[data-listo="1"]')).toHaveCount(1);
  p.errores = errores;
  return p;
}

/** Historial como si Rodri hubiera abierto sus fichas: lecturas del CSV con su fecha y hora. */
async function historialDeRodri() {
  const csv = fs.readFileSync(path.join(FIXTURES, 'lecturas-bsr.csv'), 'utf8').replace(/^﻿/, '').trim().split(/\r?\n/).slice(1);
  const lecturas = csv.map((l) => l.split(';')).map(([f, asin, bsr, , formato]) => ({ f: new Date(f.replace(' ', 'T') + ':00').toISOString(), asin, bsr: Number(bsr), formato }));
  const isbns = { B0BR000001: '979-8000000011', B0BR000002: '979-8000000028', B0BR000003: '979-8000000035' };
  await ext.sw.evaluate(async ({ lecturas, isbns }) => {
    const L = globalThis.LUPA;
    const por = {};
    for (const x of lecturas) {
      const ficha = { ok: true, tienda: 'amazon.es', asin: x.asin, url: `https://www.amazon.es/dp/${x.asin}`, titulo: `Libro ${x.asin}`, formato: x.formato, isbn13: isbns[x.asin] || null, precio: 12.99, moneda: 'EUR', bsr: { general: x.bsr, categoriaGeneral: 'Libros', categorias: [] } };
      por[x.asin] = L.historial.anadir(por[x.asin] || null, ficha, 'ficha', x.f).entrada;
    }
    const cambios = {};
    for (const [asin, e] of Object.entries(por)) cambios[`h:amazon.es:${asin}`] = e;
    await chrome.storage.local.set(cambios);
  }, { lecturas, isbns });
}

test('curvas: qué curva usa cada tienda y crear una curva propia (con comprobación)', async () => {
  const p = await abrirOpciones('curvas');
  await expect(p.locator('#asignacion tbody tr')).toHaveCount(2);
  await expect(p.locator('[data-etiqueta-asignada="amazon.es|impreso"]')).toHaveText('Estimación EE. UU. — sin calibrar para España');
  await p.fill('#cp-nombre', 'Mi tabla de España');
  await p.fill('#cp-puntos', '1000;5\n500;9');
  await p.click('#cp-comprobar');
  await expect(p.locator('#cp-resultado')).toContainText('ERROR');
  await expect(p.locator('#cp-resultado')).toContainText('de menor a mayor');
  await p.fill('#cp-puntos', '1.000;5\n10.000;0,8\n100.000;0,1');
  await p.click('#cp-comprobar');
  await expect(p.locator('#cp-resultado')).toContainText('Correcta BSR 1.000 → 5 al día · BSR 10.000 → 0,8 al día · BSR 100.000 → 0,1 al día');
  await p.click('#cp-guardar');
  await expect(p.locator('[data-curva-propia]')).toHaveCount(1);
  await p.locator('select[data-asignar="amazon.es|impreso"]').selectOption({ label: 'Mi tabla de España' });
  await expect(p.locator('[data-etiqueta-asignada="amazon.es|impreso"]')).toHaveText('Curva propia «Mi tabla de España»');
  const a = await ext.sw.evaluate(async () => (await chrome.storage.local.get('asignacion')).asignacion);
  expect(a['amazon.es'].impreso).toMatch(/^propia-/);
  expect(a['amazon.com'].impreso).toBe('ee-uu-impreso');
  expect(p.errores).toEqual([]);
});

test('calibración: informe de KDP + lecturas de BSR → curva con su nº de puntos, y el panel la usa', async () => {
  await historialDeRodri();
  const p = await abrirOpciones('calibracion');
  await expect(p.locator('[data-resumen-lecturas]')).toContainText('En el historial de Lupa hay 4 libros con');
  await p.setInputFiles('#cal-informe', path.join(FIXTURES, 'kdp-pedidos-diarios.xlsx'));
  await expect(p.locator('[data-resumen-informe]')).toContainText('kdp-pedidos-diarios.xlsx');
  await expect(p.locator('[data-resumen-informe]')).toContainText('del 01/08/2026 al');
  await expect(p.locator('[data-resumen-informe]')).toContainText('(por días)');
  await p.click('#cal-calcular');
  const puntos = Number(await p.locator('[data-puntos]').first().getAttribute('data-puntos'));
  expect(puntos).toBeGreaterThan(130);
  await expect(p.locator('#cal-resultado')).toContainText('puntos de datos usados');
  await expect(p.locator('#cal-resultado svg.grafica circle').first()).toBeAttached();
  await p.locator('[data-usar-curva]').click();
  await expect(p.locator('[data-curva-usada]')).toContainText(`Calibrada con tus ventas de Amazon.es · ${puntos} puntos de datos`);
  // El panel de una ficha de Amazon.es ya sale con la curva calibrada.
  await servirAmazon(ext.contexto, [[/\/dp\/B0DZ2439GN/, 'ficha-sintetica-sopa.html']]);
  const amazon = await ext.contexto.newPage();
  await amazon.goto('https://www.amazon.es/dp/B0DZ2439GN');
  await expect(amazon.locator('lupa-kdp-panel [data-etiqueta]')).toHaveText(`Calibrada con tus ventas de Amazon.es · ${puntos} puntos de datos`);
  await expect(amazon.locator('lupa-kdp-panel [data-etiqueta]')).toHaveClass(/ok/);
  // Y la de Amazon.com sigue siendo la de EE. UU.
  await p.reload();
  await p.click('nav button[data-pestana="curvas"]');
  await expect(p.locator('[data-etiqueta-asignada="amazon.com|impreso"]')).toHaveText('Estimación EE. UU. — tablas públicas, orientativa');
  expect(p.errores).toEqual([]);
});

test('calibración: columnas que no se reconocen se eligen a mano; con pocos datos no calibra', async () => {
  await historialDeRodri();
  const p = await abrirOpciones('calibracion');
  const raro = path.join(ext.contexto._perfilTmp || FIXTURES, '..', '.tmp-informe-raro.csv');
  fs.writeFileSync(raro, '\ufeffDía;Libro;Vendidos\n03/08/2026;B0BR000002;2\n05/08/2026;B0BR000002;1\n');
  await p.setInputFiles('#cal-informe', raro);
  fs.rmSync(raro);
  const caja = p.locator('[data-elegir-hoja]');
  await expect(caja).toContainText('elige las columnas');
  await caja.locator('[data-columna="fila"]').selectOption('0');
  await caja.locator('[data-columna="fecha"]').selectOption('0');
  await caja.locator('[data-columna="id"]').selectOption('1');
  await caja.locator('[data-columna="unidades"]').selectOption('2');
  await caja.locator('[data-usar-columnas]').click();
  await expect(p.locator('[data-resumen-informe]')).toContainText('2 filas con ventas, 3 unidades de 1 libros');
  await p.click('#cal-calcular');
  await expect(p.locator('[data-calibracion-error]')).toContainText('ERROR — pocos datos:');
  await expect(p.locator('#cal-resultado [data-puntos]')).toContainText(/^\d puntos de datos \(2 con ventas\)\.$/);
});

test('historial: tabla con total, CSV y quitar un libro', async () => {
  await historialDeRodri();
  const p = await abrirOpciones('historial');
  await expect(p.locator('#historial tbody tr[data-libro]')).toHaveCount(4);
  await expect(p.locator('#historial tr.total')).toContainText('4 libros');
  const [descarga] = await Promise.all([p.waitForEvent('download'), p.click('#hist-csv')]);
  const csv = fs.readFileSync(await descarga.path(), 'utf8');
  const lineas = fs.readFileSync(path.join(FIXTURES, 'lecturas-bsr.csv'), 'utf8').trim().split(/\r?\n/).length - 1;
  expect(csv.trim().split('\r\n').length - 1).toBeLessThanOrEqual(lineas);
  expect(csv.trim().split('\r\n').length - 1).toBeGreaterThan(lineas * 0.8);
  await p.locator('[data-quitar-libro="amazon.es|B0BR000003"]').click();
  await p.locator('[role="dialog"] [data-r="si"]').click();
  await expect(p.locator('#historial tbody tr[data-libro]')).toHaveCount(3);
});

test('regalía: umbral del 60 % cambiado en Opciones se aplica en el panel', async () => {
  const p = await abrirOpciones('ajustes');
  await p.fill('#aj-umbral', '0');
  await p.click('#aj-guardar');
  await expect(p.locator('#aj-aviso')).toContainText('Guardado');
  await servirAmazon(ext.contexto, [[/\/dp\/B0DZ2439GN/, 'ficha-sintetica-sopa.html']]);
  const amazon = await ext.contexto.newPage();
  await amazon.goto('https://www.amazon.es/dp/B0DZ2439GN');
  // 60 % × 5,76 € − 2,48 € = 0,98 €.
  await expect(amazon.locator('lupa-kdp-panel [data-regalia]')).toHaveText('0,98 €');
  await p.click('#aj-defecto');
  await amazon.reload();
  await expect(amazon.locator('lupa-kdp-panel [data-regalia]')).toHaveText('0,40 €');
});
