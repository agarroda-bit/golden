// LLAVES · web privada. Los datos llegan cifrados (AES-256) y se abren con el código de «Páginas».
// El seguimiento, los ajustes de la calculadora y los pisos «a mano» se guardan en este móvil u ordenador.
import { TIPOS, AJUSTES_INICIALES, calcular, semaforo, valorLibre, eur, redondear } from './calculo.js';
import { porReferencia, fincaPorPortal, normPlanta, normPuerta } from './catastro.js';
import { plantilla, PLANTILLAS } from './plantillas.js';

const K = { cod: 'lz_paginas_codigo', visita: 'llaves_ultima_visita', vistos: 'llaves_vistos', casos: 'llaves_casos', aj: 'llaves_ajustes', ajp: 'llaves_ajustes_piso', mano: 'llaves_manuales', filtros: 'llaves_filtros', check: 'llaves_check' };
const leer = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const leerTexto = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (s, el = document) => el.querySelector(s);
const hoyISO = () => new Date().toISOString().slice(0, 10);
const fecha = (iso) => (iso ? new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const pct = (x) => (x == null || isNaN(x) ? '—' : Math.round(x * 100) + ' %');
const toast = (t) => { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 2600); };

export const ETAPAS = ['Detectado', 'Investigado', 'Nota simple pedida', 'Oferta al propietario', 'Arras', 'Comprado', 'Contacto con ocupantes', 'Acuerdo firmado', 'Llaves', 'Reforma', 'Venta o alquiler'];
const SIGUIENTE = {
  'Detectado': 'Revisar la ficha y la calculadora; si cuadra, pedir la nota simple.',
  'Investigado': 'Pedir la nota simple en el Registro (cargas, embargos, titular).',
  'Nota simple pedida': 'Pedir al vendedor el certificado de deuda de comunidad y el último recibo de IBI.',
  'Oferta al propietario': 'Enviar la carta de oferta con el precio máximo del escenario normal o menos.',
  'Arras': 'Que el abogado revise el contrato de arras antes de firmar.',
  'Comprado': 'Inscribir en el Registro y hacer la primera visita al edificio (sin presión).',
  'Contacto con ocupantes': 'Primera conversación respetuosa (usa el guion); si hay menores o mayores, marcar VULNERABLE.',
  'Acuerdo firmado': 'Pagar la compensación SOLO al recibir las llaves, con testigo o ante notario.',
  'Llaves': 'Cambiar la cerradura, dar de alta suministros y hacer fotos del estado.',
  'Reforma': 'Pedir 2-3 presupuestos y controlar plazos.',
  'Venta o alquiler': 'Decidir: vender (valor libre) o alquilar.',
};

let D = null;          // datos descifrados
let PISOS = [];        // pisos activos (fuentes + a mano)
let VISTA = 'radar';
let MAPA = null, CAPA = null, SEL = null;
let NUEVOS = new Set();

/* ---------------- Cerradura ---------------- */
const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function descifrar(sobre, codigo) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(codigo), 'PBKDF2', false, ['deriveKey']);
  const clave = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64(sobre.sal), iterations: sobre.iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(sobre.iv) }, clave, b64(sobre.datos))));
}
let SOBRE = null;
async function abrir(codigo, animar = true) {
  try {
    if (!SOBRE) SOBRE = await (await fetch('datos.enc.json', { cache: 'no-cache' })).json();
    D = await descifrar(SOBRE, codigo);
  } catch (e) {
    if (animar) { $('#errorcodigo').textContent = e?.name === 'OperationError' ? 'Ese código no abre esta puerta.' : 'No se pudieron cargar los datos: ' + (e.message || e); $('#cerradura').classList.add('temblor'); setTimeout(() => $('#cerradura').classList.remove('temblor'), 450); }
    return false;
  }
  try { localStorage.setItem(K.cod, codigo); } catch {}
  const llave = $('#llave'), puerta = $('#puerta');
  llave.classList.add('dentro');
  await new Promise((r) => setTimeout(r, 650));
  llave.classList.add('gira');
  await new Promise((r) => setTimeout(r, 420));
  puerta.classList.add('abierta');
  $('#formcodigo').style.opacity = '0';
  arrancar();
  setTimeout(() => $('#cerradura').remove(), 1100);
  return true;
}
$('#formcodigo').addEventListener('submit', (e) => { e.preventDefault(); abrir($('#codigo').value.trim()); });
const guardado = leerTexto(K.cod);
if (guardado) abrir(guardado, false).then((ok) => { if (!ok) $('#codigo').focus(); });

/* ---------------- Preparar datos ---------------- */
function ajustesGlobales() { return { ...AJUSTES_INICIALES, ...leer(K.aj, {}) }; }
function ajustesDe(id) { return { ...ajustesGlobales(), ...(leer(K.ajp, {})[id] || {}) }; }

function recalcular(p) {
  const aj = ajustesDe(p.id);
  if (aj.precioPedido) p.precio = aj.precioPedido;
  if (aj.tipo) { p.tipo = aj.tipo; p.tipoNombre = TIPOS[aj.tipo].nombre; }
  const casos = leer(K.casos, {});
  if (casos[p.id]?.vulnerable) { p.vulnerable = true; p.motivoVulnerable = p.motivoVulnerable || 'Marcado VULNERABLE en el seguimiento.'; }
  p.calc = calcular(p, aj);
  const s = semaforo(p, p.calc);
  p.sem = s.color; p.mot = s.motivo;
  const n = p.calc.escenarios?.[1];
  p.ofMax = n?.oferta ?? null; p.mg = n?.margenPedido ?? null; p.mgPct = n?.margenPedidoPct ?? null; p.bajo70 = !!n?.bajo70;
  return p;
}

function prepararPisos() {
  const manuales = leer(K.mano, []).map((m) => ({ ...m, aMano: true, fuentes: ['A mano'] }));
  PISOS = [...D.pisos.filter((p) => !p.retirado), ...manuales].map((p) => recalcular({ ...p }));
}

function arrancar() {
  $('#app').classList.remove('oculto');
  prepararPisos();
  // Nuevos desde la última visita
  const vistos = leer(K.vistos, null);
  const ultima = leerTexto(K.visita);
  if (vistos) NUEVOS = new Set(PISOS.filter((p) => !vistos.includes(p.id)).map((p) => p.id));
  else NUEVOS = new Set(PISOS.filter((p) => p.detectado >= new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10)).map((p) => p.id));
  guardar(K.vistos, PISOS.map((p) => p.id));
  try { localStorage.setItem(K.visita, new Date().toISOString()); } catch {}
  pintarCabecera(ultima);
  document.querySelectorAll('#pestanas button').forEach((b) => b.addEventListener('click', () => ir(b.dataset.v)));
  ir(location.hash.slice(1) || 'radar');
  window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (v && v !== VISTA) ir(v); });
}

function pintarCabecera(ultima) {
  const n = NUEVOS.size;
  const ll = $('#llavero');
  ll.className = n ? 'hay' : '';
  ll.innerHTML = `<svg viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="5" r="4" fill="none" stroke="#F3C969" stroke-width="2"/><g stroke="#F3C969" stroke-width="2.4" stroke-linecap="round"><path d="M11 9l-4 13M7 22l-2-1M8 18l-2-.6"/><path d="M15 9l4 13M19 22l2-1M18 18l2-.6"/></g></svg><span class="num">${n}</span> ${n === 1 ? 'nuevo' : 'nuevos'}`;
  ll.title = ultima ? `Desde tu última visita (${fecha(ultima)})` : 'Detectados en los últimos 2 días';
  ll.onclick = () => { FILTRO.soloNuevos = !FILTRO.soloNuevos; ir('radar'); };
  const act = D.actualizado ? new Date(D.actualizado) : null;
  const horas = act ? Math.round((Date.now() - act) / 36e5) : null;
  $('#actualizado').innerHTML = act ? `Recogida: ${act.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} ${act.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}${horas > 30 ? '<br><b style="color:var(--ambar)">hace más de un día</b>' : ''}` : '';
  $('#cuentaCasos').textContent = Object.values(leer(K.casos, {})).filter((c) => c.seguido).length;
}

function ir(v) {
  VISTA = v; if (location.hash.slice(1) !== v) history.replaceState(null, '', '#' + v);
  document.querySelectorAll('#pestanas button').forEach((b) => b.classList.toggle('activa', b.dataset.v === v));
  if (MAPA && v !== 'radar') { MAPA.remove(); MAPA = null; }
  ({ radar: vistaRadar, tablero: vistaTablero, mano: vistaMano, guia: vistaGuia, fuentes: vistaFuentes, ajustes: vistaAjustes }[v] || vistaRadar)();
  window.scrollTo({ top: 0 });
}

