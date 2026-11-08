/* Leads Linktree · GOLDEN OCLOCK — tandas de venta para Aissa (08/11/2026)
   Datos cifrados con el PIN (datos.enc.json). Estado en localStorage del aparato.
   Nadie envía nada desde aquí: los mensajes los manda Aissa por WhatsApp a mano. */
'use strict';
const $ = (s, p) => (p || document).querySelector(s);
const $$ = (s, p) => Array.from((p || document).querySelectorAll(s));
const h = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- informe (solo cifras agregadas, sin datos personales) ---------- */
const INF = {
  generado: '2026-11-08',
  export: 1617, unicos: 1570, validos: 1531, noClientes: 1385, compraron: 118,
  conv: 0.0752, ticket: 189.61, diasMedia: '17,8', nDias: 60, antes: 37,
  valor: 19737,
  meses: [
    ['May', 165, 20], ['Jun', 368, 23], ['Jul', 330, 20], ['Ago', 342, 28],
    ['Sep', 236, 14], ['Oct', 97, 10], ['Nov', 32, 3],
  ],
  segmentos: [
    ['Nuevos no clientes (desde 02/09)', 326, '#116B4A'],
    ['Antiguos no clientes (may-ago)', 1059, '#22306B'],
    ['Clientes suscritos', 107, '#B8860B'],
    ['No vender (fallidos/devueltos)', 14, '#B4232A'],
    ['Reclamaciones', 25, '#8A6508'],
    ['Extranjeros e inválidos', 39, '#5A648F'],
  ],
};

/* ---------- estado local ---------- */
const K = { estado: 'leadsLK.estado', fallos: 'leadsLK.fallos', bloqueo: 'leadsLK.bloqueo', llave: 'leadsLK.llave', dia: 'leadsLK.dia' };
let EST = {};
try { EST = JSON.parse(localStorage.getItem(K.estado) || '{}'); } catch (e) {}
const guardar = () => { try { localStorage.setItem(K.estado, JSON.stringify(EST)); } catch (e) {} };
const est = (tel) => EST[tel.slice(-9)] || {};
const marca = (tel, campo) => {
  const k = tel.slice(-9);
  EST[k] = EST[k] || {};
  EST[k][campo] = EST[k][campo] ? 0 : 1;
  EST[k].t = new Date().toISOString().slice(0, 16);
  guardar();
};

let D = null;          // {generado, dias, clientes, reclamaciones}
let TAB = 'tanda';
let DIA = null;

/* ---------- abrir con PIN ---------- */
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
  const sobre = await fetch('datos.enc.json').then((r) => r.json());
  // llave recordada (30 días) en este aparato
  try {
    const g = JSON.parse(localStorage.getItem(K.llave) || 'null');
    if (g && g.sal === sobre.sal && g.hasta > Date.now()) {
      const clave = await crypto.subtle.importKey('jwk', g.jwk, { name: 'AES-GCM' }, false, ['decrypt']);
      D = await descifra(sobre, clave);
      return entra();
    }
  } catch (e) {}
  $('#abrir').onclick = async () => {
    const bloq = Number(localStorage.getItem(K.bloqueo) || 0);
    if (bloq > Date.now()) { $('#mal').textContent = 'Bloqueado. Prueba en ' + Math.ceil((bloq - Date.now()) / 60000) + ' min.'; return; }
    const pin = $('#pin').value.trim();
    if (!/^\d{4}$/.test(pin)) { $('#mal').textContent = 'El PIN son 4 cifras.'; return; }
    $('#mal').textContent = 'Abriendo…';
    try {
      const clave = await claveDePin(pin, sobre, $('#rec').checked);
      D = await descifra(sobre, clave);
      localStorage.removeItem(K.fallos);
      if ($('#rec').checked) {
        const jwk = await crypto.subtle.exportKey('jwk', clave);
        localStorage.setItem(K.llave, JSON.stringify({ jwk, sal: sobre.sal, hasta: Date.now() + 30 * 864e5 }));
      }
      entra();
    } catch (e) {
      const f = Number(localStorage.getItem(K.fallos) || 0) + 1;
      localStorage.setItem(K.fallos, String(f));
      if (f >= 5) { localStorage.setItem(K.bloqueo, String(Date.now() + 30 * 60000)); localStorage.removeItem(K.fallos); }
      $('#mal').textContent = f >= 5 ? '5 fallos: bloqueado 30 minutos.' : 'PIN incorrecto (' + f + ' de 5).';
    }
  };
  $('#pin').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#abrir').click(); });
}

