// El lector de Amazon contra páginas guardadas: reales recortadas, una reconstruida de una ficha real y sintéticas.
import { expect, test } from '@playwright/test';
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { EXTENSION, FIXTURES, leerFixture, opcionesNavegador } from '../ayuda.js';

let navegador;
let pagina;
test.beforeAll(async () => {
  navegador = await chromium.launch({ ...opcionesNavegador(), headless: true });
});
test.afterAll(async () => {
  await navegador.close();
});

/** Carga una página guardada en su dirección de Amazon y le pone las librerías de Lupa. */
async function cargar(fixture, url) {
  pagina = await navegador.newPage();
  await pagina.route('**/*', (r) => (r.request().resourceType() === 'document' ? r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: leerFixture(fixture) }) : r.fulfill({ status: 204, body: '' })));
  await pagina.goto(url);
  for (const f of ['base', 'tiendas', 'regalias', 'estimacion', 'lector']) await pagina.addScriptTag({ path: path.join(EXTENSION, 'lib', `${f}.js`) });
  return pagina;
}
const ficha = (p) => p.evaluate(() => LUPA.lector.leerFicha(document, location.href));
const fichaParseada = (p) => p.evaluate(() => LUPA.lector.leerFicha(new DOMParser().parseFromString(document.documentElement.outerHTML, 'text/html'), location.href));

test('sopa de letras (ficha REAL del 15/10, entregando en Estados Unidos): BSR, «Longitud de impresión», precio ya sin IVA', async () => {
  const p = await cargar('ficha-real-sopa.html', 'https://www.amazon.es/Sopa-Letras/dp/B0DZ2439GN/ref=sr_1_1');
  const f = await ficha(p);
  expect(f).toMatchObject({
    ok: true, tienda: 'amazon.es', asin: 'B0DZ2439GN', autor: 'Martin Littlewolf', formato: 'Tapa blanda', precio: 5.76, moneda: 'EUR',
    paginas: 114, medidas: '15.24 x 0.66 x 22.86 cm', fechaPublicacion: '2025-02-28', editorial: 'Independently published', resenas: 494, nota: 4.8,
    isbn13: '979-8312528992', entrega: { texto: 'Estados Unidos', zona: 'sin-iva' }, faltan: {},
  });
  expect(f.titulo).toMatch(/^Sopa de Letras en Español - Letra Grande: 5000 Palabras/);
  expect(f.bsr).toMatchObject({ general: 4634, categoriaGeneral: 'Libros', categorias: [{ puesto: 75, nombre: 'Juegos y adivinanzas' }] });
  // Lo mismo leyendo la ficha descargada en segundo plano (DOMParser, sin pintar).
  expect(await fichaParseada(p)).toMatchObject({ precio: 5.76, paginas: 114, resenas: 494, bsr: { general: 4634 }, entrega: { zona: 'sin-iva' } });
  // BSR 4.634 → 9,1 al día. Entregando fuera de la UE, Amazon enseña el precio ya sin IVA: 5,76 € = 5,99 € / 1,04,
  // el mismo precio sin IVA que entregando en Madrid, así que la regalía es la misma: 50 % × 5,76 − 2,12 = 0,76 €.
  const est = await p.evaluate((x) => LUPA.estimar(x), f);
  expect(est.ventas.dia).toBeCloseTo(9.09, 2);
  expect(est.regalia.precioSinIva).toBe(5.76);
  expect(est.regalia.regalia).toBeCloseTo(0.5 * 5.76 - (0.75 + 114 * 0.012), 4);
  expect(est.regalia.avisos.join(' ')).toMatch(/para entregar en «Estados Unidos», ya sin IVA/);
  const madrid = await p.evaluate((x) => LUPA.estimar({ ...x, precio: 5.99, entrega: { texto: 'Madrid 28013', zona: 'espana' } }), f);
  expect(madrid.regalia.regalia).toBeCloseTo(est.regalia.regalia, 2);
});

