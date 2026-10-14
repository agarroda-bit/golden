// Lupa KDP — service worker.
// Es el único que escribe en el almacenamiento (en cola, así nunca se pisan dos escrituras):
// historial de lecturas, preferencias de cada libro, curvas, ajustes y la bandeja de ideas para la
// Biblioteca. No hace NADA por su cuenta: no hay alarmas ni tareas en segundo plano; solo contesta
// a lo que pide la pestaña de Amazon que Rodri tiene abierta o la página de Opciones.
import './lib/base.js';
import './lib/tiendas.js';
import './lib/regalias.js';
import './lib/estimacion.js';
import './lib/historial.js';
import './lib/exportar.js';
import './lib/biblioteca.js';

const L = globalThis.LUPA;

// ============================================================ cola de escrituras

let cola = Promise.resolve();
function enCola(fn) {
  const p = cola.then(fn, fn);
  cola = p.catch(() => {});
  return p;
}

// ============================================================ ajustes y curvas

async function contexto() {
  const { ajustes, asignacion, curvas } = await chrome.storage.local.get(['ajustes', 'asignacion', 'curvas']);
  return { ajustes: ajustes || {}, asignacion: asignacion || null, curvas: Array.isArray(curvas) ? curvas : [] };
}

function guardarAjustes(cambios) {
  return enCola(async () => {
    const { ajustes } = await chrome.storage.local.get('ajustes');
    const nuevos = { ...(ajustes || {}), ...(cambios || {}) };
    await chrome.storage.local.set({ ajustes: nuevos });
    return { ok: true, ajustes: nuevos };
  });
}

/** Guarda (o sustituye) una curva propia o calibrada. Las de fábrica no se tocan. */
function guardarCurva(curva) {
  return enCola(async () => {
    const v = L.validarCurva(curva);
    if (!v.ok) return { ok: false, error: v.errores.join(' ') };
    if (L.CURVAS_FABRICA.some((c) => c.id === curva.id)) return { ok: false, error: 'Las curvas de fábrica no se pueden cambiar: guarda la tuya con otro nombre.' };
    const { curvas } = await chrome.storage.local.get('curvas');
    const lista = (Array.isArray(curvas) ? curvas : []).filter((c) => c.id !== curva.id);
    lista.push({ ...curva, guardada: new Date().toISOString() });
    await chrome.storage.local.set({ curvas: lista });
    return { ok: true, curvas: lista };
  });
}

function borrarCurva(id) {
  return enCola(async () => {
    const { curvas, asignacion } = await chrome.storage.local.get(['curvas', 'asignacion']);
    const lista = (Array.isArray(curvas) ? curvas : []).filter((c) => c.id !== id);
    // Donde estuviera asignada, se vuelve a la de fábrica.
    const a = L.copia({ ...L.ASIGNACION_DEFECTO, ...(asignacion || {}) });
    for (const t of Object.keys(a)) for (const f of Object.keys(a[t])) if (a[t][f] === id) a[t][f] = L.ASIGNACION_DEFECTO[t][f];
    await chrome.storage.local.set({ curvas: lista, asignacion: a });
    return { ok: true };
  });
}

/** Elige la curva de una tienda y un formato ('impreso' | 'kindle'). */
function asignarCurva(tienda, formato, id) {
  return enCola(async () => {
    if (!L.TIENDAS[tienda] || !['impreso', 'kindle'].includes(formato)) return { ok: false, error: 'Tienda o formato desconocidos.' };
    const { curvas, asignacion } = await chrome.storage.local.get(['curvas', 'asignacion']);
    const curva = L.todasLasCurvas(curvas).find((c) => c.id === id);
    if (!curva) return { ok: false, error: 'Esa curva no existe.' };
    if (curva.formato !== formato) return { ok: false, error: `Esa curva es para ${L.FORMATOS_CURVA[curva.formato]}, no para ${L.FORMATOS_CURVA[formato]}.` };
    const a = L.copia({ ...L.ASIGNACION_DEFECTO, ...(asignacion || {}) });
    a[tienda] = { ...a[tienda], [formato]: id };
    await chrome.storage.local.set({ asignacion: a });
    return { ok: true, asignacion: a };
  });
}

// ============================================================ historial

async function leerEntrada(tienda, asin) {
  const k = L.historial.clave(tienda, asin);
  return (await chrome.storage.local.get(k))[k] || null;
}

async function todoElHistorial() {
  const todo = await chrome.storage.local.get(null);
  return Object.entries(todo)
    .filter(([k]) => k.startsWith('h:'))
    .map(([, v]) => v);
}

/** Guarda una lectura de una ficha. Devuelve el libro con todas sus lecturas. */
function guardarLectura(ficha, origen) {
  return enCola(async () => {
    if (!ficha || !ficha.ok || !ficha.asin || !L.TIENDAS[ficha.tienda]) return { ok: false, error: 'Ficha sin ASIN o fuera de Amazon.es/.com: no se guarda.' };
    const k = L.historial.clave(ficha.tienda, ficha.asin);
    const existente = (await chrome.storage.local.get(k))[k] || null;
    const { entrada, anadida } = L.historial.anadir(existente, ficha, origen);
    await chrome.storage.local.set({ [k]: entrada });
    return { ok: true, entrada, anadida };
  });
}

