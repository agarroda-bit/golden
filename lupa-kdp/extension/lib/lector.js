/* Lupa KDP — lector de páginas de Amazon (fichas, búsquedas y «Los más vendidos»).

   Funciona igual con la página abierta y con una ficha descargada en segundo plano y convertida con
   DOMParser: por eso solo usa textContent (innerText necesita la página pintada) y selectores de
   Amazon que llevan años igual (#productTitle, listas de «Detalles del producto», data-asin…).
   Lo que no se pueda leer se devuelve como null junto a su motivo: nunca se rellena con una cifra
   inventada. Los textos de Amazon están en tiendas.js (L.TEXTOS). */
(function (L) {
  'use strict';

  const T = () => L.TEXTOS;
  const txt = (el) => (el ? L.limpiar(el.textContent) : '');
  const primero = (doc, selectores) => {
    for (const s of selectores) {
      const el = doc.querySelector(s);
      if (el && txt(el)) return el;
    }
    return null;
  };
  const casa = (texto, lista) => lista.some((re) => re.test(texto));

  /** ¿Es la página de «comprueba que no eres un robot»? Devuelve el motivo o null. */
  function detectarRobot(doc) {
    if (!doc) return null;
    if (doc.querySelector('form[action*="validateCaptcha"], form[action*="/errors/validateCaptcha"], input#captchacharacters')) {
      return 'Amazon pide comprobar que eres una persona';
    }
    const cuerpo = txt(doc.body).slice(0, 4000);
    if (casa(cuerpo, T().robot)) return 'Amazon pide comprobar que eres una persona';
    return null;
  }

  /** ASIN de una dirección de Amazon (/dp/…, /gp/product/…, /gp/aw/d/…). */
  function asinDeUrl(url) {
    const m = String(url || '').match(/\/(?:dp|gp\/product|gp\/aw\/d|exec\/obidos\/asin|o\/ASIN)\/([A-Z0-9]{10})(?:[/?#]|$)/i);
    return m ? m[1].toUpperCase() : null;
  }

  /** Tipo de página por su dirección y su contenido. */
  function tipoPagina(doc, url) {
    const u = String(url || '');
    if (detectarRobot(doc)) return 'robot';
    if (/\/(gp\/bestsellers|zgbs|gp\/new-releases|gp\/movers-and-shakers|gp\/most-wished-for|gp\/most-gifted)\b|\/bestsellers\//i.test(u)) return 'mas-vendidos';
    if (doc.querySelector('#productTitle, #ebooksProductTitle') || asinDeUrl(u)) {
      if (doc.querySelector('#productTitle, #ebooksProductTitle, #dp, #dp-container')) return 'ficha';
    }
    if (/\/s\?|\/s\/|[?&]k=/.test(u) || doc.querySelector('[data-component-type="s-search-result"]')) return 'busqueda';
    return 'otra';
  }

  // ------------------------------------------------------------------ detalles del producto

  /** Etiqueta limpia: sin los «:» ni las marcas invisibles que Amazon pone alrededor. */
  const etiquetaLimpia = (s) => L.limpiar(s).replace(/\s*:\s*$/, '').replace(/^\s*:\s*/, '').trim();

  /**
   * Mapa «etiqueta → valor» con todo lo que trae la ficha en sus listas de detalles:
   * viñetas (#detailBullets), tablas (#productDetails…) y el carrusel nuevo (#rpi-attribute-…).
   */
  function detalles(doc) {
    const mapa = new Map();
    const poner = (k, v) => {
      const kk = etiquetaLimpia(k);
      const vv = L.limpiar(v);
      if (kk && vv && !mapa.has(kk)) mapa.set(kk, vv);
    };
    // Viñetas: <span class="a-text-bold">Editorial ‏ : ‎</span><span>…</span>
    for (const li of doc.querySelectorAll('#detailBullets_feature_div li, #detailBulletsWrapper_feature_div li, .detail-bullet-list li')) {
      const negrita = li.querySelector('.a-text-bold');
      if (!negrita) continue;
      const k = txt(negrita);
      const v = L.limpiar(txt(li).slice(k.length));
      poner(k, v);
    }
    // Tablas de detalles.
    for (const tr of doc.querySelectorAll('#productDetails_detailBullets_sections1 tr, #productDetailsTable tr, #productDetails_techSpec_section_1 tr, table.prodDetTable tr')) {
      const th = tr.querySelector('th');
      const td = tr.querySelector('td');
      if (th && td) poner(txt(th), txt(td));
    }
    // Carrusel de «Información del producto» (fichas nuevas).
    for (const at of doc.querySelectorAll('[id^="rpi-attribute-"]')) {
      const k = at.querySelector('.rpi-attribute-label');
      const v = at.querySelector('.rpi-attribute-value');
      if (k && v) poner(txt(k), txt(v));
    }
    return mapa;
  }

  /** Busca en los detalles la primera etiqueta que case con alguna expresión. */
  function detalle(mapa, expresiones) {
    for (const [k, v] of mapa) if (casa(k, expresiones)) return { etiqueta: k, valor: v };
    return null;
  }

  // ------------------------------------------------------------------ BSR

  const RE_PUESTO = /(?:n\.?\s?[ºo°]|#)\s*([\d][\d.,\s]*)\s+(?:en|in)\s+(.+?)(?=\s*\((?:ver|see)\b|\s*(?:n\.?\s?[ºo°]|#)\s*\d|$)/gi;

  /** Texto del bloque «Clasificación en los más vendidos de Amazon» (o null si no está). */
  function textoBsr(doc) {
    // 1) Viñetas y tablas: el elemento cuya etiqueta es la del BSR.
    for (const el of doc.querySelectorAll('#detailBulletsWrapper_feature_div li, #detailBullets_feature_div li, .detail-bullet-list li, #productDetails_detailBullets_sections1 tr, #productDetailsTable tr, table.prodDetTable tr, #SalesRank')) {
      const t = txt(el);
      if (casa(t.slice(0, 80), T().bsr)) return t;
    }
    // 2) Cualquier sitio de la ficha (diseños nuevos): se busca el texto y se sube a su bloque.
    const recorrido = doc.createTreeWalker(doc.body || doc, 4 /* NodeFilter.SHOW_TEXT */);
    let nodo;
    while ((nodo = recorrido.nextNode())) {
      if (!casa(nodo.nodeValue, T().bsr)) continue;
      const bloque = nodo.parentElement && (nodo.parentElement.closest('li, tr, div') || nodo.parentElement);
      if (bloque) return txt(bloque);
    }
    return null;
  }

  /**
   * Puesto en ventas: { general, categoriaGeneral, categorias: [{ puesto, nombre }], texto } o con motivo.
   * El general es el de «Libros» (papel) o «Tienda Kindle»; los demás son categorías.
   */
  function leerBsr(doc) {
    const texto = textoBsr(doc);
    if (!texto) {
      return { general: null, categoriaGeneral: null, categorias: [], texto: null, motivo: 'no aparece el puesto en ventas (BSR) en la ficha: Amazon no lo enseña en libros que aún no se han vendido' };
    }
    const sinCabecera = texto.replace(/^.*?(?:amazon|rank)\s*:?\s*/i, '');
    const puestos = [];
    let m;
    RE_PUESTO.lastIndex = 0;
    while ((m = RE_PUESTO.exec(sinCabecera))) {
      const puesto = L.entero(m[1]);
      const nombre = L.limpiar(m[2]).replace(/\s*\(.*$/, '').replace(/[.,;]\s*$/, '');
      if (puesto && nombre) puestos.push({ puesto, nombre });
    }
    if (!puestos.length) {
      return { general: null, categoriaGeneral: null, categorias: [], texto, motivo: `no se entiende el puesto en ventas («${texto.slice(0, 120)}»)` };
    }
    const esGeneral = (n) => casa(n, T().generalImpreso) || casa(n, T().generalKindle);
    const idx = puestos.findIndex((p) => esGeneral(p.nombre));
    if (idx === -1) {
      return {
        general: null,
        categoriaGeneral: null,
        categorias: puestos,
        texto,
        motivo: 'solo aparece el puesto en categorías, no el general de Libros o Tienda Kindle: con eso no se puede estimar',
      };
    }
    const g = puestos[idx];
    return { general: g.puesto, categoriaGeneral: g.nombre, categorias: puestos.filter((_, i) => i !== idx), texto };
  }

  // ------------------------------------------------------------------ precio y formato

  // Primero el precio de la caja de compra; si la ficha llega sin él (pasa al leerla en segundo plano:
  // Amazon lo rellena después con sus scripts), el del formato elegido («desde 5,99 €»).
  const SEL_PRECIO = [
    '#corePriceDisplay_desktop_feature_div .priceToPay .a-offscreen',
    '#corePrice_feature_div .priceToPay .a-offscreen',
    '#apex_desktop .priceToPay .a-offscreen',
    '#corePriceDisplay_desktop_feature_div .a-price:not(.a-text-price) .a-offscreen',
    '#corePrice_feature_div .a-price:not(.a-text-price) .a-offscreen',
    '#price',
    '#newBuyBoxPrice',
    '#kindle-price',
    '#price_inside_buybox',
    '[id^="tmm-grid-swatch-"].selected .slot-price .a-offscreen',
    '[id^="tmm-grid-swatch-"].selected .slot-price',
    '#tmmSwatches .swatchElement.selected .slot-price .a-color-price',
    '#tmmSwatches .swatchElement.selected .slot-price .a-color-base',
    '#tmmSwatches .swatchElement.selected .slot-price',
    '#tmmSwatches .a-button-selected .slot-price',
    '#buyNewSection .a-color-price',
    '#buybox .a-color-price',
  ];
  const SEL_CATALOGO = ['.basisPrice .a-offscreen', '#listPrice', '#corePriceDisplay_desktop_feature_div .a-text-price .a-offscreen', '.a-price.a-text-price[data-a-strike="true"] .a-offscreen'];

  /** «12,99 €» / «$12.99» / «12,99 US$» → número (o null). */
  function precioDeTexto(t) {
    const s = L.limpiar(t);
    if (!/\d/.test(s)) return null;
    const m = s.match(/(\d[\d.,\s]*\d|\d)/);
    if (!m) return null;
    const n = L.decimal(m[1].replace(/\s/g, ''));
    return Number.isFinite(n) && n > 0 && n < 10000 ? n : null;
  }

  function leerPrecio(doc) {
    for (const s of SEL_PRECIO) {
      const el = doc.querySelector(s);
      if (!el) continue;
      const p = precioDeTexto(txt(el));
      if (p != null) return { precio: p, origen: s };
    }
    return { precio: null, motivo: 'no se ve el precio en la ficha (¿no disponible o solo de segunda mano?)' };
  }

  function leerPrecioCatalogo(doc) {
    for (const s of SEL_CATALOGO) {
      const el = doc.querySelector(s);
      if (!el) continue;
      const p = precioDeTexto(txt(el));
      if (p != null) return p;
    }
    return null;
  }

  function leerFormato(doc, mapa) {
    const binding = primero(doc, ['#productBinding', '#bookEdition + #productBinding']);
    if (binding) return txt(binding);
    // Fichas actuales: en la línea del autor, «Formato: Tapa blanda».
    for (const s of doc.querySelectorAll('#bylineInfo span')) {
      if (/^(formato|format)\s*:?$/i.test(txt(s)) && s.nextElementSibling && txt(s.nextElementSibling)) return txt(s.nextElementSibling);
    }
    const sub = primero(doc, ['#productSubtitle', '#subtitle', '#bookEdition']);
    if (sub) {
      const f = txt(sub).split(/\s[–—-]\s/)[0];
      if (L.tipoFormato(f) && L.tipoFormato(f) !== 'otro') return f;
    }
    const sel = primero(doc, ['#tmmSwatches .swatchElement.selected .slot-title', '#tmmSwatches .swatchElement.selected a > span:first-child', '[id^="tmm-grid-swatch-"].selected .slot-title', '#tmmSwatches .a-button-selected .a-button-text span:first-child']);
    if (sel) return txt(sel).replace(/\s*\d.*$/, '');
    const selId = doc.querySelector('[id^="tmm-grid-swatch-"].selected');
    if (selId) {
      const tipo = selId.id.replace('tmm-grid-swatch-', '');
      const nombres = { PAPERBACK: 'Tapa blanda', HARDCOVER: 'Tapa dura', KINDLE: 'Versión Kindle', SPIRAL_BOUND: 'Espiral' };
      if (nombres[tipo]) return nombres[tipo];
    }
    // En las viñetas de detalles: «Tapa blanda : 104 páginas».
    for (const [k] of mapa) if (L.tipoFormato(k) === 'impreso') return k;
    if (detalle(mapa, T().tamanoArchivo)) return 'Versión Kindle';
    if (doc.querySelector('#ebooksProductTitle, #kindle-price')) return 'Versión Kindle';
    return null;
  }

  /** «492 Reseñas», «(1.234)», «1,2 mil valoraciones», «12K ratings» → número (o null). */
  function numeroResenas(texto) {
    const t = L.limpiar(texto);
    const mil = t.match(/(\d+(?:[.,]\d+)?)\s*(mil|k)\b/i);
    if (mil) return Math.round(L.decimal(mil[1]) * 1000);
    const m = t.match(/\d[\d.,\s]*/);
    return m ? L.entero(m[0]) : null;
  }

  // ------------------------------------------------------------------ la ficha entera

  /**
   * Lee una ficha de producto. Devuelve un objeto con todos los datos y, para cada uno que no se
   * haya podido leer, su motivo en «faltan».
   */
  function leerFicha(doc, url) {
    const u = new URL(url, 'https://www.amazon.es/');
    const tienda = L.tiendaDeHost(u.hostname);
    const faltan = {};
    const robot = detectarRobot(doc);
    if (robot) return { ok: false, robot: true, motivo: robot, url: u.href };
    if (!doc.querySelector('#productTitle, #ebooksProductTitle, #dp, #dp-container')) {
      return { ok: false, motivo: 'esta página no es la ficha de un producto', url: u.href };
    }
    const mapa = detalles(doc);

    let asin = asinDeUrl(u.href);
    if (!asin) {
      const campo = doc.querySelector('input#ASIN, input[name="ASIN"], input[name="ASIN.0"]');
      if (campo && /^[A-Z0-9]{10}$/i.test(campo.value)) asin = campo.value.toUpperCase();
    }
    if (!asin) {
      const d = detalle(mapa, T().asin);
      if (d && /^[A-Z0-9]{10}$/i.test(d.valor)) asin = d.valor.toUpperCase();
    }

    const tituloEl = primero(doc, ['#productTitle', '#ebooksProductTitle', '#title']);
    const titulo = tituloEl ? txt(tituloEl) : null;
    if (!titulo) faltan.titulo = 'no se ve el título';

    const autores = [...doc.querySelectorAll('#bylineInfo .author a.a-link-normal, #bylineInfo .author .contributorNameID, #bylineInfo a.contributorNameID')]
      .map(txt)
      .filter((x) => x && !/^\(|^ver |^see /i.test(x));
    const autor = [...new Set(autores)].join(', ') || null;

    const formato = leerFormato(doc, mapa);
    if (!formato) faltan.formato = 'no se ve el formato (tapa blanda, Kindle…)';

    const pr = leerPrecio(doc);
    if (pr.precio == null) faltan.precio = pr.motivo;
    const precioCatalogo = leerPrecioCatalogo(doc);

    // Páginas: «Número de páginas», «Longitud de impresión» o la línea «Tapa blanda : 104 páginas».
    let paginas = null;
    for (const [k, v] of mapa) {
      if (casa(k, T().paginas) && /p[aá]ginas|pages/i.test(v)) {
        paginas = L.entero(v.match(/(\d[\d.,]*)\s*(?:p[aá]ginas|pages)/i)?.[1]);
        if (paginas) break;
      }
    }
    if (!paginas) faltan.paginas = 'no se ve el número de páginas';

    const dims = detalle(mapa, T().dimensiones);
    const medidas = dims ? dims.valor : null;
    if (!medidas && L.tipoFormato(formato) !== 'kindle') faltan.medidas = 'no se ven las medidas del libro';

    // Fecha de publicación: su propia línea o entre paréntesis detrás de la editorial.
    let fechaPublicacion = null;
    const f = detalle(mapa, T().fecha);
    if (f) fechaPublicacion = L.fechaTexto(f.valor);
    const ed = detalle(mapa, T().editorial);
    if (!fechaPublicacion && ed) {
      const entre = ed.valor.match(/\(([^)]*\d{4}[^)]*)\)/);
      if (entre) fechaPublicacion = L.fechaTexto(entre[1]);
    }
    if (!fechaPublicacion) {
      const sub = doc.querySelector('#productSubtitle, #subtitle');
      if (sub) fechaPublicacion = L.fechaTexto(txt(sub));
    }
    if (!fechaPublicacion) faltan.fechaPublicacion = 'no se ve la fecha de publicación';
    const editorial = ed ? L.limpiar(ed.valor.replace(/\(.*\)/, '').replace(/;.*$/, '')) || null : null;

    // Reseñas y nota.
    let resenas = null;
    const r = doc.querySelector('#acrCustomerReviewText, #acrCustomerReviewLink #acrCustomerReviewText');
    if (r) resenas = numeroResenas(r.getAttribute('aria-label') || '') ?? numeroResenas(txt(r));
    else if (doc.querySelector('#averageCustomerReviews_feature_div, #averageCustomerReviews') && /s[eé] el primero|be the first|sin valoraciones|no customer reviews/i.test(txt(doc.querySelector('#averageCustomerReviews_feature_div, #averageCustomerReviews')))) resenas = 0;
    let nota = null;
    const pop = doc.querySelector('#acrPopover');
    const notaTexto = (pop && (pop.getAttribute('title') || txt(pop.querySelector('.a-icon-alt')))) || txt(doc.querySelector('[data-hook="rating-out-of-text"]')) || txt(doc.querySelector('#averageCustomerReviews .a-icon-alt'));
    if (notaTexto) {
      const nm = notaTexto.match(/(\d+(?:[.,]\d+)?)\s*(?:de|out of)\s*5/i);
      if (nm) nota = L.decimal(nm[1]);
    }
    if (resenas == null) faltan.resenas = 'no se ve el número de reseñas';
    if (nota == null && resenas !== 0) faltan.nota = 'no se ve la nota';

    // Kindle: tamaño del archivo («2345 KB»).
    let tamanoArchivoMB = null;
    const ta = detalle(mapa, T().tamanoArchivo);
    if (ta) {
      const n = L.decimal(ta.valor);
      if (Number.isFinite(n)) tamanoArchivoMB = /mb/i.test(ta.valor) ? n : n / 1024;
    }

    const bsr = leerBsr(doc);
    if (bsr.general == null) faltan.bsr = bsr.motivo;

    const isbn13 = detalle(mapa, T().isbn13);
    const idioma = detalle(mapa, T().idioma);
    return {
      ok: true,
      tienda,
      url: `${u.origin}/dp/${asin || ''}`,
      asin,
      titulo,
      autor,
      formato,
      precio: pr.precio,
      precioCatalogo: precioCatalogo != null && pr.precio != null && precioCatalogo > pr.precio ? precioCatalogo : null,
      moneda: tienda ? L.TIENDAS[tienda].moneda : null,
      paginas,
      medidas,
      fechaPublicacion,
      editorial,
      idioma: idioma ? idioma.valor : null,
      isbn13: isbn13 ? isbn13.valor : null,
      resenas,
      nota,
      tamanoArchivoMB,
      bsr,
      faltan,
      leido: new Date().toISOString(),
    };
  }

  /**
   * ¿Es un libro? (Lupa solo enseña su panel en libros, no en relojes ni en nada más.)
   * Señales: la ficha se marca como libro, trae ISBN o «Longitud de impresión», su formato es de libro o
   * su puesto general es en Libros / Tienda Kindle.
   */
  function esLibro(doc, ficha) {
    if (!ficha || !ficha.ok) return false;
    const dp = doc.querySelector('#dp');
    if (dp && /\b(book|ebooks)\b/.test(dp.className)) return true;
    if (ficha.formato && L.tipoFormato(ficha.formato) !== 'otro') return true;
    if (ficha.bsr && ficha.bsr.categoriaGeneral) return true;
    if (ficha.isbn13 || ficha.tamanoArchivoMB != null) return true;
    if (doc.querySelector('[id^="tmm-grid-swatch-PAPERBACK"], [id^="tmm-grid-swatch-HARDCOVER"], [id^="tmm-grid-swatch-KINDLE"], #ebooksProductTitle')) return true;
    for (const [k] of detalles(doc)) if (casa(k, T().paginas) || casa(k, T().isbn13) || casa(k, T().isbn10)) return true;
    return false;
  }

  /** ¿La tarjeta de una búsqueda es de un libro? (enseña un formato de libro o la línea «de AUTOR | fecha»). */
  const FORMATOS_TARJETA = /\b(tapa blanda|tapa dura|versi[oó]n kindle|formato kindle|kindle|libro de bolsillo|espiral|paperback|hardcover|audiolibro|audible)\b/i;
  function tarjetaDeLibro(el) {
    return FORMATOS_TARJETA.test(txt(el.querySelector('[data-cy="price-recipe"]') || el).slice(0, 4000));
  }

  /** ¿La página de «Los más vendidos» es de libros o de Kindle? */
  const esListaDeLibros = (url) => /\/(books|digital-text|kindle-store|boost|libros)\b|\/zgbs\/(books|digital-text)/i.test(String(url || ''));

  // ------------------------------------------------------------------ listas

  /** Contenedor de cada libro en «Los más vendidos» (varios diseños de Amazon). */
  const SEL_MAS_VENDIDOS = ['#gridItemRoot', '.zg-grid-general-faceout', '[id^="p13n-asin-index-"]', 'li.zg-item-immersion', '.zg_itemImmersion'];

  /**
   * Libros de una búsqueda o de «Los más vendidos».
   * Devuelve { tipo, items: [{ asin, titulo, elemento, patrocinado, puesto }] } sin ASIN repetidos.
   */
  function leerLista(doc, url) {
    const tipo = tipoPagina(doc, url);
    const items = [];
    const vistos = new Set();
    const anadir = (elemento, asin, extra) => {
      if (!asin || !/^[A-Z0-9]{10}$/.test(asin) || vistos.has(asin)) return;
      vistos.add(asin);
      items.push({ asin, elemento, ...extra });
    };
    if (tipo === 'busqueda') {
      for (const el of doc.querySelectorAll('[data-component-type="s-search-result"][data-asin]')) {
        if (!tarjetaDeLibro(el)) continue;
        const asin = (el.getAttribute('data-asin') || '').toUpperCase();
        const h2 = el.querySelector('h2');
        const titulo = h2 ? L.limpiar(h2.getAttribute('aria-label') || txt(h2)).replace(/^(anuncio patrocinado|sponsored ad)\s*[-–:]\s*/i, '') : null;
        const patrocinado = el.classList.contains('AdHolder') || !!el.querySelector('a[href*="/sspa/click"]');
        anadir(el, asin, { titulo, patrocinado, puesto: null });
      }
    } else if (tipo === 'mas-vendidos' && esListaDeLibros(url)) {
      let contenedores = [];
      for (const s of SEL_MAS_VENDIDOS) {
        contenedores = [...doc.querySelectorAll(s)];
        if (contenedores.length) break;
      }
      for (const el of contenedores) {
        let asin = null;
        const conAsin = el.matches('[data-asin]') ? el : el.querySelector('[data-asin]');
        if (conAsin && conAsin.getAttribute('data-asin')) asin = conAsin.getAttribute('data-asin').toUpperCase();
        if (!asin) {
          const conId = el.querySelector('[id]');
          if (conId && /^[A-Z0-9]{10}$/.test(conId.id)) asin = conId.id;
        }
        if (!asin) {
          const a = el.querySelector('a[href*="/dp/"]');
          asin = a ? asinDeUrl(a.getAttribute('href')) : null;
        }
        const insignia = el.querySelector('.zg-bdg-text, .zg-badge-text');
        const puesto = insignia ? L.entero(txt(insignia)) : null;
        const tituloEl = el.querySelector('._cDEzb_p13n-sc-css-line-clamp-1_1Fn1y, ._cDEzb_p13n-sc-css-line-clamp-2_EWgCb, ._cDEzb_p13n-sc-css-line-clamp-3_g3dy1, [class*="line-clamp"], .p13n-sc-truncate, .p13n-sc-truncated, img[alt]');
        const titulo = tituloEl ? L.limpiar(tituloEl.tagName === 'IMG' ? tituloEl.getAttribute('alt') : txt(tituloEl)) : null;
        anadir(el, asin, { titulo, patrocinado: false, puesto });
      }
    }
    return { tipo, items };
  }

  L.lector = { detectarRobot, asinDeUrl, tipoPagina, detalles, leerBsr, leerPrecio, leerFicha, leerLista, precioDeTexto, numeroResenas, esLibro, esListaDeLibros };
})((globalThis.LUPA = globalThis.LUPA || {}));