function entra() {
  $('#gate').style.display = 'none';
  $('#nav').style.display = 'flex';
  $('#main').style.display = 'block';
  $('#pie').style.display = 'flex';
  const fechas = Object.keys(D.dias).sort();
  const hoy = new Date().toISOString().slice(0, 10);
  DIA = localStorage.getItem(K.dia);
  if (!DIA || !D.dias[DIA]) DIA = fechas.find((f) => f >= hoy) || fechas[fechas.length - 1];
  $$('#nav button').forEach((b) => b.onclick = () => { TAB = b.dataset.t; $$('#nav button').forEach((x) => x.classList.toggle('on', x === b)); pinta(); });
  $('#btnExportar').onclick = exporta;
  $('#btnCopiar').onclick = copiaResumen;
  pinta();
}

/* ---------- pintado ---------- */
const DIAS_SEM = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
function bonita(f) {
  const d = new Date(f + 'T12:00:00');
  return DIAS_SEM[d.getDay()] + ' ' + d.getDate() + '/' + (d.getMonth() + 1);
}
function pinta() {
  const m = $('#main');
  if (TAB === 'tanda') m.innerHTML = vistaTanda();
  else if (TAB === 'clientes') m.innerHTML = vistaLista(D.clientes.items, 'Clientes suscritos: recompra y reseña. Puntúan aparte y no tienen fecha: se trabajan cuando toque.');
  else if (TAB === 'recla') m.innerHTML = vistaRecla();
  else m.innerHTML = vistaInforme();
  engancha();
  window.scrollTo(0, 0);
}
function cartaLead(it, conMsg) {
  const e = est(it.tel);
  return '<div class="carta' + (e.b ? ' esta-baja' : '') + '" data-tel="' + h(it.tel) + '">'
    + '<div class="fila"><span class="nom">' + (it.n ? it.n + '. ' : '') + h(it.nombre || 'Sin nombre') + '</span>'
    + '<span class="chip seg">' + h((it.segmento || '').replace(/_/g, ' ')) + '</span>'
    + (it.variante ? '<span class="chip var">' + h(it.variante) + '</span>' : '') + '</div>'
    + '<div class="tel">' + h(it.tel) + (it.fila_crm ? ' · CRM fila ' + h(it.fila_crm) : '') + '</div>'
    + (conMsg ? '<div class="msg">' + h(it.msg) + '</div>' : '')
    + '<div class="acciones">'
    + '<a class="wa" target="_blank" rel="noopener" href="https://wa.me/' + it.tel.replace(/\D/g, '') + '?text=' + encodeURIComponent(it.msg) + '">WhatsApp ➤</a>'
    + boton(it, 'h', 'hecho', '✓ Hecho') + boton(it, 'r', 'resp', 'Respondió') + boton(it, 'v', 'venta', '💰 Venta') + boton(it, 'b', 'baja', 'BAJA')
    + '</div></div>';
}
const boton = (it, campo, clase, texto) => '<button class="' + clase + (est(it.tel)[campo] ? ' on' : '') + '" data-m="' + campo + '">' + texto + '</button>';

