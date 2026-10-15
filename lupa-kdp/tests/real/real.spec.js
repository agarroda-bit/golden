// Prueba con Amazon.es DE VERDAD (solo con «npm run test:real»): ventana visible, perfil temporal que se
// borra al acabar (nunca el Chrome de Rodri), cookies rechazadas y ritmo de persona (entra por la portada,
// pausas de 8 a 15 s). Abre las tres fichas del encargo: una sopa de letras, un Murdoku y un libro de
// Buen Rato, y apunta lo que enseña el panel de Lupa. Si Amazon pide comprobar que eres una persona,
// se para (no lo intenta saltar) y lo apunta. Resultado en .tmp/real/resultado.json, capturas .png y el HTML
// de cada ficha.
//
// Libro de Buen Rato: si se sabe su ASIN, LUPA_BUEN_RATO_ASIN=B0… npm run test:real; si no, se busca
// «Buen Rato Recuerdos» en Amazon.es y se coge el primer libro cuyo autor sea Buen Rato.
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { RAIZ, abrir, abrirConExtension, dormir, esRobot, pausaPersona, rechazarCookies } from '../ayuda.js';

test.skip(!process.env.LUPA_REAL, 'Solo con «npm run test:real» (abre Amazon.es de verdad).');

const SALIDA = path.join(RAIZ, '.tmp', 'real');

/** Lo que enseña el panel de Lupa en la ficha abierta. */
async function leerPanel(pagina) {
  const panel = pagina.locator('lupa-kdp-panel');
  await expect(panel).toHaveCount(1, { timeout: 30_000 });
  await dormir(2500); // que acabe el contador animado
  return panel.evaluate((host) => {
    const r = host.shadowRoot;
    const t = (s) => (r.querySelector(s) ? r.querySelector(s).textContent.replace(/\s+/g, ' ').trim() : null);
    const a = (s, at) => (r.querySelector(s) ? r.querySelector(s).getAttribute(at) : null);
    const datos = {};
    for (const dd of r.querySelectorAll('[data-dato]')) datos[dd.dataset.dato] = dd.textContent.replace(/\s+/g, ' ').trim();
    return {
      titulo: t('.titulo-libro'),
      bsr: a('[data-bsr]', 'data-bsr') ? Number(a('[data-bsr]', 'data-bsr')) : null,
      bsrTexto: t('[data-seccion="bsr"]'),
      ventasDia: a('[data-contador="dia"]', 'data-valor') ? Number(a('[data-contador="dia"]', 'data-valor')) : null,
      ventasMes: a('[data-contador="mes"]', 'data-valor') ? Number(a('[data-contador="mes"]', 'data-valor')) : null,
      ventasTexto: t('[data-seccion="ventas"]'),
      etiqueta: t('[data-etiqueta]'),
      regalia: t('[data-regalia]'),
      explicacion: t('[data-explica]'),
      errores: [...r.querySelectorAll('.error')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()),
      avisos: [...r.querySelectorAll('.avisos li')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()),
      datos,
    };
  });
}

test('tres fichas reales de Amazon.es: sopa de letras, Murdoku y Buen Rato', async () => {
  test.setTimeout(20 * 60 * 1000);
  fs.mkdirSync(SALIDA, { recursive: true });
  const ext = await abrirConExtension({ ventana: true, conRed: true });
  const resultado = { fecha: new Date().toISOString(), fichas: [], parado: null };
  const guardar = () => fs.writeFileSync(path.join(SALIDA, 'resultado.json'), JSON.stringify(resultado, null, 2));
  try {
    const p = await ext.contexto.newPage();
    await abrir(p, 'https://www.amazon.es/', { espera: 3000 });
    if (await esRobot(p)) {
      resultado.parado = 'Amazon pide comprobar que eres una persona ya en la portada: prueba parada sin insistir.';
      return;
    }
    await rechazarCookies(p);

    const fichas = [
      { nombre: 'sopa de letras', url: 'https://www.amazon.es/dp/B0DZ2439GN' },
      { nombre: 'Murdoku', url: 'https://www.amazon.es/dp/B0H29QB982' },
    ];
    // Buen Rato: por su ASIN o buscándolo como lo haría Rodri.
    if (process.env.LUPA_BUEN_RATO_ASIN) fichas.push({ nombre: 'Buen Rato', url: `https://www.amazon.es/dp/${process.env.LUPA_BUEN_RATO_ASIN}` });
    else {
      await pausaPersona();
      await p.fill('#twotabsearchtextbox', 'Buen Rato Recuerdos');
      await Promise.all([p.waitForLoadState('domcontentloaded'), p.press('#twotabsearchtextbox', 'Enter')]);
      await dormir(3000);
      if (await esRobot(p)) {
        resultado.parado = 'Amazon pidió comprobar que eres una persona al buscar Buen Rato: prueba parada.';
        return;
      }
      const asin = await p.evaluate(() => {
        for (const el of document.querySelectorAll('[data-component-type="s-search-result"][data-asin]')) {
          if (/buen rato/i.test(el.textContent) && el.getAttribute('data-asin')) return el.getAttribute('data-asin');
        }
        return null;
      });
      if (asin) fichas.push({ nombre: 'Buen Rato', url: `https://www.amazon.es/dp/${asin}` });
      else resultado.fichas.push({ nombre: 'Buen Rato', error: 'No hay ningún libro de Buen Rato a la venta en Amazon.es todavía (búsqueda «Buen Rato Recuerdos»).' });
      await p.screenshot({ path: path.join(SALIDA, 'busqueda-buen-rato.png') });
    }

    for (const f of fichas) {
      await pausaPersona();
      const resp = await abrir(p, f.url);
      if (await esRobot(p)) {
        resultado.parado = `Amazon pidió comprobar que eres una persona al abrir ${f.nombre}: prueba parada sin insistir.`;
        break;
      }
      // La ficha tal como llega, por si hay que convertirla en página de prueba (scripts/recortar-fixture.mjs).
      fs.writeFileSync(path.join(SALIDA, `${f.nombre.replace(/\s+/g, '-')}.html`), resp ? await resp.text().catch(() => '') : '');
      const panel = await leerPanel(p);
      resultado.fichas.push({ nombre: f.nombre, url: f.url, ...panel });
      await p.screenshot({ path: path.join(SALIDA, `${f.nombre.replace(/\s+/g, '-')}.png`) });
      guardar();
    }
  } finally {
    guardar();
    await ext.cerrar();
  }
  // Resumen en la consola (para pegarlo en el informe).
  for (const f of resultado.fichas) {
    console.log(`${f.nombre}: ${f.error || `BSR ${f.bsr ?? 'ERROR'} · ${f.ventasDia != null ? `${f.ventasDia.toFixed(2)} ventas/día · ${f.ventasMes.toFixed(0)} al mes` : 'sin estimación'} · regalía ${f.regalia ?? 'ERROR'} · ${f.etiqueta ?? ''}`}`);
  }
  if (resultado.parado) console.log(resultado.parado);
  expect(resultado.fichas.length + (resultado.parado ? 1 : 0)).toBeGreaterThan(0);
});
