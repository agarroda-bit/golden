// Catastro: Sede Electrónica, servicios públicos sin datos del titular (OVC, JSON, CORS abierto).
// Se usa igual desde el Mac (recogida diaria) y desde el móvil (formulario «A mano»).
const OVC = 'https://ovc.catastro.meh.es/OVCServWeb/OVCWcfCallejero';
const FUENTE = 'Sede Electrónica del Catastro (consulta pública sin titular)';

const pedir = async (url) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error('Catastro HTTP ' + r.status);
  return JSON.parse((await r.text()).replace(/^﻿/, ''));
};
const lista = (x) => (Array.isArray(x) ? x : x ? [x] : []);

function unidad(u) {
  const rc = u.rc || u.idbi?.rc || {};
  const d = u.dt || {};
  const dir = d.locs?.lous?.lourb?.dir || {};
  const li = d.locs?.lous?.lourb?.loint || {};
  const deb = u.debi || {};
  return {
    rc: [rc.pc1, rc.pc2, rc.car, rc.cc1, rc.cc2].join(''),
    via: [dir.tv, dir.nv].filter(Boolean).join(' '), numero: dir.pnp || '',
    escalera: li.es || '', planta: li.pt || '', puerta: li.pu || '',
    cp: d.locs?.lous?.lourb?.dp || '', municipio: d.nm || '',
    uso: deb.luso || '', m2: deb.sfc ? Number(deb.sfc) : null, anyo: deb.ant ? Number(deb.ant) : null,
    participacion: deb.cpt || '',
  };
}

export async function porReferencia(rc) {
  const j = await pedir(`${OVC}/COVCCallejero.svc/json/Consulta_DNPRC?RefCat=${encodeURIComponent(rc)}`);
  const r = j.consulta_dnprcResult || {};
  if (r.lerr) throw new Error('Catastro: ' + lista(r.lerr).map((e) => e.des).join('; '));
  if (r.bico) {
    const u = unidad(r.bico.bi);
    const cons = lista(r.bico.lcons).map((c) => ({ uso: c.lcd, m2: Number(c.dfcons?.stl || 0) }));
    return { unidades: [u], construcciones: cons, finca: r.bico.finca?.ltp || '' };
  }
  return { unidades: lista(r.lrcdnp?.rcdnp).map(unidad), construcciones: [], finca: '' };
}

export async function parcelaPorCoordenadas(lat, lon) {
  const j = await pedir(`${OVC}/COVCCoordenadas.svc/json/Consulta_RCCOOR?CoorX=${lon}&CoorY=${lat}&SRS=EPSG:4326`);
  const c = lista(j.Consulta_RCCOORResult?.coordenadas?.coord)[0];
  if (!c) throw new Error('Catastro: no hay finca en esas coordenadas');
  return { parcela: c.pc.pc1 + c.pc.pc2, direccion: c.ldt };
}

// Fincas cercanas a un punto (el Catastro devuelve las de alrededor con su número de portal).
export async function fincasCercanas(lat, lon) {
  const j = await pedir(`${OVC}/COVCCoordenadas.svc/json/Consulta_RCCOOR_Distancia?CoorX=${lon}&CoorY=${lat}&SRS=EPSG:4326`);
  const c = lista(j.Consulta_RCCOOR_DistanciaResult?.coordenadas_distancias?.coordd)[0];
  return lista(c?.lpcd).map((x) => ({ parcela: x.pc.pc1 + x.pc.pc2, numero: x.dt?.lourb?.dir?.pnp || '', direccion: x.ldt, distancia: Number(x.dis) }));
}

