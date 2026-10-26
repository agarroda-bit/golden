// Valoración, calculadora y semáforo. Sin dependencias: lo usan la recogida (Node) y la web (navegador).

// Tipos de oportunidad. Meses: espera hasta tener las llaves en cada escenario.
//   rápido = acuerdo voluntario de llaves; normal ≈ duración media del juicio según el CGPJ (Cataluña 2023);
//   largo = juicio + recursos o suspensión por vulnerabilidad. Son SUPUESTOS que Rodri cambia en la ficha;
//   las fuentes y explicaciones están en datos/legal.json (pestaña «Guía legal»).
export const TIPOS = {
  usurpacion: { nombre: 'Ocupación sin título', corto: 'Ocupado', riesgo: 'Alto', meses: [3, 12, 24], descuento: 0.30 },          // CGPJ: 11,8 meses verbales por ocupación ilegal
  inquiokupa: { nombre: 'Inquilino que no paga o con contrato vencido', corto: 'Inquiokupa', riesgo: 'Medio-alto', meses: [3, 9, 20], descuento: 0.25 }, // CGPJ: 8,2 meses verbales arrendaticios
  sin_posesion: { nombre: '«Sin posesión» (el banco no tiene las llaves)', corto: 'Sin posesión', riesgo: 'Alto', meses: [4, 14, 36], descuento: 0.30 },
  subasta: { nombre: 'Subasta', corto: 'Subasta', riesgo: 'Alto', meses: [4, 12, 30], descuento: 0.25 },
  alquiler_social: { nombre: 'Alquiler social obligatorio', corto: 'Alquiler social', riesgo: 'Muy alto', meses: [12, 36, 84], descuento: 0.50 },
  nuda_propiedad: { nombre: 'Nuda propiedad (otra persona tiene el usufructo)', corto: 'Nuda propiedad', riesgo: 'Alto', meses: [24, 120, 240], descuento: 0.40 },
  proindiviso: { nombre: 'Proindiviso: se vende solo una parte del piso', corto: 'Una parte (%)', riesgo: 'Muy alto', meses: [12, 30, 60], descuento: 0.45 },
  credito: { nombre: 'Compra del crédito o cesión de remate', corto: 'Crédito / remate', riesgo: 'Muy alto', meses: [6, 18, 40], descuento: 0.35 },
  desconocido: { nombre: 'Ocupado o en situación especial, sin detallar', corto: 'Sin detallar', riesgo: 'Desconocido', meses: [3, 12, 30], descuento: 0.30 },
};

export const AJUSTES_INICIALES = {
  llaves: 3000,          // TÚ: compensación por entregar las llaves (acuerdo voluntario)
  reformaM2: 350,        // TÚ: reforma en €/m²
  gastosMes: 120,        // TÚ: comunidad + IBI + seguro + suministros mínimos al mes
  abogado: 2500,         // TÚ: abogado (y procurador si hace falta)
  notariaRegistro: 1200, // Notaría (400-800 €), registro (150-300 €) y gestoría: orientativo, ver legal.json
  itp: 0.10,             // ITP de vivienda en Cataluña, tipo general hasta 600.000 € (ATC, comprobado 25/10/2026)
  valorReferencia: null, // TÚ: valor de referencia del Catastro; si es mayor que la oferta, el ITP se paga sobre él
  deudas: 0,             // TÚ: deudas de IBI y comunidad (pedir certificado)
  margenObjetivo: 0.20,  // TÚ: lo que quieres ganar como mínimo sobre el valor libre
  extraLargoAbogado: 1500, // en el escenario largo: juicio completo
};

const distanciaKm = (a, b) => { const r = Math.PI / 180, x = (b.lon - a.lon) * r * Math.cos(((a.lat + b.lat) / 2) * r), y = (b.lat - a.lat) * r; return Math.sqrt(x * x + y * y) * 6371; };
const mediana = (xs) => { const s = [...xs].sort((a, b) => a - b); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
const cuartil = (xs, q) => { const s = [...xs].sort((a, b) => a - b); if (!s.length) return null; const i = (s.length - 1) * q; const lo = Math.floor(i); return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo); };
export const redondear = (x, a = 100) => (x == null || isNaN(x) ? null : Math.round(x / a) * a);

