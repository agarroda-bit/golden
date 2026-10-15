// Simulacro de «Mandar a la Biblioteca»: la idea sale del panel de Amazon y entra en la Biblioteca.
import { expect, test } from '@playwright/test';
import { abrirConExtension, esperarEnSW, servirAmazon, servirBiblioteca } from '../ayuda.js';

let ext;
test.beforeEach(async () => {
  ext = await abrirConExtension();
  await ext.contexto.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://www.amazon.es' });
});
test.afterEach(async () => {
  await ext.cerrar();
});

async function mandarDesdeLaFicha(consulta = '', opciones = {}) {
  // Se apunta qué pide Lupa abrir (sin permiso «tabs», Lupa no puede leer la dirección de esa pestaña).
  await ext.sw.evaluate(() => {
    const crear = chrome.tabs.create.bind(chrome.tabs);
    globalThis.__abiertas = [];
    chrome.tabs.create = (o) => {
      globalThis.__abiertas.push(o.url);
      return crear(o);
    };
  });
  await servirAmazon(ext.contexto, [[/\/dp\/B0DZ2439GN/, 'ficha-sintetica-sopa.html']]);
  // Después de Amazon: la última ruta registrada es la que manda.
  await servirBiblioteca(ext.contexto, { consulta, ...opciones });
  const amazon = await ext.contexto.newPage();
  await amazon.goto('https://www.amazon.es/dp/B0DZ2439GN');
  await expect(amazon.locator('lupa-kdp-panel [data-contador="dia"]')).toHaveText('23');
  const [biblio] = await Promise.all([ext.contexto.waitForEvent('page'), amazon.locator('lupa-kdp-panel [data-accion="biblioteca"]').click()]);
  // La pestaña que abre Lupa nace fuera del enrutado de Playwright (su primera carga choca con el proxy
  // muerto): se vuelve a cargar la misma dirección, ya con la Biblioteca simulada.
  await biblio.waitForLoadState('domcontentloaded').catch(() => {});
  expect(await ext.sw.evaluate(() => globalThis.__abiertas)).toEqual(['https://claude.ai/artifact/F242UTzquSffkufNJvGgnL']);
  await biblio.goto('https://claude.ai/artifact/F242UTzquSffkufNJvGgnL');
  return { amazon, biblio };
}

test('la idea entra en «Tus ideas de libro» con título, formato y la ficha del libro', async () => {
  const { amazon, biblio } = await mandarDesdeLaFicha();
  const marco = biblio.frameLocator('#artefacto');
  await expect(marco.locator('#listaIdeas .idea')).toHaveCount(1, { timeout: 20_000 });
  await expect(marco.locator('#toast')).toHaveText('Idea mandada a la fábrica');
  const ideas = await biblio.frames().find((f) => /claudeusercontent/.test(f.url())).evaluate(() => Object.values(window.__ideas));
  expect(ideas).toHaveLength(1);
  expect(ideas[0]).toMatchObject({ publico: 'Mayores', formato: 'Solo sopas de letras', prisa: 'normal', autor: 'Lupa KDP', estado: 'nueva' });
  expect(ideas[0].texto).toMatch(/^Idea vista en Amazon\.es con Lupa KDP: «Sopa de Letras en Español - Letra Grande: 5000 Palabras - 224 Puzles - Para Adultos, La Abuela, Adolescentes, y Todos»\. Tapa blanda · 104 págs\. · 5,99 €/);
  expect(ideas[0].texto).toContain('BSR nº 1.315 en Libros');
  expect(ideas[0].texto).toContain('Ficha: https://www.amazon.es/dp/B0DZ2439GN');
  // Lupa se entera y lo dice en el panel de Amazon.
  await esperarEnSW(ext.sw, async () => ((await chrome.storage.local.get('biblioteca')).biblioteca || []).some((x) => x.estado === 'entregada'));
  await expect(amazon.locator('lupa-kdp-panel [data-estado-biblioteca]')).toContainText('Idea mandada a la Biblioteca: ya está en «Tus ideas de libro».');
  // Copia de seguridad en el portapapeles.
  expect(await amazon.evaluate(() => navigator.clipboard.readText())).toBe(ideas[0].texto);
});

test('si la Biblioteca no puede guardar (sin sesión), la idea se queda pendiente y se dice por qué', async () => {
  const { amazon, biblio } = await mandarDesdeLaFicha('?solo-lectura=1');
  await expect(amazon.locator('lupa-kdp-panel [data-estado-biblioteca]')).toContainText('ERROR — la Biblioteca no ha aceptado la idea: la Biblioteca está en solo lectura: ábrela en claude.ai con tu cuenta', { timeout: 20_000 });
  await expect(biblio.frameLocator('#artefacto').locator('#listaIdeas .idea')).toHaveCount(0);
  const [item] = await ext.sw.evaluate(async () => (await chrome.storage.local.get('biblioteca')).biblioteca);
  expect(item.estado).toBe('pendiente');
  expect(item.motivo).toMatch(/solo lectura/);
  // En Opciones se ve y se puede reintentar.
  const op = await ext.contexto.newPage();
  await op.goto(`chrome-extension://${ext.extensionId}/opciones/opciones.html?pestana=biblioteca`);
  await expect(op.locator('#ideas tbody tr[data-idea]')).toHaveCount(1);
  await expect(op.locator('#ideas tbody')).toContainText('Pendiente de entrar');
  await expect(op.locator('#ideas tbody')).toContainText('solo lectura');
});

test('una idea que la nube de la Biblioteca rechaza no se da por entregada', async () => {
  const { amazon } = await mandarDesdeLaFicha('?falla=1');
  await expect(amazon.locator('lupa-kdp-panel [data-estado-biblioteca]')).toContainText('la Biblioteca dice: «No se pudo guardar la idea»', { timeout: 20_000 });
});

test('un marco escondido de la misma web donde la página no funciona no se queda con la idea', async () => {
  const { amazon, biblio } = await mandarDesdeLaFicha('', { marcoPrevio: true });
  expect(biblio.frames().some((f) => /_previo/.test(f.url()))).toBe(true);
  await expect(biblio.frameLocator('#artefacto').locator('#listaIdeas .idea')).toHaveCount(1, { timeout: 20_000 });
  await expect(amazon.locator('lupa-kdp-panel [data-estado-biblioteca]')).toContainText('Idea mandada a la Biblioteca');
  const [item] = await ext.sw.evaluate(async () => (await chrome.storage.local.get('biblioteca')).biblioteca);
  expect(item).toMatchObject({ estado: 'entregada', intentos: 1 });
});
