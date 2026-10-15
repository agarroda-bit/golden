/* Lupa KDP — regalía estimada por ejemplar.

   Papel (tapa blanda y tapa dura), como la calcula KDP:
     regalía = % × precio sin IVA − coste de impresión
   · % = 60 % si el precio sin IVA llega a 9,99 € (o 9,99 $); si no, 50 % (cambio de KDP del 10/06/2025).
   · Amazon.es enseña el precio con el 4 % de IVA de los libros: se quita antes de calcular.
   · Coste de impresión según páginas, tamaño (normal o grande) y tinta: tablas oficiales de KDP
     (kdp.amazon.com, «Printing cost» y «Hardcover printing cost», consultadas el 14/10/2026).
   Kindle: 70 % del precio sin IVA menos la entrega (entre 2,99 y 9,99), o 35 % fuera de esa franja.

   Nunca inventa: si falta el precio, las páginas o el tamaño, devuelve el motivo. */
(function (L) {
  'use strict';

  // Tamaño grande: más de 6,12" (15,55 cm) de ancho o más de 9" (22,86 cm) de alto.
  const ANCHO_MAX_NORMAL_CM = 15.55;
  const ALTO_MAX_NORMAL_CM = 22.86;

  // [páginas desde, páginas hasta, fijo normal, por página normal, fijo grande, por página grande]
  const TABLAS = {
    'tapa blanda': {
      negra: {
        EUR: [[24, 110, 2.05, 0, 2.48, 0], [111, 828, 0.75, 0.012, 0.75, 0.016]],
        USD: [[24, 110, 2.3, 0, 2.84, 0], [111, 828, 1.0, 0.012, 1.0, 0.017]],
      },
      'color estándar': {
        EUR: [[72, 600, 0.75, 0.024, 0.75, 0.035]],
        USD: [[72, 600, 1.0, 0.0255, 1.0, 0.0402]],
      },
      'color prémium': {
        EUR: [[24, 41, 2.85, 0, 3.61, 0], [42, 828, 0.75, 0.0525, 0.75, 0.0715]],
        USD: [[24, 41, 3.6, 0, 4.2, 0], [42, 828, 1.0, 0.065, 1.0, 0.08]],
      },
    },
    'tapa dura': {
      negra: {
        EUR: [[75, 108, 5.95, 0, 6.35, 0], [109, 550, 4.65, 0.012, 4.65, 0.016]],
        USD: [[75, 108, 6.8, 0, 7.49, 0], [109, 550, 5.65, 0.012, 5.65, 0.017]],
      },
      'color prémium': {
        EUR: [[75, 550, 4.65, 0.057, 4.65, 0.072]],
        USD: [[75, 550, 5.65, 0.065, 5.65, 0.08]],
      },
    },
  };

  L.TINTAS = ['negra', 'color estándar', 'color prémium'];

  /**
   * Tamaño a partir de las medidas de la ficha («21.59 x 0.86 x 27.94 cm», «8.5 x 0.24 x 11 inches»).
   * Devuelve { ok, tamano: 'normal'|'grande', anchoCm, altoCm } o el motivo.
   */
  function tamanoDeMedidas(texto) {
    if (!texto) return L.error('no se ven las medidas del libro');
    const s = L.limpiar(texto).toLowerCase();
    const numeros = (s.match(/\d+(?:[.,]\d+)?/g) || []).map((x) => Number.parseFloat(x.replace(',', '.')));
    if (numeros.length < 2) return L.error(`no entiendo las medidas «${L.limpiar(texto)}»`);
    let factor = 1;
    if (/pulgadas|inches|\bin\b|"/.test(s)) factor = 2.54;
    else if (/\bmm\b|mil[ií]metros/.test(s)) factor = 0.1;
    else if (!/\bcm\b|cent[ií]metros/.test(s)) return L.error(`no sé en qué unidad están las medidas «${L.limpiar(texto)}»`);
    const cm = numeros.map((n) => n * factor).sort((a, b) => a - b);
    // Con tres medidas, la más pequeña es el grosor del lomo; ancho y alto son las otras dos.
    const [ancho, alto] = cm.length >= 3 ? [cm[1], cm[2]] : [cm[0], cm[1]];
    const grande = ancho > ANCHO_MAX_NORMAL_CM + 0.05 || alto > ALTO_MAX_NORMAL_CM + 0.05;
    return { ok: true, tamano: grande ? 'grande' : 'normal', anchoCm: L.redondear(ancho, 2), altoCm: L.redondear(alto, 2) };
  }

  /** Coste de impresión de KDP. Devuelve { ok, coste, detalle } o el motivo. */
  function costeImpresion({ encuadernacion, tinta = 'negra', paginas, tamano, moneda }) {
    const enc = TABLAS[encuadernacion];
    if (!enc) return L.error(`no hay costes de impresión de KDP para «${encuadernacion || 'este formato'}»`);
    const t = enc[tinta];
    if (!t) return L.error(`KDP no imprime ${encuadernacion} con tinta ${tinta}`);
    const tabla = t[moneda];
    if (!tabla) return L.error(`no hay costes de impresión en ${moneda}`);
    if (!Number.isFinite(paginas) || paginas <= 0) return L.error('no se ve el número de páginas');
    if (tamano !== 'normal' && tamano !== 'grande') return L.error('no se sabe si el tamaño es normal o grande');
    // KDP imprime siempre un número par de páginas.
    const pags = paginas % 2 ? paginas + 1 : paginas;
    const fila = tabla.find(([desde, hasta]) => pags >= desde && pags <= hasta);
    if (!fila) {
      const min = tabla[0][0];
      const max = tabla[tabla.length - 1][1];
      return L.error(`KDP solo imprime ${encuadernacion} con tinta ${tinta} de ${min} a ${max} páginas (este tiene ${paginas})`);
    }
    const [, , fijoN, pagN, fijoG, pagG] = fila;
    const fijo = tamano === 'grande' ? fijoG : fijoN;
    const porPagina = tamano === 'grande' ? pagG : pagN;
    const coste = L.redondear(fijo + porPagina * pags, 4);
    const detalle = porPagina
      ? `${L.dinero(fijo, moneda)} + ${pags} págs. × ${String(porPagina).replace('.', ',')}`
      : `${L.dinero(fijo, moneda)} fijo (hasta ${fila[1]} págs.)`;
    return { ok: true, coste, detalle, fijo, porPagina, paginasCobradas: pags };
  }

  /**
   * IVA que lleva el precio de la ficha. Amazon.es enseña el 4 % español si entrega en la península o
   * Baleares (o si no se sabe dónde), nada si entrega en Canarias, Ceuta, Melilla o fuera de la UE, y el
   * IVA del país si entrega en otro país de la UE (ahí se quita el 4 % y se avisa).
   */
  function ivaDe(ficha, tienda) {
    if (!tienda.iva) return { iva: 0, aviso: null };
    const e = ficha.entrega;
    if (e && e.zona === 'sin-iva') return { iva: 0, aviso: `Amazon enseña el precio para entregar en «${e.texto}», ya sin IVA: no se le quita` };
    if (e && e.zona === 'ue') return { iva: tienda.iva, aviso: `Amazon enseña el precio para entregar en «${e.texto}», con el IVA de allí y no el ${L.porcentaje(tienda.iva)} español: la regalía puede variar unos céntimos` };
    return { iva: tienda.iva, aviso: null };
  }

  /** Ajustes de la regalía por defecto (se pueden cambiar en Opciones). */
  L.REGALIA_DEFECTO = { umbral60: 9.99, tasaAlta: 0.6, tasaBaja: 0.5 };

  /**
   * Regalía de papel por ejemplar.
   * ficha: { tienda, formato, precio, precioCatalogo?, paginas, medidas, tamano?, tinta? }
   * Devuelve { ok, regalia, tasa, precioSinIva, coste, explicacion, avisos[] } o el motivo.
   */
  function regaliaImpreso(ficha, ajustes = {}) {
    const tienda = L.TIENDAS[ficha.tienda];
    if (!tienda) return L.error('tienda desconocida');
    const r = { ...L.REGALIA_DEFECTO, ...(ajustes.regalia || {}) };
    const encuadernacion = L.encuadernacion(ficha.formato) || (L.tipoFormato(ficha.formato) === 'impreso' ? 'tapa blanda' : null);
    if (!encuadernacion) return L.error(`la regalía de KDP solo se calcula para tapa blanda y tapa dura (esto es «${ficha.formato || 'sin formato'}»)`);
    // KDP paga sobre el precio de catálogo, aunque Amazon lo rebaje.
    const precio = Number.isFinite(ficha.precioCatalogo) ? ficha.precioCatalogo : ficha.precio;
    if (!Number.isFinite(precio) || precio <= 0) return L.error('no se ha podido leer el precio');
    if (!Number.isFinite(ficha.paginas)) return L.error('no se ve el número de páginas');
    let tamano = ficha.tamano;
    let avisoTamano = null;
    if (tamano !== 'normal' && tamano !== 'grande') {
      const t = tamanoDeMedidas(ficha.medidas);
      if (!t.ok) return L.error(`${t.motivo}: no se sabe si el tamaño es normal o grande`);
      tamano = t.tamano;
    } else if (ficha.tamanoElegido) {
      avisoTamano = `tamaño ${tamano} elegido por ti`;
    }
    const tinta = ficha.tinta || 'negra';
    const c = costeImpresion({ encuadernacion, tinta, paginas: ficha.paginas, tamano, moneda: tienda.moneda });
    if (!c.ok) return c;
    const { iva, aviso: avisoIva } = ivaDe(ficha, tienda);
    const precioSinIva = L.redondear(precio / (1 + iva), 4);
    const tasa = precioSinIva + 1e-9 >= r.umbral60 ? r.tasaAlta : r.tasaBaja;
    const regalia = L.redondear(tasa * precioSinIva - c.coste, 4);
    const avisos = [];
    if (avisoIva) avisos.push(avisoIva);
    if (avisoTamano) avisos.push(avisoTamano);
    if (!ficha.tinta) avisos.push('supone tinta negra (cámbialo si el libro es a color)');
    if (Number.isFinite(ficha.precioCatalogo) && Number.isFinite(ficha.precio) && ficha.precioCatalogo !== ficha.precio) {
      avisos.push(`calculada con el precio de catálogo (${L.dinero(ficha.precioCatalogo, tienda.moneda)}), no con la oferta`);
    }
    if (regalia <= 0) avisos.push('con este precio KDP no pagaría nada: el precio no cubre la impresión (¿es a color o no es de KDP?)');
    if (ficha.editorial && !/independently published|publicado de forma independiente|publicaci[oó]n independiente|createspace|kindle direct/i.test(ficha.editorial)) {
      avisos.push(`editorial «${ficha.editorial}»: no parece de KDP; es la regalía que tendría si lo fuera`);
    }
    const umbral = L.dinero(r.umbral60, tienda.moneda);
    const porQue = tasa === r.tasaAlta ? `Paga el ${L.porcentaje(tasa)} porque el precio${tienda.iva ? ' sin IVA' : ''} llega a ${umbral}.` : `Paga el ${L.porcentaje(tasa)} porque el precio${tienda.iva ? ' sin IVA' : ''} no llega a ${umbral}.`;
    const nota = iva ? `Precio sin el ${L.porcentaje(iva)} de IVA: ${L.dinero(precioSinIva, tienda.moneda)}. ${porQue}` : porQue;
    return {
      ok: true,
      tipo: 'impreso',
      regalia,
      moneda: tienda.moneda,
      tasa,
      precio,
      precioSinIva,
      coste: c.coste,
      tamano,
      tinta,
      encuadernacion,
      explicacion: `${L.porcentaje(tasa)} × ${L.dinero(precioSinIva, tienda.moneda)} − ${L.dinero(c.coste, tienda.moneda)} de impresión (${encuadernacion}, ${tamano}, ${ficha.paginas} págs., tinta ${tinta})`,
      nota,
      avisos,
    };
  }

  /** Regalía Kindle por ejemplar (70 % entre 2,99 y 9,99; 35 % fuera). */
  function regaliaKindle(ficha) {
    const tienda = L.TIENDAS[ficha.tienda];
    if (!tienda) return L.error('tienda desconocida');
    const precio = Number.isFinite(ficha.precioCatalogo) ? ficha.precioCatalogo : ficha.precio;
    if (!Number.isFinite(precio) || precio <= 0) return L.error('no se ha podido leer el precio Kindle');
    const { iva, aviso: avisoIva } = ivaDe(ficha, tienda);
    const precioSinIva = L.redondear(precio / (1 + iva), 4);
    const [min, max] = tienda.kindle70;
    const avisos = avisoIva ? [avisoIva] : [];
    if (precio >= min && precio <= max) {
      let entrega = 0;
      if (Number.isFinite(ficha.tamanoArchivoMB)) entrega = L.redondear(ficha.tamanoArchivoMB * tienda.entregaMB, 4);
      else avisos.push('sin descontar la entrega: no se ve el tamaño del archivo');
      const regalia = L.redondear(0.7 * precioSinIva - entrega, 4);
      return {
        ok: true,
        tipo: 'kindle',
        regalia,
        moneda: tienda.moneda,
        tasa: 0.7,
        precio,
        precioSinIva,
        coste: entrega,
        explicacion: `70 % × ${L.dinero(precioSinIva, tienda.moneda)}${entrega ? ` − ${L.dinero(entrega, tienda.moneda)} de entrega` : ''}`,
        nota: `${iva ? `Precio sin el ${L.porcentaje(iva)} de IVA: ${L.dinero(precioSinIva, tienda.moneda)}. ` : ''}El 70 % se paga entre ${L.dinero(min, tienda.moneda)} y ${L.dinero(max, tienda.moneda)}.`,
        avisos,
      };
    }
    return {
      ok: true,
      tipo: 'kindle',
      regalia: L.redondear(0.35 * precioSinIva, 4),
      moneda: tienda.moneda,
      tasa: 0.35,
      precio,
      precioSinIva,
      coste: 0,
      explicacion: `35 % × ${L.dinero(precioSinIva, tienda.moneda)} (fuera de la franja de ${L.dinero(min, tienda.moneda)} a ${L.dinero(max, tienda.moneda)} del 70 %)`,
      avisos,
    };
  }

  /** Regalía de cualquier ficha según su formato. */
  function regalia(ficha, ajustes) {
    const tipo = L.tipoFormato(ficha.formato);
    if (tipo === 'kindle') return regaliaKindle(ficha);
    if (tipo === 'impreso') return regaliaImpreso(ficha, ajustes);
    return L.error(`no hay regalía de KDP para el formato «${ficha.formato || 'desconocido'}»`);
  }

  L.regalias = { TABLAS, tamanoDeMedidas, costeImpresion, regaliaImpreso, regaliaKindle, regalia };
})((globalThis.LUPA = globalThis.LUPA || {}));