test('Murdoku (estructura real de hoy): BSR nº5, tres categorías y precio «desde 17,00 €»', async () => {
  const p = await cargar('ficha-real-murdoku-reconstruida.html', 'https://www.amazon.es/dp/B0H29QB982');
  const f = await ficha(p);
  expect(f).toMatchObject({ ok: true, asin: 'B0H29QB982', autor: 'Manuel Garand', formato: 'Tapa blanda', precio: 17, paginas: 224, fechaPublicacion: '2026-07-01', editorial: 'Ediciones Temas de Hoy', resenas: 192, nota: 4.6 });
  expect(f.bsr).toMatchObject({ general: 5, categoriaGeneral: 'Libros' });
  expect(f.bsr.categorias).toEqual([{ puesto: 2, nombre: 'Juegos y adivinanzas' }, { puesto: 5, nombre: 'Misterios' }, { puesto: 11, nombre: 'Ficción por género' }]);
  const est = await p.evaluate((x) => LUPA.estimar(x), f);
  expect(est.ventas.fueraDeTabla).toBe(true);
  expect(est.avisos.join(' ')).toMatch(/BSR fuera de la tabla/);
});

test('fichas sintéticas: sopa con detalles antiguos («Tapa blanda: 104 páginas», editorial con fecha), Kindle y libro sin BSR', async () => {
  let f = await ficha(await cargar('ficha-sintetica-sopa.html', 'https://www.amazon.es/dp/B0DZ2439GN'));
  expect(f).toMatchObject({ formato: 'Tapa blanda', paginas: 104, fechaPublicacion: '2025-02-28', resenas: 494, bsr: { general: 1315 } });
  f = await ficha(await cargar('ficha-sintetica-kindle.html', 'https://www.amazon.es/dp/B0KINDLE01'));
  expect(f).toMatchObject({ formato: 'Versión Kindle', precio: 4.99, tamanoArchivoMB: 2345 / 1024, bsr: { general: 5432, categoriaGeneral: 'Tienda Kindle' } });
  f = await ficha(await cargar('ficha-sintetica-sin-bsr.html', 'https://www.amazon.es/dp/B0BUENRATO'));
  expect(f.bsr.general).toBeNull();
  expect(f.faltan.bsr).toMatch(/no aparece el puesto en ventas/);
  expect(f.resenas).toBe(0);
});

test('página de comprobación de robot (real): se reconoce y no se lee', async () => {
  const p = await cargar('robot-seguir-comprando.html', 'https://www.amazon.es/dp/B0DZ2439GN');
  expect(await p.evaluate(() => LUPA.lector.detectarRobot(document))).toBe('Amazon pide comprobar que eres una persona');
  expect(await p.evaluate(() => LUPA.lector.tipoPagina(document, location.href))).toBe('robot');
  expect(await ficha(p)).toMatchObject({ ok: false, robot: true });
});

test('búsqueda real de Amazon.es: 21 libros, 6 patrocinados, títulos sin «Anuncio patrocinado»', async () => {
  const p = await cargar('busqueda-real-sopa.html', 'https://www.amazon.es/s?k=sopa+de+letras+letra+grande&i=stripbooks');
  const r = await p.evaluate(() => {
    const l = LUPA.lector.leerLista(document, location.href);
    return { tipo: l.tipo, items: l.items.map((i) => ({ asin: i.asin, patrocinado: i.patrocinado, titulo: i.titulo })) };
  });
  expect(r.tipo).toBe('busqueda');
  expect(r.items).toHaveLength(21);
  expect(r.items.filter((i) => i.patrocinado)).toHaveLength(6);
  expect(r.items[0]).toMatchObject({ asin: 'B0DZ2439GN', patrocinado: false });
  expect(r.items.every((i) => !/^anuncio patrocinado/i.test(i.titulo))).toBe(true);
});

