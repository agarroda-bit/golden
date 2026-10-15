/* Lupa KDP — calibración de la curva con las ventas de Rodri.

   1. Se importa el informe de ventas de KDP (.xlsx o .csv): de cada fila sale fecha, libro (ASIN o
      ISBN), tienda, formato y unidades. Las columnas se reconocen por su nombre en castellano o en
      inglés; si no se reconocen, Rodri las elige a mano en Opciones.
   2. Se juntan con las lecturas de BSR de sus propios libros (el historial de Lupa y, si quiere, un
      CSV con lecturas): cada día con BSR y ventas conocidas es un punto de datos. Un día con BSR dentro
      de las fechas del informe y sin ventas cuenta como 0 ventas (solo en libros que salen en el informe).
   3. Se ajusta una curva potencial ventas/día = a × BSR^(−b) por máxima verosimilitud de Poisson
      (cuenta bien los días con 0 ventas, que en una regresión con logaritmos no caben).
   Siempre se dice con cuántos puntos sale la curva; con pocos datos no se calibra. */
(function (L) {
  'use strict';

  const N = (s) => L.normalizar(s).replace(/[._]/g, ' ').replace(/\s+/g, ' ').trim();

  /** Nombres de columna que se reconocen (castellano e inglés), del más preferido al menos. */
  const COLUMNAS = {
    fecha: ['date', 'fecha', 'order date', 'fecha del pedido', 'fecha de pedido', 'royalty date', 'fecha de regalias', 'fecha de la regalia', 'sale date', 'fecha de venta', 'transaction date', 'dia', 'day', 'month', 'mes', 'periodo', 'period'],
    id: ['asin/isbn', 'asin', 'isbn', 'asin isbn', 'isbn/asin', 'asin/isbn-13', 'isbn-13', 'asin o isbn'],
    tienda: ['marketplace', 'tienda', 'mercado', 'store', 'tienda de amazon', 'amazon marketplace'],
    unidades: ['net units sold', 'unidades netas vendidas', 'unidades vendidas netas', 'net units', 'unidades netas', 'units sold', 'unidades vendidas', 'paid units', 'unidades pagadas', 'units ordered', 'unidades pedidas', 'ordered units', 'orders', 'pedidos', 'quantity', 'cantidad'],
    formato: ['format', 'formato', 'royalty type', 'tipo de regalias', 'tipo de regalia', 'binding', 'encuadernacion', 'tipo de libro', 'tipo de formato'],
    transaccion: ['transaction type', 'tipo de transaccion'],
    titulo: ['title', 'titulo'],
  };
  const NOMBRES_CAMPO = { fecha: 'fecha', id: 'ASIN o ISBN', tienda: 'tienda', unidades: 'unidades', formato: 'formato', transaccion: 'tipo de transacción', titulo: 'título' };

  /** Columna de cada campo en una fila de cabecera (o null). */
  function columnasDe(cabecera) {
    const nombres = (cabecera || []).map((c) => N(c));
    const r = {};
    for (const [campo, sinonimos] of Object.entries(COLUMNAS)) {
      r[campo] = null;
      for (const s of sinonimos) {
        const i = nombres.indexOf(s);
        if (i !== -1) {
          r[campo] = i;
          break;
        }
      }
    }
    return r;
  }

  /** Fila de cabecera de una hoja: la primera (de las 20 primeras) con fecha, libro y unidades. */
  function buscarCabecera(filas) {
    for (let i = 0; i < Math.min(20, filas.length); i++) {
      const c = columnasDe(filas[i]);
      if (c.fecha != null && c.id != null && c.unidades != null) return { fila: i, columnas: c };
    }
    return null;
  }

  /** «Amazon.es», «amazon.es», «ES» → 'amazon.es'. Otras tiendas → su nombre en minúsculas. */
  function tiendaDe(valor) {
    const s = L.normalizar(valor).replace(/\s/g, '');
    if (!s) return null;
    if (/amazon\.?es$|^es$|espana|spain/.test(s)) return 'amazon.es';
    if (/amazon\.?com$|^us$|^com$|estadosunidos|unitedstates/.test(s)) return 'amazon.com';
    return s;
  }

  /** Formato a partir de un texto del informe o del nombre de la hoja → 'impreso' | 'kindle' | null. */
  function formatoDe(valor) {
    const s = N(valor);
    if (!s) return null;
    if (/ebook|e-book|kindle|libro electronico|libros electronicos|digital|\b70 ?%|\b35 ?%|kenp/.test(s)) return 'kindle';
    if (/paperback|tapa blanda|hardcover|tapa dura|print|impreso|papel|libros impresos|\b60 ?%|\b50 ?%|\b40 ?%|expanded distribution|distribucion ampliada|standard - (paperback|hardcover)/.test(s)) return 'impreso';
    return null;
  }

  /** Solo dígitos y letras en mayúscula (para juntar ASIN e ISBN escritos de cualquier forma). */
  const idLimpio = (v) => String(v ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '');

  /**
   * Orden de las fechas con barras de una columna: 'dmy' (14/10/2026) o 'mdy' (10/14/2026, informes en
   * inglés). Si algún primer número pasa de 12 es día/mes; si algún segundo número pasa de 12, mes/día.
   */
  function ordenFechas(valores) {
    let dmy = 0;
    let mdy = 0;
    for (const v of valores) {
      const m = String(v ?? '').match(/^\s*(\d{1,2})\/(\d{1,2})\/\d{2,4}/);
      if (!m) continue;
      if (+m[1] > 12) dmy++;
      if (+m[2] > 12) mdy++;
    }
    return mdy > dmy ? 'mdy' : 'dmy';
  }

  /** Fecha de una celda → { dia: 'AAAA-MM-DD' } o { mes: 'AAAA-MM' } o null. */
  function fechaDe(valor, orden = 'dmy') {
    if (valor == null || valor === '') return null;
    if (orden === 'mdy' && typeof valor === 'string') {
      const m = valor.match(/^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (m) return { dia: `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` };
    }
    if (typeof valor === 'number' && valor > 20000 && valor < 80000) {
      // Número de serie de Excel (días desde el 30/12/1899).
      const d = new Date(Date.UTC(1899, 11, 30) + Math.round(valor) * 86400000);
      return { dia: d.toISOString().slice(0, 10) };
    }
    const s = L.limpiar(valor);
    let m = s.match(/^(\d{4})-(\d{1,2})$/) || s.match(/^(\d{1,2})\/(\d{4})$/);
    if (m) {
      const [a, mm] = m[1].length === 4 ? [m[1], m[2]] : [m[2], m[1]];
      return { mes: `${a}-${String(mm).padStart(2, '0')}` };
    }
    const dia = L.fechaTexto(s);
    if (dia) {
      // «septiembre 2026» o «Sep 2026» (sin día) → mes.
      if (!/\d{1,2}\D+\d{1,2}\D+\d{2,4}|\d{1,2}\s*(de\s+)?[a-z]+\s*(de\s+)?\d{4}|[a-z]+\s+\d{1,2},?\s+\d{4}|\d{4}-\d{1,2}-\d{1,2}/i.test(L.normalizar(s))) return { mes: dia.slice(0, 7) };
      return { dia };
    }
    return null;
  }

  /**
   * Lee el informe de KDP (las hojas que devuelve L.hojas).
   * «elegidas»: columnas elegidas a mano { hoja: { fecha, id, tienda, unidades, formato } } (opcional).
   * Devuelve { ventas: [{ dia|mes, id, tienda, formato, unidades, titulo }], hojas: [{ nombre, filas, cabecera, columnas, motivo }], avisos }.
   */
  function leerInforme(hojas, elegidas = {}) {
    const ventas = [];
    const resumen = [];
    const avisos = [];
    for (const h of hojas || []) {
      const manual = elegidas[h.nombre];
      const cab = manual ? { fila: manual.fila ?? 0, columnas: manual } : buscarCabecera(h.filas);
      if (!cab) {
        resumen.push({ nombre: h.nombre, filas: 0, cabecera: null, motivo: 'no se reconocen las columnas de fecha, libro y unidades', muestra: (h.filas || []).slice(0, 5) });
        continue;
      }
      const c = cab.columnas;
      const formatoHoja = formatoDe(h.nombre);
      const orden = ordenFechas(h.filas.slice(cab.fila + 1).map((f) => f && f[c.fecha]));
      let leidas = 0;
      let gratis = 0;
      let sinFormato = 0;
      for (const fila of h.filas.slice(cab.fila + 1)) {
        if (!fila || fila.every((x) => x == null || String(x).trim() === '')) continue;
        const f = fechaDe(fila[c.fecha], orden);
        const id = idLimpio(fila[c.id]);
        const unidades = typeof fila[c.unidades] === 'number' ? fila[c.unidades] : L.decimal(fila[c.unidades]);
        if (!f || !id || !Number.isFinite(unidades)) continue;
        const transaccion = c.transaccion != null ? N(fila[c.transaccion]) : '';
        if (/free|gratis|gratuit|promo|kenp|kindle unlimited|prestamo/.test(transaccion)) {
          gratis++;
          continue;
        }
        const formato = (c.formato != null ? formatoDe(fila[c.formato]) : null) || formatoHoja;
        if (!formato) sinFormato++;
        ventas.push({ ...f, id, tienda: c.tienda != null ? tiendaDe(fila[c.tienda]) : null, formato, unidades, titulo: c.titulo != null ? L.limpiar(fila[c.titulo]) : null });
        leidas++;
      }
      if (gratis) avisos.push(`${h.nombre}: ${gratis} filas de unidades gratis o préstamos no cuentan (no mueven el BSR de pago).`);
      if (sinFormato) avisos.push(`${h.nombre}: ${sinFormato} filas sin formato (ni en una columna ni en el nombre de la hoja): se juntarán con el formato del libro en el historial.`);
      if (c.tienda == null) avisos.push(`${h.nombre}: no hay columna de tienda; se toma la tienda de las lecturas de BSR.`);
      resumen.push({ nombre: h.nombre, filas: leidas, cabecera: cab.fila, columnas: c });
    }
    return { ventas, hojas: resumen, avisos };
  }

  /** Resumen de lo importado para enseñarlo en Opciones. */
  function resumenVentas(ventas) {
    const dias = ventas.filter((v) => v.dia).map((v) => v.dia).sort();
    const meses = ventas.filter((v) => v.mes).map((v) => v.mes).sort();
    const tiendas = {};
    const formatos = {};
    for (const v of ventas) {
      tiendas[v.tienda || 'sin tienda'] = (tiendas[v.tienda || 'sin tienda'] || 0) + v.unidades;
      formatos[v.formato || 'sin formato'] = (formatos[v.formato || 'sin formato'] || 0) + v.unidades;
    }
    return {
      filas: ventas.length,
      unidades: ventas.reduce((a, v) => a + v.unidades, 0),
      libros: new Set(ventas.map((v) => v.id)).size,
      desde: dias[0] || (meses[0] ? `${meses[0]}-01` : null),
      hasta: dias[dias.length - 1] || (meses.length ? `${meses[meses.length - 1]}-28` : null),
      diarias: dias.length,
      mensuales: meses.length,
      tiendas,
      formatos,
    };
  }

  /** CSV de lecturas de BSR (fecha;asin;bsr[;tienda;formato]) → [{ f, id, bsr, tienda, formato }]. */
  function leerLecturasCsv(hojas) {
    const lecturas = [];
    for (const h of hojas || []) {
      const cab = h.filas[0] || [];
      const n = cab.map((x) => N(x));
      const col = (...nombres) => n.findIndex((x) => nombres.includes(x));
      const cf = col('fecha', 'date', 'fecha y hora', 'datetime');
      const ci = col('asin', 'isbn', 'asin/isbn', 'libro');
      const cb = col('bsr', 'bsr general', 'puesto', 'rank', 'sales rank', 'clasificacion');
      const ct = col('tienda', 'marketplace', 'store');
      const cfo = col('formato', 'format');
      if (cf < 0 || ci < 0 || cb < 0) continue;
      for (const fila of h.filas.slice(1)) {
        const fe = fechaDe(fila[cf]);
        let iso = null;
        if (fe && fe.dia) {
          const hora = String(fila[cf]).match(/(\d{1,2}):(\d{2})/);
          iso = `${fe.dia}T${hora ? `${hora[1].padStart(2, '0')}:${hora[2]}` : '12:00'}:00`;
        }
        const bsr = typeof fila[cb] === 'number' ? fila[cb] : L.entero(fila[cb]);
        const id = idLimpio(fila[ci]);
        if (!iso || !id || !Number.isFinite(bsr) || bsr < 1) continue;
        lecturas.push({ f: iso, id, bsr, tienda: ct >= 0 ? tiendaDe(fila[ct]) : null, formato: cfo >= 0 ? formatoDe(fila[cfo]) || L.tipoFormato(fila[cfo]) : null });
      }
    }
    return lecturas;
  }

  // ------------------------------------------------------------------ juntar ventas y BSR

  const diasDelMes = (mes) => {
    const [a, m] = mes.split('-').map(Number);
    return new Date(Date.UTC(a, m, 0)).getUTCDate();
  };

  /**
   * Puntos de datos para una tienda y un formato.
   * historial: registros «h:…» de Lupa; ventas: de leerInforme; extra: lecturas de un CSV.
   * Devuelve { pares: [{ libro, titulo, periodo, dias, bsr, unidades, exposicion, lecturas }], avisos }.
   */
  function pares({ historial = [], ventas = [], extra = [], tienda = 'amazon.es', formato = 'impreso' }) {
    const avisos = [];
    // Libros de Rodri: todas las formas de nombrarlos (ASIN, ISBN-13, ISBN-10) → una clave.
    const libros = new Map();
    const claveDe = new Map();
    const registrar = (clave, ids, titulo, fmt) => {
      if (!libros.has(clave)) libros.set(clave, { clave, ids: new Set(), titulo: titulo || clave, formato: fmt || null });
      const l = libros.get(clave);
      for (const id of ids) if (id) {
        l.ids.add(id);
        claveDe.set(id, clave);
      }
      return l;
    };
    for (const e of historial) {
      if (e.tienda !== tienda) continue;
      const f = e.ficha || {};
      const ids = [idLimpio(e.asin), idLimpio(f.isbn13)];
      const isbn13 = idLimpio(f.isbn13);
      if (/^978\d{10}$/.test(isbn13)) ids.push(isbn10de13(isbn13));
      registrar(`${tienda}:${e.asin}`, ids, e.titulo, L.tipoFormato(e.formato));
    }
    // Lecturas de BSR por libro y día (mediana del día).
    const porDia = new Map(); // clave|dia → [bsr]
    const anotar = (clave, iso, bsr) => {
      const dia = L.dia(iso);
      if (!dia) return;
      const k = `${clave}|${dia}`;
      if (!porDia.has(k)) porDia.set(k, []);
      porDia.get(k).push(bsr);
    };
    for (const e of historial) {
      if (e.tienda !== tienda || L.tipoFormato(e.formato) !== formato) continue;
      for (const l of e.lecturas || []) if (Number.isFinite(l.bsr)) anotar(`${tienda}:${e.asin}`, l.f, l.bsr);
    }
    let extraUsadas = 0;
    for (const x of extra) {
      if (x.tienda && x.tienda !== tienda) continue;
      let clave = claveDe.get(x.id);
      if (!clave) clave = registrar(`${tienda}:${x.id}`, [x.id], x.id, x.formato).clave;
      const lib = libros.get(clave);
      const fmt = x.formato || lib.formato;
      if (fmt && fmt !== formato) continue;
      anotar(clave, x.f, x.bsr);
      extraUsadas++;
    }
    // Fechas que cubre el informe (todas sus filas, de cualquier libro, tienda o formato).
    const diasInforme = ventas.filter((v) => v.dia).map((v) => v.dia).sort();
    const mesesInforme = ventas.filter((v) => v.mes).map((v) => v.mes).sort();
    const desde = diasInforme[0] || null;
    const hasta = diasInforme[diasInforme.length - 1] || null;
    const mesDesde = mesesInforme[0] || null;
    const mesHasta = mesesInforme[mesesInforme.length - 1] || null;
    // Ventas de esa tienda y formato, por libro.
    const ventasLibro = new Map(); // clave → { dias: Map(dia→u), meses: Map(mes→u) }
    let fuera = 0;
    for (const v of ventas) {
      const clave = claveDe.get(v.id);
      if (!clave) {
        fuera++;
        continue;
      }
      if (v.tienda && v.tienda !== tienda) continue;
      const fmt = v.formato || libros.get(clave).formato;
      if (fmt !== formato) continue;
      if (!ventasLibro.has(clave)) ventasLibro.set(clave, { dias: new Map(), meses: new Map() });
      const vl = ventasLibro.get(clave);
      if (v.dia) vl.dias.set(v.dia, (vl.dias.get(v.dia) || 0) + v.unidades);
      else if (v.mes) vl.meses.set(v.mes, (vl.meses.get(v.mes) || 0) + v.unidades);
    }
    if (fuera) avisos.push(`${fuera} filas del informe son de libros sin lecturas de BSR en Lupa: no cuentan (abre sus fichas en Amazon unos días para que entren).`);
    const resultado = [];
    // Puntos diarios: cada día con BSR dentro de las fechas del informe.
    for (const [k, bsrs] of porDia) {
      const [clave, dia] = k.split('|');
      const vl = ventasLibro.get(clave);
      if (!vl || !vl.dias.size || !desde || dia < desde || dia > hasta) continue;
      resultado.push({ libro: clave.split(':').slice(1).join(':'), titulo: libros.get(clave).titulo, periodo: dia, dias: 1, bsr: L.mediana(bsrs), unidades: vl.dias.get(dia) || 0, exposicion: 1, lecturas: bsrs.length });
    }
    // Puntos mensuales (informes por meses): media geométrica de los BSR diarios, con al menos 3 días.
    // Un mes del informe sin fila para el libro cuenta como 0 ventas.
    const mesesUsados = new Set();
    const mesesRango = [];
    if (mesDesde) {
      for (let [a, m] = mesDesde.split('-').map(Number); `${a}-${String(m).padStart(2, '0')}` <= mesHasta; m === 12 ? ((a += 1), (m = 1)) : (m += 1)) mesesRango.push(`${a}-${String(m).padStart(2, '0')}`);
    }
    for (const [clave, vl] of ventasLibro) {
      if (!vl.meses.size) continue;
      for (const mes of mesesRango) {
        const unidades = vl.meses.get(mes) || 0;
        const diarios = [...porDia.entries()].filter(([k]) => k.startsWith(`${clave}|${mes}-`)).map(([, b]) => L.mediana(b));
        if (diarios.length < 3) {
          mesesUsados.add(`${mes} (pocos días con BSR)`);
          continue;
        }
        const geo = Math.exp(diarios.reduce((a, b) => a + Math.log(b), 0) / diarios.length);
        resultado.push({ libro: clave.split(':').slice(1).join(':'), titulo: libros.get(clave).titulo, periodo: mes, dias: diasDelMes(mes), bsr: geo, unidades, exposicion: diasDelMes(mes), lecturas: diarios.length });
      }
    }
    if ([...mesesUsados].length) avisos.push(`Meses sin bastantes lecturas de BSR (hacen falta 3 días): ${[...mesesUsados].join(', ')}.`);
    if (extraUsadas) avisos.push(`${extraUsadas} lecturas de BSR salen del CSV importado.`);
    resultado.sort((a, b) => String(a.periodo).localeCompare(String(b.periodo)) || a.libro.localeCompare(b.libro));
    return { pares: resultado, avisos };
  }

  /** ISBN-13 «978…» → ISBN-10 (el ASIN de los libros con ISBN-10). */
  function isbn10de13(isbn13) {
    const cuerpo = isbn13.slice(3, 12);
    let suma = 0;
    for (let i = 0; i < 9; i++) suma += (10 - i) * Number(cuerpo[i]);
    const control = (11 - (suma % 11)) % 11;
    return cuerpo + (control === 10 ? 'X' : String(control));
  }

  // ------------------------------------------------------------------ ajuste de la curva

  /**
   * Curva potencial por máxima verosimilitud de Poisson:
   * unidades ~ Poisson(exposición × a × BSR^(−b)).
   * Devuelve { ok, a, b, n, conVentas, unidades, r2, rango, iteraciones } o el motivo.
   */
  function ajustar(puntos, { minimoPuntos = 5, minimoConVentas = 3 } = {}) {
    const p = (puntos || []).filter((x) => Number.isFinite(x.bsr) && x.bsr >= 1 && Number.isFinite(x.unidades) && x.unidades >= 0 && x.exposicion > 0);
    const conVentas = p.filter((x) => x.unidades > 0).length;
    const n = p.length;
    if (n < minimoPuntos || conVentas < minimoConVentas) {
      return { ok: false, n, conVentas, motivo: `pocos datos: ${n} ${n === 1 ? 'punto' : 'puntos'} (${conVentas} con ventas). Hacen falta al menos ${minimoPuntos} días con BSR y ${minimoConVentas} con ventas` };
    }
    const bsrs = p.map((x) => x.bsr);
    const rango = [Math.min(...bsrs), Math.max(...bsrs)];
    if (rango[1] / rango[0] < 2) return { ok: false, n, conVentas, motivo: 'el BSR casi no se ha movido (del más bajo al más alto no llega al doble): con eso no se ve cómo cambian las ventas con el puesto' };
    const x = p.map((q) => Math.log(q.bsr));
    const y = p.map((q) => q.unidades);
    const off = p.map((q) => Math.log(q.exposicion));
    // Punto de partida: recta en log-log con las ventas suavizadas.
    const xm = x.reduce((a, b) => a + b, 0) / n;
    const ly = p.map((q) => Math.log((q.unidades + 0.5) / q.exposicion));
    const lym = ly.reduce((a, b) => a + b, 0) / n;
    let sxy = 0;
    let sxx = 0;
    for (let i = 0; i < n; i++) {
      sxy += (x[i] - xm) * (ly[i] - lym);
      sxx += (x[i] - xm) ** 2;
    }
    let beta = sxx > 0 ? Math.min(-0.05, sxy / sxx) : -0.8;
    let alfa = lym - beta * xm;
    const desvio = (al, be) => {
      let d = 0;
      for (let i = 0; i < n; i++) {
        const mu = Math.exp(al + be * x[i] + off[i]);
        d += 2 * ((y[i] > 0 ? y[i] * Math.log(y[i] / mu) : 0) - (y[i] - mu));
      }
      return d;
    };
    let actual = desvio(alfa, beta);
    let iteraciones = 0;
    for (; iteraciones < 200; iteraciones++) {
      let g0 = 0;
      let g1 = 0;
      let h00 = 0;
      let h01 = 0;
      let h11 = 0;
      for (let i = 0; i < n; i++) {
        const mu = Math.exp(alfa + beta * x[i] + off[i]);
        g0 += y[i] - mu;
        g1 += (y[i] - mu) * x[i];
        h00 += mu;
        h01 += mu * x[i];
        h11 += mu * x[i] * x[i];
      }
      const det = h00 * h11 - h01 * h01;
      if (!(Math.abs(det) > 1e-12)) break;
      let d0 = (h11 * g0 - h01 * g1) / det;
      let d1 = (h00 * g1 - h01 * g0) / det;
      let paso = 1;
      let nuevo = desvio(alfa + d0, beta + d1);
      while (!(nuevo <= actual + 1e-12) && paso > 1e-6) {
        paso /= 2;
        nuevo = desvio(alfa + paso * d0, beta + paso * d1);
      }
      d0 *= paso;
      d1 *= paso;
      alfa += d0;
      beta += d1;
      const mejora = actual - nuevo;
      actual = nuevo;
      if (Math.abs(d0) + Math.abs(d1) < 1e-10 || mejora < 1e-12) break;
    }
    const b = -beta;
    const a = Math.exp(alfa);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return { ok: false, n, conVentas, motivo: 'el ajuste no ha convergido' };
    if (b <= 0) return { ok: false, n, conVentas, motivo: 'con estos datos sale que a más BSR más ventas, que no tiene sentido: hacen falta más días o libros con BSR distintos' };
    // Pseudo-R² de desviación: cuánto explica la curva frente a una media sin BSR.
    const media = y.reduce((s, v) => s + v, 0) / p.reduce((s, q) => s + q.exposicion, 0);
    let nulo = 0;
    for (let i = 0; i < n; i++) {
      const mu = media * p[i].exposicion;
      nulo += 2 * ((y[i] > 0 ? y[i] * Math.log(y[i] / mu) : 0) - (y[i] - mu));
    }
    const r2 = nulo > 0 ? Math.max(0, 1 - actual / nulo) : 0;
    return { ok: true, a, b, n, conVentas, unidades: y.reduce((s, v) => s + v, 0), r2, rango, iteraciones, desvio: actual };
  }

  /** Curva lista para guardar a partir de un ajuste. */
  function curvaDe(ajuste, { tienda, formato, desde, hasta }) {
    const t = L.TIENDAS[tienda] ? L.TIENDAS[tienda].nombre : tienda;
    return {
      id: `calibrada-${tienda}-${formato}`,
      nombre: `Calibrada · ${t} · ${formato === 'kindle' ? 'Kindle' : 'tapa blanda'}`,
      origen: 'calibrada',
      tienda,
      formato,
      tipo: 'potencia',
      a: ajuste.a,
      b: ajuste.b,
      n: ajuste.n,
      conVentas: ajuste.conVentas,
      unidades: ajuste.unidades,
      r2: ajuste.r2,
      rango: ajuste.rango,
      desde: desde || null,
      hasta: hasta || null,
      fecha: new Date().toISOString(),
      fuente: `Ajuste propio con ${ajuste.n} puntos de datos (${ajuste.conVentas} con ventas) de las ventas de KDP de Rodri y sus lecturas de BSR.`,
    };
  }

  L.calibracion = { COLUMNAS, NOMBRES_CAMPO, columnasDe, buscarCabecera, tiendaDe, formatoDe, fechaDe, ordenFechas, leerInforme, resumenVentas, leerLecturasCsv, pares, ajustar, curvaDe, isbn10de13, idLimpio };
})((globalThis.LUPA = globalThis.LUPA || {}));
