// Copia las fuentes de la casa (Oswald para títulos y cifras, Rubik para el texto) a la extensión.
// Vienen de los paquetes @fontsource-variable (licencia SIL OFL 1.1). Solo el juego «latin»
// (incluye á, é, í, ó, ú, ñ, ü, ¿, ¡ y €). Solo hace falta si se cambian las fuentes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destino = path.join(raiz, 'extension', 'fuentes');
fs.mkdirSync(destino, { recursive: true });
const copias = [
  ['@fontsource-variable/oswald/files/oswald-latin-wght-normal.woff2', 'oswald.woff2'],
  ['@fontsource-variable/rubik/files/rubik-latin-wght-normal.woff2', 'rubik.woff2'],
];
for (const [origen, nombre] of copias) fs.copyFileSync(path.join(raiz, 'node_modules', origen), path.join(destino, nombre));
const licencia = [
  'Fuentes incluidas en Lupa KDP',
  '',
  'oswald.woff2 — Oswald (variable, juego latin). Copyright 2016 The Oswald Project Authors.',
  'rubik.woff2  — Rubik (variable, juego latin). Copyright 2015 The Rubik Project Authors.',
  '',
  'Las dos se distribuyen con la licencia SIL Open Font License 1.1, copiada a continuación.',
  '',
  fs.readFileSync(path.join(raiz, 'node_modules', '@fontsource-variable/oswald/LICENSE'), 'utf8').split('\n').slice(2).join('\n'),
].join('\n');
fs.writeFileSync(path.join(destino, 'OFL.txt'), licencia);
console.log('Fuentes listas en extension/fuentes');