// Valor libre estimado: comparables de la misma fuente pública (pisos libres del mismo municipio)
// y el valor tasado oficial del Ministerio. Si no cuadran, se dice.
export function valorLibre(piso, comparables, ministerio) {
  // Superficie: la del anuncio, que es la misma medida que la de los comparables (pisos de las mismas webs).
  // El Catastro da m² construidos CON zonas comunes: sirve para comprobar, no para multiplicar.
  // Si el anuncio dice MÁS que el Catastro (que ya incluye zonas comunes), no cuadra: se usa la cifra menor, por prudencia.
  const mc = piso.catastro?.exacta ? piso.catastro.m2 : null;
  let m2 = piso.m2Anuncio || mc || null;
  let origenM2 = piso.m2Anuncio ? 'anuncio' : 'Catastro (con zonas comunes: el valor puede salir alto)';
  if (piso.m2Anuncio && mc && mc < piso.m2Anuncio * 0.85) { m2 = mc; origenM2 = `Catastro (el anuncio dice ${Math.round(piso.m2Anuncio)} m²; se usa la cifra menor)`; }
  const avisos = [];
  const comps = (comparables || []).filter((c) => c.municipio === piso.municipio && c.eurM2 > 500 && c.eurM2 < 9000);
  // Cerca (≤ 1,5 km) si hay 5 o más; si no, todo el municipio. Y entre ellos, superficie parecida (±40 %) si quedan 5.
  let base = comps, donde = 'del mismo municipio';
  if (piso.lat && piso.lon) {
    for (const km of [0.8, 1.2, 1.5]) {
      const cerca = comps.filter((c) => c.lat && c.lon && distanciaKm(piso, c) <= km);
      if (cerca.length >= 5) { base = cerca; donde = `a menos de ${String(km).replace('.', ',')} km`; break; }
    }
  }
  let usados = m2 ? base.filter((c) => Math.abs(c.m2 - m2) / m2 <= 0.4) : base;
  let criterio = `pisos libres ${donde} con superficie parecida (±40 %)`;
  if (usados.length < 5) { usados = base; criterio = `todos los pisos libres ${donde} (pocos de superficie parecida)`; }
  if (donde === 'del mismo municipio' && usados.length >= 5) avisos.push('Comparables de todo el municipio (no hay 5 cerca): en los barrios más baratos el valor real puede ser menor.');
  const eur = usados.map((c) => c.eurM2);
  const med = mediana(eur);
  const min = ministerio?.municipios?.[piso.municipio];
  const oficial = min?.mas5 || min?.total || null;
  let eurM2 = null, metodo = '';
  if (eur.length >= 5) { eurM2 = med; metodo = `Mediana de ${eur.length} comparables`; }
  else if (oficial) { eurM2 = oficial; metodo = `Solo valor oficial del Ministerio (hay ${eur.length} comparables, hacen falta 5)`; avisos.push('Pocos comparables: el valor sale solo del dato oficial del municipio (tasaciones), que suele ir por encima del precio real en pisos viejos.'); }
  if (eurM2 && oficial && eur.length >= 5 && Math.abs(med - oficial) / oficial > 0.35) avisos.push(`Los comparables (${Math.round(med)} €/m²) y el Ministerio (${Math.round(oficial)} €/m²) se separan más de un 35 %: comprobar a mano.`);
  if (!m2) avisos.push('ERROR: no hay superficie ni en el anuncio ni en el Catastro; no se puede valorar.');
  // Confianza del valor: cuántos comparables hay a menos de 1,5 km
  const cerca15 = piso.lat && piso.lon ? comps.filter((c) => c.lat && c.lon && distanciaKm(piso, c) <= 1.5).length : 0;
  const soloMinisterio = eur.length < 5;
  const confianza = soloMinisterio || cerca15 < 5
    ? { nivel: 'BAJA', cerca: cerca15, motivo: soloMinisterio ? `solo el dato del Ministerio (hay ${eur.length} comparables en el municipio)` : `${cerca15} comparable${cerca15 === 1 ? '' : 's'} a menos de 1,5 km (hacen falta 5)${piso.lat ? '' : '; el piso no tiene coordenadas'}` }
    : cerca15 >= 8 ? { nivel: 'ALTA', cerca: cerca15, motivo: `${cerca15} comparables a menos de 1,5 km` }
      : { nivel: 'MEDIA', cerca: cerca15, motivo: `${cerca15} comparables a menos de 1,5 km (con 8 sería alta)` };

  // Proindiviso: solo se compra una parte del piso
  const cuota = piso.cuota && piso.cuota > 0 && piso.cuota < 1 ? piso.cuota : 1;
  if (cuota < 1) avisos.push(`Se vende solo el ${(cuota * 100).toLocaleString('es-ES', { maximumFractionDigits: 2 })} % del piso: el valor libre es esa parte del total. Para tener el piso entero hay que comprar el resto o ir a una división de la cosa común (CONSULTAR ABOGADO).`);
  return {
    m2, origenM2, eurM2: eurM2 ? Math.round(eurM2) : null, cuota, valorEntero: m2 && eurM2 ? redondear(m2 * eurM2, 500) : null, valor: m2 && eurM2 ? redondear(m2 * eurM2 * cuota, 500) : null, metodo: metodo + (cuota < 1 ? ` × ${(cuota * 100).toLocaleString('es-ES', { maximumFractionDigits: 2 })} % que se vende` : ''), criterio,
    comparables: { n: eur.length, mediana: med ? Math.round(med) : null, p25: eur.length ? Math.round(cuartil(eur, 0.25)) : null, p75: eur.length ? Math.round(cuartil(eur, 0.75)) : null, muestra: usados.slice(0, 12) },
    confianza,
    oficial: oficial ? { eurM2: Math.round(oficial), periodo: ministerio.periodo, fuente: ministerio.fuente, url: ministerio.url, tasaciones: min.tasaciones_mas5 || min.tasaciones } : null,
    avisos,
  };
}

