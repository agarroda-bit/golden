/* Catálogo sin compra · GOLDEN OCLOCK (11/11/2026)
   Lista semanal de quien pidió el catálogo en Linktree y no ha comprado.
   Datos cifrados con el PIN (datos.enc.json). Lo que se marca se guarda en este aparato (localStorage)
   y sale con «Exportar»; el cruce del lunes lo recoge. Nada se envía desde aquí. */
'use strict';
const $ = (s, p) => (p || document).querySelector(s);
const $$ = (s, p) => Array.from((p || document).querySelectorAll(s));
const h = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const K = { llave: 'sinCompra.llave', fallos: 'sinCompra.fallos', bloqueo: 'sinCompra.bloqueo', ev: 'sinCompra.ev', firma: 'sinCompra.firma', oferta: 'sinCompra.oferta', tab: 'sinCompra.tab' };
const lee = (k, def) => { try { const v = localStorage.getItem(k); return v == null ? def : v; } catch (e) { return def; } };
const pon = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

let D = null;                 // {generado, semana, kpis, cuentas, apuntados, personas}
let EV = {};                  // {tel9: [{t, r, m}]} marcado en este aparato
try { EV = JSON.parse(lee(K.ev, '{}')) || {}; } catch (e) { EV = {}; }
let TAB = lee(K.tab, 'escribir');
let FILTRO = 'todos';
let BUSCA = '';
let CUANTOS = 40;

const RES = [['escrito', '✓ Escrito'], ['llamado', '📞 Llamado'], ['no_contesta', 'No contesta'],
             ['respondio', '💬 Respondió'], ['venta', '💰 Venta'], ['baja', 'BAJA']];
const NOMRES = { escrito: 'escrito', llamado: 'llamado', no_contesta: 'no contesta', respondio: 'respondió', venta: 'venta', baja: 'BAJA' };
const CONTACTO = ['escrito', 'llamado', 'no_contesta'];

/* ---------- abrir con PIN (igual que Leads Linktree) ---------- */
const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function descifra(sobre, clave) {
  const txt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(sobre.iv) }, clave, b64(sobre.datos));
  return JSON.parse(new TextDecoder().decode(txt));
}
async function claveDePin(pin, sobre, extraible) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64(sobre.sal), iterations: sobre.iter, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, !!extraible, ['decrypt']);
}
async function arranca() {
  let sobre;
  try { sobre = await fetch('datos.enc.json', { cache: 'no-store' }).then((r) => r.json()); }
  catch (e) { $('#mal').textContent = 'No se pudo cargar la lista. Recarga la página.'; return; }
  try {
    const g = JSON.parse(lee(K.llave, 'null'));
    if (g && g.sal === sobre.sal && g.hasta > Date.now()) {
      const clave = await crypto.subtle.importKey('jwk', g.jwk, { name: 'AES-GCM' }, false, ['decrypt']);
      D = await descifra(sobre, clave);
      return entra();
    }
  } catch (e) {}
  $('#abrir').onclick = async () => {
    const bloq = Number(lee(K.bloqueo, 0));
    if (bloq > Date.now()) { $('#mal').textContent = 'Bloqueado. Prueba en ' + Math.ceil((bloq - Date.now()) / 60000) + ' min.'; return; }
    const pin = $('#pin').value.trim();
    if (!/^\d{4}$/.test(pin)) { $('#mal').textContent = 'El PIN son 4 cifras.'; return; }
    $('#mal').textContent = 'Abriendo…';
    try {
      const clave = await claveDePin(pin, sobre, $('#rec').checked);
      D = await descifra(sobre, clave);
      try { localStorage.removeItem(K.fallos); } catch (e) {}
      if ($('#rec').checked) {
        const jwk = await crypto.subtle.exportKey('jwk', clave);
        pon(K.llave, JSON.stringify({ jwk, sal: sobre.sal, hasta: Date.now() + 30 * 864e5 }));
      }
      entra();
    } catch (e) {
      const f = Number(lee(K.fallos, 0)) + 1;
      pon(K.fallos, String(f));
      if (f >= 5) { pon(K.bloqueo, String(Date.now() + 30 * 60000)); try { localStorage.removeItem(K.fallos); } catch (x) {} }
      $('#mal').textContent = f >= 5 ? '5 fallos: bloqueado 30 minutos.' : 'PIN incorrecto (' + f + ' de 5).';
    }
  };
  $('#pin').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#abrir').click(); });
}