/* ---------------- Radar: mapa + lista ---------------- */
const FILTRO = { municipio: '', tipo: '', precioMax: 80000, sem: [], soloNuevos: false, orden: 'margen', ...leer(K.filtros, {}) };
FILTRO.soloNuevos = false;
const nombreMun = (id) => D.municipios?.find((m) => m.id === id)?.corto || id;

function filtrados() {
  const r = PISOS.filter((p) => (!FILTRO.municipio || p.municipio === FILTRO.municipio)
    && (!FILTRO.tipo || p.tipo === FILTRO.tipo)
    && (!FILTRO.precioMax || (p.precio || 0) <= FILTRO.precioMax)
    && (!FILTRO.sem.length || FILTRO.sem.includes(p.sem))
    && (!FILTRO.soloNuevos || NUEVOS.has(p.id)));
  const ord = { margen: (a, b) => (b.mgPct ?? -9) - (a.mgPct ?? -9), precio: (a, b) => (a.precio || 9e9) - (b.precio || 9e9), nuevo: (a, b) => (b.detectado || '').localeCompare(a.detectado || ''), euros: (a, b) => (b.mg ?? -9e9) - (a.mg ?? -9e9) }[FILTRO.orden];
  return r.sort(ord);
}

function vistaRadar() {
  const tiposPresentes = [...new Set(PISOS.map((p) => p.tipo))];
  const c = (s) => PISOS.filter((p) => p.sem === s && (p.precio || 0) <= 80000).length;
  $('#vista').innerHTML = `
    <div class="franja">
      <div class="dato"><b class="num">${PISOS.length}</b><span>pisos en el radar</span></div>
      <div class="dato"><b class="num">${PISOS.filter((p) => (p.precio || 0) <= 80000).length}</b><span>piden ≤ 80.000 €</span></div>
      <div class="dato v"><b class="num">${c('VERDE')}</b><span>verdes ≤ 80.000 €</span></div>
      <div class="dato a"><b class="num">${c('AMARILLO')}</b><span>amarillos ≤ 80.000 €</span></div>
      <div class="dato r"><b class="num">${c('ROJO')}</b><span>rojos ≤ 80.000 €</span></div>
    </div>
    <div class="filtros">
      <select id="fMun" aria-label="Municipio"><option value="">Todos los municipios</option>${(D.municipios || []).map((m) => `<option value="${m.id}" ${FILTRO.municipio === m.id ? 'selected' : ''}>${h(m.corto)} (${PISOS.filter((p) => p.municipio === m.id).length})</option>`).join('')}</select>
      <select id="fTipo" aria-label="Tipo"><option value="">Todos los tipos</option>${tiposPresentes.map((t) => `<option value="${t}" ${FILTRO.tipo === t ? 'selected' : ''}>${h(TIPOS[t]?.corto || t)}</option>`).join('')}</select>
      <select id="fPrecio" aria-label="Precio máximo">${[60000, 70000, 80000, 100000, 0].map((v) => `<option value="${v}" ${FILTRO.precioMax === v ? 'selected' : ''}>${v ? 'Hasta ' + eur(v) : 'Cualquier precio'}</option>`).join('')}</select>
      ${['VERDE', 'AMARILLO', 'ROJO'].map((s) => `<button class="chip ${FILTRO.sem.includes(s) ? 'on' : ''}" data-sem="${s}"><span class="punto ${s}"></span>${s[0] + s.slice(1).toLowerCase()}</button>`).join('')}
      <button class="chip ${FILTRO.soloNuevos ? 'on' : ''}" id="fNuevos">Solo nuevos (${NUEVOS.size})</button>
      <select id="fOrden" aria-label="Orden"><option value="margen" ${FILTRO.orden === 'margen' ? 'selected' : ''}>Ordenar por margen % (al precio pedido)</option><option value="euros" ${FILTRO.orden === 'euros' ? 'selected' : ''}>Por margen en €</option><option value="precio" ${FILTRO.orden === 'precio' ? 'selected' : ''}>Por precio</option><option value="nuevo" ${FILTRO.orden === 'nuevo' ? 'selected' : ''}>Más nuevos</option></select>
    </div>
    <div class="radar"><div id="mapa"></div><div class="lista" id="lista"></div></div>`;
  const cambia = () => { guardar(K.filtros, { ...FILTRO, soloNuevos: false }); pintarLista(); pintarMapa(); };
  $('#fMun').onchange = (e) => { FILTRO.municipio = e.target.value; cambia(); if (MAPA) encuadrar(); };
  $('#fTipo').onchange = (e) => { FILTRO.tipo = e.target.value; cambia(); };
  $('#fPrecio').onchange = (e) => { FILTRO.precioMax = Number(e.target.value); cambia(); };
  $('#fOrden').onchange = (e) => { FILTRO.orden = e.target.value; cambia(); };
  $('#fNuevos').onclick = (e) => { FILTRO.soloNuevos = !FILTRO.soloNuevos; e.currentTarget.classList.toggle('on'); cambia(); };
  document.querySelectorAll('[data-sem]').forEach((b) => b.onclick = () => { const s = b.dataset.sem; FILTRO.sem = FILTRO.sem.includes(s) ? FILTRO.sem.filter((x) => x !== s) : [...FILTRO.sem, s]; b.classList.toggle('on'); cambia(); });
  iniciarMapa(); pintarLista(); pintarMapa(); encuadrar();
}

function etiquetas(p) {
  const e = [];
  if (NUEVOS.has(p.id)) e.push('<span class="eti nuevo">NUEVO</span>');
  e.push(`<span class="eti">${h(TIPOS[p.tipo]?.corto || p.tipo)}</span>`);
  if (p.vulnerable) e.push('<span class="eti vul">VULNERABLE</span>');
  if ((p.errores || []).length) e.push(`<span class="eti err">${p.errores.length} ERROR</span>`);
  if (p.fueraPresupuesto || p.precio > 80000) e.push('<span class="eti fuera">pide &gt; 80.000</span>');
  if (p.aMano) e.push('<span class="eti mano">A mano</span>');
  if ((p.fuentes || []).length > 1) e.push(`<span class="eti">${p.fuentes.length} fuentes</span>`);
  if (leer(K.casos, {})[p.id]?.seguido) e.push(`<span class="eti" style="color:var(--laton2)">${h(leer(K.casos, {})[p.id].etapa)}</span>`);
  return e.join('');
}

function tarjeta(p, i) {
  return `<article class="tarjeta ${SEL === p.id ? 'sel' : ''}" data-id="${h(p.id)}" style="animation-delay:${Math.min(i, 12) * 35}ms">
    <div class="foto" style="${p.foto ? `background-image:url('${h(p.foto)}')` : ''}"><span class="sem ${p.sem}">${p.sem}</span></div>
    <div>
      <h3>${h(p.catastro?.exacta ? p.catastro.direccion + (p.catastro.planta ? ` · ${p.catastro.planta}-${p.catastro.puerta}` : '') : p.direccion)}</h3>
      <div class="donde">${h(nombreMun(p.municipio))}${p.catastro?.cp ? ' · ' + h(p.catastro.cp) : ''}${p.valor?.m2 ? ` · ${Math.round(p.valor.m2)} m²` : ''}${p.catastro?.anyo ? ` · ${p.catastro.anyo}` : ''} · ${h((p.fuentes || [p.fuente]).join(' + '))}</div>
      <div class="cifras num">
        <div><span>Piden</span><b>${eur(p.precio)}</b></div>
        <div><span>Libre vale</span><b>${eur(p.valor?.valor)}</b></div>
        <div><span>Oferta máx.</span><b>${eur(p.ofMax)}</b></div>
        <div><span>Margen si pagas lo que piden</span><b class="margen ${p.mg > 0 ? 'pos' : 'neg'}">${eur(p.mg)} · ${pct(p.mgPct)}</b></div>
      </div>
      <div class="motivo">${h(p.mot)}</div>
      <div class="etiquetas">${etiquetas(p)}</div>
    </div></article>`;
}

function pintarLista() {
  const ps = filtrados();
  $('#lista').innerHTML = ps.length ? ps.map(tarjeta).join('') : '<div class="vacio">Ningún piso con estos filtros.</div>';
  $('#lista').querySelectorAll('.tarjeta').forEach((t) => {
    t.onclick = () => abrirFicha(t.dataset.id);
    t.onmouseenter = () => resaltar(t.dataset.id);
  });
}

