// Fase 3 · Idealista y portales SIN leer sus webs: se analizan el TEXTO de sus correos de alerta (que llegan al Gmail)
// y lo que comparten sus apps («Piso en venta en Calle X, L'Hospitalet - 65.000 €» + enlace).
// NUNCA se abre idealista.com ni ninguna web de portal desde un programa: los enlaces solo se guardan.
// Formato de Idealista copiado de correos reales (junio de 2026). Fotocasa, Habitaclia y pisos.com: formato supuesto, sin verificar.

export const ZONA = [
  ['lh', /hospitalet/], ['cornella', /cornell/], ['esplugues', /esplugues/], ['prat', /prat de llobregat/],
  ['santboi', /sant boi|san baudilio/], ['santjoan', /sant joan desp|san juan desp/], ['santfeliu', /sant feliu de llobregat|san feliu de llobregat/],
  ['viladecans', /viladecans/], ['gava', /\bgav[aà]\b/], ['castelldefels', /castelldefels/],
];
const sinAcentos = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export function municipioDe(texto) { const t = sinAcentos(texto).replace(/_/g, ' ').replace(/-/g, ' '); return ZONA.find(([, re]) => re.test(t))?.[0] || null; }

const OCUPADO = /\b(ocupad[oa]s?|okupad[oa]|okupas?|sin posesi[oó]n|no se puede visitar|sin visitas|sin derecho a visita|inquiokupa|con inquilin|alquilad[oa] con|nuda propiedad|subasta|cesi[oó]n de remate|situaci[oó]n especial|sin justo t[ií]tulo)\b/i;
export const pareceOcupado = (t) => OCUPADO.test(t || '');
export function tipoPorTexto(t = '') {
  t = t.toLowerCase();
  if (/nuda propiedad/.test(t)) return 'nuda_propiedad';
  if (/subasta/.test(t)) return 'subasta';
  if (/cesi[oó]n de remate|cr[eé]dito/.test(t)) return 'credito';
  if (/sin posesi[oó]n/.test(t)) return 'sin_posesion';
  if (/inquiokupa|impago|contrato (vencido|finalizado)|inquilin/.test(t)) return 'inquiokupa';
  if (/sin justo t[ií]tulo|okupa|ocupad/.test(t)) return 'usurpacion';
  return 'desconocido';
}

const numero = (s) => Number(String(s).replace(/\./g, '').replace(',', '.'));
const VIA = /^(calle|carrer|c\/|avenida|avinguda|av\.?|avda\.?|plaza|pla[cç]a|pza\.?|rambla|paseo|passeig|ronda|traves[ií]a|travessera|camino|cam[ií]|pasaje|passatge|carretera|ctra\.?|gran via|via)\b/i;

// «Calle Ceravalls, Les Planes, Hospitalet de Llobregat» / «Calle Miquel Romeu, 135, Zona del Mig, Hospitalet…»
export function partesDireccion(lugar = '') {
  const p = lugar.split(/\s*,\s*/).map((x) => x.trim()).filter(Boolean);
  const r = { calle: '', numero: '', barrio: '', municipioTexto: p.at(-1) || '' };
  let i = 0;
  if (p[0] && VIA.test(p[0])) {
    const m = p[0].match(/^(.*?)[\s,]+(\d+[A-Za-z]?)$/);
    if (m) { r.calle = m[1]; r.numero = m[2]; } else r.calle = p[0];
    i = 1;
    if (p[1] && /^\d+[A-Za-z]?$/.test(p[1])) { r.numero = p[1]; i = 2; }
  }
  r.barrio = p.slice(i, -1).join(', ');
  return r;
}

function caracteristicas(linea = '') {
  const m2 = linea.match(/([\d.,]+)\s*m(?:²|2)(?![\w/])/); const hab = linea.match(/(\d+)\s*hab/); const pl = linea.match(/(\d+)ª?\s*planta|planta\s+(\w+)|\b(bajo|entresuelo|[aá]tico)\b/i);
  return { m2: m2 ? numero(m2[1]) : null, habitaciones: hab ? Number(hab[1]) : null, planta: pl ? (pl[1] || pl[2] || pl[3]) : null, ascensor: /con ascensor/.test(linea) ? true : /sin ascensor/.test(linea) ? false : null };
}

