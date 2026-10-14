import assert from 'node:assert/strict';
import { test } from 'node:test';
import { L } from './cargar.js';

test('CSV para Excel: BOM, punto y coma, comillas, decimales con coma y protección contra fórmulas', () => {
  const csv = L.exportar.csv(['A', 'B', 'C'], [['=SUMA(1)', 'texto; con punto y coma', 12.5], ['línea 1\nlínea 2', '"comillas"', -3]]);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  const lineas = csv.slice(1).split('\r\n');
  assert.equal(lineas[0], 'A;B;C');
  assert.equal(lineas[1], `'=SUMA(1);"texto; con punto y coma";12,5`);
  assert.ok(csv.includes('"línea 1\nlínea 2";"""comillas""";-3'));
  assert.ok(csv.endsWith('\r\n'));
});

test('CSV del historial: una fila por lectura con su estimación', () => {
  const ficha = { ok: true, tienda: 'amazon.es', asin: 'B0DZ2439GN', url: 'https://www.amazon.es/dp/B0DZ2439GN', titulo: 'Sopa de letras', autor: 'Martin Littlewolf', formato: 'Tapa blanda', precio: 5.99, moneda: 'EUR', paginas: 224, medidas: '21.59 x 1.3 x 27.94 cm', fechaPublicacion: '2025-02-28', resenas: 494, nota: 4.8, bsr: { general: 1315, categoriaGeneral: 'Libros', categorias: [{ puesto: 3, nombre: 'Sopas de letras' }] } };
  let e = L.historial.anadir(null, ficha, 'ficha', '2026-10-14T20:00:00.000Z').entrada;
  e = L.historial.anadir(e, { ...ficha, bsr: { general: null, motivo: 'no aparece' } }, 'analizar', '2026-10-14T22:00:00.000Z').entrada;
  const csv = L.exportar.csvHistorial([e]);
  const lineas = csv.slice(1).trim().split('\r\n');
  assert.equal(lineas.length, 3);
  assert.equal(lineas[0].split(';').length, L.exportar.COLUMNAS_HISTORIAL.length);
  const c1 = lineas[1].split(';');
  assert.equal(c1[3], 'B0DZ2439GN');
  assert.equal(c1[7], '1315');
  assert.equal(c1[9], 'nº 1.315 en Sopas de letras'.replace('1.315', '3'));
  assert.equal(c1[10], '5,99');
  assert.match(c1[16], /^\d+,?\d*$/);
  assert.equal(c1[18], 'EE. UU. · libros impresos');
  const c2 = lineas[2].split(';');
  assert.match(c2[16], /^ERROR: no aparece/);
});
