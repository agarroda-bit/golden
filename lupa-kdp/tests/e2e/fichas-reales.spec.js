// Simulacro con las fichas reales: lo que enseña el panel con la sopa de letras (B0DZ2439GN, ficha real
// capturada el 15/10 a las 00:46 UTC, BSR nº4.634, entregando en Estados Unidos) y el Murdoku (B0H29QB982,
// reconstruida de la ficha real del 14/10, BSR nº5).
import { expect, test } from '@playwright/test';
import { abrirConExtension, servirAmazon } from '../ayuda.js';

let ext;
test.beforeEach(async () => {
  ext = await abrirConExtension();
});
test.afterEach(async () => {
  await ext.cerrar();
});

test('sopa de letras real: BSR 4.634 → 9,1 al día, 273 al mes; regalía 0,76 € (114 págs., tamaño normal, precio ya sin IVA)', async () => {
  await servirAmazon(ext.contexto, [[/\/dp\/B0DZ2439GN/, 'ficha-real-sopa.html']]);
  const p = await ext.contexto.newPage();
  await p.goto('https://www.amazon.es/Sopa-Letras/dp/B0DZ2439GN/ref=sr_1_1');
  const panel = p.locator('lupa-kdp-panel');
  await expect(panel.locator('[data-bsr="4634"]')).toContainText('nº 4.634 en Libros');
  await expect(panel.locator('[data-seccion="bsr"]')).toContainText('nº 75 en Juegos y adivinanzas');
  await expect(panel.locator('[data-contador="dia"]')).toHaveText('9,1');
  await expect(panel.locator('[data-contador="mes"]')).toHaveText('273');
  await expect(panel.locator('[data-etiqueta]')).toHaveText('Estimación EE. UU. — sin calibrar para España');
  // Entregando en Estados Unidos, Amazon enseña 5,76 € (5,99 € sin el IVA): no se le vuelve a quitar.
  await expect(panel.locator('[data-dato="precio"]')).toHaveText('5,76 €');
  await expect(panel.locator('[data-regalia]')).toHaveText('0,76 €');
  await expect(panel.locator('[data-explica]')).toHaveText('50 % × 5,76 € − 2,12 € de impresión (tapa blanda, normal, 114 págs., tinta negra)');
  await expect(panel.locator('[data-seccion="regalia"] .avisos')).toContainText('Amazon enseña el precio para entregar en «Estados Unidos», ya sin IVA: no se le quita');
  await expect(panel.locator('[data-regalia-mes]')).toHaveText('207,87 € al mes');
  // «Independently published» = KDP: sin aviso de editorial.
  await expect(panel.locator('[data-seccion="regalia"]')).not.toContainText('no parece de KDP');
  await expect(panel.locator('[data-dato="medidas"]')).toHaveText('normal (15,24 × 22,86 cm)');
  await expect(panel.locator('[data-dato="resenas"]')).toHaveText('494');
  await expect(panel.locator('[data-dato="fechaPublicacion"]')).toHaveText('28 feb 2025');
  await expect(panel.locator('.error')).toHaveCount(0);
});

test('Murdoku real: BSR 5 está por encima de la tabla de EE. UU. y el panel lo avisa', async () => {
  await servirAmazon(ext.contexto, [[/\/dp\/B0H29QB982/, 'ficha-real-murdoku-reconstruida.html']]);
  const p = await ext.contexto.newPage();
  await p.goto('https://www.amazon.es/dp/B0H29QB982');
  const panel = p.locator('lupa-kdp-panel');
  await expect(panel.locator('[data-bsr="5"]')).toContainText('nº 5 en Libros');
  await expect(panel.locator('[data-seccion="bsr"]')).toContainText('nº 2 en Juegos y adivinanzas');
  await expect(panel.locator('[data-seccion="bsr"]')).toContainText('nº 5 en Misterios');
  await expect(panel.locator('[data-seccion="ventas"] .avisos')).toContainText('BSR fuera de la tabla (100–100.000): la cifra se ha prolongado y es menos fiable');
  await expect(panel.locator('[data-dato="precio"]')).toHaveText('17,00 €');
  await expect(panel.locator('[data-dato="paginas"]')).toHaveText('224');
  await expect(panel.locator('[data-dato="resenas"]')).toHaveText('192');
  await expect(panel.locator('[data-seccion="regalia"] .avisos')).toContainText('editorial «Ediciones Temas de Hoy»: no parece de KDP; es la regalía que tendría si lo fuera');
});