/* ---------- fechas y números ---------- */
const fmt = (n) => Number(n).toLocaleString('es-ES');
const dm = (f) => f ? f.slice(8, 10) + '/' + f.slice(5, 7) : '';
const hoyISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString(); };
const telBonito = (tel9) => tel9.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');

/* ---------- estado de cada persona: lo del vault + lo marcado aquí ---------- */
function eventos(p) { return EV[p.tel9] || []; }
function info(p) {
  const ev = eventos(p);
  const contactos = (p.contactos || 0) + ev.filter((e) => CONTACTO.includes(e.r)).length;
  let ult = p.ult_r ? { r: p.ult_r, t: p.ult_t } : null;
  if (ev.length) ult = ev[ev.length - 1];
  return { contactos, ult, hoy: ev.filter((e) => e.t.slice(0, 10) === hoyISO().slice(0, 10)).map((e) => e.r) };
}
function anota(p, r, m) {
  const lista = EV[p.tel9] = EV[p.tel9] || [];
  lista.push({ t: hoyISO().slice(0, 16), r, ...(m ? { m } : {}) });
  pon(K.ev, JSON.stringify(EV));
}
function deshaz(p) {
  const lista = EV[p.tel9] || [];
  lista.pop();
  if (!lista.length) delete EV[p.tel9];
  pon(K.ev, JSON.stringify(EV));
}

/* ---------- mensajes ---------- */
const BAJA = 'Si no quieres más mensajes, responde BAJA.';
function firma() { return (lee(K.firma, '') || '').trim() || 'Rodri'; }
function textoOferta() {
  const v = (lee(K.oferta, '') || '').trim();
  if (!v) return 'tenemos catálogo nuevo con precios más bajos en los modelos más pedidos';
  let m = v.match(/^(\d+(?:[.,]\d+)?)\s*%$/);
  if (m) return 'esta semana tienes un ' + m[1] + ' % de descuento en todo el catálogo';
  m = v.match(/^(\d+(?:[.,]\d+)?)\s*(€|eur|euros)?$/i);
  if (m) return 'esta semana tienes ' + m[1] + ' € de descuento en tu reloj';
  return 'esta semana tenemos ' + v;
}
function regalo() { const m = new Date().getMonth(); return (m === 10 || m === 11) ? ' estas Navidades 🎄' : ''; }
function mensajes(p) {
  const hola = p.nombre ? 'Hola ' + p.nombre : 'Hola';
  const yo = 'Soy ' + firma() + ', de GOLDEN OCLOCK.';
  const m1 = p.grupo === 'vuelve'
    ? hola + ' 👋 ' + yo + ' ¡Qué alegría verte otra vez! Vi que volviste a pedir nuestro catálogo 2026 ⌚ Te lo paso por aquí con las novedades y, como ya eres cliente, te atiendo yo directamente. Envío en 24-48 h y pagas al recibir.\n' + BAJA
    : hola + ' 👋 ' + yo + ' Hace unos días pediste nuestro catálogo 2026 de relojes ⌚ ¿Te llegó bien? Si quieres, te lo paso por aquí y te ayudo a elegir. Envío en 24-48 h y pagas al recibir.\n' + BAJA;
  const m2 = hola + ' ✨ ' + yo + ' Como pediste nuestro catálogo, te escribo antes que a nadie: ' + textoOferta() + ' 🎁 Te paso el catálogo nuevo por aquí y me dices cuál te gusta. Envío en 24-48 h y pagas al recibir.\n' + BAJA;
  const m3 = hola + ' 😊 ' + yo + ' Una pregunta rápida: ¿buscabas reloj para ti o para regalar' + regalo() + '? Dime qué estilo te gusta (deportivo, clásico, dorado…) y más o menos tu presupuesto, y te mando 2 o 3 opciones que te encajen.\n' + BAJA;
  return [m1, m2, m3];
}
const wa = (p, txt) => 'https://wa.me/34' + p.tel9 + '?text=' + encodeURIComponent(txt);

