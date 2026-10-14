import assert from 'node:assert/strict';
import { test } from 'node:test';
import { L } from './cargar.js';

const ficha = (bsr, precio = 5.99, extra = {}) => ({
  ok: true, tienda: 'amazon.es', asin: 'B0DZ2439GN', url: 'https://www.amazon.es/dp/B0DZ2439GN', titulo: 'Sopa de Letras en Español - Letra Grande',
  formato: 'Tapa blanda', precio, moneda: 'EUR', paginas: 224, medidas: '21.59 x 1.3 x 27.94 cm', resenas: 494, nota: 4.8,
  bsr: { general: bsr, categoriaGeneral: 'Libros', categorias: [{ puesto: 3, nombre: 'Sopas de letras' }] }, faltan: {}, leido: '2026-10-14T20:00:00.000Z', ...extra,
});

test('cada lectura se guarda con fecha, BSR y precio', () => {
  const { entrada, anadida } = L.historial.anadir(null, ficha(1315), 'ficha', '2026-10-14T20:00:00.000Z');
  assert.equal(anadida, true);
  assert.equal(entrada.asin, 'B0DZ2439GN');
  assert.deepEqual(entrada.lecturas[0], { f: '2026-10-14T20:00:00.000Z', bsr: 1315, cat: 'Libros', cats: [[3, 'Sopas de letras']], precio: 5.99, moneda: 'EUR', resenas: 494, nota: 4.8, origen: 'ficha' });
  assert.equal(entrada.ficha.paginas, 224);
});

test('una lectura igual a la anterior en menos de 30 minutos no se repite', () => {
  let { entrada } = L.historial.anadir(null, ficha(1315), 'ficha', '2026-10-14T20:00:00.000Z');
  let r = L.historial.anadir(entrada, ficha(1315), 'ficha', '2026-10-14T20:10:00.000Z');
  assert.equal(r.anadida, false);
  assert.equal(r.entrada.lecturas.length, 1);
  r = L.historial.anadir(r.entrada, ficha(1290), 'ficha', '2026-10-14T20:12:00.000Z');
  assert.equal(r.anadida, true);
  r = L.historial.anadir(r.entrada, ficha(1290), 'ficha', '2026-10-14T21:00:00.000Z');
  assert.equal(r.anadida, true);
  assert.equal(r.entrada.lecturas.length, 3);
});

test('tendencia del BSR: mejor, peor y cambio desde la anterior', () => {
  let e = null;
  for (const [h, b] of [['2026-10-01T10:00:00Z', 3400], ['2026-10-05T10:00:00Z', 2100], ['2026-10-10T10:00:00Z', 1700], ['2026-10-14T10:00:00Z', 1315]]) e = L.historial.anadir(e, ficha(b), 'ficha', h).entrada;
  const t = L.historial.tendencia(e.lecturas);
  assert.equal(t.conBsr, 4);
  assert.equal(t.mejor, 1315);
  assert.equal(t.peor, 3400);
  assert.ok(Math.abs(t.cambio - (1700 - 1315) / 1700) < 1e-9);
  assert.match(t.texto, /^4 lecturas desde el 01\/10\/2026 · mejor 1\.315 · peor 3\.400 · mejora un 23 % desde la anterior$/);
  const linea = L.historial.linea(t.puntos, 300, 64, 6);
  assert.equal(linea.circulos.length, 4);
  // El BSR más bajo (mejor) queda arriba del todo.
  assert.equal(linea.circulos[3][1], 6);
  assert.equal(linea.circulos[0][1], 58);
});

test('tendencia con una sola lectura o sin BSR', () => {
  const uno = L.historial.anadir(null, ficha(1315), 'ficha', '2026-10-14T10:00:00Z').entrada;
  assert.match(L.historial.tendencia(uno.lecturas).texto, /Primera lectura/);
  const sin = L.historial.anadir(null, ficha(null), 'ficha', '2026-10-14T10:00:00Z').entrada;
  assert.equal(L.historial.tendencia(sin.lecturas).texto, '1 lectura sin BSR');
});

test('ficha reciente para no volver a pedirla a Amazon', () => {
  const e = L.historial.anadir(null, ficha(1315), 'ficha', '2026-10-14T20:00:00.000Z').entrada;
  const ahora = new Date('2026-10-14T20:40:00.000Z').getTime();
  assert.equal(L.historial.fichaReciente(e, 60, ahora).minutos, 40);
  assert.equal(L.historial.fichaReciente(e, 30, ahora), null);
});
