/* Lupa KDP — piezas de interfaz para las páginas de Amazon.
   Todo lo que pinta Lupa va dentro de una «sombra» (Shadow DOM): el estilo de Amazon no le afecta
   y el de Lupa no toca la página. Estilo de la casa: noche, oro y azul hielo; títulos y cifras en
   Oswald, texto en Rubik (las fuentes viajan dentro de la extensión: no se pide nada a internet).
   Casillas que rellena Rodri: amarillas y con «TÚ:» delante. Sin emoticonos. */
(function (L) {
  'use strict';

  const ESTILO = `
:host { all: initial; }
* { box-sizing: border-box; }
.lupa {
  --bg: #0B0F1A; --bg2: #131A2B; --bg3: #18213a; --fg: #F4F1EA; --muted: #A7AEBC; --line: #26304A;
  --oro: #D4A64A; --oro2: #E8C47A; --hielo: #5FB8E6; --ok: #5FD39A; --warn: #F2B84B; --bad: #F08A80;
  --display: 'Lupa Oswald', Oswald, Impact, 'Arial Narrow', sans-serif;
  --body: 'Lupa Rubik', Rubik, system-ui, -apple-system, 'Segoe UI', sans-serif;
  font: 400 13px/1.45 var(--body); color: var(--fg); -webkit-font-smoothing: antialiased; text-align: left;
}
.lupa button { font: 500 12.5px var(--body); cursor: pointer; border-radius: 8px; border: 1px solid var(--line); background: var(--bg2); color: var(--fg); padding: 6px 10px; line-height: 1.2; }
.lupa button:hover { border-color: var(--hielo); }
.lupa button:focus-visible, .lupa select:focus-visible, .lupa a:focus-visible { outline: 3px solid var(--oro); outline-offset: 2px; }
.lupa button[disabled] { opacity: .5; cursor: not-allowed; }
.lupa button.oro { background: var(--oro); border-color: var(--oro); color: #1a1200; font-weight: 700; }
.lupa button.oro:hover { background: var(--oro2); }
.lupa button.hielo { background: var(--hielo); border-color: var(--hielo); color: #06202e; font-weight: 700; }
.lupa button.peligro { color: var(--bad); border-color: rgba(240,138,128,.5); }
.lupa button.fantasma { background: transparent; border-color: transparent; color: var(--muted); padding: 4px 7px; }
.lupa button.fantasma:hover { color: var(--fg); border-color: var(--line); }
.lupa .chip { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: .02em; }
.lupa .chip.aviso { background: rgba(242,184,75,.16); color: var(--warn); }
.lupa .chip.ok { background: rgba(95,211,154,.16); color: var(--ok); }
.lupa .chip.hielo { background: rgba(95,184,230,.16); color: var(--hielo); }
.lupa .chip.tenue { background: rgba(167,174,188,.14); color: var(--muted); }
.lupa .error { color: var(--bad); font-weight: 500; }
.lupa .error b { font-weight: 700; letter-spacing: .04em; }
.lupa .tenue { color: var(--muted); }
.lupa .pequena { font-size: 11.5px; color: var(--muted); }
.lupa .casilla-tuya { display: grid; gap: 3px; }
.lupa .casilla-tuya > span { font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--oro); font-weight: 700; }
.lupa .casilla-tuya select { font: 500 13px var(--body); padding: 6px 8px; border: 2px solid #E8C547; border-radius: 8px; background: #FFF1A8; color: #1a1200; }
.lupa .num { font-family: var(--display); font-variant-numeric: tabular-nums; }
.lupa .aviso-caja { border-radius: 10px; padding: 8px 10px; font-size: 12.5px; border: 1px solid rgba(240,138,128,.45); background: rgba(240,138,128,.1); color: var(--bad); }
.lupa .aviso-caja.ok { border-color: rgba(95,211,154,.45); background: rgba(95,211,154,.1); color: var(--ok); }
.lupa .aviso-caja.info { border-color: rgba(95,184,230,.45); background: rgba(95,184,230,.1); color: var(--hielo); }

/* ---------- panel flotante de la ficha */
.panel { position: fixed; top: 96px; right: 16px; width: 344px; max-height: calc(100vh - 112px); overflow: auto; z-index: 2147483000;
  background: var(--bg); border: 1px solid var(--line); border-radius: 16px; box-shadow: 0 22px 60px rgba(0,0,0,.55), 0 0 0 1px rgba(212,166,74,.12);
  background-image: radial-gradient(ellipse at 15% -10%, rgba(95,184,230,.14), transparent 55%), radial-gradient(ellipse at 95% 0%, rgba(212,166,74,.12), transparent 50%); }
.panel.minimo { width: auto; max-height: none; overflow: visible; border-radius: 999px; }
.cabecera { display: flex; align-items: center; gap: 8px; padding: 10px 12px 8px; cursor: grab; user-select: none; border-bottom: 1px solid var(--line); }
.cabecera:active { cursor: grabbing; }
.marca { font-family: var(--display); font-weight: 700; font-size: 17px; letter-spacing: .14em; color: var(--oro); text-transform: uppercase; }
.marca i { font-style: normal; color: var(--hielo); }
.hueco { flex: 1; }
.cuerpo { padding: 10px 14px 14px; display: grid; gap: 12px; }
.titulo-libro { font-family: var(--display); font-weight: 500; font-size: 17px; line-height: 1.15; color: var(--fg); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.seccion { display: grid; gap: 6px; }
.seccion > h3 { margin: 0; font-family: var(--display); font-weight: 500; font-size: 13px; letter-spacing: .12em; text-transform: uppercase; color: var(--oro); }
.cifras { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.cifra { background: var(--bg2); border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; }
.cifra b { display: block; font-family: var(--display); font-weight: 700; font-size: 38px; line-height: 1; color: var(--fg); font-variant-numeric: tabular-nums; }
.cifra.oro b { color: var(--oro); }
.cifra.hielo b { color: var(--hielo); }
.cifra span { font-size: 11.5px; color: var(--muted); }
.datos { display: grid; grid-template-columns: auto 1fr; gap: 3px 10px; font-size: 12.5px; }
.datos dt { color: var(--muted); }
.datos dd { margin: 0; color: var(--fg); min-width: 0; overflow-wrap: anywhere; }
.bsr-general { font-family: var(--display); font-size: 22px; color: var(--hielo); line-height: 1.1; }
.bsr-cats { margin: 0; padding: 0; list-style: none; font-size: 12px; color: var(--muted); display: grid; gap: 2px; }
.regalia { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.regalia b { font-family: var(--display); font-size: 26px; color: var(--oro); }
.explica { font-size: 11.5px; color: var(--muted); }
.avisos { margin: 0; padding-left: 16px; font-size: 11.5px; color: var(--warn); display: grid; gap: 2px; }
.grafica { width: 100%; height: 64px; display: block; background: var(--bg2); border: 1px solid var(--line); border-radius: 10px; }
.grafica path { fill: none; stroke: var(--hielo); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.grafica circle { fill: var(--oro); }
.botones { display: flex; flex-wrap: wrap; gap: 6px; }
.estado-biblioteca { font-size: 12px; }
.pastilla { display: flex; align-items: center; gap: 10px; padding: 8px 14px; cursor: pointer; }
.pastilla .num { font-size: 18px; color: var(--fg); }

/* ---------- listas: botón «Ver ventas» en cada libro */
.tarjeta { margin: 6px 0 4px; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; font-size: 12.5px; }
.tarjeta button { padding: 4px 10px; font-size: 12px; }
.tarjeta .resultado { display: inline-flex; flex-wrap: wrap; gap: 4px 10px; align-items: baseline; background: var(--bg); color: var(--fg); border: 1px solid var(--line); border-radius: 10px; padding: 5px 10px; }
.tarjeta .resultado .num { font-size: 16px; color: var(--oro); }
.tarjeta .resultado .num.hielo { color: var(--hielo); }
.tarjeta .resultado.error { color: var(--bad); border-color: rgba(240,138,128,.5); }

/* ---------- listas: barra de «Analizar página» */
.barra { position: fixed; right: 16px; bottom: 16px; z-index: 2147483000; width: 380px; max-height: calc(100vh - 32px); overflow: auto;
  background: var(--bg); border: 1px solid var(--line); border-radius: 16px; box-shadow: 0 22px 60px rgba(0,0,0,.55); }
.barra .cuerpo { gap: 10px; }
.progreso { height: 6px; border-radius: 6px; background: var(--line); overflow: hidden; }
.progreso i { display: block; height: 100%; width: 0; background: linear-gradient(90deg, var(--hielo), var(--oro)); transition: width .3s; }
.resumen { width: 100%; border-collapse: collapse; font-size: 12px; }
.resumen th { text-align: left; font-family: var(--display); font-weight: 500; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--oro); padding: 4px 6px; border-bottom: 1px solid var(--line); }
.resumen td { padding: 4px 6px; border-bottom: 1px solid var(--line); vertical-align: top; }
.resumen td.n, .resumen th.n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.resumen tr.total td { font-weight: 700; border-top: 2px solid var(--oro); border-bottom: 0; }
.resumen .t { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
@media (prefers-reduced-motion: reduce) { .progreso i { transition: none; } }
`;

  /** Crea un elemento con sombra y el estilo de Lupa. Devuelve { host, raiz }. */
  function crearHost(etiqueta, clase) {
    const host = document.createElement(etiqueta);
    host.setAttribute('data-lupa-kdp', '');
    const raiz = host.attachShadow({ mode: 'open' });
    const estilo = document.createElement('style');
    estilo.textContent = ESTILO;
    raiz.appendChild(estilo);
    const contenedor = document.createElement('div');
    contenedor.className = `lupa ${clase || ''}`.trim();
    raiz.appendChild(contenedor);
    return { host, raiz, contenedor };
  }

  /** Mensaje al service worker. */
  async function pedir(mensaje) {
    try {
      const r = await chrome.runtime.sendMessage(mensaje);
      return r || { ok: false, error: 'Lupa no contesta: recarga la página.' };
    } catch (e) {
      return { ok: false, error: /context invalidated|Extension context/i.test(String(e && e.message)) ? 'Lupa se ha actualizado: recarga la página.' : String((e && e.message) || e) };
    }
  }

  let fuentesCargadas = null;
  /** Oswald y Rubik dentro de la página, desde la extensión (sin pedir nada a internet). */
  function cargarFuentes() {
    if (fuentesCargadas) return fuentesCargadas;
    fuentesCargadas = (async () => {
      const r = await pedir({ tipo: 'fuentes' });
      if (!r || !r.ok) return false;
      const bytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const caras = [new FontFace('Lupa Oswald', bytes(r.oswald), { weight: '200 700' }), new FontFace('Lupa Rubik', bytes(r.rubik), { weight: '300 900' })];
      for (const c of caras) {
        await c.load();
        document.fonts.add(c);
      }
      return true;
    })().catch(() => false);
    return fuentesCargadas;
  }

  const sinMovimiento = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** Contador animado: sube de 0 a la cifra en algo más de un segundo (sin animación si el sistema lo pide). */
  function contador(el, valor, formatear = L.cifra, ms = 1200) {
    el.dataset.valor = String(valor);
    if (!Number.isFinite(valor) || sinMovimiento()) {
      el.textContent = formatear(valor);
      return;
    }
    const t0 = performance.now();
    el.textContent = formatear(0);
    const paso = (t) => {
      const p = Math.min(1, (t - t0) / ms);
      const e = 1 - (1 - p) ** 3;
      el.textContent = formatear(p >= 1 ? valor : valor * e);
      if (p < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  }

  /** Descarga un archivo generado en la página. */
  function descargar(nombre, contenido, tipo = 'text/csv;charset=utf-8') {
    const blob = contenido instanceof Blob ? contenido : new Blob([contenido], { type: tipo });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.style.display = 'none';
    document.documentElement.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  /** Copia texto al portapapeles (con plan B si el navegador no deja). */
  async function copiar(texto) {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch {
      const t = document.createElement('textarea');
      t.value = texto;
      t.style.cssText = 'position:fixed;opacity:0;left:-9999px';
      document.documentElement.appendChild(t);
      t.select();
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } catch {
        ok = false;
      }
      t.remove();
      return ok;
    }
  }

  const e = L.escaparHTML;
  /** «ERROR — motivo» en rojo (lo que no se ha podido leer). */
  const error = (motivo) => `<span class="error"><b>ERROR</b> — ${e(motivo)}</span>`;

  L.ui = { ESTILO, crearHost, pedir, cargarFuentes, contador, descargar, copiar, error, sinMovimiento };
})((globalThis.LUPA = globalThis.LUPA || {}));