/** Tinta y tamaño elegidos por Rodri para un libro (las casillas amarillas del panel). */
function preferencias(tienda, asin, cambios) {
  return enCola(async () => {
    const k = L.historial.clave(tienda, asin);
    const e = (await chrome.storage.local.get(k))[k];
    if (!e) return { ok: false, error: 'Ese libro no está en el historial.' };
    const permitidos = {};
    if (cambios && L.TINTAS.includes(cambios.tinta)) permitidos.tinta = cambios.tinta;
    if (cambios && ['normal', 'grande'].includes(cambios.tamano)) {
      permitidos.tamano = cambios.tamano;
      permitidos.tamanoElegido = true;
    }
    if (cambios && cambios.tamano === '') {
      delete (e.prefs || {}).tamano;
      delete (e.prefs || {}).tamanoElegido;
    }
    e.prefs = { ...(e.prefs || {}), ...permitidos };
    await chrome.storage.local.set({ [k]: e });
    return { ok: true, entrada: e };
  });
}

function quitarDelHistorial(tienda, asin) {
  return enCola(async () => {
    await chrome.storage.local.remove(L.historial.clave(tienda, asin));
    return { ok: true };
  });
}

async function exportarCsv(filtro) {
  let entradas = await todoElHistorial();
  if (filtro && filtro.tienda) entradas = entradas.filter((e) => e.tienda === filtro.tienda);
  if (filtro && filtro.asin) entradas = entradas.filter((e) => e.asin === filtro.asin);
  const lecturas = entradas.reduce((n, e) => n + (e.lecturas || []).length, 0);
  const csv = L.exportar.csvHistorial(entradas, await contexto());
  return { ok: true, csv, lecturas, libros: entradas.length, nombre: L.exportar.nombreArchivo(filtro && filtro.asin ? `lupa-kdp-${filtro.asin}` : 'lupa-kdp-historial') };
}

// ============================================================ Biblioteca

async function bandeja() {
  const { biblioteca } = await chrome.storage.local.get('biblioteca');
  return Array.isArray(biblioteca) ? biblioteca : [];
}

