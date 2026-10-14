import assert from 'node:assert/strict';
import { test } from 'node:test';
import { L } from './cargar.js';

test('qué juegos lleva y para quién es, con las opciones exactas de la Biblioteca', () => {
  assert.equal(L.biblioteca.juegosDe('Sopa de Letras en Español - Letra Grande: 5000 Palabras'), 'Solo sopas de letras');
  assert.equal(L.biblioteca.juegosDe('Sudoku XXL para mayores'), 'Solo sudokus');
  assert.equal(L.biblioteca.juegosDe('Laberintos para niños de 6 a 8 años'), 'Solo laberintos');
  assert.equal(L.biblioteca.juegosDe('Pasatiempos XXL: sopas de letras, sudokus y laberintos'), 'Mezcla de pasatiempos');
  assert.equal(L.biblioteca.juegosDe('Mis recetas: cuaderno para rellenar'), 'Cuaderno para rellenar');
  assert.equal(L.biblioteca.juegosDe('Murdoku: 80 misterios de lógica'), 'Lo que veas mejor');
  for (const t of ['Sopa de letras', 'Sudoku', 'Laberintos', 'Pasatiempos variados', 'Mis recetas', 'Murdoku']) assert.ok(L.BIBLIOTECA.juegos.includes(L.biblioteca.juegosDe(t)));
  assert.equal(L.biblioteca.publicoDe('Sopa de letras para mayores letra muy grande'), 'Mayores');
  assert.equal(L.biblioteca.publicoDe('Laberintos para niños de 6 a 8 años'), 'Niños');
  assert.equal(L.biblioteca.publicoDe('Retos para adolescentes'), 'Adolescentes');
  assert.equal(L.biblioteca.publicoDe('Sudokus difíciles para adultos'), 'Adultos');
  assert.equal(L.biblioteca.publicoDe('Murdoku'), 'Lo que veas mejor');
});

test('la idea lleva título, formato y la ficha del libro', () => {
  const ficha = { tienda: 'amazon.es', asin: 'B0DZ2439GN', url: 'https://www.amazon.es/dp/B0DZ2439GN', titulo: 'Sopa de Letras en Español - Letra Grande', autor: 'Martin Littlewolf', formato: 'Tapa blanda', precio: 5.99, moneda: 'EUR', paginas: 224, medidas: '21.59 x 1.3 x 27.94 cm', fechaPublicacion: '2025-02-28', resenas: 494, nota: 4.8, bsr: { general: 1315, categoriaGeneral: 'Libros', categorias: [{ puesto: 3, nombre: 'Sopas de letras' }] } };
  const est = L.estimar(ficha);
  const i = L.biblioteca.idea(ficha, est);
  assert.match(i.texto, /^Idea vista en Amazon\.es con Lupa KDP: «Sopa de Letras en Español - Letra Grande»\. Tapa blanda · 224 págs\. · 5,99 € · de Martin Littlewolf · publicado el 28 feb 2025 · 494 reseñas \(nota 4,8\)\. BSR nº 1\.315 en Libros \(nº 3 en Sopas de letras\)\. Ventas estimadas: /);
  assert.match(i.texto, /Estimación EE\. UU\. — sin calibrar para España/);
  assert.match(i.texto, /Ficha: https:\/\/www\.amazon\.es\/dp\/B0DZ2439GN$/);
  assert.equal(i.formato, 'Solo sopas de letras');
  assert.equal(i.publico, 'Mayores');
  assert.equal(i.prisa, 'normal');
  assert.equal(i.autor, 'Lupa KDP');
  assert.deepEqual(i.ficha, { tienda: 'amazon.es', asin: 'B0DZ2439GN', url: 'https://www.amazon.es/dp/B0DZ2439GN', titulo: 'Sopa de Letras en Español - Letra Grande', formato: 'Tapa blanda' });
  const sinBsr = L.biblioteca.idea({ ...ficha, bsr: { general: null } }, L.estimar({ ...ficha, bsr: { general: null } }));
  assert.match(sinBsr.texto, /Sin BSR en la ficha/);
  assert.doesNotMatch(sinBsr.texto, /Ventas estimadas/);
});
