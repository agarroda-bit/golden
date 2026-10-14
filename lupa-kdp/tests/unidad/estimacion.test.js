import assert from 'node:assert/strict';
import { test } from 'node:test';
import { L } from './cargar.js';

const impreso = L.CURVAS_FABRICA.find((c) => c.id === 'ee-uu-impreso');
const kindle = L.CURVAS_FABRICA.find((c) => c.id === 'ee-uu-kindle');
const cerca = (a, b, rel = 0.001) => assert.ok(Math.abs(a - b) <= Math.abs(b) * rel, `${a} ≠ ${b}`);

test('las curvas de fábrica son válidas', () => {
  for (const c of L.CURVAS_FABRICA) assert.deepEqual(L.validarCurva(c), { ok: true, errores: [] });
});

test('en los puntos de la tabla da exactamente la tabla', () => {
  cerca(L.ventasDia(impreso, 1000).valor, 28);
  cerca(L.ventasDia(impreso, 100).valor, 170);
  cerca(L.ventasDia(impreso, 100000).valor, 0.65);
  cerca(L.ventasDia(kindle, 25000).valor, 9.08);
});

test('entre dos puntos interpola en escala logarítmica', () => {
  // Entre 1.000 (28) y 5.000 (8,6): a mitad logarítmica (≈2.236) sale la media geométrica.
  cerca(L.ventasDia(impreso, Math.sqrt(1000 * 5000)).valor, Math.sqrt(28 * 8.6));
  const v = L.ventasDia(impreso, 1315);
  assert.ok(v.valor < 28 && v.valor > 8.6);
  assert.equal(v.fueraDeTabla, false);
});

test('fuera de la tabla prolonga el tramo del extremo y lo avisa', () => {
  const lejos = L.ventasDia(impreso, 1000000);
  assert.equal(lejos.fueraDeTabla, true);
  assert.ok(lejos.valor < 0.65 && lejos.valor > 0);
  const arriba = L.ventasDia(impreso, 10);
  assert.equal(arriba.fueraDeTabla, true);
  assert.ok(arriba.valor > 170);
  // Más BSR, nunca más ventas.
  let anterior = Infinity;
  for (const b of [1, 7, 50, 333, 1000, 4200, 9000, 40000, 99999, 250000, 2e6]) {
    const x = L.ventasDia(impreso, b).valor;
    assert.ok(x <= anterior, `BSR ${b}`);
    anterior = x;
  }
});

test('curva potencia (calibrada) y validación de curvas propias', () => {
  const c = { id: 'cal', nombre: 'Mía', formato: 'impreso', tipo: 'potencia', a: 2000, b: 0.8, rango: [500, 50000], origen: 'calibrada', tienda: 'amazon.es', n: 37 };
  cerca(L.ventasDia(c, 1000).valor, 2000 * 1000 ** -0.8);
  assert.equal(L.ventasDia(c, 100).fueraDeTabla, true);
  assert.equal(L.validarCurva(c).ok, true);
  assert.equal(L.validarCurva({ ...c, b: -1 }).ok, false);
  const mala = { id: 'x', nombre: 'x', formato: 'impreso', tipo: 'tabla', puntos: [[100, 5], [50, 10]] };
  assert.match(L.validarCurva(mala).errores.join(' '), /de menor a mayor/);
  const sube = { id: 'x', nombre: 'x', formato: 'impreso', tipo: 'tabla', puntos: [[100, 5], [500, 10]] };
  assert.match(L.validarCurva(sube).errores.join(' '), /no se puede vender más/);
});

test('etiqueta visible: EE. UU. sin calibrar en Amazon.es; calibrada con nº de puntos', () => {
  assert.equal(L.etiquetaCurva(impreso, 'amazon.es'), 'Estimación EE. UU. — sin calibrar para España');
  assert.match(L.etiquetaCurva(impreso, 'amazon.com'), /^Estimación EE\. UU\./);
  assert.equal(L.etiquetaCurva({ origen: 'calibrada', tienda: 'amazon.es', n: 42, nombre: 'x' }, 'amazon.es'), 'Calibrada con tus ventas de Amazon.es · 42 puntos de datos');
});

test('asignación por tienda y formato', () => {
  assert.equal(L.curvaPara('amazon.es', 'impreso').id, 'ee-uu-impreso');
  assert.equal(L.curvaPara('amazon.es', 'kindle').id, 'ee-uu-kindle');
  const propia = { id: 'cal-es-impreso', nombre: 'Calibrada', formato: 'impreso', tipo: 'potencia', a: 100, b: 0.7, origen: 'calibrada', tienda: 'amazon.es', n: 12 };
  const asignacion = { 'amazon.es': { impreso: 'cal-es-impreso', kindle: 'ee-uu-kindle' } };
  assert.equal(L.curvaPara('amazon.es', 'impreso', asignacion, [propia]).id, 'cal-es-impreso');
  assert.equal(L.curvaPara('amazon.com', 'impreso', asignacion, [propia]).id, 'ee-uu-impreso');
});

test('estimación completa: ventas, regalía y avisos; nunca una cifra sin BSR', () => {
  const ficha = { tienda: 'amazon.es', formato: 'Tapa blanda', precio: 5.99, paginas: 224, medidas: '21.59 x 1.3 x 27.94 cm', bsr: { general: 1315, categoriaGeneral: 'Libros', categorias: [] } };
  const e = L.estimar(ficha);
  assert.equal(e.ventas.ok, true);
  cerca(e.ventas.mes, e.ventas.dia * 30);
  assert.equal(e.etiqueta, 'Estimación EE. UU. — sin calibrar para España');
  assert.equal(e.regalia.ok, true);
  const sin = L.estimar({ ...ficha, bsr: { general: null, motivo: 'no aparece el puesto en ventas' } });
  assert.equal(sin.ventas.ok, false);
  assert.match(sin.ventas.motivo, /no aparece el puesto/);
  assert.equal(sin.regaliaMes, null);
  const audio = L.estimar({ ...ficha, formato: 'Audiolibro' });
  assert.match(audio.ventas.motivo, /Audiolibro/);
});
