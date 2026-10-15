/* Lupa KDP — búsquedas y «Los más vendidos».

   · Botón «Ver ventas» en cada libro: lee su ficha en segundo plano y pinta la estimación debajo.
   · Botón «Analizar página»: hace lo mismo con los libros de ESTA página, de uno en uno, con una
     pausa al azar de 4 a 6 segundos entre ficha y ficha y como mucho 30 fichas por página.
   Reglas que no se pueden saltar: solo los libros que Rodri tiene en pantalla (nunca otra página, ni
   la siguiente de la búsqueda), nada por su cuenta, y si Amazon pide comprobar que es una persona,
   se para del todo y lo avisa (no lo intenta saltar). Una ficha leída hace menos de 60 minutos no se
   vuelve a pedir a Amazon: se usa la del historial. */
(function (L) {
  'use strict';

  L.LISTAS = { maxPorPagina: 30, pausaMin: 4000, pausaMax: 6000, minutosCache: 60 };

  const e = L.escaparHTML;
  let estado = null;

  // ------------------------------------------------------------------ leer una ficha en segundo plano

  async function descargarFicha(asin) {
    const url = `${location.origin}/dp/${asin}`;
    let resp;
    try {
      resp = await fetch(url, { credentials: 'include', redirect: 'follow', headers: { Accept: 'text/html,application/xhtml+xml' } });
    } catch {
      return { error: 'no hay conexión con Amazon' };
    }
    let html = '';
    try {
      html = await resp.text();
    } catch {
      return { error: 'la ficha no ha llegado entera' };
    }
    const doc = new DOMParser().parseFromString(html, 'text/html');
    if (L.lector.detectarRobot(doc)) return { robot: true };
    if (!resp.ok) return { error: `Amazon ha contestado con un error ${resp.status}` };
    const ficha = L.lector.leerFicha(doc, resp.url || url);
    if (ficha.robot) return { robot: true };
    if (!ficha.ok) return { error: ficha.motivo };
    return { ficha };
  }

  /** Espera cancelable (con cuenta atrás en la barra). */
  async function esperar(ms) {
    const fin = Date.now() + ms;
    while (Date.now() < fin) {
      if (estado.parar) return false;
      estado.siguienteEn = Math.ceil((fin - Date.now()) / 1000);
      pintarBarra();
      await L.pausa(Math.min(250, fin - Date.now()));
    }
    estado.siguienteEn = null;
    return true;
  }

  function enCola(fn) {
    const p = estado.cadena.then(fn, fn);
    estado.cadena = p.catch(() => {});
    return p;
  }

  /**
   * Lee la ficha de un libro: primero del historial (si es reciente) y si no, de Amazon, siempre de
   * una en una y con la pausa humana entre dos peticiones a Amazon.
   */
  function leerFicha(asin, origen) {
    return enCola(async () => {
      if (estado.bloqueado) return { robot: true };
      const cache = await L.ui.pedir({ tipo: 'fichaReciente', tienda: estado.tienda, asin, minutos: L.LISTAS.minutosCache });
      if (cache.ok && cache.ficha) return { ficha: cache.ficha, deCache: true, minutos: cache.minutos };
      if (estado.ultimaPeticion) {
        const pausa = L.aleatorio(estado.pausa[0], estado.pausa[1]);
        const falta = estado.ultimaPeticion + pausa - Date.now();
        if (falta > 0 && !(await esperar(falta))) return { parado: true };
      }
      if (estado.bloqueado) return { robot: true };
      estado.peticiones.push(Date.now());
      const r = await descargarFicha(asin);
      estado.ultimaPeticion = Date.now();
      if (r.robot) {
        estado.bloqueado = true;
        estado.parar = true;
        L.ui.pedir({ tipo: 'bloqueo', url: `${location.origin}/dp/${asin}` });
        pintarBarra();
        return r;
      }
      if (r.ficha) {
        const g = await L.ui.pedir({ tipo: 'guardarLectura', ficha: r.ficha, origen });
        if (g && g.ok) r.entrada = g.entrada;
      }
      return r;
    });
  }

  // ------------------------------------------------------------------ cada libro

  function resultadoHtml(reg) {
    const r = reg.resultado;
    if (!r) return '';
    if (r.cargando) return `<span class="resultado tenue">${e(r.cargando)}</span>`;
    if (r.robot) return `<span class="resultado error">${L.ui.error('Amazon ha pedido comprobar que eres una persona: Lupa se ha parado')}</span>`;
    if (r.parado) return `<span class="resultado tenue">Parado</span>`;
    if (r.error) return `<span class="resultado error">${L.ui.error(`no se ha podido leer la ficha: ${r.error}`)}</span>`;
    const est = r.est;
    const v = est.ventas;
    const partes = [];
    if (v.ok) partes.push(`≈ <b class="num">${e(L.cifra(v.dia))}</b> al día`, `<b class="num hielo">${e(L.cifra(v.mes))}</b> al mes`);
    else partes.push(L.ui.error(v.motivo));
    const b = r.ficha.bsr;
    if (b && Number.isFinite(b.general)) partes.push(`BSR nº ${L.miles(b.general)}`);
    partes.push(est.regalia.ok ? `regalía ${e(L.dinero(est.regalia.regalia, est.regalia.moneda))}` : L.ui.error(`regalía: ${est.regalia.motivo}`));
    const etiqueta = v.ok ? `<span class="chip ${est.curva && est.curva.origen === 'calibrada' ? 'ok' : 'aviso'}">${e(est.curva && est.curva.origen === 'calibrada' ? 'calibrada' : 'EE. UU. sin calibrar')}</span>` : '';
    const cache = r.deCache ? `<span class="pequena">(del historial, leída hace ${r.minutos} min)</span>` : '';
    return `<span class="resultado" data-ventas-dia="${v.ok ? v.dia : ''}">${partes.join(' · ')} ${etiqueta} ${cache}</span>`;
  }

  function pintarTarjeta(reg) {
    const zona = reg.contenedor.querySelector('[data-resultado]');
    zona.innerHTML = resultadoHtml(reg);
    const boton = reg.contenedor.querySelector('[data-ver]');
    boton.disabled = !!(reg.resultado && reg.resultado.cargando);
  }

  async function verVentas(asin, origen = 'ver-ventas') {
    const reg = estado.items.get(asin);
    if (!reg) return null;
    if (estado.bloqueado) {
      reg.resultado = { robot: true };
      pintarTarjeta(reg);
      return reg.resultado;
    }
    reg.resultado = { cargando: estado.pendientes > 0 ? 'En cola…' : 'Leyendo la ficha…' };
    pintarTarjeta(reg);
    estado.pendientes++;
    const r = await leerFicha(asin, origen);
    estado.pendientes--;
    if (r.ficha) {
      const prefs = (r.entrada && r.entrada.prefs) || {};
      r.est = L.estimar({ ...r.ficha, ...prefs }, estado.contexto || {});
    }
    reg.resultado = r;
    pintarTarjeta(reg);
    pintarBarra();
    return r;
  }

  function dondeInsertar(el) {
    return (
      el.querySelector('[data-cy="title-recipe"]') ||
      el.querySelector('.s-title-instructions-style') ||
      el.querySelector('[class*="line-clamp"]')?.closest('a') ||
      el.querySelector('a[href*="/dp/"]')
    );
  }

  function anadirBoton(item) {
    const { host, contenedor } = L.ui.crearHost('lupa-kdp-tarjeta', 'tarjeta');
    contenedor.innerHTML = '<button class="oro" data-ver>Ver ventas</button><span data-resultado></span>';
    // Que el clic no llegue a la tarjeta de Amazon (no abre la ficha ni cuenta como clic en el anuncio).
    for (const tipo of ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup']) host.addEventListener(tipo, (ev) => ev.stopPropagation());
    contenedor.querySelector('[data-ver]').addEventListener('click', (ev) => {
      ev.preventDefault();
      verVentas(item.asin, 'ver-ventas');
    });
    const ancla = dondeInsertar(item.elemento);
    if (ancla && ancla.parentElement) ancla.insertAdjacentElement('afterend', host);
    else item.elemento.appendChild(host);
    host.dataset.asin = item.asin;
    estado.items.set(item.asin, { ...item, host, contenedor, resultado: null });
  }

  function escanear() {
    const { items } = L.lector.leerLista(document, location.href);
    for (const it of items) {
      const ya = estado.items.get(it.asin);
      if (ya && ya.elemento.isConnected && ya.host.isConnected) continue;
      if (ya) ya.host.remove();
      anadirBoton(it);
    }
    pintarBarra();
  }

  // ------------------------------------------------------------------ «Analizar página»

  function visibles() {
    return [...estado.items.values()].filter((r) => r.elemento.isConnected);
  }

  async function analizar() {
    if (estado.analizando) return;
    if (estado.bloqueado) {
      pintarBarra();
      return;
    }
    estado.analizando = true;
    estado.parar = false;
    estado.terminado = false;
    // Los libros de esta página en el orden en que salen, sin los ya leídos.
    const cola = visibles().filter((r) => !r.resultado || r.resultado.error || r.resultado.parado);
    estado.totalAnalisis = cola.length;
    estado.hechosAnalisis = 0;
    pintarBarra();
    for (const reg of cola) {
      if (estado.parar) break;
      // Máximo de fichas pedidas a Amazon en esta página (las del historial no cuentan).
      const pedidas = estado.peticiones.length;
      if (pedidas >= L.LISTAS.maxPorPagina) {
        estado.limite = true;
        break;
      }
      const r = await verVentas(reg.asin, 'analizar');
      estado.hechosAnalisis++;
      if (r && r.robot) break;
      pintarBarra();
    }
    estado.analizando = false;
    estado.terminado = true;
    estado.siguienteEn = null;
    pintarBarra();
  }

  function parar() {
    estado.parar = true;
    pintarBarra();
  }

  // ------------------------------------------------------------------ resumen y CSV de la página

  function leidos() {
    return visibles()
      .filter((r) => r.resultado && r.resultado.ficha)
      .sort((a, b) => {
        const va = a.resultado.est.ventas.ok ? a.resultado.est.ventas.dia : -1;
        const vb = b.resultado.est.ventas.ok ? b.resultado.est.ventas.dia : -1;
        return vb - va;
      });
  }

  function resumenHtml() {
    const filas = leidos();
    if (!filas.length) return '';
    let totalMes = 0;
    let totalRegaliaMes = 0;
    let moneda = 'EUR';
    const cuerpo = filas
      .map((r, i) => {
        const f = r.resultado.ficha;
        const est = r.resultado.est;
        moneda = f.moneda || moneda;
        if (est.ventas.ok) totalMes += est.ventas.mes;
        if (est.regaliaMes != null) totalRegaliaMes += est.regaliaMes;
        const ventas = est.ventas.ok ? `<td class="n">${L.cifra(est.ventas.dia)}</td><td class="n">${L.cifra(est.ventas.mes)}</td>` : `<td colspan="2">${L.ui.error(est.ventas.motivo)}</td>`;
        return `<tr><td class="n">${i + 1}</td><td><span class="t" title="${e(f.titulo || '')}">${e(f.titulo || f.asin)}</span></td><td class="n">${f.bsr && Number.isFinite(f.bsr.general) ? L.miles(f.bsr.general) : '—'}</td>${ventas}<td class="n">${est.regalia.ok ? e(L.dinero(est.regalia.regalia, est.regalia.moneda)) : 'ERROR'}</td></tr>`;
      })
      .join('');
    return `<table class="resumen" data-resumen><thead><tr><th class="n">#</th><th>Libro</th><th class="n">BSR</th><th class="n">Día</th><th class="n">Mes</th><th class="n">Regalía</th></tr></thead><tbody>${cuerpo}
      <tr class="total"><td></td><td>Total de la página (${filas.length} libros)</td><td></td><td></td><td class="n" data-total-mes="${totalMes}">${L.cifra(totalMes)}</td><td class="n">${e(L.dinero(totalRegaliaMes, moneda))}/mes</td></tr></tbody></table>`;
  }

  function csvPagina() {
    const cab = ['Puesto en la lista', 'ASIN', 'Título', 'Autor', 'Formato', 'Precio', 'Moneda', 'Páginas', 'Fecha de publicación', 'Reseñas', 'Nota', 'BSR general', 'Categoría del BSR', 'Ventas/día estimadas', 'Ventas/mes estimadas', 'Curva usada', 'Regalía por ejemplar', 'Regalía al mes', 'Patrocinado', 'Enlace'];
    const filas = leidos().map((r) => {
      const f = r.resultado.ficha;
      const est = r.resultado.est;
      return [
        r.puesto ?? '', f.asin, f.titulo || '', f.autor || '', f.formato || '', f.precio ?? '', f.moneda || '', f.paginas ?? '',
        f.fechaPublicacion ? L.fechaCorta(`${f.fechaPublicacion}T12:00:00`) : '', f.resenas ?? '', f.nota ?? '',
        f.bsr && Number.isFinite(f.bsr.general) ? f.bsr.general : '', (f.bsr && f.bsr.categoriaGeneral) || '',
        est.ventas.ok ? L.redondear(est.ventas.dia, 2) : `ERROR: ${est.ventas.motivo}`, est.ventas.ok ? L.redondear(est.ventas.mes, 1) : '',
        est.curva ? est.curva.nombre : '', est.regalia.ok ? L.redondear(est.regalia.regalia, 2) : `ERROR: ${est.regalia.motivo}`,
        est.regaliaMes != null ? L.redondear(est.regaliaMes, 2) : '', r.patrocinado ? 'sí' : 'no', f.url || '',
      ];
    });
    return L.exportar ? L.exportar.csv(cab, filas) : '';
  }

  // ------------------------------------------------------------------ barra

  function pintarBarra() {
    if (!estado || !estado.barra) return;
    const c = estado.barra.contenedor;
    if (estado.barraOculta) {
      estado.barra.host.style.display = 'none';
      return;
    }
    estado.barra.host.style.display = '';
    const n = visibles().length;
    const pedidas = estado.peticiones.length;
    const tipoTxt = estado.tipo === 'mas-vendidos' ? 'en esta lista de «Los más vendidos»' : 'en esta búsqueda';
    let estadoTxt = '';
    let progreso = 0;
    if (estado.bloqueado) {
      estadoTxt = `<div class="aviso-caja" data-alerta>Amazon ha pedido comprobar que eres una persona. Lupa se ha parado y no pedirá más fichas en esta página. Resuélvelo tú en una pestaña de Amazon y espera un buen rato antes de volver a analizar.</div>`;
    } else if (estado.analizando) {
      progreso = estado.totalAnalisis ? estado.hechosAnalisis / estado.totalAnalisis : 0;
      estadoTxt = `<div class="pequena" data-progreso-texto>Leyendo ${Math.min(estado.hechosAnalisis + 1, estado.totalAnalisis)} de ${estado.totalAnalisis}${estado.siguienteEn ? ` · siguiente ficha en ${estado.siguienteEn} s` : ''} · ${pedidas} de ${L.LISTAS.maxPorPagina} fichas pedidas a Amazon</div>`;
    } else if (estado.terminado) {
      progreso = 1;
      const motivo = estado.limite
        ? `Se ha llegado al máximo de ${L.LISTAS.maxPorPagina} fichas en esta página: para seguir, pasa a la página siguiente o usa «Ver ventas» libro a libro.`
        : estado.parar
          ? 'Parado.'
          : 'Hecho.';
      estadoTxt = `<div class="pequena" data-progreso-texto>${e(motivo)} ${leidos().length} libros leídos · ${pedidas} fichas pedidas a Amazon.</div>`;
    } else {
      estadoTxt = `<div class="pequena" data-progreso-texto>«Analizar página» lee las fichas de uno en uno, con 4 a 6 s entre ficha y ficha y como mucho ${L.LISTAS.maxPorPagina} por página.</div>`;
    }
    c.innerHTML = `<div class="barra" role="complementary" aria-label="Lupa KDP">
      <div class="cabecera"><span class="marca">Lupa <i>KDP</i></span><span class="chip hielo" data-cuenta>${n} libros</span><span class="pequena">${e(tipoTxt)}</span><span class="hueco"></span>
        <button class="fantasma" data-accion="ocultar" aria-label="Cerrar la barra" title="Cerrar la barra (el icono de Lupa la vuelve a abrir)">×</button></div>
      <div class="cuerpo">
        <div class="botones">
          <button class="oro" data-accion="analizar"${estado.analizando || estado.bloqueado || !n ? ' disabled' : ''}>Analizar página</button>
          <button class="peligro" data-accion="parar"${estado.analizando ? '' : ' disabled'}>Parar</button>
          <button data-accion="csv-pagina"${leidos().length ? '' : ' disabled'}>CSV de esta página</button>
        </div>
        <div class="progreso"><i style="width:${Math.round(progreso * 100)}%"></i></div>
        ${estadoTxt}
        ${resumenHtml()}
      </div></div>`;
  }

  function crearBarra() {
    const { host, contenedor } = L.ui.crearHost('lupa-kdp-barra');
    document.documentElement.appendChild(host);
    contenedor.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-accion]');
      if (!b) return;
      if (b.dataset.accion === 'analizar') analizar();
      else if (b.dataset.accion === 'parar') parar();
      else if (b.dataset.accion === 'ocultar') {
        estado.barraOculta = true;
        pintarBarra();
      } else if (b.dataset.accion === 'csv-pagina') {
        const nombre = L.exportar.nombreArchivo(estado.tipo === 'mas-vendidos' ? 'lupa-kdp-mas-vendidos' : 'lupa-kdp-busqueda');
        L.ui.descargar(nombre, csvPagina());
      }
    });
    estado.barra = { host, contenedor };
  }

  // ------------------------------------------------------------------ arranque

  async function iniciar({ tipo, tienda, contexto }) {
    estado = {
      tipo,
      tienda,
      contexto,
      items: new Map(),
      cadena: Promise.resolve(),
      peticiones: [],
      ultimaPeticion: 0,
      pausa: [L.LISTAS.pausaMin, L.LISTAS.pausaMax],
      analizando: false,
      parar: false,
      bloqueado: false,
      pendientes: 0,
    };
    // Solo las pruebas automáticas acortan la pausa (con una marca interna); Rodri no puede bajarla.
    const { modoPruebas } = await chrome.storage.local.get('modoPruebas').catch(() => ({}));
    if (modoPruebas && Array.isArray(modoPruebas.pausa)) estado.pausa = modoPruebas.pausa;
    crearBarra();
    escanear();
    // Amazon añade libros al bajar (Los más vendidos) o al filtrar: se les pone su botón.
    let reloj = null;
    new MutationObserver((cambios) => {
      if (cambios.every((c) => [...c.addedNodes].every((n) => n.nodeType !== 1 || n.hasAttribute('data-lupa-kdp')))) return;
      clearTimeout(reloj);
      reloj = setTimeout(escanear, 400);
    }).observe(document.body, { childList: true, subtree: true });
  }

  function volverAMostrar() {
    if (!estado) return false;
    estado.barraOculta = false;
    pintarBarra();
    return true;
  }

  L.lista = { iniciar, volverAMostrar, verVentas, analizar, parar, csvPagina, estado: () => estado };
})((globalThis.LUPA = globalThis.LUPA || {}));