/* casitas */
const COLOR = { VERDE: '#35C27E', AMARILLO: '#F2B33D', ROJO: '#E5484D' };
const casita = (p) => L.divIcon({ className: '', iconSize: [30, 30], iconAnchor: [15, 26], popupAnchor: [0, -24],
  html: `<div class="casita ${NUEVOS.has(p.id) ? 'nueva' : ''} ${SEL === p.id ? 'sel' : ''}" data-id="${h(p.id)}" style="position:relative"><svg viewBox="0 0 30 30" width="30" height="30"><path d="M3 14 15 4l12 10v13H3z" fill="${COLOR[p.sem]}" stroke="#101820" stroke-width="2" stroke-linejoin="round"/><rect x="12" y="18" width="6" height="9" rx="1" fill="#101820"/><circle cx="16.6" cy="22.5" r=".9" fill="${COLOR[p.sem]}"/></svg></div>` });
function iniciarMapa() {
  if (!window.L) { $('#mapa').innerHTML = '<div class="vacio">No se pudo cargar el mapa (sin conexión).</div>'; return; }
  MAPA = L.map('mapa', { zoomControl: true, attributionControl: true }).setView([41.345, 2.06], 12);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, className: 'teselas', attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(MAPA);
  CAPA = L.layerGroup().addTo(MAPA);
}
const posicion = (p) => (p.lat && p.lon ? [p.lat, p.lon] : (() => { const m = D.municipios?.find((x) => x.id === p.municipio); return m ? [m.centro[0] + (Math.random() - 0.5) * 0.006, m.centro[1] + (Math.random() - 0.5) * 0.006] : null; })());
function pintarMapa() {
  if (!MAPA) return;
  CAPA.clearLayers();
  for (const p of filtrados()) {
    const pos = posicion(p); if (!pos) continue;
    const mk = L.marker(pos, { icon: casita(p), title: p.direccion, riseOnHover: true }).addTo(CAPA);
    mk.bindPopup(`<b>${h(p.direccion)}</b><br>${h(nombreMun(p.municipio))}<br>Piden <b>${eur(p.precio)}</b> · oferta máx. <b>${eur(p.ofMax)}</b><br>${h(p.mot)}${p.lat ? '' : '<br><i>Ubicación aproximada</i>'}<br><a href="#" data-abrir="${h(p.id)}">Abrir ficha</a>`);
    mk.on('popupopen', (e) => { e.popup.getElement().querySelector('[data-abrir]').onclick = (ev) => { ev.preventDefault(); abrirFicha(p.id); }; SEL = p.id; marcarTarjeta(); });
  }
}
function encuadrar() {
  if (!MAPA) return;
  const pts = filtrados().map(posicion).filter(Boolean);
  if (pts.length) MAPA.fitBounds(pts, { padding: [30, 30], maxZoom: 15 });
}
function resaltar(id) { document.querySelectorAll('.casita').forEach((c) => c.classList.toggle('sel', c.dataset.id === id)); }
function marcarTarjeta() { document.querySelectorAll('.tarjeta').forEach((t) => t.classList.toggle('sel', t.dataset.id === SEL)); const t = document.querySelector(`.tarjeta[data-id="${CSS.escape(SEL)}"]`); t?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }

/* ---------------- Ficha ---------------- */
const legalTipo = (t) => D.legal?.tipos?.[t] || null;

function abrirFicha(id) {
  const p = PISOS.find((x) => x.id === id); if (!p) return;
  SEL = id;
  $('#ficha').classList.remove('oculto');
  document.body.style.overflow = 'hidden';
  pintarFicha(p);
  history.pushState({ ficha: id }, '', location.hash);
}
function cerrarFicha() { $('#ficha').classList.add('oculto'); document.body.style.overflow = ''; if (VISTA === 'radar') { pintarLista(); pintarMapa(); } if (VISTA === 'tablero') vistaTablero(); }
window.addEventListener('popstate', () => { if (!$('#ficha').classList.contains('oculto')) cerrarFicha(); });
$('#ficha').addEventListener('click', (e) => { if (e.target.id === 'ficha') history.back(); });

