import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { L } from './cargar.js';

const FIX = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
const leer = (n) => fs.readFileSync(path.join(FIX, n));
const C = L.calibracion;

/** Historial como el que deja Lupa al abrir las fichas de los libros de Rodri. */
function historialDesdeLecturas(lecturas, isbns) {
  const porAsin = new Map();
  for (const x of lecturas) {
    const ficha = {
      ok: true, tienda: 'amazon.es', asin: x.id, titulo: `Libro ${x.id}`, formato: x.formato === 'kindle' ? 'Versión Kindle' : 'Tapa blanda',
      isbn13: isbns[x.id] || null, bsr: { general: x.bsr, categoriaGeneral: 'Libros', categorias: [] }, precio: 12.99, moneda: 'EUR',
    };
    const fecha = new Date(x.f).toISOString();
    porAsin.set(x.id, L.historial.anadir(porAsin.get(x.id) || null, ficha, 'ficha', fecha).entrada);
  }
  return [...porAsin.values()];
}

test('lee un .xlsx de KDP: hojas, filas de título encima de la cabecera y fechas de Excel', async () => {
  const hojas = await L.hojas.leerXlsx(leer('kdp-pedidos-diarios.xlsx'));
  assert.deepEqual(hojas.map((h) => h.nombre), ['Paperback Orders', 'eBook Orders']);
  assert.equal(hojas[0].filas[0][0], 'KDP Orders Report');
  assert.deepEqual(hojas[0].filas[2], ['Date', 'Title', 'Author Name', 'ASIN/ISBN', 'Marketplace', 'Paid Units', 'Free Units']);
  assert.equal(typeof hojas[0].filas[3][0], 'number');
  const inf = C.leerInforme(hojas);
  assert.equal(inf.hojas[0].cabecera, 2);
  assert.ok(inf.ventas.length > 50);
  assert.ok(inf.ventas.every((v) => /^2026-0[89]-\d{2}$/.test(v.dia)));
  assert.ok(inf.ventas.some((v) => v.tienda === 'amazon.com'));
  assert.ok(inf.ventas.filter((v) => v.formato === 'kindle').every((v) => v.id === 'B0BRKINDL1'));
  // Las tapas blandas vienen con su ISBN-13.
  assert.ok(inf.ventas.some((v) => v.id === '9798000000011' && v.formato === 'impreso'));
  const r = C.resumenVentas(inf.ventas);
  assert.equal(r.desde.slice(0, 7), '2026-08');
  assert.equal(r.hasta.slice(0, 7), '2026-09');
});

test('lee un CSV en castellano con «;» y fechas dd/mm/aaaa', () => {
  const hojas = L.hojas.leerCsv(leer('kdp-ventas-castellano.csv').toString('utf8'), 'ventas.csv');
  const inf = C.leerInforme(hojas);
  assert.equal(inf.hojas[0].cabecera, 0);
  assert.deepEqual(Object.keys(inf.hojas[0].columnas).filter((k) => inf.hojas[0].columnas[k] != null).sort(), ['fecha', 'formato', 'id', 'tienda', 'titulo', 'unidades']);
  assert.ok(inf.ventas.every((v) => /^2026-0[89]-\d{2}$/.test(v.dia)));
  assert.ok(inf.ventas.some((v) => v.formato === 'kindle') && inf.ventas.some((v) => v.formato === 'impreso'));
});

test('fechas: número de Excel, ISO, día/mes, mes/día (informe en inglés) y solo mes', () => {
  assert.deepEqual(C.fechaDe(45658), { dia: '2025-01-01' });
  assert.deepEqual(C.fechaDe(46235), { dia: '2026-08-01' });
  assert.deepEqual(C.fechaDe('2026-10-14'), { dia: '2026-10-14' });
  assert.deepEqual(C.fechaDe('14/10/2026'), { dia: '2026-10-14' });
  assert.deepEqual(C.fechaDe('10/14/2026', 'mdy'), { dia: '2026-10-14' });
  assert.equal(C.ordenFechas(['10/14/2026', '10/02/2026']), 'mdy');
  assert.equal(C.ordenFechas(['14/10/2026', '02/10/2026']), 'dmy');
  assert.deepEqual(C.fechaDe('2026-09'), { mes: '2026-09' });
  assert.deepEqual(C.fechaDe('septiembre 2026'), { mes: '2026-09' });
  assert.deepEqual(C.fechaDe('Sep 2026'), { mes: '2026-09' });
});

test('tiendas, formatos e ISBN', () => {
  assert.equal(C.tiendaDe('Amazon.es'), 'amazon.es');
  assert.equal(C.tiendaDe('amazon.com'), 'amazon.com');
  assert.equal(C.tiendaDe('Amazon.de'), 'amazon.de');
  assert.equal(C.formatoDe('eBook Orders'), 'kindle');
  assert.equal(C.formatoDe('Paperback Orders'), 'impreso');
  assert.equal(C.formatoDe('70%'), 'kindle');
  assert.equal(C.formatoDe('60%'), 'impreso');
  assert.equal(C.formatoDe('Tapa blanda'), 'impreso');
  assert.equal(C.isbn10de13('9788408287288'), '8408287281');
  assert.equal(C.idLimpio('979-8310417793'), '9798310417793');
});