const sinAcentos = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
// Calle y número → finca, con el callejero público del Catastro (no depende del mapa).
// municipio: nombre del Catastro («L'HOSPITALET DE LLOBREGAT», «EL PRAT DE LLOBREGAT»…)
export function palabrasCalle(calle = '') {
  return sinAcentos(calle).replace(/['’`´]/g, ' ').replace(/\b(CARRER|CALLE|C|CL|AVINGUDA|AVENIDA|AV|AVDA|PLACA|PLAZA|PL|PZ|PZA|PASSEIG|PASEO|PG|PS|RAMBLA|RBLA|RONDA|TRAVESSERA|PASSATGE|PASAJE|PTGE|CAMI|CAMINO|CTRA|CARRETERA|GRAN|VIA|DE|DEL|DELS|LA|LES|LOS|LAS|EL|ELS|D|L|I|Y)\b/g, ' ').split(/[^A-Z0-9]+/).filter((w) => w.length > 1);
}
export async function fincaPorCallejero(municipio, calle, numero) {
  const palabras = palabrasCalle(calle);
  if (!palabras.length || !numero) return null;
  const clave = [...palabras].sort((a, b) => b.length - a.length)[0];
  const q = (o) => new URLSearchParams({ Provincia: 'BARCELONA', Municipio: municipio, ...o }).toString();
  const j = await pedir(`${OVC}/COVCCallejero.svc/json/ObtenerCallejero?${q({ NomVia: clave })}`);
  const calles = lista(j.consulta_callejeroResult?.callejero?.calle).map((c) => c.dir);
  const buena = calles.find((d) => palabras.every((w) => sinAcentos(d.nv).includes(w))) || (calles.length === 1 ? calles[0] : null);
  if (!buena) return null;
  const n = await pedir(`${OVC}/COVCCallejero.svc/json/ObtenerNumerero?${q({ TipoVia: buena.tv, NomVia: buena.nv, Numero: String(Number(numero)) })}`);
  const nums = lista(n.consulta_numereroResult?.nump).filter((x) => String(Number(x.num?.pnp)) === String(Number(numero)));
  const x = nums.find((y) => !String(y.num?.plp || '').trim()) || nums[0];
  if (!x) return null;
  const parcela = x.pc.pc1 + x.pc.pc2;
  let lat = null, lon = null;
  try {
    const c = await pedir(`${OVC}/COVCCoordenadas.svc/json/Consulta_CPMRC?Provincia=BARCELONA&Municipio=&SRS=EPSG:4326&RefCat=${parcela}`);
    const g = lista(c.Consulta_CPMRCResult?.coordenadas?.coord)[0]?.geo;
    if (g) { lat = Number(g.ycen); lon = Number(g.xcen); }
  } catch {}
  return { parcela, direccion: `${buena.tv} ${buena.nv} ${x.num.pnp}${String(x.num.plp || '').trim()}`, lat, lon, exacta: true, via: 'callejero' };
}

// Desde una dirección del mapa (que puede ser el centro de la calle) hasta la finca del número pedido.
// puntos: el punto del mapa y, si la calle es larga, otros puntos de la calle (esquinas de su recuadro).
export async function fincaPorPortal(puntos, numero, calle = '') {
  const palabras = sinAcentos(calle).replace(/\b(CARRER|CALLE|C|AVINGUDA|AVENIDA|AV|AVDA|PLACA|PLAZA|PZ|PASSATGE|PASAJE|RAMBLA|DE|DEL|LA|LES|LOS|LAS|EL|DELS|D|L)\b/g, ' ').split(/[^A-Z0-9]+/).filter((w) => w.length > 2);
  const vistas = [];
  for (const [lat, lon] of puntos) {
    const fincas = await fincasCercanas(lat, lon);
    vistas.push(...fincas);
    const buena = fincas.find((f) => String(Number(f.numero)) === String(Number(numero)) && (!palabras.length || palabras.some((w) => sinAcentos(f.direccion).includes(w))));
    if (buena) return { ...buena, exacta: true };
  }
  const misma = vistas.filter((f) => !palabras.length || palabras.some((w) => sinAcentos(f.direccion).includes(w)));
  return misma.length ? { ...misma.sort((a, b) => a.distancia - b.distancia)[0], exacta: false } : null;
}

// «ENT», «Pl. 1», «BJS», «PB», «1º» → códigos del Catastro (EN, 01, BJ…)
export function normPlanta(p = '') {
  const s = String(p).toUpperCase().replace(/[ºª.]/g, '').replace(/^PL\s*/, '').trim();
  if (!s) return '';
  if (/^(BJ|BJS|BAJO|BAJOS|PB|B|BX|00|0)$/.test(s)) return 'BJ';
  if (/^(EN|ENT|ENTR|ENTLO|ENTRESUELO|E)$/.test(s)) return 'EN';
  if (/^(PR|PPAL|PRAL|PRINCIPAL)$/.test(s)) return 'PR';
  if (/^(AT|ATICO|ÁTICO)$/.test(s)) return 'AT';
  if (/^\d+$/.test(s)) return s.padStart(2, '0');
  return s;
}
export const normPuerta = (p = '') => {
  const s = String(p).toUpperCase().replace(/^PTA\.?\s*/, '').trim();
  return /^\d+$/.test(s) ? s.padStart(2, '0') : s;
};

// Busca la vivienda concreta. Devuelve un objeto «catastro» para la ficha, con su procedencia y avisos.
export async function investigar({ refCatastral, lat, lon, planta, puerta, escalera, m2Anuncio }) {
  const hoy = new Date().toISOString().slice(0, 10);
  const avisos = [];
  let unidades = [], construcciones = [], finca = '', parcela = '';
  if (refCatastral && refCatastral.length >= 14) {
    ({ unidades, construcciones, finca } = await porReferencia(refCatastral));
    parcela = refCatastral.slice(0, 14);
    if (refCatastral.length === 20 && unidades.length === 1) {
      return resultado(unidades[0], { exacta: true, construcciones, finca, parcela, hoy, avisos, m2Anuncio, total: 1 });
    }
  } else if (lat && lon) {
    ({ parcela } = await parcelaPorCoordenadas(lat, lon));
    ({ unidades } = await porReferencia(parcela));
  } else throw new Error('Sin referencia catastral ni coordenadas');

  const viviendas = unidades.filter((u) => /resid/i.test(u.uso));
  const pl = normPlanta(planta), pu = normPuerta(puerta);
  let c = viviendas.filter((u) => (!pl || u.planta === pl) && (!pu || u.puerta === pu) && (!escalera || !u.escalera || u.escalera === String(escalera)));
  if (c.length > 1 && m2Anuncio) {
    const cerca = c.filter((u) => u.m2 && Math.abs(u.m2 - m2Anuncio) / m2Anuncio < 0.2);
    if (cerca.length) c = cerca;
  }
  if (c.length === 1 && (pl || pu)) return resultado(c[0], { exacta: true, parcela, hoy, avisos, m2Anuncio, total: viviendas.length });
  // No se sabe qué puerta es: datos de la finca (año y rango de superficies)
  avisos.push(pl || pu ? `No se encontró la planta ${planta || '?'} puerta ${puerta || '?'} en la finca: datos de la finca.` : 'El anuncio no dice planta ni puerta: datos de la finca, no del piso.');
  const base = c.length ? c : viviendas;
  const m2s = base.map((u) => u.m2).filter(Boolean).sort((a, b) => a - b);
  const anyos = [...new Set(base.map((u) => u.anyo).filter(Boolean))];
  return {
    exacta: false, rc: null, parcela, uso: 'Residencial',
    direccion: base[0] ? `${base[0].via} ${base[0].numero}` : '', cp: base[0]?.cp || '',
    m2: null, m2Rango: m2s.length ? [m2s[0], m2s[m2s.length - 1]] : null,
    anyo: anyos.length === 1 ? anyos[0] : null, anyos, viviendasFinca: viviendas.length,
    fuente: FUENTE, url: `https://www1.sedecatastro.gob.es/Cartografia/mapa.aspx?refcat=${parcela}`, comprobado: hoy, avisos,
  };
}

function resultado(u, { exacta, construcciones = [], finca = '', parcela, hoy, avisos, m2Anuncio, total }) {
  // El Catastro cuenta m² construidos con zonas comunes: lo normal es que dé un 10-40 % más que el anuncio.
  if (m2Anuncio && u.m2) {
    const r = u.m2 / m2Anuncio;
    if (r > 1.6 || r < 0.85) avisos.push(`ERROR: el anuncio dice ${Math.round(m2Anuncio)} m² y el Catastro ${u.m2} m² (con zonas comunes): no cuadra. ¿Es otro piso o el anuncio está mal?`);
    else if (r > 1.25) avisos.push(`El Catastro da ${u.m2} m² con zonas comunes y el anuncio ${Math.round(m2Anuncio)} m²: diferencia alta pero posible.`);
  }
  if (u.uso && !/resid/i.test(u.uso)) avisos.push(`ERROR: el Catastro dice que el uso es «${u.uso}», no vivienda. Una vivienda en un local no se puede vender ni alquilar como vivienda sin cédula.`);
  return {
    exacta, rc: u.rc, parcela, uso: u.uso,
    direccion: `${u.via} ${u.numero}`.trim(), escalera: u.escalera, planta: u.planta, puerta: u.puerta, cp: u.cp,
    m2: u.m2, anyo: u.anyo, viviendasFinca: total, construcciones, finca,
    fuente: FUENTE, url: `https://www1.sedecatastro.gob.es/CYCBienInmueble/OVCConCiud.aspx?UrbRus=U&RefC=${u.rc}`, comprobado: hoy, avisos,
  };
}