// Calculadora: valor libre − descuento = precio objetivo; menos costes = PRECIO MÁXIMO DE OFERTA.
export function calcular(piso, ajustesPiso = {}) {
  const a = { ...AJUSTES_INICIALES, ...ajustesPiso };
  const t = TIPOS[piso.tipo] || TIPOS.desconocido;
  const valor = ajustesPiso.valorLibre ?? piso.valor?.valor;
  const m2 = piso.valor?.m2 || piso.m2Anuncio || 0;
  const descuento = ajustesPiso.descuento ?? t.descuento;
  const meses = ajustesPiso.meses || t.meses;
  if (!valor) return { error: 'Sin valor libre no se puede calcular', escenarios: [] };
  const objetivo = valor * (1 - descuento);
  const escenarios = ['rápido', 'normal', 'largo'].map((nombre, i) => {
    const fijos = {
      llaves: a.llaves,
      notariaRegistro: a.notariaRegistro,
      deudas: a.deudas,
      reforma: a.reformaM2 * m2,
      espera: meses[i] * a.gastosMes,
      abogado: a.abogado + (i === 2 ? a.extraLargoAbogado : 0),
    };
    const sumaFijos = Object.values(fijos).reduce((x, y) => x + y, 0);
    // Si se compra al precio que piden: cuánto se gana
    const pide = ajustesPiso.precioPedido || piso.precio || null;
    const costePedido = pide ? pide + a.itp * Math.max(pide, a.valorReferencia || 0) + sumaFijos : null;
    const margenPedido = pide ? valor - costePedido : null;
    // oferta + ITP + fijos = objetivo; el ITP va sobre la oferta o sobre el valor de referencia si es mayor
    let oferta = Math.max(0, (objetivo - sumaFijos) / (1 + a.itp));
    if (a.valorReferencia && a.valorReferencia > oferta) oferta = Math.max(0, objetivo - sumaFijos - a.itp * a.valorReferencia);
    const baseItp = Math.max(oferta, a.valorReferencia || 0);
    const itp = baseItp * a.itp;
    const costeTotal = oferta + itp + sumaFijos;
    const margen = valor - costeTotal;
    const filas = [
      { concepto: 'Valor libre estimado', importe: valor },
      { concepto: `Descuento por ocupación (${Math.round(descuento * 100)} %)`, importe: -valor * descuento },
      { concepto: 'Precio objetivo (lo que vale para ti ocupado)', importe: objetivo, subtotal: true },
      { concepto: 'Compensación por llaves', importe: -fijos.llaves, tuyo: true },
      { concepto: `ITP Cataluña (${Math.round(a.itp * 1000) / 10} % sobre ${baseItp > oferta ? 'el valor de referencia' : 'la oferta'})`, importe: -itp },
      { concepto: 'Notaría, registro y gestoría', importe: -fijos.notariaRegistro },
      { concepto: 'Deudas de IBI y comunidad', importe: -fijos.deudas, tuyo: true },
      { concepto: `Reforma (${a.reformaM2} €/m² × ${Math.round(m2)} m²)`, importe: -fijos.reforma, tuyo: true },
      { concepto: `Espera: ${meses[i]} meses × ${a.gastosMes} €`, importe: -fijos.espera, tuyo: true },
      { concepto: 'Abogado' + (i === 2 ? ' (con juicio completo)' : ''), importe: -fijos.abogado, tuyo: true },
      { concepto: 'PRECIO MÁXIMO DE OFERTA (redondeado a 500 € hacia abajo)', importe: Math.floor(oferta / 500) * 500, total: true },
    ];
    return { nombre, meses: meses[i], bajo70: oferta < 0.7 * valor, oferta: Math.floor(oferta / 500) * 500, costeTotal: Math.round(costeTotal), margen: Math.round(margen), margenPct: costeTotal ? margen / costeTotal : 0,
      costePedido: costePedido && Math.round(costePedido), margenPedido: margenPedido == null ? null : Math.round(margenPedido), margenPedidoPct: costePedido ? margenPedido / costePedido : null,
      // Rentabilidad al año = margen ÷ coste total ÷ (meses ÷ 12). Con menos de un mes se cuenta 1 (si no, sale disparada).
      rentAnual: costeTotal ? margen / costeTotal / (Math.max(meses[i], 1) / 12) : null,
      rentAnualPedido: costePedido ? margenPedido / costePedido / (Math.max(meses[i], 1) / 12) : null, filas };
  });
  return { valor, objetivo, descuento, ajustes: a, escenarios };
}

