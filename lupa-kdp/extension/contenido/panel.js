/* Lupa KDP — panel flotante en la ficha de un libro.
   Enseña ventas al día y al mes (con contador animado y la etiqueta de la curva), el BSR general y de
   categorías, la regalía KDP por ejemplar y al mes, los datos de la ficha y la tendencia del BSR.
   Todo dato que no se pueda leer sale como «ERROR — motivo». Se puede mover, plegar y cerrar. */
(function (L) {
  'use strict';

  const e = L.escaparHTML;
  const ERR = (m) => L.ui.error(m);
  let estado = null; // { host, contenedor, datos, acciones, minimo, cerrado }

  // ------------------------------------------------------------------ piezas

  function seccionVentas(d) {
    const v = d.est.ventas;
    if (!v.ok) {
      // Sin BSR, el motivo largo ya sale en «Puesto en ventas»: aquí basta con decir por qué no hay cifra.
      const sinBsr = d.ficha.bsr && !Number.isFinite(d.ficha.bsr.general) && L.tipoFormato(d.ficha.formato) !== 'otro' && d.ficha.formato;
      const motivo = sinBsr ? 'sin puesto en ventas (BSR) no hay estimación; el motivo está en «Puesto en ventas»' : v.motivo;
      return `<section class="seccion" data-seccion="ventas"><h3>Ventas estimadas</h3><p data-error="ventas">${ERR(motivo)}</p></section>`;
    }
    const calibrada = d.est.curva && d.est.curva.origen === 'calibrada';
    const avisos = d.est.avisos.length ? `<ul class="avisos">${d.est.avisos.map((a) => `<li>${e(a)}</li>`).join('')}</ul>` : '';
    return `<section class="seccion" data-seccion="ventas"><h3>Ventas estimadas</h3>
      <div class="cifras">
        <div class="cifra oro"><b class="num" data-contador="dia">0</b><span>al día</span></div>
        <div class="cifra hielo"><b class="num" data-contador="mes">0</b><span>al mes</span></div>
      </div>
      <div><span class="chip ${calibrada ? 'ok' : 'aviso'}" data-etiqueta title="${e((d.est.curva && d.est.curva.fuente) || '')}">${e(d.est.etiqueta)}</span></div>
      ${avisos}
    </section>`;
  }

  function seccionBsr(d) {
    const b = d.ficha.bsr || {};
    if (!Number.isFinite(b.general)) {
      const cats = (b.categorias || []).length ? `<ul class="bsr-cats">${b.categorias.map((c) => `<li>nº ${L.miles(c.puesto)} en ${e(c.nombre)}</li>`).join('')}</ul>` : '';
      return `<section class="seccion" data-seccion="bsr"><h3>Puesto en ventas (BSR)</h3><p data-error="bsr">${ERR(b.motivo || 'no se ve el BSR')}</p>${cats}</section>`;
    }
    const cats = (b.categorias || []).map((c) => `<li>nº ${L.miles(c.puesto)} en ${e(c.nombre)}</li>`).join('');
    return `<section class="seccion" data-seccion="bsr"><h3>Puesto en ventas (BSR)</h3>
      <div class="bsr-general" data-bsr="${b.general}">nº ${L.miles(b.general)} <span class="pequena">en ${e(b.categoriaGeneral)}</span></div>
      ${cats ? `<ul class="bsr-cats">${cats}</ul>` : '<span class="pequena">Sin puestos en categorías</span>'}
    </section>`;
  }

  function selectorTinta(prefs) {
    const actual = prefs.tinta || 'negra';
    return `<label class="casilla-tuya"><span>TÚ: tinta del libro</span><select data-pref="tinta">${L.TINTAS.map((t) => `<option value="${e(t)}"${t === actual ? ' selected' : ''}>${e(L.capitalizarTexto(t))}</option>`).join('')}</select></label>`;
  }

  function selectorTamano(prefs) {
    const actual = prefs.tamano || '';
    const op = [['', 'Según la ficha'], ['normal', 'Normal (hasta 15,5 × 22,9 cm)'], ['grande', 'Grande (p. ej. 21,6 × 27,9 cm)']];
    return `<label class="casilla-tuya"><span>TÚ: tamaño del libro</span><select data-pref="tamano">${op.map(([v, t]) => `<option value="${v}"${v === actual ? ' selected' : ''}>${e(t)}</option>`).join('')}</select></label>`;
  }

  function seccionRegalia(d) {
    const r = d.est.regalia;
    const impreso = L.tipoFormato(d.ficha.formato) === 'impreso';
    const faltaTamano = impreso && !d.ficha.medidas;
    const casillas = impreso ? `<div class="cifras">${selectorTinta(d.prefs)}${faltaTamano || d.prefs.tamano ? selectorTamano(d.prefs) : ''}</div>` : '';
    if (!r.ok) {
      return `<section class="seccion" data-seccion="regalia"><h3>Regalía KDP estimada</h3><p data-error="regalia">${ERR(r.motivo)}</p>${casillas}</section>`;
    }
    const mes = d.est.regaliaMes != null ? `<span data-regalia-mes>${e(L.dinero(d.est.regaliaMes, r.moneda))} al mes</span>` : `<span class="pequena">sin ventas estimadas no hay cifra al mes</span>`;
    const avisos = r.avisos.length ? `<ul class="avisos">${r.avisos.map((a) => `<li>${e(a)}</li>`).join('')}</ul>` : '';
    return `<section class="seccion" data-seccion="regalia"><h3>Regalía KDP estimada</h3>
      <div class="regalia"><b data-regalia="${r.regalia}">${e(L.dinero(r.regalia, r.moneda))}</b><span>por ejemplar</span>${mes}</div>
      <div class="explica" data-explica>${e(r.explicacion)}</div>
      ${r.nota ? `<div class="explica" data-nota-regalia>${e(r.nota)}</div>` : ''}
      ${avisos}
      ${casillas}
    </section>`;
  }

  function seccionDatos(d) {
    const f = d.ficha;
    const falta = f.faltan || {};
    const fila = (titulo, valor, clave) => `<dt>${e(titulo)}</dt><dd data-dato="${clave}">${valor != null && valor !== '' ? valor : ERR(falta[clave] || 'no se ha podido leer')}</dd>`;
    let tamano = null;
    if (f.medidas) {
      const t = L.regalias.tamanoDeMedidas(f.medidas);
      tamano = t.ok ? `${t.tamano} (${String(t.anchoCm).replace('.', ',')} × ${String(t.altoCm).replace('.', ',')} cm)` : ERR(t.motivo);
    } else if (L.tipoFormato(f.formato) === 'kindle') tamano = 'no aplica (Kindle)';
    const precio = Number.isFinite(f.precio) ? e(L.dinero(f.precio, f.moneda)) + (Number.isFinite(f.precioCatalogo) ? ` <span class="pequena">(catálogo ${e(L.dinero(f.precioCatalogo, f.moneda))})</span>` : '') : null;
    const resenas = Number.isFinite(f.resenas) ? (f.resenas === 0 ? 'ninguna todavía' : L.miles(f.resenas)) : null;
    const nota = Number.isFinite(f.nota) ? `${String(f.nota).replace('.', ',')} de 5` : f.resenas === 0 ? 'sin nota (no hay reseñas)' : null;
    return `<section class="seccion" data-seccion="datos"><h3>Datos de la ficha</h3><dl class="datos">
      ${fila('Formato', f.formato ? e(f.formato) : null, 'formato')}
      ${fila('Precio', precio, 'precio')}
      ${fila('Páginas', Number.isFinite(f.paginas) ? L.miles(f.paginas) : null, 'paginas')}
      ${fila('Tamaño', tamano, 'medidas')}
      ${fila('Publicación', f.fechaPublicacion ? e(L.fechaBonita(f.fechaPublicacion)) : null, 'fechaPublicacion')}
      ${fila('Reseñas', resenas, 'resenas')}
      ${fila('Nota', nota, 'nota')}
      <dt>ASIN</dt><dd>${e(f.asin || '—')}</dd>
    </dl></section>`;
  }

  function seccionTendencia(d) {
    const t = d.tendencia;
    let grafica = '';
    if (t.puntos.length >= 2) {
      const { d: camino, circulos } = L.historial.linea(t.puntos, 300, 64, 7);
      grafica = `<svg class="grafica" viewBox="0 0 300 64" preserveAspectRatio="none" role="img" aria-label="Tendencia del BSR: más arriba es mejor puesto"><path d="${camino}"/>${circulos.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6"/>`).join('')}</svg>`;
    }
    return `<section class="seccion" data-seccion="tendencia"><h3>Tendencia del BSR</h3>${grafica}<div class="pequena" data-tendencia>${e(t.texto)}${t.puntos.length >= 2 ? ' · más arriba en la gráfica = vende más' : ''}</div></section>`;
  }

  function html(d) {
    const tienda = L.TIENDAS[d.ficha.tienda];
    if (estado && estado.minimo) {
      const v = d.est.ventas;
      return `<div class="panel minimo" role="complementary" aria-label="Lupa KDP">
        <div class="pastilla" data-accion="desplegar" title="Desplegar el panel de Lupa KDP"><span class="marca">Lupa <i>KDP</i></span>
        <span class="num">${v.ok ? `${L.cifra(v.dia)} al día` : 'ERROR'}</span></div></div>`;
    }
    return `<div class="panel" role="complementary" aria-label="Lupa KDP">
      <div class="cabecera" data-arrastre>
        <span class="marca">Lupa <i>KDP</i></span><span class="chip hielo">${e(tienda ? tienda.nombre : '')}</span>
        <span class="hueco"></span>
        <button class="fantasma" data-accion="plegar" title="Plegar el panel" aria-label="Plegar el panel">–</button>
        <button class="fantasma" data-accion="cerrar" title="Cerrar el panel (el icono de Lupa lo vuelve a abrir)" aria-label="Cerrar el panel">×</button>
      </div>
      <div class="cuerpo">
        <div class="titulo-libro" title="${e(d.ficha.titulo || '')}">${d.ficha.titulo ? e(d.ficha.titulo) : ERR('no se ve el título')}</div>
        ${seccionVentas(d)}
        ${seccionBsr(d)}
        ${seccionRegalia(d)}
        ${seccionTendencia(d)}
        ${seccionDatos(d)}
        <div class="botones">
          <button class="oro" data-accion="biblioteca">Mandar a la Biblioteca</button>
          <button data-accion="csv-libro">CSV de este libro</button>
          <button data-accion="csv-todo">CSV de todo</button>
          <button class="fantasma" data-accion="opciones">Opciones</button>
        </div>
        <div class="estado-biblioteca" data-estado-biblioteca aria-live="polite"></div>
      </div>
    </div>`;
  }

  // ------------------------------------------------------------------ comportamiento

  function animar() {
    const v = estado.datos.est.ventas;
    if (!v.ok) return;
    const dia = estado.contenedor.querySelector('[data-contador="dia"]');
    const mes = estado.contenedor.querySelector('[data-contador="mes"]');
    if (dia) L.ui.contador(dia, v.dia);
    if (mes) L.ui.contador(mes, v.mes);
  }

  function colocar() {
    const panel = estado.contenedor.querySelector('.panel');
    if (!panel || !estado.pos) return;
    const x = Math.max(0, Math.min(window.innerWidth - 120, estado.pos.x));
    const y = Math.max(0, Math.min(window.innerHeight - 60, estado.pos.y));
    panel.style.left = `${x}px`;
    panel.style.top = `${y}px`;
    panel.style.right = 'auto';
  }

  function arrastrable() {
    const cab = estado.contenedor.querySelector('[data-arrastre]');
    if (!cab) return;
    cab.addEventListener('pointerdown', (ev) => {
      if (ev.target.closest('button')) return;
      const panel = estado.contenedor.querySelector('.panel');
      const r = panel.getBoundingClientRect();
      const dx = ev.clientX - r.left;
      const dy = ev.clientY - r.top;
      cab.setPointerCapture(ev.pointerId);
      const mover = (m) => {
        estado.pos = { x: m.clientX - dx, y: m.clientY - dy };
        colocar();
      };
      const soltar = () => {
        cab.removeEventListener('pointermove', mover);
        cab.removeEventListener('pointerup', soltar);
        chrome.storage.local.set({ panelPos: estado.pos }).catch(() => {});
      };
      cab.addEventListener('pointermove', mover);
      cab.addEventListener('pointerup', soltar);
    });
  }

  function pintar(animarCifras = true) {
    estado.contenedor.innerHTML = html(estado.datos);
    colocar();
    arrastrable();
    if (animarCifras) animar();
    else {
      const v = estado.datos.est.ventas;
      for (const [k, val] of [['dia', v.dia], ['mes', v.mes]]) {
        const el = estado.contenedor.querySelector(`[data-contador="${k}"]`);
        if (el) {
          el.dataset.valor = String(val);
          el.textContent = L.cifra(val);
        }
      }
    }
    if (estado.mensajeBiblioteca) avisoBiblioteca(estado.mensajeBiblioteca.texto, estado.mensajeBiblioteca.tipo);
  }

  async function alPulsar(ev) {
    const b = ev.target.closest('[data-accion]');
    if (!b) return;
    const a = estado.acciones;
    switch (b.dataset.accion) {
      case 'plegar':
        estado.minimo = true;
        chrome.storage.local.set({ panelMinimo: true }).catch(() => {});
        pintar(false);
        break;
      case 'desplegar':
        estado.minimo = false;
        chrome.storage.local.set({ panelMinimo: false }).catch(() => {});
        pintar(true);
        break;
      case 'cerrar':
        estado.cerrado = true;
        estado.host.style.display = 'none';
        break;
      case 'biblioteca':
        b.disabled = true;
        await a.mandarBiblioteca();
        b.disabled = false;
        break;
      case 'csv-libro':
        await a.exportar({ asin: estado.datos.ficha.asin, tienda: estado.datos.ficha.tienda });
        break;
      case 'csv-todo':
        await a.exportar(null);
        break;
      case 'opciones':
        await L.ui.pedir({ tipo: 'abrirOpciones' });
        break;
      default:
    }
  }

  async function alCambiar(ev) {
    const s = ev.target.closest('select[data-pref]');
    if (!s) return;
    await estado.acciones.cambiarPreferencia(s.dataset.pref, s.value);
  }

  /** Línea de estado de «Mandar a la Biblioteca». tipo: 'info' | 'ok' | 'error'. */
  function avisoBiblioteca(texto, tipo = 'info') {
    if (!estado) return;
    estado.mensajeBiblioteca = { texto, tipo };
    const el = estado.contenedor.querySelector('[data-estado-biblioteca]');
    if (el) el.innerHTML = texto ? `<div class="aviso-caja ${tipo === 'error' ? '' : tipo}">${e(texto)}</div>` : '';
  }

  /**
   * Pinta (o repinta) el panel.
   * datos: { ficha, est, tendencia, prefs }; acciones: { mandarBiblioteca, exportar, cambiarPreferencia }.
   */
  async function mostrar(datos, acciones, { animar: conAnimacion = true } = {}) {
    if (!estado) {
      const { host, contenedor } = L.ui.crearHost('lupa-kdp-panel');
      document.documentElement.appendChild(host);
      const guardado = await chrome.storage.local.get(['panelPos', 'panelMinimo']).catch(() => ({}));
      estado = { host, contenedor, minimo: guardado.panelMinimo === true, pos: guardado.panelPos || null, cerrado: false };
      contenedor.addEventListener('click', alPulsar);
      contenedor.addEventListener('change', alCambiar);
      window.addEventListener('resize', () => colocar());
    }
    estado.datos = datos;
    estado.acciones = acciones;
    pintar(conAnimacion);
  }

  /** El icono de Lupa vuelve a abrir el panel cerrado. */
  function volverAMostrar() {
    if (!estado) return false;
    estado.cerrado = false;
    estado.minimo = false;
    estado.host.style.display = '';
    pintar(true);
    return true;
  }

  L.capitalizarTexto = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
  L.panel = { mostrar, volverAMostrar, avisoBiblioteca, existe: () => !!estado };
})((globalThis.LUPA = globalThis.LUPA || {}));