function vistaTanda() {
  const fechas = Object.keys(D.dias).sort();
  const items = (D.dias[DIA] || { items: [] }).items;
  const hechos = items.filter((it) => est(it.tel).h).length;
  const i = fechas.indexOf(DIA);
  const sel = fechas.map((f) => {
    const its = D.dias[f].items;
    const hh = its.filter((it) => est(it.tel).h).length;
    return '<option value="' + f + '"' + (f === DIA ? ' selected' : '') + '>' + bonita(f) + ' — ' + hh + '/' + its.length + '</option>';
  }).join('');
  return '<div class="diaBarra"><button id="antes"' + (i <= 0 ? ' disabled' : '') + '>‹</button>'
    + '<select id="selDia">' + sel + '</select>'
    + '<button id="despues"' + (i >= fechas.length - 1 ? ' disabled' : '') + '>›</button></div>'
    + '<div class="progreso"><div style="width:' + (items.length ? (100 * hechos / items.length) : 0) + '%"></div></div>'
    + '<div class="resumenDia"><b style="color:#22306B">' + hechos + ' de ' + items.length + '</b> hechas · '
    + items.filter((it) => est(it.tel).r).length + ' respondieron · '
    + items.filter((it) => est(it.tel).v).length + ' ventas · '
    + items.filter((it) => est(it.tel).b).length + ' bajas</div>'
    + (items.length ? items.map((it) => cartaLead(it, true)).join('') : '<div class="vacio">Este día no tiene tanda.</div>');
}
function vistaLista(items, nota) {
  let html = '<div class="nota">' + h(nota) + '</div><input class="buscar" id="buscar" placeholder="Buscar por nombre o teléfono…">';
  html += '<div id="listaCli">' + items.map((it) => cartaLead(it, true)).join('') + '</div>';
  return html;
}
function vistaRecla() {
  const items = D.reclamaciones || [];
  let html = '<div class="nota"><b>Van primero:</b> a estas personas no se les vende nada hasta resolver su caso. '
    + 'La respuesta ya está escrita: botón de WhatsApp y a mano.</div>';
  html += items.map((r) => {
    const tel = r.telefono || '';
    const e = est(tel);
    return '<div class="carta" data-tel="' + h(tel) + '">'
      + '<div class="fila"><span class="nom">' + h(r.nombre || 'Sin nombre') + '</span>'
      + (r.es_cliente === 'SI' ? '<span class="chip seg">cliente · ' + h(r.importe_total) + ' €</span>' : '<span class="chip seg">no era cliente</span>') + '</div>'
      + '<div class="tel">' + h(tel) + (r.filas_crm ? ' · CRM fila ' + h(r.filas_crm) : '') + (r.estados_crm ? ' · ' + h(r.estados_crm) : '') + '</div>'
      + (r.modelos_crm ? '<div class="tel">Pedido: ' + h(r.modelos_crm) + (r.seguimientos_crm && r.seguimientos_crm.replace(/[ |]/g, '') ? ' · seg: ' + h(r.seguimientos_crm) : '') + '</div>' : '')
      + '<div class="msg">💬 ' + h(r.mensaje) + '</div>'
      + '<div class="msg" style="border-left-color:#116B4A">✍️ ' + h(r.respuesta_propuesta) + '</div>'
      + '<div class="acciones">'
      + '<a class="wa" target="_blank" rel="noopener" href="https://wa.me/' + tel.replace(/\D/g, '') + '?text=' + encodeURIComponent(r.respuesta_propuesta) + '">WhatsApp ➤</a>'
      + '<button class="hecho' + (e.h ? ' on' : '') + '" data-m="h">✓ Contestada</button>'
      + '<button class="venta' + (e.v ? ' on' : '') + '" data-m="v">Resuelta</button>'
      + '</div></div>';
  }).join('');
  return html;
}

