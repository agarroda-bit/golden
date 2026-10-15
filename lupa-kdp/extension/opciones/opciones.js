/* Lupa KDP — página de Opciones: curvas por tienda y formato, calibración con las ventas de KDP,
   historial de lecturas, ideas mandadas a la Biblioteca y ajustes de la regalía. */
(function (L) {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const e = L.escaparHTML;

  async function pedir(mensaje) {
    try {
      return (await chrome.runtime.sendMessage(mensaje)) || { ok: false, error: 'Sin respuesta de Lupa.' };
    } catch (err) {
      return { ok: false, error: String((err && err.message) || err) };
    }
  }

  let relojAviso = null;
  function avisar(texto, ms = 3200) {
    let el = $('#aviso-flotante');
    if (!el) {
      el = document.createElement('div');
      el.id = 'aviso-flotante';
      el.className = 'aviso-flotante';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = texto;
    el.classList.remove('oculto');
    clearTimeout(relojAviso);
    relojAviso = setTimeout(() => el.classList.add('oculto'), ms);
  }

  /** Pregunta de sí o no con botones propios (sin ventanas del sistema). */
  function confirmar(texto, si = 'Sí') {
    return new Promise((resolver) => {
      const velo = document.createElement('div');
      velo.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:16px;z-index:60';
      velo.innerHTML = `<div class="bloque" role="dialog" aria-modal="true" style="max-width:420px;margin:0"><p></p><div class="fila"><span class="hueco"></span><button data-r="no">Cancelar</button><button data-r="si" class="oro"></button></div></div>`;
      velo.querySelector('p').textContent = texto;
      velo.querySelector('[data-r="si"]').textContent = si;
      velo.addEventListener('click', (ev) => {
        const b = ev.target.closest('button');
        if (!b && ev.target !== velo) return;
        velo.remove();
        resolver(!!b && b.dataset.r === 'si');
      });
      document.body.appendChild(velo);
      velo.querySelector('[data-r="si"]').focus();
    });
  }

  function descargar(nombre, contenido) {
    const url = URL.createObjectURL(new Blob([contenido], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  // ------------------------------------------------------------ estado

  let ctx = { ajustes: {}, asignacion: null, curvas: [] };
  async function cargarContexto() {
    const r = await pedir({ tipo: 'contexto' });
    if (r.ok) ctx = { ajustes: r.ajustes || {}, asignacion: r.asignacion, curvas: r.curvas || [] };
  }

  // ------------------------------------------------------------ pestañas

  function mostrarPestana(nombre) {
    for (const b of $$('nav.pestanas button')) b.setAttribute('aria-selected', String(b.dataset.pestana === nombre));
    for (const v of $$('[data-vista]')) v.classList.toggle('oculto', v.dataset.vista !== nombre);
    try {
      localStorage.setItem('lupa:pestana', nombre);
    } catch {
      /* sin almacenamiento local: no pasa nada */
    }
  }

  // ------------------------------------------------------------ curvas

  const coma = (n, d = 4) => String(L.redondear(n, d)).replace('.', ',');

  function descripcionCurva(c) {
    if (c.tipo !== 'tabla') {
      const datos = c.origen === 'calibrada' ? `<p><span class="chip ok">${c.n} puntos de datos</span> <span class="chip tenue">${c.conVentas} con ventas</span> <span class="chip tenue">R² ${coma(c.r2, 2)}</span></p>` : '';
      return `${datos}<p class="nota">ventas/día = ${e(coma(c.a))} × BSR<sup>−${e(coma(c.b))}</sup>${c.rango ? ` · datos de BSR ${L.miles(c.rango[0])} a ${L.miles(c.rango[1])}` : ''}</p>`;
    }
    const filas = c.puntos.map(([b, v]) => `<tr><td class="n">${L.miles(b)}</td><td class="n">${L.cifra(v)}</td><td class="n">${L.cifra(v * L.DIAS_MES)}</td></tr>`).join('');
    return `<div class="tabla"><table><thead><tr><th class="n">BSR</th><th class="n">Ventas/día</th><th class="n">Ventas/mes</th></tr></thead><tbody>${filas}</tbody></table></div>`;
  }

  function pintarAsignacion() {
    const a = { ...L.ASIGNACION_DEFECTO, ...(ctx.asignacion || {}) };
    const todas = L.todasLasCurvas(ctx.curvas);
    $('#asignacion tbody').innerHTML = Object.keys(L.TIENDAS)
      .map((t) => {
        const celdas = ['impreso', 'kindle']
          .map((f) => {
            const actual = (a[t] && a[t][f]) || L.ASIGNACION_DEFECTO[t][f];
            const curva = todas.find((c) => c.id === actual);
            const opciones = todas.filter((c) => c.formato === f).map((c) => `<option value="${e(c.id)}"${c.id === actual ? ' selected' : ''}>${e(c.nombre)}</option>`).join('');
            return `<td><label class="casilla-tuya"><span>TÚ: curva</span><select data-asignar="${t}|${f}">${opciones}</select></label><div class="nota" data-etiqueta-asignada="${t}|${f}">${e(L.etiquetaCurva(curva, t))}</div></td>`;
          })
          .join('');
        return `<tr><td><b>${e(L.TIENDAS[t].nombre)}</b></td>${celdas}</tr>`;
      })
      .join('');
  }

  function pintarCurvasFabrica() {
    $('#curvas-fabrica').innerHTML = L.CURVAS_FABRICA.map(
      (c) => `<div class="bloque" data-curva="${e(c.id)}">
        <h3>${e(c.nombre)}</h3>
        <p><span class="chip aviso">De fábrica · ${e(c.pais)}</span> <span class="chip tenue">${e(L.FORMATOS_CURVA[c.formato])}</span></p>
        ${descripcionCurva(c)}
        <p class="nota">${e(c.fuente)} Entre dos puntos se interpola en escala logarítmica; fuera de la tabla se prolonga el último tramo y el panel lo avisa.</p>
      </div>`,
    ).join('');
  }

  function pintarPropias() {
    const propias = ctx.curvas || [];
    $('#curvas-propias').innerHTML = propias.length
      ? propias
          .map(
            (c) => `<div class="bloque" data-curva-propia="${e(c.id)}">
        <h3>${e(c.nombre)}</h3>
        <p><span class="chip ${c.origen === 'calibrada' ? 'ok' : 'hielo'}">${c.origen === 'calibrada' ? 'Calibrada' : 'Propia'}</span> <span class="chip tenue">${e(L.FORMATOS_CURVA[c.formato])}</span> <span class="chip tenue">${e(L.fechaCorta(c.guardada || c.fecha))}</span></p>
        ${descripcionCurva(c)}
        ${c.fuente ? `<p class="nota">${e(c.fuente)}</p>` : ''}
        <button class="peligro" data-quitar-curva="${e(c.id)}">Quitar esta curva</button>
      </div>`,
          )
          .join('')
      : '<p class="nota">Todavía no tienes curvas propias. Calibra una con tus ventas o crea una aquí abajo.</p>';
  }

  function leerPuntos(texto) {
    const puntos = [];
    const errores = [];
    String(texto || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .forEach((linea, i) => {
        const partes = linea.split(/\s*[;\t]\s*/);
        const bsr = L.entero(partes[0]);
        const v = L.decimal(partes[1]);
        if (partes.length !== 2 || !bsr || !(v > 0)) errores.push(`Línea ${i + 1} («${linea}»): pon el BSR y las ventas al día separados por «;».`);
        else puntos.push([bsr, v]);
      });
    return { puntos, errores };
  }

  function curvaDelFormulario() {
    const nombre = $('#cp-nombre').value.trim();
    const { puntos, errores } = leerPuntos($('#cp-puntos').value);
    const curva = { id: `propia-${L.huella(nombre || 'sin nombre')}`, nombre, formato: $('#cp-formato').value, tipo: 'tabla', puntos, origen: 'propia' };
    const v = L.validarCurva(curva);
    return { curva, errores: [...errores, ...v.errores] };
  }

  function comprobarCurva() {
    const { curva, errores } = curvaDelFormulario();
    const el = $('#cp-resultado');
    if (errores.length) {
      el.innerHTML = `<span class="chip mal">ERROR</span> ${e(errores.join(' '))}`;
      return null;
    }
    const ej = [1000, 10000, 100000].map((b) => `BSR ${L.miles(b)} → ${L.cifra(L.ventasDia(curva, b).valor)} al día`).join(' · ');
    el.innerHTML = `<span class="chip ok">Correcta</span> ${e(ej)}`;
    return curva;
  }

  // ------------------------------------------------------------ calibración

  let hojasLeidas = null; // hojas del último informe subido (para elegir columnas a mano)
  let nombreInforme = null;
  let cal = { informe: null, lecturas: null };

  function pintarResumenInforme() {
    const el = $('#cal-informe-resumen');
    const inf = cal.informe;
    if (!inf) {
      el.innerHTML = '<p class="nota">Todavía no has subido ningún informe.</p>';
      return;
    }
    const r = L.calibracion.resumenVentas(inf.ventas || []);
    const lista = (obj) =>
      Object.entries(obj)
        .map(([k, v]) => `${e(k === 'impreso' ? 'tapa blanda' : k)}: ${L.miles(v)}`)
        .join(' · ');
    const avisos = (inf.avisos || []).map((a) => `<li>${e(a)}</li>`).join('');
    const malas = (inf.hojas || []).filter((h) => !h.columnas);
    el.innerHTML = `<div class="aviso ${r.filas ? 'ok' : 'error'}" data-resumen-informe>
        <b>${e(inf.nombre)}</b>: ${L.miles(r.filas)} filas con ventas, ${L.miles(r.unidades)} unidades de ${r.libros} libros${r.desde ? `, del ${e(L.fechaCorta(`${r.desde}T12:00:00`))} al ${e(L.fechaCorta(`${r.hasta}T12:00:00`))}` : ''}${r.diarias ? ' (por días)' : ''}${r.mensuales ? ' (por meses)' : ''}.
        <br>Por tienda: ${lista(r.tiendas)}. Por formato: ${lista(r.formatos)}.
      </div>
      ${avisos ? `<ul class="nota">${avisos}</ul>` : ''}
      ${malas.length && hojasLeidas ? malas.map((h) => elegirColumnasHtml(h.nombre)).join('') : ''}
      ${malas.length && !hojasLeidas ? `<p class="nota">${malas.length} hojas sin columnas reconocidas: vuelve a subir el archivo para elegirlas a mano.</p>` : ''}`;
  }

  /** Casillas para elegir a mano las columnas de una hoja que Lupa no reconoce. */
  function elegirColumnasHtml(nombreHoja) {
    const hoja = hojasLeidas.find((h) => h.nombre === nombreHoja);
    if (!hoja) return '';
    const muestra = hoja.filas.slice(0, 6);
    const ancho = Math.max(...muestra.map((f) => f.length), 1);
    const tabla = `<div class="tabla"><table><tbody>${muestra.map((f, i) => `<tr><td class="n">${i + 1}</td>${Array.from({ length: ancho }, (_, j) => `<td>${e(f[j] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    const opcionesFila = Array.from({ length: Math.min(10, hoja.filas.length) }, (_, i) => `<option value="${i}">Fila ${i + 1}</option>`).join('');
    const opcionesCol = (vacio) => `${vacio ? '<option value="">(no hay)</option>' : ''}${Array.from({ length: ancho }, (_, j) => `<option value="${j}">Columna ${L.hojas ? String.fromCharCode(65 + j) : j + 1}</option>`).join('')}`;
    const campo = (c, vacio) => `<label class="casilla-tuya"><span>TÚ: columna de ${e(L.calibracion.NOMBRES_CAMPO[c])}</span><select data-columna="${c}">${opcionesCol(vacio)}</select></label>`;
    return `<div class="bloque" data-elegir-hoja="${e(nombreHoja)}"><h3>Hoja «${e(nombreHoja)}»: elige las columnas</h3>
      <p class="nota">No se reconocen sus columnas. Mira las primeras filas y di dónde está cada dato.</p>${tabla}
      <div class="rejilla" style="margin-top:8px">
        <label class="casilla-tuya"><span>TÚ: fila de la cabecera</span><select data-columna="fila">${opcionesFila}</select></label>
        ${campo('fecha')}${campo('id')}${campo('unidades')}${campo('tienda', true)}${campo('formato', true)}
      </div>
      <div class="fila" style="margin-top:8px"><button class="oro" data-usar-columnas="${e(nombreHoja)}">Usar estas columnas</button></div></div>`;
  }

  async function guardarInforme(nombre, hojas, elegidas = {}) {
    const inf = L.calibracion.leerInforme(hojas, elegidas);
    const informe = { nombre, ventas: inf.ventas, avisos: inf.avisos, hojas: inf.hojas.map(({ muestra, ...h }) => h), fecha: new Date().toISOString(), elegidas };
    const r = await pedir({ tipo: 'guardarCalibracion', cambios: { informe } });
    if (!r.ok) {
      avisar(`No se ha podido guardar el informe: ${r.error}`);
      return;
    }
    cal.informe = informe;
    pintarResumenInforme();
    await pintarResumenLecturas();
  }

  async function subirInforme(archivo) {
    try {
      const hojas = await L.hojas.leerArchivo(archivo.name, await archivo.arrayBuffer());
      hojasLeidas = hojas;
      nombreInforme = archivo.name;
      await guardarInforme(archivo.name, hojas);
      avisar('Informe leído.');
    } catch (err) {
      $('#cal-informe-resumen').innerHTML = `<div class="aviso error">ERROR — no se ha podido leer «${e(archivo.name)}»: ${e((err && err.message) || err)}</div>`;
    }
  }

  async function subirLecturas(archivo) {
    try {
      const hojas = await L.hojas.leerArchivo(archivo.name, await archivo.arrayBuffer());
      const lecturas = L.calibracion.leerLecturasCsv(hojas);
      if (!lecturas.length) throw new Error('no hay filas con fecha, ASIN y BSR (la primera fila tiene que ser la cabecera: Fecha;ASIN;BSR)');
      const r = await pedir({ tipo: 'guardarCalibracion', cambios: { lecturas: { nombre: archivo.name, lecturas, fecha: new Date().toISOString() } } });
      if (!r.ok) throw new Error(r.error);
      cal.lecturas = r.calibracion.lecturas;
      await pintarResumenLecturas();
      avisar(`${lecturas.length} lecturas de BSR importadas.`);
    } catch (err) {
      $('#cal-lecturas-resumen').innerHTML = `<div class="aviso error">ERROR — no se han podido leer las lecturas: ${e((err && err.message) || err)}</div>`;
    }
  }

  async function pintarResumenLecturas() {
    const h = await pedir({ tipo: 'todoElHistorial' });
    const entradas = (h.ok && h.entradas) || [];
    const conBsr = entradas.reduce((n, x) => n + (x.lecturas || []).filter((l) => Number.isFinite(l.bsr)).length, 0);
    const extra = cal.lecturas;
    $('#cal-lecturas-resumen').innerHTML = `<div class="aviso info" data-resumen-lecturas>En el historial de Lupa hay ${L.miles(entradas.length)} libros con ${L.miles(conBsr)} lecturas de BSR.${
      extra ? ` Importadas de «${e(extra.nombre)}»: ${L.miles(extra.lecturas.length)} lecturas.` : ''
    }</div>${extra ? '<div class="fila" style="margin-top:6px"><button class="peligro" data-quitar-lecturas>Quitar las lecturas importadas</button></div>' : ''}`;
  }

  /** Gráfica log-log: puntos de datos, tu curva (oro) y la de EE. UU. (azul hielo). */
  function grafica(pares, curva, fabrica) {
    const W = 640;
    const H = 300;
    const m = { i: 56, d: 14, a: 14, b: 40 };
    const xs = pares.map((p) => p.bsr);
    const x0 = Math.log10(Math.min(...xs) / 1.5);
    const x1 = Math.log10(Math.max(...xs) * 1.5);
    const tasas = pares.filter((p) => p.unidades > 0).map((p) => p.unidades / p.exposicion);
    const enCurva = [10 ** x0, 10 ** x1].flatMap((b) => [L.ventasDia(curva, b).valor, L.ventasDia(fabrica, b).valor]);
    const y0 = Math.log10(Math.min(...tasas, ...enCurva) / 2);
    const y1 = Math.log10(Math.max(...tasas, ...enCurva) * 2);
    const banda = 22; // franja de abajo para los días sin ventas
    const px = (b) => m.i + ((Math.log10(b) - x0) / (x1 - x0)) * (W - m.i - m.d);
    const py = (v) => m.a + (1 - (Math.log10(v) - y0) / (y1 - y0)) * (H - m.a - m.b - banda);
    const linea = (c, clase) => {
      const pts = Array.from({ length: 60 }, (_, i) => 10 ** (x0 + ((x1 - x0) * i) / 59)).map((b) => `${px(b).toFixed(1)},${py(L.ventasDia(c, b).valor).toFixed(1)}`);
      return `<polyline points="${pts.join(' ')}" class="${clase}"/>`;
    };
    const ticksX = [];
    for (let k = Math.ceil(x0); k <= Math.floor(x1); k++) ticksX.push(10 ** k);
    const ticksY = [];
    for (let k = Math.ceil(y0); k <= Math.floor(y1); k++) ticksY.push(10 ** k);
    const yCero = H - m.b - banda / 2;
    const puntos = pares
      .map((p) => (p.unidades > 0 ? `<circle cx="${px(p.bsr).toFixed(1)}" cy="${py(p.unidades / p.exposicion).toFixed(1)}" r="3.2" class="con"/>` : `<circle cx="${px(p.bsr).toFixed(1)}" cy="${(yCero + (Math.random() * 8 - 4)).toFixed(1)}" r="2.4" class="sin"/>`))
      .join('');
    return `<svg class="grafica" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ventas al día según el BSR: tus datos, tu curva y la de EE. UU.">
      <style>.eje{stroke:#26304A}.txt{fill:#A7AEBC;font:11px 'Lupa Rubik',system-ui}.con{fill:#5FB8E6}.sin{fill:#A7AEBC;opacity:.5}.tuya{fill:none;stroke:#D4A64A;stroke-width:2.5}.eeuu{fill:none;stroke:#5FB8E6;stroke-width:1.5;stroke-dasharray:5 4;opacity:.8}</style>
      ${ticksX.map((b) => `<line x1="${px(b)}" x2="${px(b)}" y1="${m.a}" y2="${H - m.b}" class="eje"/><text x="${px(b)}" y="${H - m.b + 16}" text-anchor="middle" class="txt">${L.miles(b)}</text>`).join('')}
      ${ticksY.map((v) => `<line x1="${m.i}" x2="${W - m.d}" y1="${py(v)}" y2="${py(v)}" class="eje"/><text x="${m.i - 6}" y="${py(v) + 4}" text-anchor="end" class="txt">${L.cifra(v)}</text>`).join('')}
      <text x="${m.i - 6}" y="${yCero + 4}" text-anchor="end" class="txt">0</text>
      <text x="${(W + m.i) / 2}" y="${H - 6}" text-anchor="middle" class="txt">BSR (escala logarítmica) · eje vertical: ventas al día</text>
      ${linea(fabrica, 'eeuu')}${linea(curva, 'tuya')}${puntos}
    </svg>
    <p class="nota"><span style="color:#D4A64A">━</span> tu curva · <span style="color:#5FB8E6">┅</span> EE. UU. de fábrica · <span style="color:#5FB8E6">●</span> día con ventas · <span style="color:#A7AEBC">●</span> día sin ventas (abajo). La curva pasa por debajo de los puntos azules porque también cuenta los días sin ventas.</p>`;
  }

  async function calcular() {
    const el = $('#cal-resultado');
    const tienda = $('#cal-tienda').value;
    const formato = $('#cal-formato').value;
    if (!cal.informe || !(cal.informe.ventas || []).length) {
      el.innerHTML = '<div class="aviso error">ERROR — primero sube el informe de ventas de KDP (paso 1).</div>';
      return;
    }
    const h = await pedir({ tipo: 'todoElHistorial' });
    const { pares, avisos } = L.calibracion.pares({ historial: (h.ok && h.entradas) || [], ventas: cal.informe.ventas, extra: cal.lecturas ? cal.lecturas.lecturas : [], tienda, formato });
    const aj = L.calibracion.ajustar(pares);
    const listaAvisos = avisos.length ? `<ul class="nota">${avisos.map((a) => `<li>${e(a)}</li>`).join('')}</ul>` : '';
    if (!aj.ok) {
      el.innerHTML = `<div class="aviso error" data-calibracion-error>ERROR — ${e(aj.motivo)}.</div><p class="nota" data-puntos>${aj.n} puntos de datos (${aj.conVentas} con ventas).</p>${listaAvisos}`;
      return;
    }
    const r = L.calibracion.resumenVentas(cal.informe.ventas);
    const curva = L.calibracion.curvaDe(aj, { tienda, formato, desde: r.desde, hasta: r.hasta });
    const fabrica = L.CURVAS_FABRICA.find((c) => c.formato === formato);
    const comparacion = [1000, 10000, 100000, 500000]
      .map((b) => `<tr><td class="n">${L.miles(b)}</td><td class="n">${L.cifra(L.ventasDia(fabrica, b).valor)}</td><td class="n">${L.cifra(L.ventasDia(curva, b).valor)}</td></tr>`)
      .join('');
    const pocos = aj.n < 30 ? `<div class="aviso">Pocos datos: ${aj.n} puntos. La curva es orientativa; mejorará con más días de lecturas de tus libros.</div>` : '';
    const tablaPares = pares.map((p) => `<tr><td>${e(p.periodo)}</td><td>${e(p.titulo)}</td><td class="n">${L.miles(Math.round(p.bsr))}</td><td class="n">${L.miles(p.unidades)}</td><td class="n">${p.lecturas}</td></tr>`).join('');
    const etiquetaFormato = formato === 'kindle' ? 'Kindle' : 'tapa blanda';
    el.innerHTML = `<div class="rejilla">
        <div class="bloque"><div class="cifra-grande" data-puntos="${aj.n}">${L.miles(aj.n)}</div><div class="nota">puntos de datos usados (días con BSR)</div>
          <p style="margin-top:8px">${aj.conVentas} días con ventas · ${L.miles(aj.unidades)} unidades · BSR de ${L.miles(Math.round(aj.rango[0]))} a ${L.miles(Math.round(aj.rango[1]))} · R² ${coma(aj.r2, 2)}</p>
          <p class="nota">ventas/día = ${e(coma(aj.a))} × BSR<sup>−${e(coma(aj.b))}</sup></p></div>
        <div class="bloque"><h3>Comparada con la de EE. UU.</h3><div class="tabla"><table><thead><tr><th class="n">BSR</th><th class="n">EE. UU.</th><th class="n">Tuya</th></tr></thead><tbody>${comparacion}</tbody></table></div></div>
      </div>
      ${pocos}
      ${grafica(pares, curva, fabrica)}
      ${listaAvisos}
      <div class="fila" style="margin-top:10px">
        <button class="oro" data-usar-curva>Usar esta curva en ${e(L.TIENDAS[tienda].nombre)} (${etiquetaFormato})</button>
        <button data-volver-fabrica>Volver a la de EE. UU.</button>
      </div>
      <details style="margin-top:10px"><summary class="nota">Ver los ${aj.n} puntos de datos</summary><div class="tabla"><table><thead><tr><th>Día o mes</th><th>Libro</th><th class="n">BSR</th><th class="n">Ventas</th><th class="n">Lecturas de BSR</th></tr></thead><tbody>${tablaPares}</tbody></table></div></details>`;
    el.querySelector('[data-usar-curva]').addEventListener('click', async () => {
      const g = await pedir({ tipo: 'guardarCurva', curva });
      if (!g.ok) return avisar(`No se ha podido guardar: ${g.error}`);
      const a = await pedir({ tipo: 'asignarCurva', tienda, formato, id: curva.id });
      if (!a.ok) return avisar(`No se ha podido usar: ${a.error}`);
      await refrescarCurvas();
      el.querySelector('[data-usar-curva]').insertAdjacentHTML('afterend', `<span class="aviso ok" data-curva-usada>Hecho: en ${e(L.TIENDAS[tienda].nombre)} sale «${e(L.etiquetaCurva(curva, tienda))}».</span>`);
    });
    el.querySelector('[data-volver-fabrica]').addEventListener('click', async () => {
      const a = await pedir({ tipo: 'asignarCurva', tienda, formato, id: fabrica.id });
      if (a.ok) {
        await refrescarCurvas();
        avisar(`${L.TIENDAS[tienda].nombre} vuelve a usar la curva de EE. UU.`);
      }
    });
  }

  // ------------------------------------------------------------ historial

  async function pintarHistorial() {
    const r = await pedir({ tipo: 'todoElHistorial' });
    const entradas = ((r.ok && r.entradas) || []).sort((a, b) => String(b.actualizado || '').localeCompare(String(a.actualizado || '')));
    let total = 0;
    const filas = entradas
      .map((x) => {
        const t = L.historial.tendencia(x.lecturas);
        total += (x.lecturas || []).length;
        const tienda = L.TIENDAS[x.tienda] ? L.TIENDAS[x.tienda].nombre : x.tienda;
        const cambio = t.cambio == null ? (t.conBsr ? 'una lectura' : 'sin BSR') : t.cambio > 0.005 ? `mejora un ${L.porcentaje(t.cambio)}` : t.cambio < -0.005 ? `empeora un ${L.porcentaje(-t.cambio)}` : 'igual';
        return `<tr data-libro="${e(x.tienda)}|${e(x.asin)}"><td>${x.url ? `<a href="${e(x.url)}" target="_blank" rel="noopener">${e(x.titulo || x.asin)}</a>` : e(x.titulo || x.asin)}</td><td>${e(tienda)}</td><td>${e(x.asin)}</td><td class="n">${(x.lecturas || []).length}</td><td>${e(L.fechaCorta(t.desde))}</td><td class="n">${t.ultima ? L.miles(t.ultima) : '—'}</td><td class="n">${t.mejor ? L.miles(t.mejor) : '—'}</td><td>${e(cambio)}</td>
          <td><div class="fila"><button data-csv-libro="${e(x.tienda)}|${e(x.asin)}">CSV</button><button class="peligro" data-quitar-libro="${e(x.tienda)}|${e(x.asin)}">Quitar</button></div></td></tr>`;
      })
      .join('');
    $('#historial tbody').innerHTML = entradas.length
      ? `${filas}<tr class="total"><td>Total</td><td></td><td>${entradas.length} libros</td><td class="n">${L.miles(total)}</td><td colspan="5">lecturas</td></tr>`
      : '<tr><td colspan="9" class="nota">Todavía no hay lecturas: abre la ficha de un libro en Amazon.es o Amazon.com.</td></tr>';
  }

  async function exportar(filtro) {
    const r = await pedir({ tipo: 'exportarCsv', filtro });
    if (!r.ok) return avisar(`No se ha podido exportar: ${r.error}`);
    descargar(r.nombre, r.csv);
    avisar(`CSV descargado: ${r.lecturas} lecturas de ${r.libros} libros.`);
  }

  // ------------------------------------------------------------ Biblioteca

  const ESTADOS_IDEA = { pendiente: ['aviso', 'Pendiente de entrar'], entregando: ['hielo', 'Entrando en la Biblioteca'], entregada: ['ok', 'En la Biblioteca'] };

  async function pintarIdeas() {
    const r = await pedir({ tipo: 'bandeja' });
    const ideas = ((r.ok && r.ideas) || []).slice().reverse();
    $('#ideas tbody').innerHTML = ideas.length
      ? ideas
          .map((i) => {
            const [clase, texto] = ESTADOS_IDEA[i.estado] || ['tenue', i.estado];
            const f = (i.idea && i.idea.ficha) || {};
            return `<tr data-idea="${e(i.id)}"><td>${e(L.fechaHora(i.creada))}</td><td>${f.url ? `<a href="${e(f.url)}" target="_blank" rel="noopener">${e(f.titulo || f.asin || '')}</a>` : e(f.titulo || '')}<div class="nota">${e(f.formato || '')}</div></td>
              <td><span class="chip ${clase}">${e(texto)}</span>${i.motivo ? `<div class="nota">${e(i.motivo)}</div>` : ''}</td>
              <td><div class="fila">${i.estado !== 'entregada' ? `<button data-reintentar="${e(i.id)}">Reintentar</button>` : ''}<button data-copiar-idea="${e(i.id)}">Copiar texto</button><button class="peligro" data-quitar-idea="${e(i.id)}">Quitar</button></div></td></tr>`;
          })
          .join('')
      : '<tr><td colspan="4" class="nota">Todavía no has mandado ninguna idea.</td></tr>';
    ideasActuales = ideas;
  }
  let ideasActuales = [];

  // ------------------------------------------------------------ regalía

  function pintarAjustes() {
    const r = { ...L.REGALIA_DEFECTO, ...((ctx.ajustes && ctx.ajustes.regalia) || {}) };
    $('#aj-umbral').value = String(r.umbral60).replace('.', ',');
    $('#aj-alta').value = String(L.redondear(r.tasaAlta * 100, 2)).replace('.', ',');
    $('#aj-baja').value = String(L.redondear(r.tasaBaja * 100, 2)).replace('.', ',');
    $('#url-biblioteca').value = (ctx.ajustes && ctx.ajustes.urlBiblioteca) || L.BIBLIOTECA.url;
  }

  async function guardarRegalia(defecto) {
    let regalia = L.REGALIA_DEFECTO;
    if (!defecto) {
      const umbral = L.decimal($('#aj-umbral').value);
      const alta = L.decimal($('#aj-alta').value);
      const baja = L.decimal($('#aj-baja').value);
      if (!(umbral >= 0 && umbral < 1000) || !(alta > 0 && alta <= 100) || !(baja > 0 && baja <= 100)) {
        $('#aj-aviso').innerHTML = '<span class="chip mal">ERROR</span> El umbral tiene que ser un precio y los porcentajes estar entre 1 y 100.';
        return;
      }
      regalia = { umbral60: umbral, tasaAlta: alta / 100, tasaBaja: baja / 100 };
    }
    const r = await pedir({ tipo: 'guardarAjustes', cambios: { regalia } });
    if (r.ok) {
      ctx.ajustes = r.ajustes;
      pintarAjustes();
      $('#aj-aviso').innerHTML = '<span class="chip ok">Guardado</span>';
    }
  }

  // ------------------------------------------------------------ eventos

  async function refrescarCurvas() {
    await cargarContexto();
    pintarAsignacion();
    pintarPropias();
  }

  function enlazar() {
    for (const b of $$('nav.pestanas button')) b.addEventListener('click', () => mostrarPestana(b.dataset.pestana));
    document.addEventListener('change', async (ev) => {
      const s = ev.target.closest('select[data-asignar]');
      if (s) {
        const [tienda, formato] = s.dataset.asignar.split('|');
        const r = await pedir({ tipo: 'asignarCurva', tienda, formato, id: s.value });
        if (!r.ok) avisar(`No se ha podido cambiar: ${r.error}`);
        await refrescarCurvas();
        avisar('Curva cambiada: el panel de Amazon la usa desde la próxima ficha que abras.');
      }
    });
    document.addEventListener('click', async (ev) => {
      const t = ev.target;
      const quitarCurva = t.closest('[data-quitar-curva]');
      if (quitarCurva && (await confirmar('¿Quitar esta curva? Donde estuviera en uso, se vuelve a la de EE. UU.', 'Quitar'))) {
        await pedir({ tipo: 'borrarCurva', id: quitarCurva.dataset.quitarCurva });
        await refrescarCurvas();
      }
      const usarCols = t.closest('[data-usar-columnas]');
      if (usarCols && hojasLeidas) {
        const caja = usarCols.closest('[data-elegir-hoja]');
        const valor = (k) => {
          const v = caja.querySelector(`[data-columna="${k}"]`).value;
          return v === '' ? null : Number(v);
        };
        const elegidas = { ...((cal.informe && cal.informe.elegidas) || {}), [caja.dataset.elegirHoja]: { fila: valor('fila'), fecha: valor('fecha'), id: valor('id'), unidades: valor('unidades'), tienda: valor('tienda'), formato: valor('formato') } };
        await guardarInforme(nombreInforme, hojasLeidas, elegidas);
      }
      if (t.closest('[data-quitar-lecturas]')) {
        await pedir({ tipo: 'guardarCalibracion', cambios: { lecturas: null } });
        cal.lecturas = null;
        await pintarResumenLecturas();
      }
      const csvLibro = t.closest('[data-csv-libro]');
      if (csvLibro) {
        const [tienda, asin] = csvLibro.dataset.csvLibro.split('|');
        await exportar({ tienda, asin });
      }
      const quitarLibro = t.closest('[data-quitar-libro]');
      if (quitarLibro && (await confirmar('¿Quitar este libro y todas sus lecturas del historial?', 'Quitar'))) {
        const [tienda, asin] = quitarLibro.dataset.quitarLibro.split('|');
        await pedir({ tipo: 'quitarDelHistorial', tienda, asin });
        await pintarHistorial();
      }
      const re = t.closest('[data-reintentar]');
      if (re) await pedir({ tipo: 'reintentarIdea', id: re.dataset.reintentar });
      const cop = t.closest('[data-copiar-idea]');
      if (cop) {
        const i = ideasActuales.find((x) => x.id === cop.dataset.copiarIdea);
        if (i) {
          await navigator.clipboard.writeText(i.idea.texto).then(() => avisar('Texto de la idea copiado.'), () => avisar('No se ha podido copiar.'));
        }
      }
      const qi = t.closest('[data-quitar-idea]');
      if (qi && (await confirmar('¿Quitar esta idea de la lista? (En la Biblioteca se queda si ya entró.)', 'Quitar'))) {
        await pedir({ tipo: 'quitarIdea', id: qi.dataset.quitarIdea });
        await pintarIdeas();
      }
    });
    $('#cp-comprobar').addEventListener('click', comprobarCurva);
    $('#cp-guardar').addEventListener('click', async () => {
      const curva = comprobarCurva();
      if (!curva) return;
      const r = await pedir({ tipo: 'guardarCurva', curva });
      if (!r.ok) {
        $('#cp-resultado').innerHTML = `<span class="chip mal">ERROR</span> ${e(r.error)}`;
        return;
      }
      await refrescarCurvas();
      $('#cp-resultado').innerHTML = '<span class="chip ok">Guardada</span> Elígela arriba para la tienda y el formato que quieras.';
    });
    $('#cal-informe').addEventListener('change', (ev) => ev.target.files[0] && subirInforme(ev.target.files[0]));
    $('#cal-lecturas').addEventListener('change', (ev) => ev.target.files[0] && subirLecturas(ev.target.files[0]));
    $('#cal-calcular').addEventListener('click', calcular);
    $('#hist-csv').addEventListener('click', () => exportar(null));
    $('#aj-guardar').addEventListener('click', () => guardarRegalia(false));
    $('#aj-defecto').addEventListener('click', () => guardarRegalia(true));
    $('#guardar-url-biblioteca').addEventListener('click', async () => {
      const url = $('#url-biblioteca').value.trim();
      if (!/^https:\/\/claude\.ai\/(code\/)?artifact\/[\w-]+/.test(url)) {
        $('#aviso-url-biblioteca').innerHTML = '<span class="chip mal">ERROR</span> Tiene que ser una dirección de claude.ai/artifact/…';
        return;
      }
      const r = await pedir({ tipo: 'guardarAjustes', cambios: { urlBiblioteca: url } });
      if (r.ok) $('#aviso-url-biblioteca').innerHTML = '<span class="chip ok">Guardada</span>';
    });
    // Lo que cambie en otra pestaña (lecturas nuevas, ideas que entran) se ve aquí al momento.
    let reloj = null;
    chrome.storage.onChanged.addListener((cambios) => {
      clearTimeout(reloj);
      reloj = setTimeout(async () => {
        if (cambios.biblioteca) pintarIdeas();
        if (Object.keys(cambios).some((k) => k.startsWith('h:'))) pintarHistorial();
        if (cambios.curvas || cambios.asignacion) refrescarCurvas();
      }, 200);
    });
  }

  async function arrancar() {
    $('#version').textContent = `Versión ${chrome.runtime.getManifest().version}`;
    enlazar();
    await cargarContexto();
    pintarCurvasFabrica();
    pintarAsignacion();
    pintarPropias();
    pintarAjustes();
    const c = await pedir({ tipo: 'leerCalibracion' });
    cal = { informe: (c.ok && c.calibracion && c.calibracion.informe) || null, lecturas: (c.ok && c.calibracion && c.calibracion.lecturas) || null };
    pintarResumenInforme();
    await Promise.all([pintarResumenLecturas(), pintarHistorial(), pintarIdeas()]);
    let inicial = 'curvas';
    try {
      inicial = new URLSearchParams(location.search).get('pestana') || localStorage.getItem('lupa:pestana') || inicial;
    } catch {
      /* nada */
    }
    if (!$(`nav.pestanas button[data-pestana="${inicial}"]`)) inicial = 'curvas';
    mostrarPestana(inicial);
    document.body.dataset.listo = '1';
  }

  L.opciones = { pedir, leerPuntos };
  arrancar();
})((globalThis.LUPA = globalThis.LUPA || {}));