test('calibra amazon.es tapa blanda con el historial de Lupa y el informe diario (ISBN ↔ ASIN)', async () => {
  const lecturas = C.leerLecturasCsv(L.hojas.leerCsv(leer('lecturas-bsr.csv').toString('utf8')));
  const lineas = leer('lecturas-bsr.csv').toString('utf8').trim().split(/\r?\n/).length - 1;
  assert.equal(lecturas.length, lineas);
  const historial = historialDesdeLecturas(lecturas, { B0BR000001: '979-8000000011', B0BR000002: '979-8000000028', B0BR000003: '979-8000000035' });
  const ventas = C.leerInforme(await L.hojas.leerXlsx(leer('kdp-pedidos-diarios.xlsx'))).ventas;
  const { pares, avisos } = C.pares({ historial, ventas, tienda: 'amazon.es', formato: 'impreso' });
  // Tres libros × días con lectura de BSR dentro de las fechas del informe.
  assert.ok(pares.length >= 140 && pares.length <= 183, `pares: ${pares.length}`);
  assert.ok(pares.every((p) => ['B0BR000001', 'B0BR000002', 'B0BR000003'].includes(p.libro)));
  assert.ok(pares.some((p) => p.unidades === 0), 'los días sin ventas cuentan como 0');
  // Las ventas de Amazon.com no entran.
  const total = pares.reduce((a, p) => a + p.unidades, 0);
  const totalInforme = ventas.filter((v) => v.tienda === 'amazon.es' && v.formato === 'impreso').reduce((a, v) => a + v.unidades, 0);
  assert.ok(total <= totalInforme);
  const aj = C.ajustar(pares);
  assert.equal(aj.ok, true, aj.motivo);
  assert.ok(Math.abs(aj.b - 0.75) < 0.2, `b = ${aj.b}`);
  // A BSR 5.000 la curva verdadera da 900 × 5000^−0,75 = 1,51 al día.
  const v5000 = aj.a * 5000 ** -aj.b;
  assert.ok(v5000 > 0.9 && v5000 < 2.5, `ventas a 5.000: ${v5000}`);
  assert.equal(aj.n, pares.length);
  assert.ok(aj.r2 > 0.2 && aj.r2 <= 1);
  const curva = C.curvaDe(aj, { tienda: 'amazon.es', formato: 'impreso' });
  assert.equal(L.validarCurva(curva).ok, true);
  assert.equal(L.etiquetaCurva(curva, 'amazon.es'), `Calibrada con tus ventas de Amazon.es · ${aj.n} puntos de datos`);
  assert.ok(Array.isArray(avisos));
});

test('calibra Kindle con un CSV de lecturas y el informe en castellano', () => {
  const extra = C.leerLecturasCsv(L.hojas.leerCsv(leer('lecturas-bsr.csv').toString('utf8')));
  const ventas = C.leerInforme(L.hojas.leerCsv(leer('kdp-ventas-castellano.csv').toString('utf8'))).ventas;
  const { pares } = C.pares({ historial: [], ventas, extra, tienda: 'amazon.es', formato: 'kindle' });
  assert.ok(pares.length > 40);
  assert.ok(pares.every((p) => p.libro === 'B0BRKINDL1'));
  const aj = C.ajustar(pares);
  assert.equal(aj.ok, true, aj.motivo);
  assert.ok(aj.b > 0.3 && aj.b < 1.4, `b = ${aj.b}`);
});

test('informe mensual: un punto por libro y mes, sin las unidades gratis', async () => {
  const extra = C.leerLecturasCsv(L.hojas.leerCsv(leer('lecturas-bsr.csv').toString('utf8')));
  const inf = C.leerInforme(await L.hojas.leerXlsx(leer('kdp-regalias-mensual.xlsx')));
  assert.ok(inf.ventas.every((v) => v.mes && !v.dia));
  assert.ok(inf.avisos.some((a) => /1 filas de unidades gratis/.test(a)));
  // En el informe mensual las tapas blandas van por ISBN: el CSV de lecturas usa ASIN, así que solo entra Kindle.
  const k = C.pares({ ventas: inf.ventas, extra, tienda: 'amazon.es', formato: 'kindle' });
  // Agosto y septiembre (un mes sin fila del libro cuenta como 0 ventas).
  assert.deepEqual(k.pares.map((p) => p.periodo), ['2026-08', '2026-09']);
  assert.ok(k.pares.every((p) => p.exposicion === (p.periodo === '2026-08' ? 31 : 30) && p.lecturas >= 3));
  const total = inf.ventas.filter((v) => v.formato === 'kindle').reduce((a, v) => a + v.unidades, 0);
  assert.equal(k.pares.reduce((a, p) => a + p.unidades, 0), total);
});

test('con pocos datos no calibra y dice cuántos puntos hay', () => {
  const pocos = [
    { bsr: 1000, unidades: 2, exposicion: 1 },
    { bsr: 5000, unidades: 0, exposicion: 1 },
    { bsr: 8000, unidades: 1, exposicion: 1 },
  ];
  const r = C.ajustar(pocos);
  assert.equal(r.ok, false);
  assert.match(r.motivo, /^pocos datos: 3 puntos \(2 con ventas\)/);
  const plano = Array.from({ length: 10 }, (_, i) => ({ bsr: 5000 + i * 10, unidades: i % 2, exposicion: 1 }));
  assert.match(C.ajustar(plano).motivo, /no llega al doble/);
});

test('el ajuste recupera exactamente una curva sin ruido', () => {
  const puntos = [500, 1000, 3000, 9000, 30000, 100000].map((bsr) => ({ bsr, unidades: 2000 * bsr ** -0.8 * 30, exposicion: 30 }));
  const r = C.ajustar(puntos);
  assert.equal(r.ok, true);
  assert.ok(Math.abs(r.b - 0.8) < 1e-6, `b = ${r.b}`);
  assert.ok(Math.abs(r.a - 2000) / 2000 < 1e-5, `a = ${r.a}`);
  assert.ok(r.r2 > 0.999);
});