/* ---------- informe (pestaña G) ---------- */
const eur = (n) => n.toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €';
function vistaInforme() {
  const conv100 = (INF.conv * 100).toFixed(1).replace('.', ',');
  return ''
    + '<h2>Las cifras (08/11/2026)</h2>'
    + '<div class="kpis">'
    + kpi(INF.unicos, 'leads únicos (de ' + INF.export + ' filas)')
    + kpi(INF.validos, 'con móvil español válido')
    + kpi(INF.compraron, 'ya compraron (' + conv100 + ' %)')
    + kpi(INF.noClientes, 'no clientes por vender')
    + kpi(eur(INF.ticket), 'ticket medio por pedido')
    + kpi(INF.diasMedia + ' días', 'de media hasta la 1.ª compra (' + INF.nDias + ' casos)')
    + '</div>'
    + '<div class="nota"><b>Valor estimado de la lista:</b> ' + INF.noClientes + ' no clientes × '
    + conv100 + ' % de conversión × ' + eur(INF.ticket) + ' de ticket ≈ <b>' + eur(INF.valor) + '</b>. '
    + 'Además, ' + INF.antes + ' de los ' + INF.compraron + ' compradores ya compraban antes de apuntarse.</div>'
    + '<div class="nota"><b>Qué atacar primero:</b> 1.º las <b>reclamaciones</b> (25, no se les vende hasta resolver), '
    + '2.º los <b>nuevos no clientes</b> (326 desde el 02/09: los más calientes y con octubre-noviembre convirtiendo al 9-10 %), '
    + '3.º <b>clientes suscritos</b> con la campaña de Navidad y reseñas, y 4.º la reactivación de los antiguos.</div>'
    + '<div class="nota"><b>Linktree:</b> quitar de la bio la frase «RELOJES C··· SUIZO»: choca con la regla de marcas ajenas '
    + 'y es de lo que más tumba cuentas de anuncios. Dejar «Relojes GOLDEN OCLOCK · envío 24-48 h · pago al recibir». '
    + 'Para volver a llenar la lista ahora que caen las altas (nov: 32): reactivar anuncios con el catálogo como imán, '
    + 'poner el enlace del catálogo en la bio de TikTok y en cada vídeo, y un QR en cada paquete que regale algo por apuntarse.</div>'
    + '<h2>Altas por mes</h2><div class="grafico">' + graficoBarras(INF.meses.map((m) => [m[0], m[1]]), '#22306B') + '</div>'
    + '<h2>Conversión por mes de alta</h2><div class="grafico">' + graficoBarras(INF.meses.map((m) => [m[0], Math.round(1000 * m[2] / m[1]) / 10]), '#B8860B', ' %') + '</div>'
    + '<h2>Clientes contra no clientes</h2><div class="grafico">' + graficoSegmentos() + '</div>'
    + '<h2>Embudo</h2><div class="grafico">' + graficoEmbudo() + '</div>';
}
const kpi = (v, t) => '<div class="kpi"><b>' + v + '</b><span>' + t + '</span></div>';
function graficoBarras(pares, color, sufijo) {
  const W = 700, H = 240, m = { l: 10, r: 10, t: 24, b: 28 };
  const max = Math.max(...pares.map((p) => p[1])) || 1;
  const bw = (W - m.l - m.r) / pares.length;
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img">';
  pares.forEach((p, i) => {
    const bh = Math.round((H - m.t - m.b) * p[1] / max);
    const x = m.l + i * bw + bw * 0.14, y = H - m.b - bh;
    s += '<rect x="' + x + '" y="' + y + '" width="' + (bw * 0.72) + '" height="' + bh + '" rx="7" fill="' + color + '"/>';
    s += '<text x="' + (x + bw * 0.36) + '" y="' + (y - 7) + '" text-anchor="middle" font-size="17" font-weight="700" fill="#22306B">' + String(p[1]).replace('.', ',') + (sufijo || '') + '</text>';
    s += '<text x="' + (x + bw * 0.36) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="16" fill="#5A648F">' + p[0] + '</text>';
  });
  return s + '</svg>';
}
function graficoSegmentos() {
  const W = 700, filaH = 44, m = { l: 10, r: 84 };
  const max = Math.max(...INF.segmentos.map((s) => s[1]));
  const H = INF.segmentos.length * filaH + 10;
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img">';
  INF.segmentos.forEach((g, i) => {
    const y = 6 + i * filaH;
    const w = Math.max(6, (W - m.l - m.r) * g[1] / max);
    s += '<text x="' + m.l + '" y="' + (y + 13) + '" font-size="15" fill="#44507E">' + h(g[0]) + '</text>';
    s += '<rect x="' + m.l + '" y="' + (y + 19) + '" width="' + w + '" height="15" rx="7" fill="' + g[2] + '"/>';
    s += '<text x="' + (m.l + w + 8) + '" y="' + (y + 32) + '" font-size="16" font-weight="700" fill="#22306B">' + g[1] + '</text>';
  });
  return s + '</svg>';
}
function graficoEmbudo() {
  const pasos = [
    ['Filas del export', INF.export, '#5A648F'],
    ['Leads únicos', INF.unicos, '#22306B'],
    ['Móvil español válido', INF.validos, '#116B4A'],
    ['No clientes en tandas', INF.noClientes, '#B8860B'],
  ];
  const W = 700, filaH = 52, H = pasos.length * filaH + 6;
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img">';
  pasos.forEach((p, i) => {
    const y = 4 + i * filaH;
    const w = (W - 20) * p[1] / pasos[0][1];
    const x = (W - w) / 2;
    s += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + (filaH - 12) + '" rx="10" fill="' + p[2] + '"/>';
    s += '<text x="' + (W / 2) + '" y="' + (y + filaH / 2 + 2) + '" text-anchor="middle" font-size="17" font-weight="700" fill="#F7F3E9">' + p[0] + ': ' + p[1] + '</text>';
  });
  return s + '</svg>';
}