function pintarFicha(p) {
  const c = p.catastro || {};
  const v = p.valor || {};
  const lt = legalTipo(p.tipo);
  const casos = leer(K.casos, {}); const caso = casos[p.id];
  $('#hoja').innerHTML = `
    <div class="top"><button id="cerrar">← Volver</button><h2>${h(c.exacta ? c.direccion : p.direccion)}</h2>
      <button id="seguir" class="${caso?.seguido ? '' : 'boton oro'}">${caso?.seguido ? '✓ En seguimiento' : '+ Seguir'}</button></div>
    <div class="cuerpo">
      <div class="semaforo-grande ${p.sem}"><div class="luz ${p.sem}"></div><div>${p.sem}: ${h(p.mot)}</div></div>
      ${p.vulnerable ? `<div class="aviso vul"><b>VULNERABLE.</b> ${h(p.motivoVulnerable || '')} ${h(D.legal?.vulnerables?.llano || 'Cuando viven menores, personas mayores o una familia vulnerable, los plazos de un desalojo cambian y los juzgados piden informe de Servicios Sociales.')} <b>Recomendación: pasar por Servicios Sociales del municipio y hablarlo con el abogado antes de ofertar.</b></div>` : ''}
      ${(p.errores || []).map((e) => `<div class="aviso error">${h(e)}</div>`).join('')}
      ${(v.avisos || []).filter((a) => !/^ERROR/.test(a)).map((a) => `<div class="aviso ojo">${h(a)}</div>`).join('')}
      ${(p.avisosPrecio || []).map((a) => `<div class="aviso ojo">Precio distinto según la fuente: ${h(a)}</div>`).join('')}
      ${p.sinActualizar ? '<div class="aviso ojo">La fuente falló en la última recogida: estos datos son de la anterior.</div>' : ''}
      <div class="banda num">
        <div class="dato"><span>Piden</span><b>${eur(p.precio)}</b><span>${p.eurM2Pedido || (p.precio && v.m2 ? Math.round(p.precio / v.m2) : '—')} €/m²</span></div>
        <div class="dato"><span>Valor libre estimado</span><b>${eur(v.valor)}</b><span>${v.eurM2 || '—'} €/m² · ${h(v.metodo || '')}</span></div>
        <div class="dato"><span>Oferta máxima (normal)</span><b style="color:var(--laton2)">${eur(p.ofMax)}</b><span>margen a esa oferta ${eur(p.calc?.escenarios?.[1]?.margen)}</span></div>
        <div class="dato"><span>Si pagas lo que piden</span><b class="margen ${p.mg > 0 ? 'pos' : 'neg'}">${eur(p.mg)}</b><span>${pct(p.mgPct)} sobre lo invertido (normal)</span></div>
      </div>

      <section class="bloque"><h3>🏠 La vivienda</h3>
        <dl class="datos">
          <dt>Dirección del anuncio</dt><dd>${h(p.direccion)}</dd>
          <dt>Municipio · barrio</dt><dd>${h(D.municipios?.find((m) => m.id === p.municipio)?.nombre || p.municipio)}${p.barrio ? ' · ' + h(p.barrio) : ''}${c.cp ? ' · CP ' + h(c.cp) : ''}</dd>
          <dt>Referencia catastral</dt><dd>${c.rc ? `<a href="${h(c.url)}" target="_blank" rel="noopener">${h(c.rc)}</a>` : c.parcela ? `Finca ${h(c.parcela)} (piso exacto sin confirmar)` : h(p.refCatastral || '—')}</dd>
          <dt>Anuncio${(p.enlaces || []).length > 1 ? 's' : ''}</dt><dd>${(p.enlaces || []).map((e) => `<a href="${h(e.url)}" target="_blank" rel="noopener">${h(e.fuente)}</a>`).join(' · ') || '—'}</dd>
          <dt>Fuente · detectado</dt><dd>${h((p.fuentes || [p.fuente]).join(' + '))} · ${fecha(p.detectado)}${p.publicadoFuente ? ` (publicado por la fuente el ${fecha(p.publicadoFuente)})` : ''}</dd>
          <dt>Situación según la fuente</dt><dd>${h(p.situacionFuente || '—')}${p.finContratoFuente ? ' · fin de contrato ' + h(p.finContratoFuente) : ''}</dd>
          <dt>Dormitorios · baños</dt><dd>${p.dormitorios ?? '—'} · ${p.banos ?? '—'}</dd>
          ${p.precioAnterior ? `<dt>Precio anterior</dt><dd>${eur(p.precioAnterior)} → ${eur(p.precio)}</dd>` : ''}
          ${(p.historialPrecio || []).map((x) => `<dt>Cambio de precio</dt><dd>${fecha(x.fecha)}: ${eur(x.antes)} → ${eur(x.ahora)}</dd>`).join('')}
        </dl>
        ${p.texto ? `<details style="margin-top:10px"><summary style="cursor:pointer;color:var(--suave)">Texto del anuncio</summary><p style="font-size:13.5px;line-height:1.5;color:#D8D2C5">${h(p.texto)}</p></details>` : ''}
      </section>

      <section class="bloque"><h3>📐 Catastro <span class="eti">datos públicos, sin titular</span></h3>
        ${c.parcela ? `<dl class="datos">
          <dt>Dirección catastral</dt><dd>${h(c.direccion)}${c.escalera ? ' · esc. ' + h(c.escalera) : ''}${c.planta ? ' · planta ' + h(c.planta) : ''}${c.puerta ? ' · puerta ' + h(c.puerta) : ''}</dd>
          <dt>Superficie construida</dt><dd>${c.m2 ? c.m2 + ' m²' : c.m2Rango ? `entre ${c.m2Rango[0]} y ${c.m2Rango[1]} m² (pisos de la finca)` : '—'}${p.m2Anuncio ? ` · el anuncio dice ${Math.round(p.m2Anuncio)} m²` : ''}</dd>
          <dt>Año</dt><dd>${c.anyo || (c.anyos || []).join(', ') || '—'}</dd>
          <dt>Uso</dt><dd>${h(c.uso || '—')}</dd>
          <dt>Viviendas en la finca</dt><dd>${c.viviendasFinca ?? '—'}</dd>
        </dl>
        ${(c.avisos || []).filter((a) => !/^ERROR/.test(a)).map((a) => `<div class="aviso ojo">${h(a)}</div>`).join('')}
        <div class="fuente">Fuente: <a href="${h(c.url)}" target="_blank" rel="noopener">${h(c.fuente)}</a> · consultado ${fecha(c.comprobado)}</div>` : '<div class="aviso error">ERROR: sin datos de Catastro (no hay referencia ni coordenadas válidas).</div>'}
      </section>

      <section class="bloque"><h3>💶 Cuánto vale libre</h3>
        <dl class="datos">
          <dt>Valor libre estimado</dt><dd><b>${eur(v.valor)}</b> = ${v.m2 ? Math.round(v.m2) : '—'} m² (${h(v.origenM2 || '')}) × ${v.eurM2 || '—'} €/m²</dd>
          <dt>Cómo se calcula</dt><dd>${h(v.metodo || '—')}</dd>
          <dt>Comparables</dt><dd>${v.comparables?.n || 0} pisos libres (${h(v.criterio || '')})${v.comparables?.n ? `: mediana ${v.comparables.mediana} €/m², entre ${v.comparables.p25} y ${v.comparables.p75} €/m² (la mitad central)` : ''}</dd>
          <dt>Dato oficial</dt><dd>${v.oficial ? `${v.oficial.eurM2} €/m² (${v.oficial.tasaciones} tasaciones, ${h(v.oficial.periodo)}) · <a href="${h(v.oficial.url)}" target="_blank" rel="noopener">Ministerio de Vivienda</a>` : '—'}</dd>
        </dl>
        ${v.comparables?.muestra?.length ? `<details style="margin-top:8px"><summary style="cursor:pointer;color:var(--suave)">Ver los comparables (${v.comparables.muestra.length} de ${v.comparables.n})</summary><div class="tabla-scroll"><table class="t"><tr><th>Piso libre</th><th class="n">m²</th><th class="n">Precio</th><th class="n">€/m²</th></tr>${v.comparables.muestra.map((x) => `<tr><td><a href="${h(x.url)}" target="_blank" rel="noopener">${h(x.direccion || x.fuente)}</a><br><small style="color:var(--tenue)">${h(x.fuente)} · ${fecha(x.visto)}</small></td><td class="n">${Math.round(x.m2)}</td><td class="n">${eur(x.precio)}</td><td class="n">${x.eurM2}</td></tr>`).join('')}</table></div></details>` : ''}
        <div class="fuente">Los comparables son precios PEDIDOS por pisos libres de las mismas webs (no precios de venta firmados). El dato del Ministerio son tasaciones de vivienda de más de 5 años del municipio entero.</div>
      </section>

      <section class="bloque"><h3>🔑 Tipo de oportunidad: ${h(TIPOS[p.tipo]?.nombre || p.tipo)}</h3>
        <dl class="datos"><dt>Riesgo</dt><dd>${h(TIPOS[p.tipo]?.riesgo || '—')}</dd>
        <dt>Plazo típico</dt><dd>${h(lt?.plazo || 'Sin fuente oficial con plazo: CONSULTAR ABOGADO')}</dd></dl>
        <p style="line-height:1.5">${h(lt?.llano || 'Sin explicación verificada todavía.')}</p>
        ${lt?.consultar_abogado ? '<div class="aviso abogado"><b>CONSULTAR ABOGADO.</b> ' + h(lt.nota || 'Hay puntos que dependen del caso concreto.') + '</div>' : lt?.nota ? `<div class="aviso ojo">${h(lt.nota)}</div>` : ''}
        ${lt?.normas?.length ? `<div class="normas">Fuentes: ${lt.normas.map((n) => `<a href="${h(n.url)}" target="_blank" rel="noopener">${h(n.nombre)}</a> (comprobado ${fecha(n.comprobado)})`).join(' · ')}</div>` : ''}
        <div class="botones"><button class="boton" data-tipo-cambiar>¿No es este tipo? Cambiarlo</button></div>
      </section>

      <section class="bloque"><h3>📋 Antes de ofertar</h3><div class="checklist" id="check"></div></section>

      <section class="bloque" id="calcBloque"><h3>🧮 Calculadora</h3><div id="calc"></div></section>

      <section class="bloque"><h3>🗂 Seguimiento</h3><div id="seg"></div></section>

      <section class="bloque"><h3>📄 Plantillas</h3>
        <p style="font-size:13.5px;color:var(--suave);margin-top:0">Se descargan rellenas con los datos de este piso, en un documento que abre Word o Pages.</p>
        <div class="botones">${PLANTILLAS.map((t) => `<button class="boton" data-plantilla="${t.id}">⬇ ${h(t.nombre)}</button>`).join('')}</div>
      </section>
    </div>`;
  $('#cerrar').onclick = () => history.back();
  $('#seguir').onclick = () => { seguir(p.id, !leer(K.casos, {})[p.id]?.seguido); pintarFicha(p); pintarCabecera(); };
  $('[data-tipo-cambiar]').onclick = () => {
    const opciones = Object.entries(TIPOS).map(([k, t], i) => `${i + 1}. ${t.nombre}`).join('\n');
    const r = prompt('¿Qué tipo es? Escribe el número:\n' + opciones);
    const k = Object.keys(TIPOS)[Number(r) - 1];
    if (k) { ajustarPiso(p.id, { tipo: k }); recalcular(p); pintarFicha(p); }
  };
  document.querySelectorAll('[data-plantilla]').forEach((b) => b.onclick = () => descargarPlantilla(b.dataset.plantilla, p));
  pintarChecklist(p); pintarCalc(p); pintarSeguimiento(p);
}

function pintarChecklist(p) {
  const items = D.legal?.antesDeOfertar || [
    { id: 'nota', texto: 'Nota simple del Registro de la Propiedad: titular, cargas, embargos, anotaciones de demanda.' },
    { id: 'ibi', texto: 'Deuda de IBI (el piso responde de la deuda aunque cambie de dueño).' },
    { id: 'comunidad', texto: 'Certificado de deuda con la comunidad de propietarios.' },
    { id: 'judicial', texto: '¿Hay procedimiento judicial abierto (desahucio, ejecución)? Preguntar al vendedor por escrito.' },
  ];
  const marcas = leer(K.check, {})[p.id] || {};
  $('#check').innerHTML = items.map((i) => `<label><input type="checkbox" data-c="${i.id}" ${marcas[i.id] ? 'checked' : ''}><span>${h(i.texto)}${i.url ? ` · <a href="${h(i.url)}" target="_blank" rel="noopener">${h(i.enlace || 'dónde')}</a>` : ''}${i.precio ? ` <small style="color:var(--tenue)">(${h(i.precio)})</small>` : ''}</span></label>`).join('');
  $('#check').querySelectorAll('input').forEach((x) => x.onchange = () => { const t = leer(K.check, {}); t[p.id] = { ...(t[p.id] || {}), [x.dataset.c]: x.checked }; guardar(K.check, t); });
}

