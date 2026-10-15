// Ayudas para las pruebas con la extensión cargada en Chromium (perfil temporal, nunca el de Rodri).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const EXTENSION = path.join(RAIZ, 'extension');
export const FIXTURES = path.join(RAIZ, 'tests', 'fixtures');

/**
 * Chromium que se usa: el que trae Playwright 1.63 (chromium-1243, el del Mac de Rodri) o, si se
 * indica en LUPA_CHROMIUM, otro ya instalado (en la nube de Claude: /opt/pw-browsers/chromium).
 */
export function opcionesNavegador() {
  const ruta = process.env.LUPA_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : null);
  return ruta ? { executablePath: ruta } : { channel: 'chromium' };
}

export function leerFixture(nombre) {
  return fs.readFileSync(path.join(FIXTURES, nombre), 'utf8');
}

/** Chromium con Lupa KDP cargada. «ventana»: true para verlo. */
export async function abrirConExtension({ ventana = false, viewport = { width: 1400, height: 900 }, args = [], perfil: perfilDado = null, conRed = false } = {}) {
  const perfil = perfilDado || fs.mkdtempSync(path.join(os.tmpdir(), 'lupa-pruebas-'));
  const contexto = await chromium.launchPersistentContext(perfil, {
    ...opcionesNavegador(),
    headless: !ventana,
    args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`, ...args],
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    viewport,
    acceptDownloads: true,
    // Simulacros sin internet: todo lo que no sirve la prueba va a un proxy muerto (las pestañas que
    // abre la extensión por su cuenta se escapan del enrutado de Playwright en su primera carga).
    ...(conRed ? {} : { proxy: { server: 'http://127.0.0.1:9' } }),
  });
  let [sw] = contexto.serviceWorkers();
  if (!sw) sw = await contexto.waitForEvent('serviceworker', { timeout: 30_000 });
  const extensionId = new URL(sw.url()).host;
  // El módulo del service worker puede tardar un momento en terminar de cargar.
  for (let i = 0; i < 80 && !(await sw.evaluate(() => !!globalThis.LUPA_SW).catch(() => false)); i++) await new Promise((r) => setTimeout(r, 100));
  const cerrar = async () => {
    await contexto.close().catch(() => {});
    if (!perfilDado) fs.rmSync(perfil, { recursive: true, force: true });
  };
  return { contexto, sw, extensionId, cerrar };
}

/**
 * Sirve páginas guardadas de Amazon en sus direcciones de verdad (sin internet).
 * «rutas»: [[expresión, archivo de fixtures | función(url) → html]].
 */
export async function servirAmazon(contexto, rutas, { registro } = {}) {
  await contexto.route(/^https:\/\/www\.amazon\.(es|com)\/.*/, (ruta) => {
    const url = ruta.request().url();
    if (registro) registro.push({ url, hora: Date.now(), tipo: ruta.request().resourceType() });
    for (const [patron, archivo] of rutas) {
      if (patron.test(url)) {
        const cuerpo = typeof archivo === 'function' ? archivo(url) : leerFixture(archivo);
        return ruta.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: cuerpo });
      }
    }
    return ruta.fulfill({ status: 404, contentType: 'text/html; charset=utf-8', body: '<html><body>No está en el simulacro</body></html>' });
  });
  // Nada de salir a internet durante estas pruebas (imágenes, scripts de Amazon…).
  await contexto.route(/^https?:\/\/(?!www\.amazon\.(es|com)\/).*/, (ruta) => ruta.fulfill({ status: 204, body: '' }));
}

/** Espera a que se cumpla una condición evaluada en el service worker. */
export async function esperarEnSW(sw, fn, arg, { max = 30_000, cada = 250 } = {}) {
  const fin = Date.now() + max;
  let ultimo;
  for (;;) {
    ultimo = await sw.evaluate(fn, arg);
    if (ultimo) return ultimo;
    if (Date.now() > fin) throw new Error(`No se cumplió a tiempo (último valor: ${JSON.stringify(ultimo)})`);
    await new Promise((r) => setTimeout(r, cada));
  }
}

/** Todo el historial guardado. */
export async function historial(sw) {
  return sw.evaluate(async () => {
    const todo = await chrome.storage.local.get(null);
    return Object.entries(todo)
      .filter(([k]) => k.startsWith('h:'))
      .map(([, v]) => v);
  });
}

/** Id de la pestaña de Chrome de una página de Playwright (se busca por su URL). */
export async function idPestana(sw, page) {
  const url = page.url();
  return sw.evaluate(async (u) => {
    const pestanas = await chrome.tabs.query({});
    const t = pestanas.find((x) => x.url === u) || pestanas.find((x) => (x.url || '').startsWith(u.split('?')[0]));
    return t ? t.id : null;
  }, url);
}

/** Cambia el BSR general de una ficha guardada (para simular otra lectura otro día). */
export function conBsr(html, bsr) {
  return html.replace(/nº [\d.]+ en (Libros|Tienda Kindle) \(/, (_m, cat) => `nº ${bsr.toLocaleString('es-ES')} en ${cat} (`);
}

/**
 * Ficha sintética para cualquier ASIN (para los simulacros de listas): la de la sopa de letras con
 * otro ASIN, otro título y otro BSR.
 */
export function fichaPara(asin, bsr, titulo = `Libro de prueba ${asin}`) {
  return conBsr(leerFixture('ficha-sintetica-sopa.html'), bsr)
    .replaceAll('B0DZ2439GN', asin)
    .replace(/<span id="productTitle"[^>]*>[^<]*<\/span>/, `<span id="productTitle" class="a-size-extra-large">${titulo}</span>`);
}

/** Peticiones de fichas (/dp/ASIN) que ha hecho la página, en orden. */
export function fichasPedidas(registro) {
  return registro.filter((r) => /\/dp\/[A-Z0-9]{10}/.test(r.url) && r.tipo === 'fetch').map((r) => ({ asin: r.url.match(/\/dp\/([A-Z0-9]{10})/)[1], hora: r.hora }));
}

/** Sirve la Biblioteca simulada en claude.ai y en su marco de claudeusercontent.com. */
export async function servirBiblioteca(contexto, { consulta = '', marcoPrevio = false } = {}) {
  // «marcoPrevio»: un marco escondido en el mismo dominio donde el código de la página no puede correr
  // (como el de «calentamiento» de claude.ai). Lupa no debe quedarse ahí con la idea.
  const previo = marcoPrevio ? '<iframe id="previo" hidden sandbox="allow-same-origin" src="https://71858caa-e256-4fbe-bb82-fe46a9da9349.frame.claudeusercontent.com/_previo"></iframe>' : '';
  await contexto.route(/^https:\/\/claude\.ai\/artifact\//, (ruta) => ruta.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: leerFixture('biblioteca-marco.html').replace('__QUERY__', consulta).replace('<!--PREVIO-->', previo) }));
  await contexto.route(/^https:\/\/[\w-]+\.frame\.claudeusercontent\.com\//, (ruta) => ruta.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: leerFixture('biblioteca-simulada.html') }));
}

// ------------------------------------------------------------------ Amazon de verdad (test:real, fixtures)

export const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
/** Pausa de persona entre página y página: de 8 a 15 segundos. */
export const pausaPersona = () => dormir(8000 + Math.random() * 7000);

/**
 * ¿Es la comprobación de robot de Amazon? Las mismas frases que usa Lupa (extension/lib/tiendas.js).
 * Ojo: «Seguir comprando» a secas sale en el menú de la cuenta de cualquier página normal de
 * Amazon.es; la comprobación dice «…el botón de abajo para seguir comprando».
 */
export async function esRobot(pagina) {
  return pagina.evaluate(
    () =>
      !!document.querySelector('form[action*="validateCaptcha"], input#captchacharacters') ||
      /introduce los caracteres que (ves|aparecen)|bot[oó]n de abajo para seguir comprando|enter the characters you see below|below to continue shopping|asegurarnos de que no eres un robot|make sure you('|’)re not a robot/i.test(document.body ? document.body.innerText.slice(0, 3000) : ''),
  );
}

/** «Rechazar» en el aviso de cookies de Amazon, si sale. */
export async function rechazarCookies(pagina) {
  const boton = pagina.locator('#sp-cc-rejectall-link, input#sp-cc-rejectall-link, button:has-text("Rechazar")').first();
  if (await boton.isVisible().catch(() => false)) {
    await boton.click();
    await dormir(1500);
  }
}

/** ¿Es la pantalla de verificación del navegador (Akamai «bm-verify»)? Mientras navega, cuenta como sí. */
export async function esVerificacion(pagina) {
  return pagina
    .evaluate(() => !!document.querySelector('meta[http-equiv="refresh" i][content*="bm-verify"]') || [...document.scripts].some((s) => /_sec\/verify\?provider=interstitial/.test(s.textContent)))
    .catch(() => true);
}

/**
 * Abre una dirección como una persona y devuelve la respuesta de la página que queda. Si Amazon pone
 * delante su pantalla de verificación del navegador, la pasa el propio navegador con el JavaScript de
 * Amazon (como haría Chrome); aquí solo se espera a la página de verdad. No se salta nada.
 */
export async function abrir(pagina, url, { espera = 2500 } = {}) {
  const respuestas = [];
  const oir = (r) => {
    if (r.request().isNavigationRequest() && r.frame() === pagina.mainFrame()) respuestas.push(r);
  };
  pagina.on('response', oir);
  try {
    await pagina.goto(url, { waitUntil: 'domcontentloaded' });
    await dormir(espera);
    for (let i = 0; i < 20 && (await esVerificacion(pagina)); i++) await dormir(1000);
    await pagina.waitForLoadState('domcontentloaded').catch(() => {});
    return respuestas[respuestas.length - 1] || null;
  } finally {
    pagina.off('response', oir);
  }
}