/* ---------- interacción ---------- */
function engancha() {
  $$('.carta [data-m]').forEach((b) => {
    b.onclick = () => {
      const tel = b.closest('.carta').dataset.tel;
      if (b.dataset.m === 'b' && !est(tel).b && !confirm('¿Marcar BAJA? No se le vuelve a escribir.')) return;
      marca(tel, b.dataset.m);
      pinta();
    };
  });
  const sd = $('#selDia');
  if (sd) {
    sd.onchange = () => { DIA = sd.value; localStorage.setItem(K.dia, DIA); pinta(); };
    const fechas = Object.keys(D.dias).sort();
    $('#antes').onclick = () => { DIA = fechas[fechas.indexOf(DIA) - 1]; localStorage.setItem(K.dia, DIA); pinta(); };
    $('#despues').onclick = () => { DIA = fechas[fechas.indexOf(DIA) + 1]; localStorage.setItem(K.dia, DIA); pinta(); };
  }
  const bu = $('#buscar');
  if (bu) bu.oninput = () => {
    const q = bu.value.toLowerCase();
    $$('#listaCli .carta').forEach((c) => {
      c.style.display = c.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  };
}

/* ---------- exportar ---------- */
function todosItems() {
  const out = [];
  Object.keys(D.dias).sort().forEach((f) => D.dias[f].items.forEach((it) => out.push({ dia: f, ...it })));
  D.clientes.items.forEach((it) => out.push({ dia: '', ...it }));
  return out;
}
function exporta() {
  const items = todosItems();
  const filas = items.filter((it) => Object.keys(est(it.tel)).length)
    .map((it) => ({ tel: it.tel, nombre: it.nombre, dia: it.dia, segmento: it.segmento, variante: it.variante, ...est(it.tel) }));
  const bajas = filas.filter((x) => x.b).map((x) => x.tel);
  const blob = new Blob([JSON.stringify({ exportado: new Date().toISOString(), bajas, estado: filas }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'leads_linktree_estado_' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
}
function copiaResumen() {
  const items = (D.dias[DIA] || { items: [] }).items;
  const n = (c) => items.filter((it) => est(it.tel)[c]).length;
  const bajas = todosItems().filter((it) => est(it.tel).b).map((it) => it.tel);
  const txt = 'Tanda ' + DIA + ': ' + n('h') + '/' + items.length + ' hechas · ' + n('r') + ' respondieron · '
    + n('v') + ' ventas · ' + n('b') + ' bajas.' + (bajas.length ? '\nBAJAS totales: ' + bajas.join(', ') : '');
  (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(
    () => { $('#btnCopiar').textContent = 'Copiado ✓'; setTimeout(() => { $('#btnCopiar').textContent = 'Copiar resumen'; }, 1500); },
    () => prompt('Copia a mano:', txt));
}

arranca();
