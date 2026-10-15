import assert from 'node:assert/strict';
import { test } from 'node:test';
import { L } from './cargar.js';

const R = L.regalias;
const cerca = (a, b, eps = 0.006) => assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b}`);

test('tamaño normal o grande a partir de las medidas de la ficha', () => {
  assert.deepEqual(R.tamanoDeMedidas('21.59 x 1.27 x 27.94 cm'), { ok: true, tamano: 'grande', anchoCm: 21.59, altoCm: 27.94 });
  assert.equal(R.tamanoDeMedidas('15.24 x 0.69 x 22.86 cm').tamano, 'normal');
  assert.equal(R.tamanoDeMedidas('8.5 x 0.24 x 11 inches').tamano, 'grande');
  assert.equal(R.tamanoDeMedidas('6 x 0.5 x 9 inches').tamano, 'normal');
  assert.equal(R.tamanoDeMedidas('12,7 x 1,2 x 20,32 cm').tamano, 'normal');
  assert.equal(R.tamanoDeMedidas(null).ok, false);
  assert.match(R.tamanoDeMedidas('21 x 29').motivo, /unidad/);
});

test('costes de impresión de KDP (tablas oficiales, euros y dólares)', () => {
  cerca(R.costeImpresion({ encuadernacion: 'tapa blanda', paginas: 102, tamano: 'grande', moneda: 'EUR' }).coste, 2.48);
  cerca(R.costeImpresion({ encuadernacion: 'tapa blanda', paginas: 100, tamano: 'normal', moneda: 'EUR' }).coste, 2.05);
  cerca(R.costeImpresion({ encuadernacion: 'tapa blanda', paginas: 149, tamano: 'grande', moneda: 'EUR' }).coste, 0.75 + 150 * 0.016);
  cerca(R.costeImpresion({ encuadernacion: 'tapa blanda', paginas: 300, tamano: 'normal', moneda: 'USD' }).coste, 1 + 300 * 0.012);
  cerca(R.costeImpresion({ encuadernacion: 'tapa dura', paginas: 300, tamano: 'normal', moneda: 'USD' }).coste, 9.25);
  cerca(R.costeImpresion({ encuadernacion: 'tapa dura', paginas: 100, tamano: 'grande', moneda: 'EUR' }).coste, 6.35);
  cerca(R.costeImpresion({ encuadernacion: 'tapa blanda', tinta: 'color prémium', paginas: 32, tamano: 'grande', moneda: 'EUR' }).coste, 3.61);
  assert.match(R.costeImpresion({ encuadernacion: 'tapa blanda', tinta: 'color estándar', paginas: 50, tamano: 'normal', moneda: 'EUR' }).motivo, /72 a 600/);
  assert.match(R.costeImpresion({ encuadernacion: 'tapa blanda', paginas: 10, tamano: 'normal', moneda: 'EUR' }).motivo, /24 a 828/);
  assert.equal(R.costeImpresion({ encuadernacion: 'tapa blanda', paginas: null, tamano: 'normal', moneda: 'EUR' }).ok, false);
});

test('regalía de papel en Amazon.es: 60 % del precio sin IVA desde 9,99 €, 50 % por debajo', () => {
  // Estudio KDP Buen Rato: 9,99 € (con IVA) · 102 págs · 8,5×11" → precio sin IVA 9,61 € (< 9,99) → 50 %.
  const a = R.regaliaImpreso({ tienda: 'amazon.es', formato: 'Tapa blanda', precio: 9.99, paginas: 102, medidas: '21.59 x 0.6 x 27.94 cm' });
  assert.equal(a.ok, true);
  assert.equal(a.tasa, 0.5);
  cerca(a.precioSinIva, 9.6058, 0.0001);
  cerca(a.regalia, 0.5 * 9.6058 - 2.48);
  // Libro de la Biblioteca a 12,99 € con IVA y 149 págs. grandes: 60 % × 12,49 − 3,15 = 4,34 €.
  const b = R.regaliaImpreso({ tienda: 'amazon.es', formato: 'Tapa blanda', precio: 12.99, paginas: 149, medidas: '21.59 x 0.86 x 27.94 cm' });
  assert.equal(b.tasa, 0.6);
  cerca(b.regalia, 0.6 * (12.99 / 1.04) - (0.75 + 150 * 0.016));
  assert.match(b.explicacion, /60 % × 12,49 € − 3,15 € de impresión \(tapa blanda, grande, 149 págs\., tinta negra\)/);
  assert.ok(b.avisos.some((x) => /tinta negra/.test(x)));
  assert.equal(b.nota, 'Precio sin el 4 % de IVA: 12,49 €. Paga el 60 % porque el precio sin IVA llega a 9,99 €.');
  assert.equal(a.nota, 'Precio sin el 4 % de IVA: 9,61 €. Paga el 50 % porque el precio sin IVA no llega a 9,99 €.');
});

test('regalía de papel en Amazon.com (sin IVA) y precio que no cubre la impresión', () => {
  const a = R.regaliaImpreso({ tienda: 'amazon.com', formato: 'Paperback', precio: 15, paginas: 300, medidas: '6 x 0.7 x 9 inches' });
  cerca(a.regalia, 0.6 * 15 - (1 + 300 * 0.012));
  const b = R.regaliaImpreso({ tienda: 'amazon.es', formato: 'Tapa blanda', precio: 3.95, paginas: 120, medidas: '21.59 x 0.6 x 27.94 cm' });
  assert.ok(b.regalia < 0);
  assert.ok(b.avisos.some((x) => /no cubre la impresión/.test(x)));
});

test('regalía con precio de catálogo, tamaño elegido a mano y datos que faltan', () => {
  const a = R.regaliaImpreso({ tienda: 'amazon.com', formato: 'Paperback', precio: 12, precioCatalogo: 14.99, paginas: 120, medidas: '8.5 x 0.3 x 11 inches' });
  cerca(a.precio, 14.99);
  assert.ok(a.avisos.some((x) => /precio de catálogo/.test(x)));
  const b = R.regaliaImpreso({ tienda: 'amazon.es', formato: 'Tapa blanda', precio: 10.4, paginas: 120, tamano: 'normal', tamanoElegido: true });
  assert.equal(b.tamano, 'normal');
  assert.ok(b.avisos.some((x) => /elegido por ti/.test(x)));
  assert.match(R.regaliaImpreso({ tienda: 'amazon.es', formato: 'Tapa blanda', precio: null, paginas: 120 }).motivo, /precio/);
  assert.match(R.regaliaImpreso({ tienda: 'amazon.es', formato: 'Tapa blanda', precio: 9.99, paginas: 120 }).motivo, /medidas/);
  assert.match(R.regaliaImpreso({ tienda: 'amazon.es', formato: 'Tapa blanda', precio: 9.99, medidas: '21.59 x 0.6 x 27.94 cm' }).motivo, /páginas/);
});

test('regalía Kindle: 70 % entre 2,99 y 9,99 menos la entrega; 35 % fuera', () => {
  const a = R.regaliaKindle({ tienda: 'amazon.es', formato: 'Versión Kindle', precio: 4.99, tamanoArchivoMB: 2 });
  cerca(a.regalia, 0.7 * (4.99 / 1.04) - 0.2);
  const b = R.regaliaKindle({ tienda: 'amazon.es', formato: 'Versión Kindle', precio: 4.99 });
  cerca(b.regalia, 0.7 * (4.99 / 1.04));
  assert.ok(b.avisos.some((x) => /entrega/.test(x)));
  const c = R.regaliaKindle({ tienda: 'amazon.com', formato: 'Kindle Edition', precio: 0.99 });
  assert.equal(c.tasa, 0.35);
  cerca(c.regalia, 0.3465);
});

test('formatos que no tienen regalía de KDP', () => {
  assert.match(R.regalia({ tienda: 'amazon.es', formato: 'Audiolibro', precio: 10 }).motivo, /Audiolibro/);
  assert.equal(L.tipoFormato('Tapa blanda'), 'impreso');
  assert.equal(L.tipoFormato('Versión Kindle'), 'kindle');
  assert.equal(L.tipoFormato('Kindle Edition'), 'kindle');
  assert.equal(L.tipoFormato('Hardcover'), 'impreso');
  assert.equal(L.encuadernacion('Tapa dura'), 'tapa dura');
});

test('aviso cuando la editorial no es de KDP', () => {
  const kdp = R.regaliaImpreso({ tienda: 'amazon.es', formato: 'Tapa blanda', precio: 12.99, paginas: 120, medidas: '15.24 x 0.7 x 22.86 cm', editorial: 'Independently published' });
  assert.ok(!kdp.avisos.some((x) => /no parece de KDP/.test(x)));
  const otra = R.regaliaImpreso({ tienda: 'amazon.es', formato: 'Tapa blanda', precio: 17, paginas: 224, medidas: '15.24 x 1.4 x 22.86 cm', editorial: 'Ediciones Temas de Hoy' });
  assert.ok(otra.avisos.some((x) => /editorial «Ediciones Temas de Hoy»: no parece de KDP/.test(x)));
});

test('IVA según la dirección de entrega de Amazon.es (5,99 € en Madrid = 5,76 € entregando en Estados Unidos)', () => {
  assert.equal(L.zonaDeEntrega('Madrid 28013'), 'espana');
  assert.equal(L.zonaDeEntrega('Barcelona 08028'), 'espana');
  assert.equal(L.zonaDeEntrega('Palma 07001'), 'espana');
  assert.equal(L.zonaDeEntrega('España'), 'espana');
  assert.equal(L.zonaDeEntrega('Estados Unidos'), 'sin-iva');
  assert.equal(L.zonaDeEntrega('Reino Unido'), 'sin-iva');
  assert.equal(L.zonaDeEntrega('Las Palmas de Gran Canaria 35001'), 'sin-iva');
  assert.equal(L.zonaDeEntrega('Santa Cruz de Tenerife 38001'), 'sin-iva');
  assert.equal(L.zonaDeEntrega('Melilla 52001'), 'sin-iva');
  assert.equal(L.zonaDeEntrega('Francia'), 'ue');
  assert.equal(L.zonaDeEntrega('Portugal'), 'ue');
  assert.equal(L.zonaDeEntrega('Actualizar ubicación'), null);
  assert.equal(L.zonaDeEntrega(''), null);
  const libro = { tienda: 'amazon.es', formato: 'Tapa blanda', paginas: 114, medidas: '15.24 x 0.66 x 22.86 cm' };
  const madrid = R.regaliaImpreso({ ...libro, precio: 5.99, entrega: { texto: 'Madrid 28013', zona: 'espana' } });
  const eeuu = R.regaliaImpreso({ ...libro, precio: 5.76, entrega: { texto: 'Estados Unidos', zona: 'sin-iva' } });
  const sinSaber = R.regaliaImpreso({ ...libro, precio: 5.99 });
  cerca(madrid.precioSinIva, 5.7596, 0.0001);
  assert.equal(eeuu.precioSinIva, 5.76);
  cerca(eeuu.regalia, madrid.regalia, 0.001);
  cerca(sinSaber.regalia, madrid.regalia, 0.0001);
  assert.match(eeuu.avisos.join(' '), /para entregar en «Estados Unidos», ya sin IVA/);
  assert.match(eeuu.nota, /^Paga el 50 %/);
  assert.equal(madrid.avisos.some((a) => /entregar en/.test(a)), false);
  const francia = R.regaliaImpreso({ ...libro, precio: 6.07, entrega: { texto: 'Francia', zona: 'ue' } });
  cerca(francia.precioSinIva, 6.07 / 1.04, 0.0001);
  assert.match(francia.avisos.join(' '), /«Francia», con el IVA de allí y no el 4 % español/);
  // Kindle: lo mismo.
  const k = R.regaliaKindle({ tienda: 'amazon.es', formato: 'Versión Kindle', precio: 4.8, tamanoArchivoMB: 1, entrega: { texto: 'Estados Unidos', zona: 'sin-iva' } });
  assert.equal(k.precioSinIva, 4.8);
  assert.match(k.avisos.join(' '), /ya sin IVA/);
});
