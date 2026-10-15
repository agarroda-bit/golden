/* Lupa KDP — las dos tiendas que lee: Amazon.es y Amazon.com.
   Moneda, IVA de los libros (KDP calcula la regalía con el precio SIN IVA) y textos que hay que
   reconocer en cada ficha. Los textos de Amazon están todos aquí para cambiarlos en un solo sitio. */
(function (L) {
  'use strict';

  L.TIENDAS = {
    'amazon.es': {
      id: 'amazon.es',
      nombre: 'Amazon.es',
      moneda: 'EUR',
      // IVA de los libros en España: 4 % (papel y libro electrónico). Amazon.es enseña el precio con IVA.
      iva: 0.04,
      // Kindle: el 70 % solo entre 2,99 € y 9,99 € (precio con IVA); entrega 0,10 €/MB (ejemplo de KDP para España).
      kindle70: [2.99, 9.99],
      entregaMB: 0.1,
      mercadoKdp: 'EUR',
    },
    'amazon.com': {
      id: 'amazon.com',
      nombre: 'Amazon.com',
      moneda: 'USD',
      // En EE. UU. el precio de la ficha no lleva impuestos.
      iva: 0,
      kindle70: [2.99, 9.99],
      entregaMB: 0.15,
      mercadoKdp: 'USD',
    },
  };

  /**
   * ¿Qué IVA lleva el precio que enseña Amazon.es? Depende de la dirección de entrega de la cabecera
   * («Entrega en Madrid 28013», «Enviar a Estados Unidos»). Comprobado el 15/10/2026 con la misma
   * sopa de letras: 5,99 € entregando en Madrid y 5,76 € (= 5,99 / 1,04) entregando en Estados Unidos.
   *   'espana'  → península y Baleares: lleva el 4 % de IVA (lo normal para Rodri).
   *   'sin-iva' → Canarias, Ceuta, Melilla y países de fuera de la UE: Amazon lo enseña ya sin IVA.
   *   'ue'      → otro país de la UE: lleva el IVA de los libros de ese país (que no es el 4 %).
   *   null      → no se sabe: se supone España, como siempre.
   */
  const PAISES_UE = /alemania|austria|b[eé]lgica|bulgaria|chipre|croacia|dinamarca|eslovaquia|eslovenia|estonia|finlandia|francia|grecia|hungr[ií]a|irlanda|italia|letonia|lituania|luxemburgo|malta|pa[ií]ses bajos|holanda|polonia|portugal|rep[uú]blica checa|chequia|ruman[ií]a|suecia/i;
  const FUERA_UE = /estados unidos|ee\.\s?uu\.|reino unido|suiza|noruega|islandia|andorra|gibraltar|liechtenstein|m[oó]naco|san marino|marruecos|m[eé]xico|canad[aá]|argentina|chile|colombia|per[uú]|brasil|uruguay|venezuela|ecuador|bolivia|paraguay|cuba|rep[uú]blica dominicana|puerto rico|costa rica|panam[aá]|guatemala|australia|nueva zelanda|jap[oó]n|china|india|turqu[ií]a|israel|emiratos|arabia saud[ií]|sud[aá]frica|singapur|corea/i;
  L.zonaDeEntrega = (texto) => {
    const t = L.limpiar(texto);
    if (!t) return null;
    const cp = t.match(/\b(\d{2})\d{3}\b/);
    if (/canarias|las palmas|tenerife|ceuta|melilla/i.test(t) || (cp && ['35', '38', '51', '52'].includes(cp[1]))) return 'sin-iva';
    if (/espa[nñ]a/i.test(t) || (cp && Number(cp[1]) >= 1 && Number(cp[1]) <= 50)) return 'espana';
    if (FUERA_UE.test(t)) return 'sin-iva';
    if (PAISES_UE.test(t)) return 'ue';
    return null;
  };

  /** «www.amazon.es» → 'amazon.es'; cualquier otra web → null. */
  L.tiendaDeHost = (host) => {
    const h = String(host || '').toLowerCase().replace(/^www\.|^smile\./, '');
    return L.TIENDAS[h] ? h : null;
  };

  /** Formato de una ficha → 'impreso' | 'kindle' | 'otro' (para elegir la curva y la regalía). */
  L.tipoFormato = (formato) => {
    const f = L.normalizar(formato);
    if (!f) return null;
    if (/kindle|ebook|e-book|libro electronico|edicion kindle|version kindle/.test(f)) return 'kindle';
    if (/audio|audible|mp3|cd\b|casete/.test(f)) return 'otro';
    if (/tapa blanda|tapa dura|bolsillo|espiral|rustica|encuadernacion|paperback|hardcover|spiral|board book|cartone|mass market|libro de carton|tapa flexible|grapado|plastificado|ring-bound|loose leaf/.test(f)) return 'impreso';
    return 'otro';
  };

  /** Tipo de encuadernación para la regalía: 'tapa blanda' | 'tapa dura' | null. */
  L.encuadernacion = (formato) => {
    const f = L.normalizar(formato);
    if (/tapa dura|hardcover|cartone/.test(f)) return 'tapa dura';
    if (/tapa blanda|paperback|bolsillo|rustica|mass market|tapa flexible/.test(f)) return 'tapa blanda';
    return null;
  };

  /** Textos de Amazon que el lector reconoce (castellano e inglés). */
  L.TEXTOS = {
    // Cabecera del puesto en ventas en la ficha.
    bsr: [/clasificaci[oó]n en los m[aá]s vendidos/i, /best\s*sellers?\s*rank/i, /ranking de los m[aá]s vendidos/i],
    // Categoría general de cada formato (la que sirve para estimar ventas).
    generalImpreso: [/^libros$/i, /^books$/i],
    generalKindle: [/^tienda kindle$/i, /^kindle store$/i, /^tienda de kindle$/i],
    paginas: [/n[uú]mero de p[aá]ginas/i, /longitud de impresi[oó]n/i, /print length/i, /^tapa blanda$/i, /^tapa dura$/i, /^paperback$/i, /^hardcover$/i, /^libro de bolsillo$/i, /^espiral$/i],
    dimensiones: [/^dimensiones$/i, /^dimensions$/i, /^dimensiones del producto$/i, /^product dimensions$/i],
    fecha: [/fecha de publicaci[oó]n/i, /publication date/i],
    editorial: [/^editorial$/i, /^publisher$/i],
    idioma: [/^idioma$/i, /^language$/i],
    tamanoArchivo: [/tama[nñ]o del archivo/i, /file size/i],
    isbn10: [/^isbn-10$/i],
    isbn13: [/^isbn-13$/i],
    asin: [/^asin$/i],
    // Página de «comprueba que no eres un robot».
    robot: [
      /introduce los caracteres que (ves|aparecen)/i,
      /haz clic en el bot[oó]n de abajo para seguir comprando/i,
      /enter the characters you see below/i,
      /click the button below to continue shopping/i,
      /sorry, we just need to make sure you('|’)re not a robot/i,
      /lo sentimos, solo necesitamos asegurarnos de que no eres un robot/i,
    ],
  };
})((globalThis.LUPA = globalThis.LUPA || {}));
