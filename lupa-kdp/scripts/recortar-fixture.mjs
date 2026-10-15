// Recorta una página guardada de Amazon para usarla en los simulacros: quita scripts, estilos,
// imágenes, menús, carruseles, anuncios y reseñas largas, y deja la estructura real (ids, clases,
// data-asin…) de lo que lee Lupa. Así las pruebas usan el HTML de verdad sin subir megas al repositorio.
//   node scripts/recortar-fixture.mjs <entrada.html> <salida.html> <ficha|busqueda|mas-vendidos> [url]
import fs from 'node:fs';
import { chromium } from '@playwright/test';
import { opcionesNavegador } from '../tests/ayuda.js';

const [entrada, salida, tipo, url = 'https://www.amazon.es/'] = process.argv.slice(2);
if (!entrada || !salida || !['ficha', 'busqueda', 'mas-vendidos'].includes(tipo)) {
  console.error('Uso: node scripts/recortar-fixture.mjs <entrada.html> <salida.html> <ficha|busqueda|mas-vendidos> [url]');
  process.exit(1);
}
const html = fs.readFileSync(entrada, 'utf8');
const navegador = await chromium.launch({ ...opcionesNavegador(), headless: true });
const pagina = await navegador.newPage({ javaScriptEnabled: false });
await pagina.route('**/*', (r) => (r.request().resourceType() === 'document' ? r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }) : r.fulfill({ status: 204, body: '' })));
await pagina.goto(url, { waitUntil: 'domcontentloaded' });
const recortado = await pagina.evaluate((tipo) => {
  const quitar = (sel) => document.querySelectorAll(sel).forEach((el) => el.remove());
  quitar('script, style, noscript, iframe, link, svg, video, audio, canvas, template, object, embed');
  quitar('meta:not([charset])');
  // Comentarios.
  const it = document.createNodeIterator(document, NodeFilter.SHOW_COMMENT);
  const comentarios = [];
  for (let c = it.nextNode(); c; c = it.nextNode()) comentarios.push(c);
  comentarios.forEach((c) => c.remove());
  // Menús, pie, carruseles, anuncios y bloques que Lupa no lee.
  quitar('#navbar, #nav-belt, #nav-main, #nav-subnav, #navFooter, #nav-flyout-anchor, #rhf, #navbar-main, header#navbar, #skiplink, #a-page > .a-section.a-spacing-none.a-padding-none');
  quitar('.a-carousel-container, [data-a-carousel-options], .a-carousel-viewport');
  quitar('[id^="sp_detail"], [id^="ad-"], [id*="AdFeedback"], [id^="dp-ads"], [cel_widget_id^="adplacements"], .s-shopping-adviser, [data-component-type="sp-sponsored-result"]');
  quitar('#customerReviews ~ *, #reviewsMedley, #cm-cr-dp-review-list, #cr-dp-review-list, #cm_cr_dp_d_rating_histogram ~ *, [data-hook="top-customer-reviews-widget"]');
  quitar('#aplus_feature_div, #aplus, #aplusBrandStory_feature_div, #books-entity-teaser, #similarities_feature_div, #sims-consolidated-1_feature_div, #sims-consolidated-2_feature_div, #HLCXComparisonWidget_feature_div, #va-related-videos-widget_feature_div, #imageBlock, #imgTagWrapperId, #main-image-container, #ebooks-img-canvas, #bookDescription_feature_div, #editorialReviews_feature_div');
  if (tipo === 'busqueda') quitar('#s-skipLinkTargetForFilters, #s-refinements, .s-desktop-toolbar, [data-component-type="s-searchgrid-carousel"], [cel_widget_id*="MAIN-FEEDBACK"], [data-component-type="s-messaging-widget-results-header"]');
  // Búsqueda: solo las tarjetas de resultados, dentro de su lista.
  if (tipo === 'busqueda') {
    const tarjetas = [...document.querySelectorAll('[data-component-type="s-search-result"]')];
    const lista = document.createElement('div');
    lista.className = 's-main-slot s-result-list s-search-results sg-row';
    tarjetas.forEach((t) => lista.appendChild(t));
    document.body.replaceChildren(lista);
  }
  // Enlaces: sin la cola de seguimiento («/ref=…»); los anuncios conservan su «/sspa/click».
  for (const a of document.querySelectorAll('a[href]')) {
    const h = a.getAttribute('href');
    if (/\/sspa\/click/.test(h)) a.setAttribute('href', h.replace(/(\/sspa\/click\?).*$/, '$1ie=UTF8'));
    else a.setAttribute('href', h.replace(/\/ref=.*$/, '').replace(/[?&](dib|dib_tag|qid|sr|keywords|crid|sprefix|content-id|pd_rd_\w+|pf_rd_\w+|psc)=[^&]*/g, ''));
  }
  // Imágenes: fuera las fotos, se quedan los contenedores.
  document.querySelectorAll('img').forEach((img) => { img.removeAttribute('src'); img.removeAttribute('srcset'); img.removeAttribute('data-a-dynamic-image'); img.removeAttribute('data-old-hires'); });
  // Atributos pesados que no sirven para leer.
  for (const el of document.querySelectorAll('*')) {
    for (const a of [...el.attributes]) {
      if (/^on|^data-a-(state|modal|popover|dynamic|carousel|tabs|expander)|^data-csa-c-|^data-p13n-asin-metadata|^data-client-recs|^style$|^jsdata|^jsaction|^data-action-payload/i.test(a.name)) el.removeAttribute(a.name);
      else if (a.value.length > 600 && a.name !== 'href') el.removeAttribute(a.name);
    }
  }
  // Elementos vacíos sin id ni clase útil: fuera (varias pasadas).
  for (let i = 0; i < 3; i++) {
    for (const el of [...document.querySelectorAll('div, span')]) {
      if (!el.children.length && !el.textContent.trim() && !el.id && !el.hasAttribute('data-asin') && !el.hasAttribute('data-cy') && !el.hasAttribute('data-component-type')) el.remove();
    }
  }
  return '<!doctype html>\n' + document.documentElement.outerHTML.replace(/\n\s*\n+/g, '\n').replace(/[ \t]{2,}/g, ' ');
}, tipo);
const aviso = `<!-- Página REAL de Amazon recortada para los simulacros de Lupa KDP (${tipo}). Origen: ${url} · capturada el ${new Date().toISOString().slice(0, 10)}. Sin scripts, imágenes, menús, anuncios ni reseñas. -->\n`;
fs.writeFileSync(salida, recortado.replace('<!doctype html>\n', `<!doctype html>\n${aviso}`));
console.log(`${salida}: ${(fs.statSync(salida).size / 1024).toFixed(0)} KB (antes ${(html.length / 1024).toFixed(0)} KB)`);
await navegador.close();