// Semáforo con el motivo en una frase.
export function semaforo(piso, calc) {
  const errores = (piso.errores || []).length;
  const normal = calc?.escenarios?.[1];
  if (piso.vulnerable) return { color: 'ROJO', motivo: 'Caso VULNERABLE: los plazos cambian y hay que pasar por Servicios Sociales; no es una compra rápida.' };
  if (piso.catastro?.uso && !/resid/i.test(piso.catastro.uso)) return { color: 'ROJO', motivo: `El Catastro dice uso «${piso.catastro.uso}», no vivienda.` };
  if (!normal) return { color: 'ROJO', motivo: 'No se puede valorar: faltan datos (ver errores).' };
  const pide = piso.precio, max = normal.oferta;
  if (max <= 0) return { color: 'ROJO', motivo: 'Con estos costes no hay precio que deje margen.' };
  const ratio = pide / max;
  const baja = piso.valor?.confianza?.nivel === 'BAJA';
  if (ratio > 1.4) return { color: 'ROJO', motivo: `Piden ${eur(pide)} y lo máximo razonable es ${eur(max)}: habría que bajarles más de un 30 %.` };
  if (ratio <= 1 && !errores && piso.catastro?.exacta && !baja && (piso.valor?.comparables?.n || 0) >= 5) return { color: 'VERDE', motivo: `El precio pedido (${eur(pide)}) ya está por debajo del máximo de oferta (${eur(max)}) en el escenario normal.` };
  if (ratio <= 1) return { color: 'AMARILLO', motivo: `Sale a cuenta (${eur(pide)} ≤ ${eur(max)}), pero hay datos por confirmar (${errores ? 'errores' : !piso.catastro?.exacta ? 'piso exacto en Catastro' : baja ? 'confianza del valor BAJA: ' + piso.valor.confianza.motivo : 'pocos comparables'}).` };
  return { color: 'AMARILLO', motivo: `Piden ${eur(pide)}; tendría sentido ofertando ${eur(max)} o menos (un ${Math.round((1 - 1 / ratio) * 100)} % menos).` };
}

// Siempre con punto de millar (toLocaleString('es-ES') no lo pone en 4 cifras: «3000 €»)
export const miles = (x) => String(Math.round(Math.abs(x))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
export const eur = (x) => (x == null || isNaN(x) ? '—' : (x < 0 ? '−' : '') + miles(x) + ' €');