/** Apunta la idea en la bandeja y abre la Biblioteca (su página la rellena y la manda sola). */
function mandarBiblioteca(idea, sender) {
  return enCola(async () => {
    if (!idea || !idea.texto) return { ok: false, error: 'La idea está vacía.' };
    const lista = await bandeja();
    const item = {
      id: `idea-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      idea,
      estado: 'pendiente',
      creada: new Date().toISOString(),
      tabOrigen: sender && sender.tab ? sender.tab.id : null,
      intentos: 0,
    };
    lista.push(item);
    await chrome.storage.local.set({ biblioteca: lista.slice(-200) });
    const { ajustes } = await contexto();
    const url = (ajustes && ajustes.urlBiblioteca) || L.BIBLIOTECA.url;
    try {
      await chrome.tabs.create({ url, active: true, ...(item.tabOrigen ? { openerTabId: item.tabOrigen } : {}) });
    } catch (e) {
      return { ok: false, id: item.id, error: `No se ha podido abrir la Biblioteca: ${(e && e.message) || e}` };
    }
    return { ok: true, id: item.id };
  });
}

/** La página de la Biblioteca pregunta si hay alguna idea por entregar. */
function ideaPendiente(sender) {
  return enCola(async () => {
    const lista = await bandeja();
    const ahora = Date.now();
    // Una idea «entregando» desde hace más de 2 minutos se da por no entregada y vuelve a la cola.
    const item = lista.find((x) => x.estado === 'pendiente' || (x.estado === 'entregando' && ahora - new Date(x.desde || 0).getTime() > 120000));
    if (!item) return { ok: true, item: null };
    item.estado = 'entregando';
    item.desde = new Date().toISOString();
    item.intentos = (item.intentos || 0) + 1;
    item.tabBiblioteca = sender && sender.tab ? sender.tab.id : null;
    await chrome.storage.local.set({ biblioteca: lista });
    return { ok: true, item: { id: item.id, idea: item.idea } };
  });
}

/** La Biblioteca dice si la idea ha entrado (o por qué no). Se avisa a la pestaña de Amazon. */
function ideaEntregada(m) {
  return enCola(async () => {
    const lista = await bandeja();
    const item = lista.find((x) => x.id === m.id);
    if (!item) return { ok: false, error: 'Esa idea ya no está en la bandeja.' };
    if (m.ok) {
      item.estado = 'entregada';
      item.entregada = new Date().toISOString();
      delete item.motivo;
    } else {
      item.estado = 'pendiente';
      item.motivo = m.motivo || 'no se sabe por qué';
    }
    await chrome.storage.local.set({ biblioteca: lista });
    if (item.tabOrigen) {
      try {
        await chrome.tabs.sendMessage(item.tabOrigen, { tipo: 'bibliotecaResultado', id: item.id, ok: !!m.ok, motivo: item.motivo || null });
      } catch {
        /* la pestaña de Amazon ya no está */
      }
    }
    return { ok: true };
  });
}

function reintentarIdea(id) {
  return enCola(async () => {
    const lista = await bandeja();
    const item = lista.find((x) => x.id === id);
    if (!item) return { ok: false, error: 'Esa idea ya no está en la bandeja.' };
    item.estado = 'pendiente';
    await chrome.storage.local.set({ biblioteca: lista });
    const { ajustes } = await contexto();
    await chrome.tabs.create({ url: (ajustes && ajustes.urlBiblioteca) || L.BIBLIOTECA.url, active: true });
    return { ok: true };
  });
}

function quitarIdea(id) {
  return enCola(async () => {
    const lista = (await bandeja()).filter((x) => x.id !== id);
    await chrome.storage.local.set({ biblioteca: lista });
    return { ok: true };
  });
}

// ============================================================ fuentes de la casa

let fuentesCache = null;
/** Oswald y Rubik en base64: la pestaña de Amazon las carga con FontFace sin pedir nada a internet. */
async function fuentes() {
  if (fuentesCache) return fuentesCache;
  const leer = async (nombre) => {
    const r = await fetch(chrome.runtime.getURL(`fuentes/${nombre}`));
    const bytes = new Uint8Array(await r.arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  };
  fuentesCache = { ok: true, oswald: await leer('oswald.woff2'), rubik: await leer('rubik.woff2') };
  return fuentesCache;
}

// ============================================================ avisos

function pintarAviso(activo) {
  try {
    chrome.action.setBadgeBackgroundColor({ color: '#F08A80' });
    chrome.action.setBadgeText({ text: activo ? '!' : '' });
  } catch {
    /* sin icono (pruebas) */
  }
}

async function bloqueo(m) {
  pintarAviso(true);
  await chrome.storage.local.set({ ultimoBloqueo: { fecha: new Date().toISOString(), url: (m && m.url) || null } });
  return { ok: true };
}

// ============================================================ mensajes

const MANEJADORES = {
  contexto: () => contexto().then((c) => ({ ok: true, ...c })),
  guardarLectura: (m) => guardarLectura(m.ficha, m.origen),
  historialDe: async (m) => ({ ok: true, entrada: await leerEntrada(m.tienda, m.asin) }),
  fichaReciente: async (m) => ({ ok: true, ...(L.historial.fichaReciente(await leerEntrada(m.tienda, m.asin), m.minutos ?? 60) || { ficha: null }) }),
  preferencias: (m) => preferencias(m.tienda, m.asin, m.cambios),
  todoElHistorial: async () => ({ ok: true, entradas: await todoElHistorial() }),
  quitarDelHistorial: (m) => quitarDelHistorial(m.tienda, m.asin),
  exportarCsv: (m) => exportarCsv(m.filtro),
  guardarAjustes: (m) => guardarAjustes(m.cambios),
  guardarCurva: (m) => guardarCurva(m.curva),
  borrarCurva: (m) => borrarCurva(m.id),
  asignarCurva: (m) => asignarCurva(m.tienda, m.formato, m.id),
  mandarBiblioteca: (m, s) => mandarBiblioteca(m.idea, s),
  ideaPendiente: (_m, s) => ideaPendiente(s),
  ideaEntregada: (m) => ideaEntregada(m),
  reintentarIdea: (m) => reintentarIdea(m.id),
  quitarIdea: (m) => quitarIdea(m.id),
  bandeja: async () => ({ ok: true, ideas: await bandeja() }),
  fuentes: () => fuentes(),
  bloqueo: (m) => bloqueo(m),
  limpiarAviso: async () => {
    pintarAviso(false);
    await chrome.storage.local.remove('ultimoBloqueo');
    return { ok: true };
  },
  abrirOpciones: async () => {
    await chrome.runtime.openOptionsPage();
    return { ok: true };
  },
};

chrome.runtime.onMessage.addListener((msg, sender, responder) => {
  const manejador = msg && MANEJADORES[msg.tipo];
  if (!manejador) return false;
  Promise.resolve()
    .then(() => manejador(msg, sender))
    .then(responder, (e) => responder({ ok: false, error: String((e && e.message) || e) }));
  return true;
});

// Icono: en Amazon enseña el panel; fuera de Amazon abre Opciones.
chrome.action.onClicked.addListener(async (tab) => {
  if (tab && tab.id && /^https:\/\/www\.amazon\.(es|com)\//.test(tab.url || '')) {
    try {
      const r = await chrome.tabs.sendMessage(tab.id, { tipo: 'mostrarPanel' });
      if (r && r.ok) return;
    } catch {
      /* la página aún no tiene Lupa cargada */
    }
  }
  chrome.runtime.openOptionsPage();
});

// Para las pruebas (se llaman desde el service worker con Playwright).
globalThis.LUPA_SW = { contexto, guardarLectura, todoElHistorial, exportarCsv, mandarBiblioteca, ideaPendiente, ideaEntregada, bandeja, guardarCurva, asignarCurva };