// ---------- Idealista (formato real) ----------
const TIPO_INM = '(Piso|Ático|Atico|Dúplex|Duplex|Casa|Chalet|Estudio|Apartamento|Planta baja|Loft|Local|Nave|Restaurante|Oficina|Garaje|Trastero|Edificio|Terreno|Casa o chalet|Casa adosada|Finca)';
function idealista(texto) {
  const re = new RegExp(`\\|?\\s*${TIPO_INM}\\s+en\\s+([^\\n\\[]+?)\\[\\]\\((https:\\/\\/www\\.idealista\\.com\\/inmueble\\/(\\d+)\\/[^)\\s]*)\\)`, 'g');
  const hallados = [...texto.matchAll(re)];
  // Filtros de la búsqueda guardada (la línea «| Hasta 100.000 € Ocupada |» que va antes de cada bloque)
  return hallados.map((m, i) => {
    const fin = hallados[i + 1]?.index ?? texto.length;
    const trozo = texto.slice(m.index + m[0].length, fin);
    const antes = texto.slice(hallados[i - 1] ? hallados[i - 1].index + hallados[i - 1][0].length : 0, m.index);
    const filtros = [...antes.matchAll(/\)\s*\|\s*([^|\n]+?)\s*\|/g)].map((x) => x[1]).join(' · ');
    const lineas = trozo.split('\n').map((l) => l.replace(/^\|\s*|\s*\|$/g, '').trim()).filter((l) => l && l !== '|');
    const lp = lineas.find((l) => /[\d.]+\s*€/.test(l)) || '';
    const precio = lp.match(/([\d.]+)\s*€(\/mes)?/);
    const lc = lineas.find((l) => /\bhab\.|\d\s*m²/.test(l) && !/^[\d.]+\s*€/.test(l)) || '';
    const desc = lineas.find((l) => l !== lp && l !== lc && !/^Ver \d+ fotos|^Novedad$/.test(l) && l.length > 25) || '';
    const lugar = m[2].trim().replace(/\.\.\.$/, '');
    return {
      fuente: 'Idealista', id: m[4], url: `https://www.idealista.com/inmueble/${m[4]}/`,
      tipoInmueble: m[1], titulo: `${m[1]} en ${lugar}`, ...partesDireccion(lugar),
      precio: precio ? numero(precio[1]) : null, alquiler: !!precio?.[2], ...caracteristicas(lc),
      descripcion: desc.replace(/\.\.\.$/, '…'), fotos: Number((trozo.match(/Ver (\d+) fotos/) || [])[1] || 0), filtros,
    };
  });
}