function ajustarPiso(id, cambios) { const t = leer(K.ajp, {}); t[id] = { ...(t[id] || {}), ...cambios }; for (const k of Object.keys(t[id])) if (t[id][k] === '' || t[id][k] == null) delete t[id][k]; guardar(K.ajp, t); }

let ESC = 1;
function pintarCalc(p) {
  const a = ajustesDe(p.id);
  const t = TIPOS[p.tipo] || TIPOS.desconocido;
  const calc = p.calc;
  const campo = (k, cab, val, extra = '', paso = 100) => `<div class="tu"><label for="aj_${k}">${cab}</label><input id="aj_${k}" data-k="${k}" type="number" inputmode="decimal" step="${paso}" value="${val ?? ''}" ${extra}><small>${k === 'descuento' ? 'por defecto ' + Math.round(t.descuento * 100) + ' % para este tipo' : ''}</small></div>`;
  const e = calc.escenarios?.[ESC];
  $('#calc').innerHTML = calc.error ? `<div class="aviso error">ERROR: ${h(calc.error)}</div>` : `
    <div class="tus">
      ${campo('precioPedido', 'TÚ: PRECIO QUE PIDEN (si ha cambiado)', a.precioPedido || p.precio, '', 500)}
      ${campo('valorLibre', 'TÚ: CUÁNTO CREES QUE VALE LIBRE', a.valorLibre || p.valor?.valor, '', 1000)}
      ${campo('descuento', 'TÚ: DESCUENTO POR OCUPACIÓN (%)', Math.round((a.descuento ?? t.descuento) * 100), 'min="0" max="90"', 1)}
      ${campo('llaves', 'TÚ: COMPENSACIÓN POR LAS LLAVES (€)', a.llaves)}
      ${campo('reformaM2', 'TÚ: CUÁNTO CREES QUE COSTARÁ LA REFORMA (€/m²)', a.reformaM2, '', 10)}
      ${campo('deudas', 'TÚ: DEUDAS DE IBI Y COMUNIDAD (€)', a.deudas)}
      ${campo('gastosMes', 'TÚ: GASTOS DE CADA MES DE ESPERA (€)', a.gastosMes, '', 10)}
      ${campo('abogado', 'TÚ: ABOGADO (€)', a.abogado)}
      ${campo('valorReferencia', 'TÚ: VALOR DE REFERENCIA DEL CATASTRO (€), si lo sabes', a.valorReferencia, '', 500)}
      <div class="tu"><label>TÚ: MESES DE ESPERA (rápido / normal / largo)</label><input id="aj_meses" type="text" value="${(a.meses || t.meses).join(' / ')}"><small>por defecto ${t.meses.join(' / ')} para este tipo</small></div>
    </div>
    <div class="escenarios num">${calc.escenarios.map((x, i) => `<div class="esc ${i === ESC ? 'on' : ''}" data-esc="${i}"><h4>${x.nombre} · ${x.meses} meses</h4><div class="of">${eur(x.oferta)}</div><div class="mg">margen a esta oferta <b>${eur(x.margen)} (${pct(x.margenPct)})</b></div><div class="mg">si pagas lo que piden <b class="margen ${x.margenPedido > 0 ? 'pos' : 'neg'}">${eur(x.margenPedido)} (${pct(x.margenPedidoPct)})</b></div></div>`).join('')}</div>
    ${e.bajo70 ? `<div class="aviso abogado"><b>CONSULTAR ABOGADO · límite del 70 %.</b> Esta oferta es menos del 70 % del valor libre estimado. Desde el 08/10/2026 el RDL 29/2026 (art. 1) limita esas compras a entidades dedicadas a comprar con descuento y a personas jurídicas grandes tenedoras; para un particular a su nombre no está claro. <a href="https://www.boe.es/buscar/act.php?id=BOE-A-2026-20823" target="_blank" rel="noopener">BOE</a></div>` : ''}
    <div class="tabla-scroll"><table class="t num"><tr><th>Escenario ${h(e.nombre)}</th><th class="n">Euros</th></tr>
      ${e.filas.map((f) => `<tr class="${f.total ? 'total' : f.subtotal ? 'sub' : ''}"><td>${h(f.concepto)}${f.tuyo ? ' <span class="eti" style="background:var(--tu);color:var(--tu-tinta)">TÚ</span>' : ''}</td><td class="n">${f.importe < 0 ? '−' : ''}${eur(Math.abs(f.importe))}</td></tr>`).join('')}
      <tr class="sub"><td>Coste total (oferta + ITP + gastos)</td><td class="n">${eur(e.costeTotal)}</td></tr>
      <tr class="sub"><td>Margen a esta oferta (valor libre − coste total)</td><td class="n">${eur(e.margen)} · ${pct(e.margenPct)}</td></tr>
      <tr class="sub"><td>Si pagas lo que piden (${eur(p.precio)}): coste total ${eur(e.costePedido)}</td><td class="n margen ${e.margenPedido > 0 ? 'pos' : 'neg'}">${eur(e.margenPedido)} · ${pct(e.margenPedidoPct)}</td></tr>
    </table></div>
    <div class="fuente">ITP ${Math.round(a.itp * 1000) / 10} % y notaría/registro ${eur(a.notariaRegistro)}: ${h(D.legal?.impuestos?.resumen || 'ver Guía legal')}. Los importes en amarillo son tuyos: se guardan solo en este dispositivo.</div>
    <div class="botones"><button class="boton" id="ajReset">Volver a los valores por defecto</button></div>`;
  if (calc.error) return;
  $('#calc').querySelectorAll('[data-esc]').forEach((b) => b.onclick = () => { ESC = Number(b.dataset.esc); pintarCalc(p); });
  $('#calc').querySelectorAll('input[data-k]').forEach((inp) => inp.onchange = () => {
    const k = inp.dataset.k; let v = inp.value === '' ? null : Number(inp.value);
    if (k === 'descuento' && v != null) v = v / 100;
    if (k === 'precioPedido' && v === p.precio) v = null;
    ajustarPiso(p.id, { [k]: v }); recalcular(p); pintarFicha(p); $('#calcBloque').scrollIntoView({ block: 'start' });
  });
  $('#aj_meses').onchange = (ev) => { const m = ev.target.value.split(/[\/,; ]+/).map(Number).filter((x) => x >= 0); ajustarPiso(p.id, { meses: m.length === 3 ? m : null }); recalcular(p); pintarFicha(p); };
  $('#ajReset').onclick = () => { const t2 = leer(K.ajp, {}); delete t2[p.id]; guardar(K.ajp, t2); recalcular(p); pintarFicha(p); };
}

