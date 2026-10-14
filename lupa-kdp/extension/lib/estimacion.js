/* Lupa KDP — del puesto en ventas (BSR) a ventas al día.

   Cada tienda (amazon.es, amazon.com) y cada formato (impreso = tapa blanda/tapa dura, Kindle)
   tiene asignada una curva. De fábrica son curvas de EE. UU. sacadas de tablas públicas:
   en Amazon.es se enseña siempre «Estimación EE. UU. — sin calibrar para España» hasta que Rodri
   calibre una curva propia con sus ventas de KDP (ver calibracion.js).

   Tipos de curva:
   · 'tabla': puntos [BSR, ventas/día]; entre dos puntos se interpola en escala logarítmica
     (una recta en log-log); fuera de la tabla se prolonga el tramo del extremo y se avisa.
   · 'potencia': ventas/día = a × BSR^(−b) (la que sale de la calibración). */
(function (L) {
  'use strict';

  L.CURVAS_FABRICA = [
    {
      id: 'ee-uu-impreso',
      nombre: 'EE. UU. · libros impresos',
      origen: 'fabrica',
      pais: 'EE. UU.',
      formato: 'impreso',
      tipo: 'tabla',
      puntos: [
        [100, 170],
        [500, 48],
        [1000, 28],
        [5000, 8.6],
        [10000, 5.2],
        [50000, 1.2],
        [100000, 0.65],
      ],
      fuente: 'Tabla pública «Amazon Books» de bookcoverslab.com (Amazon.com), consultada el 14/10/2026.',
    },
    {
      id: 'ee-uu-kindle',
      nombre: 'EE. UU. · Kindle',
      origen: 'fabrica',
      pais: 'EE. UU.',
      formato: 'kindle',
      tipo: 'tabla',
      puntos: [
        [100, 1000],
        [1000, 120],
        [5000, 35],
        [25000, 9.08],
        [100000, 1.51],
        [500000, 0.362],
      ],
      fuente: 'Tabla pública «Kindle Store» de profitable.app (Amazon.com, ventas al mes ÷ 30,4), consultada el 14/10/2026.',
    },
  ];

  L.ASIGNACION_DEFECTO = {
    'amazon.es': { impreso: 'ee-uu-impreso', kindle: 'ee-uu-kindle' },
    'amazon.com': { impreso: 'ee-uu-impreso', kindle: 'ee-uu-kindle' },
  };

  L.FORMATOS_CURVA = { impreso: 'Tapa blanda (y demás libros impresos)', kindle: 'Kindle' };

  L.DIAS_MES = 30;

  /** Todas las curvas: las de fábrica más las propias y calibradas que haya guardado Rodri. */
  L.todasLasCurvas = (propias) => {
    const extra = Array.isArray(propias) ? propias.filter((c) => c && c.id && !L.CURVAS_FABRICA.some((f) => f.id === c.id)) : [];
    return [...L.CURVAS_FABRICA, ...extra];
  };

  /** Comprueba una curva antes de guardarla. Devuelve { ok, errores[] }. */
  L.validarCurva = (c) => {
    const errores = [];
    if (!c || typeof c !== 'object') return { ok: false, errores: ['La curva está vacía.'] };
    if (!c.id) errores.push('Falta el identificador de la curva.');
    if (!c.nombre) errores.push('Falta el nombre de la curva.');
    if (!['impreso', 'kindle'].includes(c.formato)) errores.push('El formato tiene que ser «impreso» o «kindle».');
    if (c.tipo === 'tabla') {
      const p = c.puntos;
      if (!Array.isArray(p) || p.length < 2) errores.push('Hacen falta al menos dos puntos (BSR y ventas al día).');
      else {
        p.forEach((x, i) => {
          if (!Array.isArray(x) || x.length !== 2 || !(x[0] > 0) || !(x[1] > 0)) errores.push(`El punto ${i + 1} tiene que ser un BSR y unas ventas al día mayores que cero.`);
        });
        for (let i = 1; i < p.length && !errores.length; i++) {
          if (!(p[i][0] > p[i - 1][0])) errores.push(`Los BSR tienen que ir de menor a mayor (punto ${i + 1}).`);
          else if (p[i][1] > p[i - 1][1]) errores.push(`Con un BSR más alto no se puede vender más (punto ${i + 1}).`);
        }
      }
    } else if (c.tipo === 'potencia') {
      if (!(c.a > 0)) errores.push('El coeficiente «a» tiene que ser mayor que cero.');
      if (!(c.b > 0)) errores.push('El exponente «b» tiene que ser mayor que cero (a más BSR, menos ventas).');
    } else errores.push('El tipo de curva tiene que ser «tabla» o «potencia».');
    return { ok: !errores.length, errores };
  };

  /**
   * Ventas al día con una curva para un BSR.
   * Devuelve { ok, valor, fueraDeTabla, rango } o el motivo.
   */
  L.ventasDia = (curva, bsr) => {
    if (!curva) return L.error('no hay curva para esta tienda y formato');
    if (!Number.isFinite(bsr) || bsr < 1) return L.error('BSR no válido');
    if (curva.tipo === 'potencia') {
      const valor = curva.a * bsr ** -curva.b;
      const [min, max] = curva.rango || [null, null];
      return { ok: true, valor, fueraDeTabla: Number.isFinite(min) && Number.isFinite(max) ? bsr < min || bsr > max : false, rango: curva.rango || null };
    }
    const p = [...(curva.puntos || [])].sort((a, b) => a[0] - b[0]);
    if (p.length < 2) return L.error('la curva tiene menos de dos puntos');
    let i = p.findIndex((x) => x[0] >= bsr);
    let fuera = false;
    if (i === -1) {
      i = p.length - 1; // más allá del último punto: se prolonga el último tramo
      fuera = bsr > p[p.length - 1][0];
    } else if (i === 0) {
      if (bsr === p[0][0]) return { ok: true, valor: p[0][1], fueraDeTabla: false, rango: [p[0][0], p[p.length - 1][0]] };
      i = 1; // antes del primer punto: se prolonga el primer tramo
      fuera = true;
    }
    const [x0, y0] = p[i - 1];
    const [x1, y1] = p[i];
    const t = (Math.log(bsr) - Math.log(x0)) / (Math.log(x1) - Math.log(x0));
    const valor = Math.exp(Math.log(y0) + t * (Math.log(y1) - Math.log(y0)));
    return { ok: true, valor, fueraDeTabla: fuera, rango: [p[0][0], p[p.length - 1][0]] };
  };

  /** Curva asignada a una tienda y un formato ('impreso' | 'kindle'). */
  L.curvaPara = (tienda, formato, asignacion, propias) => {
    const a = { ...L.ASIGNACION_DEFECTO, ...(asignacion || {}) };
    const id = (a[tienda] && a[tienda][formato]) || (L.ASIGNACION_DEFECTO[tienda] && L.ASIGNACION_DEFECTO[tienda][formato]);
    const todas = L.todasLasCurvas(propias);
    return todas.find((c) => c.id === id) || todas.find((c) => c.origen === 'fabrica' && c.formato === formato) || null;
  };

  /** Etiqueta visible en el panel: de dónde sale la cifra. */
  L.etiquetaCurva = (curva, tienda) => {
    if (!curva) return 'Sin curva';
    if (curva.origen === 'fabrica') {
      if (tienda === 'amazon.es') return 'Estimación EE. UU. — sin calibrar para España';
      return 'Estimación EE. UU. — tablas públicas, orientativa';
    }
    if (curva.origen === 'calibrada') {
      const t = L.TIENDAS[curva.tienda] ? L.TIENDAS[curva.tienda].nombre : curva.tienda || 'tu tienda';
      return `Calibrada con tus ventas de ${t} · ${curva.n} puntos de datos`;
    }
    return `Curva propia «${curva.nombre}»`;
  };

  /**
   * Estimación completa para una ficha leída.
   * ficha: lo que devuelve el lector (tienda, formato, bsr {general, categoriaGeneral, ...}, precio…)
   * contexto: { asignacion, curvas (propias), ajustes }
   * Devuelve { ventas: {ok, dia, mes, …} | error, regalia: {...} | error, curva, etiqueta, avisos }.
   */
  L.estimar = (ficha, contexto = {}) => {
    const avisos = [];
    const tipo = L.tipoFormato(ficha.formato);
    let ventas;
    let curva = null;
    if (!ficha.formato) ventas = L.error('no se ve el formato del libro (tapa blanda, Kindle…)');
    else if (tipo === 'otro') ventas = L.error(`no hay curva de ventas para el formato «${ficha.formato}»`);
    else if (!ficha.bsr || !Number.isFinite(ficha.bsr.general)) {
      ventas = L.error((ficha.bsr && ficha.bsr.motivo) || 'no se ve el puesto en ventas (BSR) general');
    } else {
      curva = L.curvaPara(ficha.tienda, tipo, contexto.asignacion, contexto.curvas);
      const v = L.ventasDia(curva, ficha.bsr.general);
      if (!v.ok) ventas = v;
      else {
        if (v.fueraDeTabla) {
          const [min, max] = v.rango || [];
          avisos.push(
            curva.tipo === 'potencia'
              ? `BSR fuera de lo que cubren tus datos (${L.miles(min)}–${L.miles(max)}): la cifra se ha prolongado`
              : `BSR fuera de la tabla (${L.miles(min)}–${L.miles(max)}): la cifra se ha prolongado y es menos fiable`,
          );
        }
        ventas = { ok: true, dia: v.valor, mes: v.valor * L.DIAS_MES, fueraDeTabla: v.fueraDeTabla };
      }
    }
    const regalia = L.regalias.regalia(ficha, contexto.ajustes || {});
    let regaliaMes = null;
    if (ventas.ok && regalia.ok) regaliaMes = Math.max(0, regalia.regalia) * ventas.mes;
    return {
      ventas,
      regalia,
      regaliaMes,
      curva: curva ? { id: curva.id, nombre: curva.nombre, origen: curva.origen, fuente: curva.fuente || null } : null,
      etiqueta: curva ? L.etiquetaCurva(curva, ficha.tienda) : null,
      avisos,
    };
  };
})((globalThis.LUPA = globalThis.LUPA || {}));
