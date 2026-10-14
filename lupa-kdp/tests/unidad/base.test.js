import assert from 'node:assert/strict';
import { test } from 'node:test';
import { L } from './cargar.js';

test('números de Amazon en castellano y en inglés', () => {
  assert.equal(L.entero('nº 1.315'), 1315);
  assert.equal(L.entero('#1,315'), 1315);
  assert.equal(L.entero('494 calificaciones'), 494);
  assert.equal(L.entero('sin cifras'), null);
  assert.equal(L.decimal('12,99'), 12.99);
  assert.equal(L.decimal('5,99 €'), 5.99);
  assert.equal(L.decimal('$12.99'), 12.99);
  assert.equal(L.decimal('1.234,50 €'), 1234.5);
  assert.equal(L.decimal('$1,234.50'), 1234.5);
  assert.equal(L.decimal('1,234'), 1234);
  assert.equal(L.decimal('4,8'), 4.8);
  assert.equal(L.decimal('4.5'), 4.5);
  assert.equal(L.decimal('1.234'), 1234);
  assert.equal(L.decimal('0,123'), 0.123);
  assert.equal(L.decimal(''), null);
});

test('formatos para el panel', () => {
  assert.equal(L.dinero(12.99, 'EUR'), '12,99 €');
  assert.equal(L.dinero(3.2789, 'EUR'), '3,28 €');
  assert.match(L.dinero(12.99, 'USD'), /^12,99 US\$$/);
  assert.equal(L.miles(1315), '1.315');
  assert.equal(L.miles(1234567), '1.234.567');
  assert.equal(L.cifra(23.4), '23');
  assert.equal(L.cifra(3.26), '3,3');
  assert.equal(L.cifra(0.456), '0,46');
  assert.equal(L.cifra(0.0123), '0,012');
  assert.equal(L.porcentaje(0.6), '60 %');
});

test('fechas de publicación escritas de varias formas', () => {
  assert.equal(L.fechaTexto('28 febrero 2025'), '2025-02-28');
  assert.equal(L.fechaTexto('28 de febrero de 2025'), '2025-02-28');
  assert.equal(L.fechaTexto('February 28, 2025'), '2025-02-28');
  assert.equal(L.fechaTexto('3 sept. 2024'), '2024-09-03');
  assert.equal(L.fechaTexto('Independently published (14 octubre 2026)'), '2026-10-14');
  assert.equal(L.fechaTexto('2026-10-14'), '2026-10-14');
  assert.equal(L.fechaTexto('sin fecha'), null);
  assert.equal(L.fechaBonita('2025-02-28'), '28 feb 2025');
});

test('textos limpios sin marcas invisibles de Amazon', () => {
  assert.equal(L.limpiar('Editorial ‏ : ‎ Independently published'), 'Editorial : Independently published');
  assert.equal(L.normalizar('  Clasificación   EN Libros '), 'clasificacion en libros');
});