/* ---------------- Seguimiento ---------------- */
function seguir(id, si) {
  const casos = leer(K.casos, {});
  if (si) casos[id] = { ...(casos[id] || {}), seguido: true, etapa: casos[id]?.etapa || 'Detectado', fechas: { ...(casos[id]?.fechas || {}), [casos[id]?.etapa || 'Detectado']: casos[id]?.fechas?.[casos[id]?.etapa || 'Detectado'] || hoyISO() }, notas: casos[id]?.notas || [], siguiente: casos[id]?.siguiente || SIGUIENTE['Detectado'] };
  else if (casos[id]) casos[id].seguido = false;
  guardar(K.casos, casos);
  toast(si ? 'Añadido al seguimiento' : 'Quitado del seguimiento');
}
function moverCaso(id, etapa) {
  const casos = leer(K.casos, {}); const c = casos[id]; if (!c) return;
  c.etapa = etapa; c.fechas = { ...(c.fechas || {}), [etapa]: hoyISO() }; c.siguiente = SIGUIENTE[etapa];
  guardar(K.casos, casos);
}
function pintarSeguimiento(p) {
  const c = leer(K.casos, {})[p.id];
  if (!c?.seguido) { $('#seg').innerHTML = '<p style="color:var(--suave);margin:0">Pulsa «+ Seguir» arriba para llevar este caso en el tablero.</p>'; return; }
  $('#seg').innerHTML = `
    <div class="form">
      <div><label>Columna</label><select id="segEtapa">${ETAPAS.map((e) => `<option ${c.etapa === e ? 'selected' : ''}>${e}</option>`).join('')}</select></div>
      <div><label>Lo siguiente que hay que hacer</label><input id="segSig" value="${h(c.siguiente || '')}"></div>
      <div><label>Contacto (solo lo que den voluntariamente, p. ej. un teléfono; nada de nombres ni situación personal)</label><input id="segCont" value="${h(c.contacto || '')}" autocomplete="off"></div>
      <label style="display:flex;gap:8px;align-items:center;color:var(--texto)"><input type="checkbox" id="segVul" ${c.vulnerable ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--rojo)"> Marcar VULNERABLE (hay menores, mayores o una familia vulnerable)</label>
      <div><label>Añadir nota</label><textarea id="segNota" rows="2" placeholder="Qué ha pasado hoy…"></textarea></div>
      <div class="botones"><button class="boton oro" id="segGuardar">Guardar</button></div>
    </div>
    <div class="tabla-scroll" style="margin-top:10px"><table class="t"><tr><th>Fecha</th><th>Qué</th></tr>
      ${ETAPAS.filter((e) => c.fechas?.[e]).map((e) => `<tr><td class="num">${fecha(c.fechas[e])}</td><td>→ ${h(e)}</td></tr>`).join('')}
      ${(c.notas || []).slice().reverse().map((n) => `<tr><td class="num">${fecha(n.fecha)}</td><td>${h(n.texto)}</td></tr>`).join('')}
    </table></div>`;
  $('#segGuardar').onclick = () => {
    const casos = leer(K.casos, {}); const x = casos[p.id];
    const nueva = $('#segEtapa').value;
    if (nueva !== x.etapa) { x.etapa = nueva; x.fechas = { ...(x.fechas || {}), [nueva]: hoyISO() }; x.siguiente = SIGUIENTE[nueva]; } else x.siguiente = $('#segSig').value.trim();
    x.contacto = $('#segCont').value.trim();
    x.vulnerable = $('#segVul').checked;
    const nota = $('#segNota').value.trim(); if (nota) x.notas = [...(x.notas || []), { fecha: hoyISO(), texto: nota }];
    guardar(K.casos, casos); recalcular(p); pintarFicha(p); toast('Guardado');
  };
}

function vistaTablero() {
  const casos = leer(K.casos, {});
  const lista = Object.entries(casos).filter(([, c]) => c.seguido).map(([id, c]) => ({ c, p: PISOS.find((x) => x.id === id) || D.pisos.find((x) => x.id === id) })).filter((x) => x.p);
  $('#vista').innerHTML = `
    <p style="color:var(--suave);margin:4px 0 10px">${lista.length ? 'Arrastra cada caso a su columna (en el móvil: ábrelo y cambia la columna). El tablero se guarda en este dispositivo; haz copia en Ajustes.' : 'Aún no sigues ningún piso. Abre una ficha en el Radar y pulsa «+ Seguir».'}</p>
    <div class="filtros" id="saltos">${ETAPAS.map((e, i) => { const n = lista.filter((x) => x.c.etapa === e).length; return `<button class="chip ${n ? 'on' : ''}" data-salto="${i}">${i + 1}. ${h(e)} · ${n}</button>`; }).join('')}</div>
    <div class="tablero">${ETAPAS.map((e) => `<div class="columna" data-etapa="${h(e)}"><h3><span>${h(e)}</span><span>${lista.filter((x) => x.c.etapa === e).length}</span></h3>
      ${lista.filter((x) => x.c.etapa === e).map(({ c, p }) => { const pr = p.sem ? p : recalcular({ ...p }); const dias = c.fechas?.[e] ? Math.round((Date.now() - new Date(c.fechas[e] + 'T12:00:00')) / 864e5) : null; return `<div class="caso ${pr.sem}" draggable="true" data-id="${h(p.id)}"><b>${h(p.catastro?.direccion || p.direccion)}</b>${h(nombreMun(p.municipio))} · ${eur(p.precio)} → máx. ${eur(pr.ofMax)}${c.vulnerable || pr.vulnerable ? ' · <span style="color:#FFB3B5">VULNERABLE</span>' : ''}<div class="sig">→ ${h(c.siguiente || '')}</div><div class="dias">${dias != null ? `${dias} día${dias === 1 ? '' : 's'} en esta columna` : ''}${p.retirado ? ' · el anuncio ya no está' : ''}</div></div>`; }).join('')}
    </div>`).join('')}</div>`;
  document.querySelectorAll('.caso').forEach((el) => {
    el.onclick = () => abrirFicha(el.dataset.id);
    el.ondragstart = (ev) => ev.dataTransfer.setData('text/plain', el.dataset.id);
  });
  const cols = document.querySelectorAll('.columna');
  const ir2 = (i) => cols[i]?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  document.querySelectorAll('[data-salto]').forEach((b) => b.onclick = () => ir2(Number(b.dataset.salto)));
  const primera = ETAPAS.findIndex((e) => lista.some((x) => x.c.etapa === e));
  if (primera > 0) setTimeout(() => cols[primera].parentElement.scrollTo({ left: cols[primera].offsetLeft - 16 }), 50);
  document.querySelectorAll('.columna').forEach((col) => {
    col.ondragover = (ev) => { ev.preventDefault(); col.classList.add('sobre'); };
    col.ondragleave = () => col.classList.remove('sobre');
    col.ondrop = (ev) => { ev.preventDefault(); moverCaso(ev.dataTransfer.getData('text/plain'), col.dataset.etapa); vistaTablero(); };
  });
}

