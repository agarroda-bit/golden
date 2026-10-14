// Dibuja los iconos de la extensión (PNG) con Chromium. Solo hace falta si se cambia el dibujo.
// Fondo de noche, lupa de oro y, dentro del cristal, tres barras de ventas en azul hielo.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { opcionesNavegador } from '../tests/ayuda.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#0B0F1A"/>
  <circle cx="27" cy="27" r="16.5" fill="#131A2B" stroke="#D4A64A" stroke-width="5"/>
  <rect x="18.5" y="28" width="4.6" height="8" rx="1.2" fill="#5FB8E6"/>
  <rect x="25" y="23" width="4.6" height="13" rx="1.2" fill="#5FB8E6"/>
  <rect x="31.5" y="17.5" width="4.6" height="18.5" rx="1.2" fill="#F4F1EA"/>
  <path d="M39.5 39.5 L52 52" stroke="#D4A64A" stroke-width="7.5" stroke-linecap="round"/>
</svg>`;
fs.mkdirSync(path.join(raiz, 'extension', 'iconos'), { recursive: true });
fs.writeFileSync(path.join(raiz, 'extension', 'iconos', 'icono.svg'), svg);
const navegador = await chromium.launch({ ...opcionesNavegador(), headless: true });
for (const lado of [16, 32, 48, 128]) {
  const p = await navegador.newPage({ viewport: { width: lado, height: lado }, deviceScaleFactor: 1 });
  await p.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${lado}" height="${lado}" `)}</body></html>`);
  await p.screenshot({ path: path.join(raiz, 'extension', 'iconos', `${lado}.png`), omitBackground: true });
  await p.close();
}
await navegador.close();
console.log('Iconos listos en extension/iconos');
