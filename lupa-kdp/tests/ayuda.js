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
export async function abrirConExtension({ ventana = false, viewport = { width: 1400, height: 900 }, args = [], perfil: perfilDado = null } = {}) {
  const perfil = perfilDado || fs.mkdtempSync(path.join(os.tmpdir(), 'lupa-pruebas-'));
  const contexto = await chromium.launchPersistentContext(perfil, {
    ...opcionesNavegador(),
    headless: !ventana,
    args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`, ...args],
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    viewport,
    acceptDownloads: true,
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