/* ---------------- Plantillas ---------------- */
function descargarPlantilla(id, p) {
  const caso = leer(K.casos, {})[p.id] || {};
  const doc = plantilla(id, { p, caso, legal: D.legal, municipio: D.municipios?.find((m) => m.id === p.municipio)?.nombre || '' });
  const blob = new Blob(['﻿' + doc.html], { type: 'application/msword' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = doc.archivo; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* ---------------- A mano ---------------- */
function vistaMano() {
  const manuales = leer(K.mano, []);
  $('#vista').innerHTML = `
    <h2 style="margin:6px 0 4px">Un piso que has visto</h2>
    <p style="color:var(--suave);margin:0 0 12px;max-width:720px">Pega la dirección (y si la tienes, el enlace del anuncio). La web busca la finca en el Catastro, te deja elegir el piso, lo valora con los comparables del radar y te da el precio máximo de oferta. Se guarda en este dispositivo.</p>
    <form class="form" id="formMano" autocomplete="off">
      <div><label>Dirección (calle y número)</label><input id="mDir" placeholder="Ej.: Carrer Major 1" required></div>
      <div class="dos">
        <div><label>Municipio</label><select id="mMun">${(D.municipios || []).map((m) => `<option value="${m.id}">${h(m.nombre)}</option>`).join('')}</select></div>
        <div><label>Enlace del anuncio (opcional)</label><input id="mUrl" inputmode="url" placeholder="https://…"></div>
      </div>
      <div class="dos">
        <div><label>Planta (opcional)</label><input id="mPl" placeholder="Ej.: 3, BJ, ENT"></div>
        <div><label>Puerta (opcional)</label><input id="mPu" placeholder="Ej.: 2, B"></div>
      </div>
      <div class="dos">
        <div><label>Precio que piden (€)</label><input id="mPrecio" type="number" inputmode="numeric" required></div>
        <div><label>Tipo</label><select id="mTipo">${Object.entries(TIPOS).map(([k, t]) => `<option value="${k}">${h(t.nombre)}</option>`).join('')}</select></div>
      </div>
      <div class="botones"><button class="boton oro" type="submit">🔎 Investigar</button></div>
    </form>
    <ul class="pasos" id="mPasos"></ul>
    <div id="mUnidades"></div>
    ${manuales.length ? `<h3 style="margin:20px 0 8px">Guardados a mano (${manuales.length})</h3><div class="lista">${manuales.map((m) => { const p = PISOS.find((x) => x.id === m.id) || recalcular({ ...m, aMano: true }); return tarjeta(p, 0); }).join('')}</div>
    <div class="botones"><button class="boton" id="mEnviar">✉️ Mandar los guardados al Mac (correo)</button></div>
    <p class="fuente">El correo va a tu Gmail con el asunto «LLAVES a mano»; la recogida diaria los añade al radar de todos tus dispositivos.</p>` : ''}`;
  $('#formMano').onsubmit = (e) => { e.preventDefault(); investigarMano(); };
  document.querySelectorAll('#vista .tarjeta').forEach((t) => t.onclick = () => abrirFicha(t.dataset.id));
  const env = $('#mEnviar'); if (env) env.onclick = () => {
    const cuerpo = leer(K.mano, []).map((m) => `${m.direccion} | ${m.municipio} | ${m.precio} € | ${m.tipo} | ${m.catastro?.rc || m.catastro?.parcela || ''} | ${(m.enlaces || []).map((x) => x.url).join(' ')}`).join('\n');
    location.href = `mailto:${encodeURIComponent(D.correo || '')}?subject=${encodeURIComponent('LLAVES a mano')}&body=${encodeURIComponent('LLAVES-MANO\n' + cuerpo)}`;
  };
}

async function investigarMano() {
  const pasos = $('#mPasos'); const un = $('#mUnidades'); un.innerHTML = '';
  const paso = (t, cl = 'va') => { const li = document.createElement('li'); li.className = cl; li.textContent = t; pasos.appendChild(li); return li; };
  pasos.innerHTML = '';
  const dir = $('#mDir').value.trim(), munId = $('#mMun').value, url = $('#mUrl').value.trim();
  const mun = D.municipios.find((m) => m.id === munId);
  const precio = Number($('#mPrecio').value), tipo = $('#mTipo').value;
  let lat, lon, puntos = [];
  const numero = (dir.match(/\b(\d+)\s*[A-Za-z]?\s*$/) || dir.match(/\b(\d+)\b/) || [])[1];
  const calle = dir.replace(/[,\s]*\d+.*$/, '').trim();
  if (!numero) { paso('Falta el número del portal (por ejemplo «Carrer Major 1»).', 'mal'); return; }
  const p1 = paso('Buscando la calle en el mapa (OpenStreetMap)…');
  try {
    const q = new URLSearchParams({ format: 'jsonv2', street: `${numero} ${calle}`, city: mun.nombre, country: 'España', limit: '1', 'accept-language': 'es' });
    let r = await (await fetch('https://nominatim.openstreetmap.org/search?' + q)).json();
    if (!r.length) r = await (await fetch('https://nominatim.openstreetmap.org/search?' + new URLSearchParams({ format: 'jsonv2', q: `${dir}, ${mun.nombre}, Barcelona, España`, limit: '1' }))).json();
    if (!r.length) throw new Error('no la encuentro');
    lat = Number(r[0].lat); lon = Number(r[0].lon);
    const bb = (r[0].boundingbox || []).map(Number);
    puntos = [[lat, lon]];
    if (bb.length === 4) puntos.push([bb[0], bb[2]], [bb[1], bb[3]], [(bb[0] + bb[1]) / 2, (bb[2] + bb[3]) / 2]);
    p1.className = 'ok'; p1.textContent = `Calle encontrada: ${r[0].display_name.split(',').slice(0, 3).join(',')}`;
  } catch (e) { p1.className = 'mal'; p1.textContent = 'No encuentro esa calle en el mapa: ' + e.message + '. Prueba con «Carrer de…» y el número.'; return; }
  const p2 = paso(`Buscando el número ${numero} en el Catastro…`);
  let parcela, unidades;
  try {
    const f = await fincaPorPortal(puntos, numero, calle);
    if (!f) throw new Error('no hay fincas de esa calle cerca');
    if (!f.exacta) throw new Error(`no encuentro el número ${numero}; la más cercana es ${f.direccion}`);
    parcela = f.parcela;
    ({ unidades } = await porReferencia(parcela));
    unidades = unidades.filter((u) => /resid/i.test(u.uso));
    p2.className = 'ok'; p2.textContent = `${f.direccion}: finca ${parcela}, ${unidades.length} viviendas`;
  } catch (e) { p2.className = 'mal'; p2.textContent = 'Catastro: ' + e.message; return; }
  const pl = normPlanta($('#mPl').value), pu = normPuerta($('#mPu').value);
  let elegida = unidades.filter((u) => (!pl || u.planta === pl) && (!pu || u.puerta === pu));
  const guardarCon = (u) => {
    const catastro = u ? { exacta: true, rc: u.rc, parcela, uso: u.uso, direccion: `${u.via} ${u.numero}`, escalera: u.escalera, planta: u.planta, puerta: u.puerta, cp: u.cp, m2: u.m2, anyo: u.anyo, viviendasFinca: unidades.length, fuente: 'Sede Electrónica del Catastro (consulta pública sin titular)', url: `https://www1.sedecatastro.gob.es/CYCBienInmueble/OVCConCiud.aspx?UrbRus=U&RefC=${u.rc}`, comprobado: hoyISO(), avisos: [] }
      : { exacta: false, parcela, uso: 'Residencial', direccion: unidades[0] ? `${unidades[0].via} ${unidades[0].numero}` : dir, cp: unidades[0]?.cp, m2: null, m2Rango: [Math.min(...unidades.map((x) => x.m2)), Math.max(...unidades.map((x) => x.m2))], anyos: [...new Set(unidades.map((x) => x.anyo))], viviendasFinca: unidades.length, fuente: 'Sede Electrónica del Catastro (consulta pública sin titular)', url: `https://www1.sedecatastro.gob.es/Cartografia/mapa.aspx?refcat=${parcela}`, comprobado: hoyISO(), avisos: ['Piso exacto sin elegir: datos de la finca.'] };
    const id = 'mano:' + (u?.rc || parcela + '-' + Date.now());
    const fuente = /solvia/.test(url) ? 'Solvia' : /aliseda/.test(url) ? 'Aliseda' : /idealista/.test(url) ? 'Idealista' : /fotocasa/.test(url) ? 'Fotocasa' : /habitaclia/.test(url) ? 'Habitaclia' : /pisos\.com/.test(url) ? 'pisos.com' : /milanuncios/.test(url) ? 'Milanuncios' : /subastas\.boe/.test(url) ? 'Subastas BOE' : 'A mano';
    const p = { id, fuente: 'A mano', enlaces: url ? [{ fuente, url }] : [], detectado: hoyISO(), visto: hoyISO(), municipio: munId, direccion: dir + (u ? ` · ${u.planta}-${u.puerta}` : ''), lat, lon, catastro, m2Anuncio: null, precio, tipo, tipoNombre: TIPOS[tipo].nombre, situacionFuente: 'Introducido a mano', texto: '', errores: [] };
    p.valor = valorLibre(p, D.comparables || [], D.ministerio);
    if (u && !/resid/i.test(u.uso)) p.errores.push(`ERROR: el Catastro dice uso «${u.uso}», no vivienda.`);
    if (!p.valor.valor) p.errores.push('ERROR: sin superficie no se puede valorar: elige el piso exacto.');
    p.vulnerable = tipo === 'alquiler_social';
    const lista = leer(K.mano, []).filter((x) => x.id !== id); lista.push(p); guardar(K.mano, lista);
    prepararPisos();
    paso(`Valorado: libre ${eur(p.valor.valor)} · ${p.valor.metodo}`, 'ok');
    abrirFicha(id);
  };
  if (elegida.length === 1) { paso(`Piso encontrado: planta ${elegida[0].planta}, puerta ${elegida[0].puerta}, ${elegida[0].m2} m², ${elegida[0].anyo}`, 'ok'); guardarCon(elegida[0]); return; }
  paso(elegida.length ? `Hay ${elegida.length} pisos que encajan: elige el tuyo` : 'Elige el piso (o guarda la finca sin piso exacto)', 'va');
  const opciones = (elegida.length ? elegida : unidades).slice().sort((a, b) => a.planta.localeCompare(b.planta) || a.puerta.localeCompare(b.puerta));
  un.innerHTML = `<div class="unidades">${opciones.map((u, i) => `<button data-i="${i}">Planta <b>${h(u.planta)}</b> · puerta <b>${h(u.puerta)}</b>${u.escalera && u.escalera !== '1' ? ' · esc. ' + h(u.escalera) : ''} — ${u.m2} m² · ${u.anyo}</button>`).join('')}</div><div class="botones"><button class="boton" id="sinPiso">Guardar sin piso exacto</button></div>`;
  un.querySelectorAll('[data-i]').forEach((b) => b.onclick = () => guardarCon(opciones[Number(b.dataset.i)]));
  $('#sinPiso').onclick = () => guardarCon(null);
}

/* ---------------- Guía legal ---------------- */
function vistaGuia() {
  const L = D.legal;
  if (!L) { $('#vista').innerHTML = '<div class="vacio">La guía legal aún no está verificada.</div>'; return; }
  const normas = (ns) => (ns || []).length ? `<div class="normas">Fuentes: ${ns.map((n) => `<a href="${h(n.url)}" target="_blank" rel="noopener">${h(n.nombre)}</a>${n.comprobado ? ` (${fecha(n.comprobado)})` : ''}`).join(' · ')}</div>` : '';
  $('#vista').innerHTML = `<div class="guia" style="max-width:860px">
    <div class="aviso abogado"><b>Esto no sustituye a un abogado.</b> Todo está comprobado en fuentes oficiales el ${fecha(L.comprobado)}, con su enlace. Lo marcado «CONSULTAR ABOGADO» depende del caso o ha cambiado hace poco.</div>
    ${L.decretos ? `<section class="bloque"><h3>⚠️ Novedad: ${h(L.decretos.titulo)}</h3><p>${h(L.decretos.llano)}</p>${L.decretos.consultar_abogado ? '<div class="aviso abogado">CONSULTAR ABOGADO</div>' : ''}${normas(L.decretos.normas)}</section>` : ''}
    <section class="bloque"><h3>🤝 Cómo se negocia con los ocupantes (siempre)</h3>
      <p>${h(L.negociacion?.llano || '')}</p>
      <ul style="line-height:1.6">${(L.negociacion?.reglas || []).map((r) => `<li>${h(r)}</li>`).join('')}</ul>
      <div class="aviso error"><b>Prohibido:</b> ${h(L.negociacion?.prohibido || '')}</div>${normas(L.negociacion?.normas)}</section>
    <section class="bloque"><h3>🛟 Casos vulnerables</h3><p>${h(L.vulnerables?.llano || '')}</p>${L.vulnerables?.consultar_abogado ? '<div class="aviso abogado">CONSULTAR ABOGADO: ' + h(L.vulnerables.nota || '') + '</div>' : ''}${normas(L.vulnerables?.normas)}</section>
    <h2 style="margin:18px 0 8px">Tipos de oportunidad</h2>
    ${Object.entries(TIPOS).map(([k, t]) => { const x = L.tipos?.[k]; return `<section class="bloque"><h3>${h(t.nombre)} <span class="eti">riesgo ${h(t.riesgo)}</span>${x?.consultar_abogado ? ' <span class="eti abogado">CONSULTAR ABOGADO</span>' : ''}</h3><p>${h(x?.llano || 'Sin explicación verificada.')}</p><p><b>Plazo típico:</b> ${h(x?.plazo || 'sin dato oficial · CONSULTAR ABOGADO')}</p>${x?.nota ? `<div class="aviso ojo">${h(x.nota)}</div>` : ''}${normas(x?.normas)}</section>`; }).join('')}
    ${(L.otros || []).map((x) => `<section class="bloque"><h3>${h(x.titulo)}${x.consultar_abogado ? ' <span class="eti abogado">CONSULTAR ABOGADO</span>' : ''}</h3><p>${h(x.llano)}</p>${x.plazo ? `<p><b>Plazo:</b> ${h(x.plazo)}</p>` : ''}${x.nota ? `<div class="aviso ojo">${h(x.nota)}</div>` : ''}${normas(x.normas)}</section>`).join('')}
    <section class="bloque"><h3>🧾 Impuestos y gastos de la compra</h3><p>${h(L.impuestos?.llano || '')}</p>${L.impuestos?.consultar_abogado ? '<div class="aviso abogado">CONSULTAR ABOGADO: ' + h(L.impuestos.nota || '') + '</div>' : ''}${normas(L.impuestos?.normas)}</section>
  </div>`;
}

/* ---------------- Fuentes ---------------- */
function vistaFuentes() {
  const F = D.estadoFuentes || [];
  $('#vista').innerHTML = `<div style="max-width:900px">
    <p style="color:var(--suave)">Qué se lee y cómo. Solo listados públicos, API oficiales, alertas por correo o exportaciones: nada de saltarse logins, captchas o bloqueos.</p>
    ${F.map((f) => `<section class="bloque"><h3><span class="punto ${f.estado === 'funciona' ? 'VERDE' : f.estado === 'pendiente' ? 'AMARILLO' : 'ROJO'}"></span>${h(f.nombre)} <span class="eti">${h(f.estado)}</span></h3><p style="margin:0 0 6px;line-height:1.45">${h(f.como)}</p>${f.ultima ? `<div class="fuente">Última recogida: ${h(f.ultima)}</div>` : ''}${f.comprobado ? `<div class="fuente">Comprobado ${fecha(f.comprobado)}${f.url ? ` · <a href="${h(f.url)}" target="_blank" rel="noopener">${h(f.url)}</a>` : ''}</div>` : ''}</section>`).join('')}
  </div>`;
}

/* ---------------- Ajustes ---------------- */
function vistaAjustes() {
  const a = ajustesGlobales();
  const campo = (k, cab, paso = 100, mult = 1) => `<div class="tu"><label for="g_${k}">${cab}</label><input id="g_${k}" data-k="${k}" data-m="${mult}" type="number" inputmode="decimal" step="${paso}" value="${Math.round(a[k] * mult * 100) / 100}"></div>`;
  $('#vista').innerHTML = `<div style="max-width:900px">
    <h2 style="margin:6px 0 8px">Valores por defecto de la calculadora</h2>
    <p style="color:var(--suave);margin-top:0">Se aplican a todos los pisos salvo a los que cambies en su ficha.</p>
    <div class="tus">
      ${campo('llaves', 'TÚ: COMPENSACIÓN POR LAS LLAVES (€)')}
      ${campo('reformaM2', 'TÚ: CUÁNTO CREES QUE COSTARÁ LA REFORMA (€/m²)', 10)}
      ${campo('gastosMes', 'TÚ: GASTOS DE CADA MES DE ESPERA (€)', 10)}
      ${campo('abogado', 'TÚ: ABOGADO (€)')}
      ${campo('extraLargoAbogado', 'TÚ: EXTRA SI HAY JUICIO COMPLETO (€)')}
      ${campo('notariaRegistro', 'NOTARÍA, REGISTRO Y GESTORÍA (€)')}
      ${campo('itp', 'ITP (%)', 0.5, 100)}
    </div>
    <div class="botones"><button class="boton" id="gReset">Volver a los de fábrica</button></div>
    <h2 style="margin:22px 0 8px">Copia de seguridad</h2>
    <p style="color:var(--suave);margin-top:0">El seguimiento, tus cifras y los pisos a mano viven en este dispositivo. Descarga una copia para pasarla al otro (móvil ↔ ordenador) o guardarla.</p>
    <div class="botones"><button class="boton oro" id="bDescargar">⬇ Descargar copia</button><label class="boton">⬆ Cargar copia<input type="file" id="bCargar" accept="application/json" hidden></label></div>
    <h2 style="margin:22px 0 8px">Cerrar</h2>
    <div class="botones"><button class="boton" id="bOlvidar">Olvidar el código en este dispositivo (también en Páginas)</button></div>
  </div>`;
  document.querySelectorAll('#vista input[data-k]').forEach((i) => i.onchange = () => { const g = leer(K.aj, {}); g[i.dataset.k] = Number(i.value) / Number(i.dataset.m); guardar(K.aj, g); prepararPisos(); toast('Guardado'); });
  $('#gReset').onclick = () => { guardar(K.aj, {}); prepararPisos(); vistaAjustes(); };
  $('#bDescargar').onclick = () => {
    const copia = { llaves: 1, fecha: new Date().toISOString() }; for (const k of ['casos', 'aj', 'ajp', 'mano', 'check']) copia[k] = leer(K[k], null);
    const a2 = document.createElement('a'); a2.href = URL.createObjectURL(new Blob([JSON.stringify(copia, null, 1)], { type: 'application/json' })); a2.download = `llaves-copia-${hoyISO()}.json`; a2.click();
  };
  $('#bCargar').onchange = async (e) => {
    try { const c = JSON.parse(await e.target.files[0].text()); if (!c.llaves) throw new Error('no es una copia de LLAVES'); for (const k of ['casos', 'aj', 'ajp', 'mano', 'check']) if (c[k]) guardar(K[k], c[k]); prepararPisos(); pintarCabecera(); toast('Copia cargada'); }
    catch (err) { alert('No se pudo cargar: ' + err.message); }
  };
  $('#bOlvidar').onclick = () => { try { localStorage.removeItem(K.cod); } catch {} location.reload(); };
}
