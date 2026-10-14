/* Lupa KDP — «Mandar a la Biblioteca»: convierte la ficha de un libro en una idea nueva para la
   Biblioteca Buen Rato (la página de Claude con «Tus ideas de libro»), con el título, el formato y
   la ficha del libro. La idea se escribe con las mismas casillas del formulario de la Biblioteca:
   «¿qué libro se te ocurre?», «¿para quién es?», «¿qué juegos lleva?», «¿cuándo lo hago?» y
   «¿de quién es la idea?». */
(function (L) {
  'use strict';

  L.BIBLIOTECA = {
    url: 'https://claude.ai/artifact/F242UTzquSffkufNJvGgnL',
    // Opciones exactas de los desplegables de la Biblioteca.
    publicos: ['Lo que veas mejor', 'Mayores', 'Adultos', 'Adolescentes', 'Niños'],
    juegos: ['Lo que veas mejor', 'Mezcla de pasatiempos', 'Solo sopas de letras', 'Solo sudokus', 'Solo laberintos', 'Cuaderno para rellenar'],
    autor: 'Lupa KDP',
  };

  /** ¿Qué juegos lleva? (con el título y el formato del libro visto). */
  function juegosDe(titulo) {
    const t = L.normalizar(titulo);
    const tipos = [
      [/sopas? de letras|busca ?palabras|word ?search|letras escondidas/, 'Solo sopas de letras'],
      [/sudoku/, 'Solo sudokus'],
      [/laberinto|maze/, 'Solo laberintos'],
    ].filter(([re]) => re.test(t));
    const mixto = /pasatiempos|crucigrama|actividades|juegos variados|mixto|enigmas?|acertijos?|logica|murdoku|murdle|misterio|crimen/.test(t);
    if (tipos.length === 1 && !mixto) return tipos[0][1];
    if (tipos.length > 1 || /pasatiempos|crucigrama|juegos variados|mixto/.test(t)) return 'Mezcla de pasatiempos';
    if (/diario|agenda|planificador|cuaderno para (rellenar|escribir)|registro de|journal|planner|log ?book|mis recetas|mis contrasenas/.test(t)) return 'Cuaderno para rellenar';
    return 'Lo que veas mejor';
  }

  /** ¿Para quién es? */
  function publicoDe(titulo) {
    const t = L.normalizar(titulo);
    if (/mayores|personas mayores|tercera edad|abuel|letra (muy )?grande|letra xxl|large print|seniors?|jubilad/.test(t)) return 'Mayores';
    if (/ninos|ninas|infantil|kids|children|peques|primaria|(de|para) [3-9] (a|y) (1[0-2]|[4-9]) anos|[3-9]-(1[0-2]|[4-9]) anos/.test(t)) return 'Niños';
    if (/adolescentes|juvenil|teens?|jovenes/.test(t)) return 'Adolescentes';
    if (/adultos|adults?/.test(t)) return 'Adultos';
    return 'Lo que veas mejor';
  }

  /**
   * Idea lista para la Biblioteca.
   * ficha: la ficha leída; est: L.estimar(ficha). Devuelve { texto, publico, formato, prisa, autor, ficha }.
   */
  function idea(ficha, est) {
    const tienda = L.TIENDAS[ficha.tienda];
    const partes = [];
    partes.push(`Idea vista en ${tienda ? tienda.nombre : 'Amazon'} con Lupa KDP: «${ficha.titulo || 'sin título'}»`);
    const datos = [];
    if (ficha.formato) datos.push(ficha.formato);
    if (ficha.paginas) datos.push(`${ficha.paginas} págs.`);
    if (Number.isFinite(ficha.precio)) datos.push(L.dinero(ficha.precio, ficha.moneda || 'EUR'));
    if (ficha.autor) datos.push(`de ${ficha.autor}`);
    if (ficha.fechaPublicacion) datos.push(`publicado el ${L.fechaBonita(ficha.fechaPublicacion)}`);
    if (Number.isFinite(ficha.resenas)) datos.push(`${L.miles(ficha.resenas)} reseñas${Number.isFinite(ficha.nota) ? ` (nota ${String(ficha.nota).replace('.', ',')})` : ''}`);
    if (datos.length) partes.push(datos.join(' · '));
    if (ficha.bsr && Number.isFinite(ficha.bsr.general)) {
      let b = `BSR nº ${L.miles(ficha.bsr.general)} en ${ficha.bsr.categoriaGeneral}`;
      const cats = (ficha.bsr.categorias || []).slice(0, 2).map((c) => `nº ${L.miles(c.puesto)} en ${c.nombre}`);
      if (cats.length) b += ` (${cats.join('; ')})`;
      partes.push(b);
    } else partes.push('Sin BSR en la ficha');
    if (est && est.ventas && est.ventas.ok) {
      partes.push(`Ventas estimadas: ${L.cifra(est.ventas.dia)} al día, ${L.cifra(est.ventas.mes)} al mes (${est.etiqueta})`);
    }
    if (est && est.regalia && est.regalia.ok) partes.push(`Regalía KDP estimada: ${L.dinero(est.regalia.regalia, est.regalia.moneda)} por ejemplar`);
    partes.push(`Ficha: ${ficha.url || ''}`);
    return {
      texto: partes.join('. ').replace(/\.\./g, '.'),
      publico: publicoDe(ficha.titulo),
      formato: juegosDe(ficha.titulo),
      prisa: 'normal',
      autor: L.BIBLIOTECA.autor,
      ficha: { tienda: ficha.tienda, asin: ficha.asin, url: ficha.url, titulo: ficha.titulo, formato: ficha.formato },
    };
  }

  L.biblioteca = { juegosDe, publicoDe, idea };
})((globalThis.LUPA = globalThis.LUPA || {}));