// ---------- Fotocasa / Habitaclia / pisos.com (formato supuesto: bloque de texto con enlace) ----------
const DOMINIOS = [
  ['Fotocasa', /https?:\/\/(?:www\.)?fotocasa\.es\/[^\s)"'<>]+/g, (u) => (u.match(/\/(\d{6,})\/d/) || [])[1]],
  ['Habitaclia', /https?:\/\/(?:www\.)?habitaclia\.com\/[^\s)"'<>]+/g, (u) => (u.match(/-i(\d{6,})\.htm/) || [])[1]],
  ['pisos.com', /https?:\/\/(?:www\.)?pisos\.com\/comprar\/[^\s)"'<>]+/g, (u) => (u.match(/-(\d{6,})_/) || [])[1]],
];
function generico(fuente, re, idDe, texto) {
  const enlaces = [...texto.matchAll(re)].filter((m) => idDe(m[0]));
  return enlaces.map((m, i) => {
    const desde = enlaces[i - 1] ? enlaces[i - 1].index + enlaces[i - 1][0].length : 0;
    const bloque = texto.slice(desde, m.index);
    const lineas = bloque.split('\n').map((l) => l.trim()).filter(Boolean);
    const lt = lineas.find((l) => new RegExp(`^${TIPO_INM}.*\\ben\\b`, 'i').test(l)) || '';
    const lugarTitulo = (lt.match(/\ben\s+(?:venta\s+en\s+)?(.+)$/i) || [])[1] || '';
    const lv = lineas.find((l) => VIA.test(l.replace(/^[^A-Za-zÀ-ÿ]+/, '')));
    const lugar = lv && !VIA.test(lugarTitulo) ? `${lv}, ${lugarTitulo}` : lugarTitulo;
    const precio = (lineas.find((l) => /^[\d.]+\s*€(?!\/m)/.test(l)) || '').match(/([\d.]+)\s*€(\/mes)?/);
    const lc = lineas.find((l) => /m²|m2|hab/.test(l) && !/€/.test(l)) || '';
    const desc = lineas.filter((l) => l !== lt && l !== lv && l !== lc && !/€/.test(l) && !/^ver /i.test(l) && l.length > 12).join(' ');
    return {
      fuente, id: idDe(m[0]), url: m[0], tipoInmueble: (lt.match(new RegExp(TIPO_INM, 'i')) || [])[1] || 'Piso', titulo: lt || lugar,
      ...partesDireccion(lugar.replace(/\s+-\s+/g, ', ')), precio: precio ? numero(precio[1]) : null, alquiler: !!precio?.[2],
      ...caracteristicas(lc), descripcion: desc.slice(0, 300), fotos: 0, filtros: '', formatoSupuesto: true,
    };
  });
}

// Un correo → anuncios. de: remitente; texto: cuerpo en texto plano (como lo da el conector de Gmail).
export function analizarCorreo({ de = '', asunto = '', texto = '' }) {
  const d = de.toLowerCase();
  let anuncios = [];
  if (/idealista/.test(d)) anuncios = idealista(texto);
  else for (const [f, re, idDe] of DOMINIOS) if (d.includes(f.toLowerCase().replace('.com', '')) || re.test(texto)) { re.lastIndex = 0; anuncios.push(...generico(f, re, idDe, texto)); }
  return anuncios.map((a) => {
    const todo = `${a.titulo} ${a.descripcion} ${a.filtros} ${asunto}`;
    const vivienda = /^(piso|[aá]tico|d[uú]plex|casa|chalet|estudio|apartamento|planta baja|loft|casa o chalet|casa adosada)$/i.test(a.tipoInmueble);
    return { ...a, municipio: municipioDe(`${a.municipioTexto} ${a.titulo} ${a.url}`), vivienda, venta: !a.alquiler, ocupado: pareceOcupado(todo), tipo: tipoPorTexto(todo) };
  });
}

// ¿Entra en el radar? Venta de vivienda, en la zona, ≤ tope y con señales de estar ocupada.
export function entraEnRadar(a, tope = 100000) {
  const motivos = [];
  if (!a.venta) motivos.push('es de alquiler');
  if (!a.vivienda) motivos.push(`no es vivienda (${a.tipoInmueble})`);
  if (!a.municipio) motivos.push(`fuera de la zona (${a.municipioTexto || '¿?'})`);
  if (!a.precio) motivos.push('sin precio'); else if (a.precio > tope) motivos.push(`pide ${a.precio.toLocaleString('es-ES')} €`);
  if (!a.ocupado) motivos.push('no dice que esté ocupado');
  return { entra: !motivos.length, motivos };
}

// Lo que comparte la app de un portal: «Piso en venta en Calle X, 12, L'Hospitalet - 65.000 € https://…»
export function analizarPegado(texto = '') {
  const t = texto.replace(/\s+/g, ' ').trim();
  const url = (t.match(/https?:\/\/[^\s]+/) || [])[0] || '';
  const fuente = /idealista\./.test(url) ? 'Idealista' : /fotocasa\./.test(url) ? 'Fotocasa' : /habitaclia\./.test(url) ? 'Habitaclia' : /pisos\.com/.test(url) ? 'pisos.com' : /milanuncios\./.test(url) ? 'Milanuncios' : /solvia\./.test(url) ? 'Solvia' : /aliseda/.test(url) ? 'Aliseda' : /subastas\.boe/.test(url) ? 'Subastas BOE' : url ? 'Otro' : 'A mano';
  const sinUrl = t.replace(url, ' ').replace(/^(mira|echa un vistazo a|he visto|te paso) (este|esta)[^:]*:\s*/i, '');
  const precio = sinUrl.match(/([\d]{1,3}(?:[.\s]\d{3})+|\d{4,7})\s*(?:€|euros)(\/mes)?/i);
  const tit = sinUrl.match(new RegExp(`${TIPO_INM}(?:\\s+en\\s+venta)?\\s+en\\s+(.+?)(?:\\s+[-–·|]\\s+|\\s+\\d[\\d.\\s]*(?:€|euros)|$)`, 'i'));
  const lugar = (tit?.[2] || '').replace(/[\s,.-]+$/, '');
  return {
    fuente, url, precio: precio ? numero(precio[1].replace(/\s/g, '.')) : null, alquiler: !!precio?.[2],
    tipoInmueble: tit?.[1] || null, ...partesDireccion(lugar), ...caracteristicas(sinUrl),
    municipio: municipioDe(`${lugar} ${sinUrl} ${url}`), ocupado: pareceOcupado(sinUrl), tipo: tipoPorTexto(sinUrl),
  };
}