test('pantalla de verificación del navegador (real, Akamai «bm-verify»): en una ficha descargada es un bloqueo y no se lee', async () => {
  const p = await cargar('robot-seguir-comprando.html', 'https://www.amazon.es/');
  const r = await p.evaluate((html) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const url = 'https://www.amazon.es/dp/B0DZ2439GN';
    return { robot: LUPA.lector.detectarRobot(doc), verificacion: LUPA.lector.esVerificacion(doc), tipo: LUPA.lector.tipoPagina(doc, url), ficha: LUPA.lector.leerFicha(doc, url) };
  }, leerFixture('verificacion-amazon.html'));
  expect(r.robot).toMatch(/pantalla de verificación/);
  expect(r).toMatchObject({ verificacion: true, tipo: 'robot', ficha: { ok: false, robot: true } });
  // El captcha clásico es otra cosa (ese sí hay que resolverlo a mano) y una ficha normal no es ninguna de las dos.
  // (Sobre la página tal como llega: aquí las librerías de Lupa van metidas en la página como scripts.)
  const comoLlega = (html) => p.evaluate((h) => { const d = new DOMParser().parseFromString(h, 'text/html'); return [LUPA.lector.esVerificacion(d), LUPA.lector.detectarRobot(d)]; }, html);
  expect(await comoLlega(leerFixture('robot-seguir-comprando.html'))).toEqual([false, 'Amazon pide comprobar que eres una persona']);
  expect(await comoLlega(leerFixture('ficha-real-sopa.html'))).toEqual([false, null]);
});

test('números de reseñas como los escribe Amazon', async () => {
  const p = await cargar('robot-seguir-comprando.html', 'https://www.amazon.es/');
  expect(await p.evaluate(() => ['492 Reseñas', '(1.234)', '1,2 mil valoraciones', '12K ratings', '(37)'].map(LUPA.lector.numeroResenas))).toEqual([492, 1234, 1200, 12000, 37]);
});

// Páginas nuevas sacadas con «npm run fixtures» (tests/fixtures/nuevas/): sin cifras fijas (el BSR cambia cada
// hora), solo que Lupa las siga leyendo enteras. Si falla, dice qué dato ya no se lee.
const NUEVAS = path.join(FIXTURES, 'nuevas');
const nuevas = fs.existsSync(NUEVAS) ? fs.readdirSync(NUEVAS).filter((f) => f.endsWith('.html')) : [];
for (const archivo of nuevas) {
  test(`página nueva ${archivo}: Lupa la sigue leyendo entera`, async () => {
    const html = fs.readFileSync(path.join(NUEVAS, archivo), 'utf8');
    const origen = (html.match(/Origen: (https:\/\/\S+)/) || [])[1];
    expect(origen, 'la página no dice de qué dirección es (cabecera de recortar-fixture.mjs)').toBeTruthy();
    const p = await cargar(`nuevas/${archivo}`, origen);
    const r = await p.evaluate(() => {
      const tipo = LUPA.lector.tipoPagina(document, location.href);
      if (tipo === 'ficha') {
        const f = LUPA.lector.leerFicha(document, location.href);
        return { tipo, ok: f.ok, faltan: f.faltan, bsr: f.bsr && f.bsr.general, precio: f.precio, paginas: f.paginas, formato: f.formato };
      }
      const l = LUPA.lector.leerLista(document, location.href);
      return { tipo, libros: l.items.length };
    });
    if (r.tipo === 'ficha') {
      expect(r.ok).toBe(true);
      // Un libro recién publicado puede no tener BSR ni reseñas: eso no es un fallo del lector.
      const faltan = Object.fromEntries(Object.entries(r.faltan).filter(([k]) => !['bsr', 'resenas', 'nota'].includes(k)));
      expect(faltan).toEqual({});
      expect(Number.isFinite(r.precio)).toBe(true);
    } else {
      expect(['busqueda', 'mas-vendidos']).toContain(r.tipo);
      expect(r.libros).toBeGreaterThan(0);
    }
  });
}