/* ---------- pintado ---------- */
function entra() {
  $('#gate').hidden = true;
  ['#nav', '#main', '#pie', '#kpis', '#cuadre'].forEach((s) => { $(s).hidden = false; });
  const k = D.kpis;
  $('#sub').textContent = 'Semana ' + D.semana + ' · lista del ' + dm(D.generado) + ' · pidieron el catálogo hace 7 días o más y no han comprado. Los mensajes los mandas tú, a mano.';
  $('#kpis').innerHTML =
    '<div class="kpi"><b>' + fmt(k.lista) + '</b><span>para escribir esta semana</span></div>'
    + '<div class="kpi">' + (k.primera_semana ? '<b class="gris">1.ª</b><span>primera semana: aún no hay con qué comparar</span>' : '<b>' + fmt(k.nuevos_semana) + '</b><span>nuevos desde la semana pasada</span>') + '</div>'
    + '<div class="kpi">' + (k.primera_semana ? '<b class="gris">—</b><span>trabajados la semana pasada que compraron (sale el lunes que viene)</span>'
      : '<b class="verde">' + fmt(k.trabajados_prev_compraron) + '<small style="color:#B9B5C8;font-size:15px"> de ' + fmt(k.trabajados_prev) + '</small></b><span>trabajados la semana pasada que compraron</span>') + '</div>';
  const nombres = { lista: 'en la lista', compraron: 'compraron después de apuntarse', menos_de_7_dias: 'se apuntaron hace menos de 7 días',
    reclamaciones: 'reclamaciones (no se les vende)', no_contactar: 'no contactar (fallidos, devoluciones, BAJA)', extranjeros_e_invalidos: 'extranjeros o teléfono no válido',
    en_cola_crm: 'en la zona de cola del CRM (ya hablando con el closer)', fallido_o_devuelto: 'pedido fallido o devuelto', contactado_hace_menos_de_14_dias: 'contactados hace menos de 14 días' };
  $('#cuadre').innerHTML = '<summary>De dónde sale: ' + fmt(D.apuntados) + ' apuntados en Linktree</summary><ul>'
    + Object.entries(D.cuentas).sort((a, b) => b[1] - a[1]).map(([c, n]) => '<li><b style="color:#FFFFFF">' + fmt(n) + '</b> ' + h(nombres[c] || c) + '</li>').join('') + '</ul>';
  $('#nEsc').textContent = '(' + fmt(k.lista) + ')';
  $('#nLla').textContent = '(' + D.personas.filter((p) => p.llamar).length + ')';
  $$('#nav button').forEach((b) => {
    b.onclick = () => { TAB = b.dataset.t; pon(K.tab, TAB); CUANTOS = 40; pinta(); window.scrollTo(0, 0); };
  });
  $('#btnExportar').onclick = exporta;
  $('#btnCopiar').onclick = copiaEstado;
  pinta();
}

function ajustes() {
  return '<div class="ajustes">'
    + '<div><label for="firmaIn">TÚ: QUIÉN FIRMA LOS MENSAJES</label><input id="firmaIn" maxlength="20" placeholder="Rodri" value="' + h(lee(K.firma, '')) + '"></div>'
    + '<div><label for="ofertaIn">TÚ: OFERTA DE LA SEMANA (IMPORTE O %)</label><input id="ofertaIn" maxlength="80" placeholder="Ej.: 15 %  ·  20 €  ·  envío gratis" value="' + h(lee(K.oferta, '')) + '">'
    + '<small>Se mete sola en el mensaje 2. Vacío: «catálogo nuevo con precios más bajos».</small></div></div>';
}

function filtrar(lista) {
  const q = BUSCA.trim().toLowerCase();
  return lista.filter((p) => {
    const i = info(p);
    if (FILTRO === 'vuelve' && p.grupo !== 'vuelve') return false;
    if (FILTRO === 'sin' && (i.contactos || (i.ult && i.ult.r === 'baja'))) return false;
    if (FILTRO === 'nuevos' && !p.nuevo_semana) return false;
    if (FILTRO === 'hechos' && !eventos(p).length) return false;
    if (q && !((p.nombre || '').toLowerCase().includes(q) || p.tel9.includes(q.replace(/\D/g, '') || '¬'))) return false;
    return true;
  });
}

