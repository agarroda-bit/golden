// El lector de Amazon contra páginas guardadas: reales recortadas, reconstruidas de fichas reales y sintéticas.
import { expect, test } from '@playwright/test';
import { chromium } from '@playwright/test';
import path from 'node:path';
import { EXTENSION, leerFixture, opcionesNavegador } from '../ayuda.js';

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

test('sopa de letras (estructura real de hoy): BSR sin espacio tras nº, «Longitud de impresión», formato en la línea del autor', async () => {
  const p = await cargar('ficha-real-sopa-reconstruida.html', 'https://www.amazon.es/Sopa-Letras/dp/B0DZ2439GN/ref=sr_1_1');
  const f = await ficha(p);
  expect(f).toMatchObject({
    ok: true, tienda: 'amazon.es', asin: 'B0DZ2439GN', autor: 'Martin Littlewolf', formato: 'Tapa blanda', precio: 5.99, moneda: 'EUR',
    paginas: 114, medidas: '15.24 x 0.66 x 22.86 cm', fechaPublicacion: '2025-02-28', editorial: 'Independently published', resenas: 492, nota: 4.8,
    isbn13: '979-8312528992', faltan: {},
  });
  expect(f.titulo).toMatch(/^Sopa de Letras en Español - Letra Grande: 5000 Palabras/);
  expect(f.bsr).toMatchObject({ general: 1415, categoriaGeneral: 'Libros', categorias: [{ puesto: 29, nombre: 'Juegos y adivinanzas' }] });
  // Lo mismo leyendo la ficha descargada en segundo plano (DOMParser, sin pintar).
  expect(await fichaParseada(p)).toMatchObject({ precio: 5.99, paginas: 114, resenas: 492, bsr: { general: 1415 } });
  // Estimación: BSR 1.415 → 21,7 al día; 114 págs. de tamaño normal: 50 % × 5,76 − (0,75 + 114 × 0,012).
  const est = await p.evaluate((x) => LUPA.estimar(x), f);
  expect(est.ventas.dia).toBeCloseTo(21.7, 1);
  expect(est.regalia.regalia).toBeCloseTo(0.5 * (5.99 / 1.04) - (0.75 + 114 * 0.012), 4);
  expect(est.regalia.tamano).toBe('normal');
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

test('números de reseñas como los escribe Amazon', async () => {
  const p = await cargar('robot-seguir-comprando.html', 'https://www.amazon.es/');
  expect(await p.evaluate(() => ['492 Reseñas', '(1.234)', '1,2 mil valoraciones', '12K ratings', '(37)'].map(LUPA.lector.numeroResenas))).toEqual([492, 1234, 1200, 12000, 37]);
});
