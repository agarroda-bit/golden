/* Lupa KDP — historial de lecturas y su tendencia.

   Cada libro (por tienda y ASIN) es un registro «h:<tienda>:<ASIN>» en chrome.storage.local con
   sus lecturas: fecha y hora, BSR, precio, reseñas y nota. El service worker es el único que
   escribe (en cola), así nunca se pisan dos escrituras.
   Una lectura igual a la anterior (mismo BSR y mismo precio) hecha menos de 30 minutos después no
   se repite: Amazon actualiza el BSR más o menos cada hora y solo sería ruido en la gráfica. */
(function (L) {
  'use strict';

  L.MINUTOS_LECTURA_REPETIDA = 30;

  const clave = (tienda, asin) => `h:${tienda}:${asin}`;

  /** Lectura compacta a partir de una ficha leída. */
  function lecturaDe(ficha, origen, ahora) {
    return {
      f: ahora || ficha.leido || new Date().toISOString(),
      bsr: ficha.bsr && Number.isFinite(ficha.bsr.general) ? ficha.bsr.general : null,
      cat: ficha.bsr ? ficha.bsr.categoriaGeneral || null : null,
      cats: ficha.bsr && Array.isArray(ficha.bsr.categorias) ? ficha.bsr.categorias.slice(0, 3).map((c) => [c.puesto, c.nombre]) : [],
      precio: Number.isFinite(ficha.precio) ? ficha.precio : null,
      moneda: ficha.moneda || null,
      resenas: Number.isFinite(ficha.resenas) ? ficha.resenas : null,
      nota: Number.isFinite(ficha.nota) ? ficha.nota : null,
      origen: origen || 'ficha',
      // Sin BSR: se guarda el porqué (sale tal cual en el CSV).
      ...(ficha.bsr && !Number.isFinite(ficha.bsr.general) && ficha.bsr.motivo ? { sinBsr: ficha.bsr.motivo } : {}),
    };
  }

  /** Datos de la ficha que se guardan con el libro (los últimos que se vieron). */
  function fichaGuardada(ficha) {
    const campos = ['tienda', 'asin', 'url', 'titulo', 'autor', 'formato', 'precio', 'precioCatalogo', 'moneda', 'paginas', 'medidas', 'fechaPublicacion', 'editorial', 'idioma', 'isbn13', 'resenas', 'nota', 'tamanoArchivoMB', 'bsr', 'faltan', 'leido'];
    const f = {};
    for (const k of campos) if (ficha[k] !== undefined) f[k] = ficha[k];
    return f;
  }

  /**
   * Añade una lectura a un libro (función pura: devuelve el registro nuevo y si se ha añadido).
   * existente: registro guardado o null.
   */
  function anadir(existente, ficha, origen, ahora = new Date().toISOString()) {
    const e = existente ? { ...existente, lecturas: [...(existente.lecturas || [])] } : { tienda: ficha.tienda, asin: ficha.asin, lecturas: [], prefs: {}, primera: ahora };
    const l = lecturaDe(ficha, origen, ahora);
    const ultima = e.lecturas[e.lecturas.length - 1];
    let anadida = true;
    if (ultima && ultima.bsr === l.bsr && ultima.precio === l.precio && new Date(ahora) - new Date(ultima.f) < L.MINUTOS_LECTURA_REPETIDA * 60000) {
      anadida = false;
      ultima.vista = ahora; // se apunta que se ha vuelto a ver, sin otra lectura
    } else e.lecturas.push(l);
    e.titulo = ficha.titulo || e.titulo || null;
    e.formato = ficha.formato || e.formato || null;
    e.autor = ficha.autor || e.autor || null;
    e.url = ficha.url || e.url || null;
    e.ficha = fichaGuardada(ficha);
    e.actualizado = ahora;
    return { entrada: e, anadida };
  }

  /** Ficha guardada si se leyó hace menos de «minutos» (para no volver a pedirla a Amazon). */
  function fichaReciente(entrada, minutos, ahora = Date.now()) {
    if (!entrada || !entrada.ficha || !entrada.ficha.leido) return null;
    const edad = (ahora - new Date(entrada.ficha.leido).getTime()) / 60000;
    return edad >= 0 && edad <= minutos ? { ficha: entrada.ficha, minutos: Math.round(edad) } : null;
  }

  /**
   * Tendencia del BSR. Devuelve { n, conBsr, desde, ultima, anterior, mejor, peor, cambio, texto, puntos }.
   * «cambio» > 0 = el BSR ha bajado (vende más) respecto a la lectura anterior con BSR.
   */
  function tendencia(lecturas) {
    const l = (lecturas || []).filter((x) => x && x.f);
    const con = l.filter((x) => Number.isFinite(x.bsr));
    const r = { n: l.length, conBsr: con.length, desde: l.length ? l[0].f : null, ultima: null, anterior: null, mejor: null, peor: null, cambio: null, puntos: [] };
    if (!con.length) {
      r.texto = l.length ? `${l.length} ${l.length === 1 ? 'lectura' : 'lecturas'} sin BSR` : 'Sin lecturas todavía';
      return r;
    }
    r.puntos = con.map((x) => [new Date(x.f).getTime(), x.bsr]);
    r.ultima = con[con.length - 1].bsr;
    r.anterior = con.length > 1 ? con[con.length - 2].bsr : null;
    r.mejor = Math.min(...con.map((x) => x.bsr));
    r.peor = Math.max(...con.map((x) => x.bsr));
    if (r.anterior) r.cambio = (r.anterior - r.ultima) / r.anterior;
    if (con.length === 1) r.texto = 'Primera lectura: vuelve otro día para ver la tendencia';
    else {
      const sentido = r.cambio > 0.005 ? `mejora un ${L.porcentaje(r.cambio)}` : r.cambio < -0.005 ? `empeora un ${L.porcentaje(-r.cambio)}` : 'igual';
      r.texto = `${con.length} lecturas desde el ${L.fechaCorta(con[0].f)} · mejor ${L.miles(r.mejor)} · peor ${L.miles(r.peor)} · ${sentido} desde la anterior`;
    }
    return r;
  }

  /**
   * Línea de la gráfica (SVG) del BSR en escala logarítmica, al revés: más arriba = mejor puesto.
   * Devuelve { d, circulos: [[x, y]] } dentro de un lienzo ancho × alto con margen.
   */
  function linea(puntos, ancho = 300, alto = 64, margen = 6) {
    if (!puntos || !puntos.length) return { d: '', circulos: [] };
    const xs = puntos.map((p) => p[0]);
    const ys = puntos.map((p) => Math.log10(p[1]));
    const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
    let [y0, y1] = [Math.min(...ys), Math.max(...ys)];
    if (y1 - y0 < 0.05) {
      y0 -= 0.1;
      y1 += 0.1;
    }
    const px = (x) => (x1 === x0 ? ancho / 2 : margen + ((x - x0) / (x1 - x0)) * (ancho - 2 * margen));
    // BSR pequeño (mejor) arriba.
    const py = (y) => margen + ((y - y0) / (y1 - y0)) * (alto - 2 * margen);
    const circulos = puntos.map((p, i) => [L.redondear(px(p[0]), 1), L.redondear(py(ys[i]), 1)]);
    const d = circulos.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
    return { d, circulos };
  }

  L.historial = { clave, lecturaDe, fichaGuardada, anadir, fichaReciente, tendencia, linea };
})((globalThis.LUPA = globalThis.LUPA || {}));