function pinta() {
  $$('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.t === TAB));
  const m = $('#main');
  if (TAB === 'llamar') {
    const lista = D.personas.filter((p) => p.llamar);
    m.innerHTML = ajustes() + '<div class="nota"><b>Los 25 de la semana para llamar</b>: los mejor puntuados que no han contestado por WhatsApp '
      + '(primero los que ya se escribieron y no respondieron). Llama, y marca qué pasó.</div>'
      + lista.map((p) => tarjeta(p, true)).join('');
  } else {
    const fs = [['todos', 'Todos'], ['sin', 'Sin tocar'], ['vuelve', 'Clientes que vuelven (' + D.kpis.vuelven + ')'], ['hechos', 'Marcados aquí']];
    if (!D.kpis.primera_semana) fs.splice(1, 0, ['nuevos', 'Nuevos esta semana']);
    const lista = filtrar(D.personas);
    m.innerHTML = ajustes()
      + '<div class="nota">Ordenados por puntuación: primero quien pidió el catálogo hace 7-30 días, con nombre, apuntado varias veces y nunca contactado. '
      + 'Tres botones = tres mensajes ya escritos: <b>1 catálogo otra vez</b>, <b>2 oferta</b>, <b>3 pregunta</b>. '
      + 'La etiqueta azul dice si la persona está en una tanda de Aissa: mira antes si ya le escribió.</div>'
      + '<div class="filtros">' + fs.map((f) => '<button data-f="' + f[0] + '" class="' + (FILTRO === f[0] ? 'on' : '') + '">' + h(f[1]) + '</button>').join('') + '</div>'
      + '<input class="buscar" id="buscar" placeholder="Buscar por nombre o teléfono…" value="' + h(BUSCA) + '">'
      + '<div id="lista">' + (lista.length ? lista.slice(0, CUANTOS).map((p) => tarjeta(p, false)).join('') : '<div class="vacio">Nadie en este filtro.</div>') + '</div>'
      + (lista.length > CUANTOS ? '<button class="mas" id="mas">Ver ' + Math.min(40, lista.length - CUANTOS) + ' más (quedan ' + fmt(lista.length - CUANTOS) + ')</button>' : '');
  }
  engancha();
}

function tarjeta(p, llamar) {
  const i = info(p);
  const ms = mensajes(p);
  const baja = i.ult && i.ult.r === 'baja';
  const clase = 'tarjeta' + (p.grupo === 'vuelve' ? ' vuelve' : '') + (baja ? ' baja' : (i.hoy.length ? ' hecho' : ''));
  const hoy = hoyISO().slice(0, 10);
  const chips = ['<span class="chip dias">📥 catálogo hace ' + p.dias + ' días</span>']
    .concat(p.veces > 1 ? ['<span class="chip">se apuntó ' + p.veces + ' veces</span>'] : [])
    .concat(p.grupo === 'vuelve' ? ['<span class="chip vuelve">cliente que vuelve' + (p.compra_previa && p.compra_previa !== 'sí' ? ' · compró ' + dm(p.compra_previa) + '/' + p.compra_previa.slice(2, 4) : '') + '</span>'] : [])
    .concat(['<span class="chip">' + (i.contactos ? 'contactado ' + i.contactos + (i.contactos === 1 ? ' vez' : ' veces') : 'nunca contactado') + '</span>'])
    .concat(i.ult ? ['<span class="chip ult">último: ' + h(NOMRES[i.ult.r] || i.ult.r) + ' ' + dm(i.ult.t.slice(0, 10)) + '</span>'] : [])
    .concat(p.tanda_aissa ? ['<span class="chip aissa">' + (p.tanda_aissa <= hoy ? 'tanda de Aissa del ' + dm(p.tanda_aissa) + ': ¿ya le escribió?' : 'en tanda de Aissa el ' + dm(p.tanda_aissa)) + '</span>'] : [])
    .concat(p.nuevo_semana && !D.kpis.primera_semana ? ['<span class="chip nuevo">nuevo</span>'] : []);
  return '<div class="' + clase + '" data-t="' + p.tel9 + '">'
    + '<div class="cab"><span class="nom">' + h(p.nombre || 'Sin nombre') + '</span><span class="pts">#' + p.n + ' · ' + Math.round(p.pts) + ' pts</span></div>'
    + '<div class="chips">' + chips.join('') + '</div>'
    + (llamar ? '<div class="numero">' + telBonito(p.tel9) + '</div><div class="llam"><a class="tel" href="tel:+34' + p.tel9 + '">📞 Llamar</a><button data-copia="' + p.tel9 + '">Copiar número</button></div><div style="height:6px"></div>' : '')
    + '<div class="wa3">'
    + '<a href="' + wa(p, ms[0]) + '" target="_blank" rel="noopener" data-m="1">1 · Catálogo<span>otra vez</span></a>'
    + '<a href="' + wa(p, ms[1]) + '" target="_blank" rel="noopener" data-m="2">2 · Oferta<span>precio bajo</span></a>'
    + '<a href="' + wa(p, ms[2]) + '" target="_blank" rel="noopener" data-m="3">3 · Pregunta<span>regalo y estilo</span></a></div>'
    + '<details class="msgs"><summary>Ver los 3 mensajes</summary>' + ms.map((t, k) => '<div class="msg"><b>' + (k + 1) + '.</b> ' + h(t) + '</div>').join('') + '</details>'
    + '<div class="res">' + RES.map(([r, t]) => '<button data-r="' + r + '" class="' + (i.hoy.includes(r) ? 'on-' + r : '') + '">' + t + '</button>').join('') + '</div>'
    + (eventos(p).length ? '<div class="hist"><span>Marcado aquí: ' + eventos(p).map((e) => h(NOMRES[e.r]) + ' ' + dm(e.t.slice(0, 10))).join(' · ') + '</span><button data-deshaz="1">↶ deshacer</button></div>' : '')
    + '</div>';
}

let ULT_M = {};               // último mensaje abierto por persona (para guardar qué botón se usó)
function engancha() {
  const firmaIn = $('#firmaIn'), ofertaIn = $('#ofertaIn');
  if (firmaIn) firmaIn.onchange = () => { pon(K.firma, firmaIn.value.trim()); pinta(); toast('Firma guardada'); };
  if (ofertaIn) ofertaIn.onchange = () => { pon(K.oferta, ofertaIn.value.trim()); pinta(); toast('Oferta metida en el mensaje 2'); };
  $$('.filtros button').forEach((b) => { b.onclick = () => { FILTRO = b.dataset.f; CUANTOS = 40; pinta(); }; });
  const bu = $('#buscar');
  if (bu) bu.oninput = () => {
    BUSCA = bu.value;
    const lista = filtrar(D.personas);
    $('#lista').innerHTML = lista.length ? lista.slice(0, CUANTOS).map((p) => tarjeta(p, false)).join('') : '<div class="vacio">Nadie con ese nombre o teléfono.</div>';
    const mas = $('#mas'); if (mas) mas.hidden = lista.length <= CUANTOS;
    engancha2();
  };
  const mas = $('#mas');
  if (mas) mas.onclick = () => { CUANTOS += 40; const y = window.scrollY; pinta(); window.scrollTo(0, y); };
  engancha2();
}
function engancha2() {
  $$('.tarjeta').forEach((c) => {
    const p = D.personas.find((x) => x.tel9 === c.dataset.t);
    $$('.wa3 a', c).forEach((a) => { a.onclick = () => { ULT_M[p.tel9] = a.dataset.m; }; });
    $$('.res button', c).forEach((b) => {
      b.onclick = () => {
        const r = b.dataset.r;
        if (r === 'baja' && !confirm('¿Marcar BAJA? No se le vuelve a escribir nunca.')) return;
        anota(p, r, r === 'escrito' ? ULT_M[p.tel9] : null);
        repinta(c, p);
        toast(r === 'venta' ? '¡Venta! Pásala al closer para el CRM.' : 'Anotado: ' + NOMRES[r]);
      };
    });
    const d = $('[data-deshaz]', c);
    if (d) d.onclick = () => { deshaz(p); repinta(c, p); };
    const cp = $('[data-copia]', c);
    if (cp) cp.onclick = () => copia(cp.dataset.copia, 'Número copiado');
  });
}
function repinta(c, p) {
  const tmp = document.createElement('div');
  tmp.innerHTML = tarjeta(p, TAB === 'llamar');
  const nueva = tmp.firstChild;
  c.replaceWith(nueva);
  engancha2();
}

/* ---------- exportar ---------- */
function estado() {
  const eventosTodos = [];
  D.personas.forEach((p) => eventos(p).forEach((e) => eventosTodos.push({ tel: '+34' + p.tel9, nombre: p.nombre, ...e, por: firma() })));
  return { pagina: 'catalogo-sin-compra', exportado: hoyISO().slice(0, 16), lista: D.generado, por: firma(), eventos: eventosTodos };
}
function exporta() {
  const est = estado();
  if (!est.eventos.length) { toast('Aún no has marcado a nadie en este aparato.'); return; }
  const blob = new Blob([JSON.stringify(est, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'catalogo_sin_compra_estado_' + hoyISO().slice(0, 10) + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  toast('Guárdalo en iCloud Drive o mándalo al Mac (Descargas): el lunes se recoge solo.');
}
function copiaEstado() {
  const est = estado();
  if (!est.eventos.length) { toast('Aún no has marcado a nadie en este aparato.'); return; }
  copia(JSON.stringify(est), 'Estado copiado (' + est.eventos.length + ' anotaciones)');
}
async function copia(txt, ok) {
  try { await navigator.clipboard.writeText(txt); toast(ok); return; } catch (e) {}
  const ta = document.createElement('textarea'); ta.value = txt; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); toast(ok); } catch (e) { toast('No se pudo copiar'); }
  ta.remove();
}
function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toast._); toast._ = setTimeout(() => { el.hidden = true; }, 2600); }

arranca();
