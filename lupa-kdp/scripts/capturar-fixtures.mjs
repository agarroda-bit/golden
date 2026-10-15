// Instantáneas nuevas de Amazon.es para las pruebas de lectores («npm run fixtures»), como en RADAR:
// Chromium con ventana, perfil temporal que se borra al acabar (nunca el Chrome de Rodri), cookies
// rechazadas y ritmo de persona (entra por la portada y espera de 8 a 15 s entre página y página).
// Guarda cada página tal como llega en .tmp/capturas/ y la recorta en tests/fixtures/nuevas/ con
// scripts/recortar-fixture.mjs; «npm run test:lectores» comprueba que Lupa las sigue leyendo enteras.
// Si Amazon pide comprobar que eres una persona, se para y no insiste.
//   npm run fixtures                                          → las páginas de la lista PAGINAS
//   npm run fixtures -- <nombre> <ficha|busqueda|mas-vendidos> <url>   → solo esa
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import { FIXTURES, RAIZ, abrir, esRobot, opcionesNavegador, pausaPersona, rechazarCookies } from '../tests/ayuda.js';

const PAGINAS = [
  { nombre: 'ficha-real-sopa', tipo: 'ficha', url: 'https://www.amazon.es/dp/B0DZ2439GN' },
  { nombre: 'ficha-real-murdoku', tipo: 'ficha', url: 'https://www.amazon.es/dp/B0H29QB982' },
  { nombre: 'mas-vendidos-real-libros', tipo: 'mas-vendidos', url: 'https://www.amazon.es/gp/bestsellers/books' },
  { nombre: 'mas-vendidos-real-kindle', tipo: 'mas-vendidos', url: 'https://www.amazon.es/gp/bestsellers/digital-text' },
  // La ficha del primer libro de «Los más vendidos» de Kindle (para tener una ficha Kindle real).
  { nombre: 'ficha-real-kindle', tipo: 'ficha', primeroDe: 'mas-vendidos-real-kindle' },
];

const [nombreSuelto, tipoSuelto, urlSuelta] = process.argv.slice(2);
const paginas = nombreSuelto ? [{ nombre: nombreSuelto, tipo: tipoSuelto, url: urlSuelta }] : PAGINAS;
if (paginas.some((p) => !p.nombre || !['ficha', 'busqueda', 'mas-vendidos'].includes(p.tipo) || !(p.url || p.primeroDe))) {
  console.error('Uso: npm run fixtures [-- <nombre> <ficha|busqueda|mas-vendidos> <url>]');
  process.exit(1);
}

const CAPTURAS = path.join(RAIZ, '.tmp', 'capturas');
const NUEVAS = path.join(FIXTURES, 'nuevas');
fs.mkdirSync(CAPTURAS, { recursive: true });
fs.mkdirSync(NUEVAS, { recursive: true });
const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'lupa-capturas-'));
const contexto = await chromium.launchPersistentContext(perfil, {
  ...opcionesNavegador(),
  headless: !!process.env.LUPA_SIN_VENTANA,
  locale: 'es-ES',
  timezoneId: 'Europe/Madrid',
  viewport: { width: 1400, height: 900 },
});
const primerAsin = {};
let parado = null;
try {
  const p = contexto.pages()[0] || (await contexto.newPage());
  await abrir(p, 'https://www.amazon.es/', { espera: 3000 });
  if (await esRobot(p)) parado = 'Amazon pide comprobar que eres una persona ya en la portada';
  else await rechazarCookies(p);

  for (const pag of paginas) {
    if (parado) break;
    const url = pag.url || (primerAsin[pag.primeroDe] && `https://www.amazon.es/dp/${primerAsin[pag.primeroDe]}`);
    if (!url) {
      console.log(`${pag.nombre}: sin dirección (no se capturó ${pag.primeroDe})`);
      continue;
    }
    await pausaPersona();
    const resp = await abrir(p, url);
    if (await esRobot(p)) {
      parado = `Amazon pidió comprobar que eres una persona en ${url}`;
      break;
    }
    if (!resp) {
      console.log(`${pag.nombre}: no ha llegado la página (${url})`);
      continue;
    }
    // El HTML tal como lo manda Amazon (sin lo que pintan luego sus scripts).
    const html = await resp.text().catch(() => '');
    if (!html) {
      console.log(`${pag.nombre}: la página ha llegado vacía (${url})`);
      continue;
    }
    const crudo = path.join(CAPTURAS, `${pag.nombre}.html`);
    fs.writeFileSync(crudo, html);
    if (pag.tipo === 'mas-vendidos') {
      primerAsin[pag.nombre] = await p.evaluate(() => {
        const a = document.querySelector('#gridItemRoot a[href*="/dp/"], [data-asin] a[href*="/dp/"], a[href*="/dp/"]');
        const m = a && a.getAttribute('href').match(/\/dp\/([A-Z0-9]{10})/);
        return m ? m[1] : null;
      });
    }
    execFileSync(process.execPath, [path.join(RAIZ, 'scripts', 'recortar-fixture.mjs'), crudo, path.join(NUEVAS, `${pag.nombre}.html`), pag.tipo, url], { stdio: 'inherit' });
    console.log(`${pag.nombre}: ${url} → tests/fixtures/nuevas/${pag.nombre}.html (${Math.round(html.length / 1024)} KB sin recortar)`);
  }
} finally {
  await contexto.close().catch(() => {});
  fs.rmSync(perfil, { recursive: true, force: true });
}
if (parado) {
  console.error(`PARADO: ${parado}. No se insiste: espera un buen rato antes de volver a probar.`);
  process.exit(2);
}
