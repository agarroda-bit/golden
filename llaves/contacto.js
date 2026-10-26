// Fase 2 · Perfil de contacto del ocupante, dentro de cada caso. Solo lo que la persona da, para negociar.
// Lo ven el DUEÑO y el NEGOCIADOR del caso; cada apertura queda en el registro (lo hace el servidor).
// No existen en la app: fotos de personas, redes sociales, DNI, nacionalidad u origen, antecedentes, salud,
// ni datos de vecinos u otras personas. Si alguien lo escribe en una nota, no se bloquea: se avisa.

export const PIDE = { dinero: 'Dinero para irse', plazo: 'Más plazo', mudanza: 'Ayuda con la mudanza', alquiler_social: 'Alquiler social / vivienda', otro: 'Otra cosa' };
export const CANALES = ['En persona', 'Teléfono', 'WhatsApp', 'Carta', 'Otro'];
export const ESTADOS_ACUERDO = ['Sin acuerdo', 'Hablando', 'Propuesta enviada', 'Aceptado de palabra', 'Firmado', 'Llaves entregadas', 'No acepta'];

// Avisos (no bloquean) de datos que no deben guardarse
const PROHIBIDO = [
  [/\b[XYZ]?\d{7,8}[-\s]?[A-Z]\b/i, 'parece un DNI o NIE (el DNI solo va en el acuerdo firmado, como documento)'],
  [/\b(nacionalidad|extranjer[oa]s?|inmigrante|su pa[ií]s|de origen|etnia|gitan[oa]s?|marroqu[ií]|rumano|latino|árabe|africano|sudamerican[oa]|paquistan[ií]|chin[oa]s?)\b/i, 'habla de nacionalidad u origen'],
  [/\b(antecedentes|detenid[oa]|c[aá]rcel|prisi[oó]n|pres[oa]|delincuente|denunciad[oa]|droga|camello)\b/i, 'habla de antecedentes o delitos'],
  [/\b(enferm[oa]|enfermedad|diagn[oó]stic|c[aá]ncer|depresi[oó]n|tratamiento|medicaci[oó]n|discapacidad|minusval|embarazad[ao]|hospital|psiqui)/i, 'habla de salud (para VULNERABLE basta con el número de menores y mayores)'],
  [/(instagram|facebook|tiktok|twitter|linkedin|x\.com|@[a-z0-9_.]{3,})/i, 'habla de redes sociales'],
  [/\b(vecin[oa]s?|portera?|del [0-9]+º|del piso de al lado|cuñad[oa]|sobrin[oa]|herman[oa] de)\b/i, 'habla de otras personas (vecinos o familiares que no son quien negocia)'],
  [/\b(foto|fotograf[ií]a|imagen de (él|ella))\b/i, 'habla de fotos de personas'],
];
export function avisosTexto(texto = '') {
  return PROHIBIDO.filter(([re]) => re.test(texto)).map(([, motivo]) => motivo);
}

// Teléfono → enlace de WhatsApp (si es un móvil español de 9 cifras se le pone el 34)
export function telefonoWa(tel = '') {
  let d = String(tel).replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  else if (d.startsWith('00')) d = d.slice(2);
  else if (/^[6789]\d{8}$/.test(d)) d = '34' + d;
  return d.length >= 9 ? d : null;
}
export const enlaceWa = (tel, texto) => { const t = telefonoWa(tel); return t ? `https://wa.me/${t}?text=${encodeURIComponent(texto)}` : null; };

const miles = (x) => String(Math.round(Number(x) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const lista = (xs) => (xs.length <= 1 ? xs.join('') : xs.slice(0, -1).join(', ') + ' y ' + xs.at(-1));
const pideTexto = (c) => lista((c?.pide || '').split(',').filter(Boolean).map((k) => (PIDE[k] || k).toLowerCase()));

// Plantillas de WhatsApp: cordiales y sin presión, con lo que pidió la persona.
export function plantillasWa({ c = {}, yo = '', calle = '', municipio = '', vulnerable = false, propuesta = null }) {
  const nombre = c.llamar ? ` ${c.llamar}` : '';
  const pide = pideTexto(c);
  const t = [
    { id: 'saludo', titulo: 'Primer saludo', texto: `Hola${nombre}. Soy ${yo || '[tu nombre]'}, el nuevo propietario de la vivienda${calle ? ' de ' + calle : ''}. Me gustaría hablar contigo con calma cuando te venga bien${c.horario ? ` (me dijiste que mejor ${c.horario})` : ''}. Sin ninguna prisa. ¿Te parece?` },
    { id: 'gracias', titulo: 'Después de hablar', texto: `Gracias por atenderme${nombre}. Como te comenté, quiero encontrar una solución que te venga bien a ti también.${pide ? ` Me dijiste que necesitas ${pide}: lo estoy mirando y te digo algo.` : ' Cuando quieras me cuentas qué necesitarías.'}` },
    { id: 'propuesta', titulo: 'Propuesta', texto: `Hola${nombre}. Te propongo${propuesta?.importe ? ` ${miles(propuesta.importe)} € de ayuda para la mudanza` : ' una ayuda para la mudanza'}, que te pagaría el mismo día que me entregues las llaves${propuesta?.salida ? `, con fecha de salida el ${propuesta.salida}` : ''}. Todo por escrito y revisado por un abogado, con testigo o ante notario. Piénsalo con calma y me dices.` },
    { id: 'recordatorio', titulo: 'Recordatorio suave', texto: `Hola${nombre}, ¿has podido pensarlo? Si quieres lo hablamos otra vez; dime cuándo te va bien.` },
  ];
  if (vulnerable) t.push({ id: 'social', titulo: 'Servicios Sociales', texto: `Hola${nombre}. Por si te sirve: los Servicios Sociales${municipio ? ' de ' + municipio : ' del ayuntamiento'} pueden orientarte con la vivienda y ayudas. Si quieres, te ayudo a pedir cita.` });
  return t;
}

// Aviso de protección de datos, corto, para leérselo o mandárselo
export const avisoDatos = (yo = '[tu nombre y teléfono]') =>
  `Para poder hablar contigo de la entrega de la vivienda guardo solo lo que tú me das: cómo quieres que te llame, tu teléfono, idioma, mejor horario, cuántas personas viven y qué necesitas, y un resumen de lo que hablemos. Solo lo vemos yo y la persona que lleva el caso; no lo compartimos con nadie. Se borra 6 meses después de cerrar el caso (el acuerdo firmado, si lo hay, se conserva). Puedes pedirme verlo, corregirlo o borrarlo cuando quieras. Responsable: ${yo}.`;

// ---------- Pintar el perfil dentro de la ficha (modo nube) ----------
const CAMPOS = [['llamar', 'Cómo quiere que le llamen'], ['telefono', 'Teléfono / WhatsApp'], ['idioma', 'Idioma'], ['horario', 'Mejor horario']];
const hoyISO = () => new Date().toISOString().slice(0, 10);
const ddmm = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');

export function pintar({ p, c, $, h, NB, MI, puede, toast, fecha, D }) {
  const caja = $('#contacto'); if (!caja || !c?._id) return;
  if (!puede.contacto(c)) { caja.innerHTML = ''; return; }
  caja.innerHTML = `<h4 style="margin:14px 0 6px">🤝 Perfil de contacto del ocupante</h4>
    <p class="fuente" style="margin:0 0 6px">Solo lo que la persona da, para negociar. Lo ven el dueño y el negociador del caso; abrirlo queda apuntado en el registro.</p>
    <button class="boton" id="abrirContacto">Abrir el perfil de contacto</button>`;
  $('#abrirContacto').onclick = async () => {
    let r;
    try { r = await NB.abrirContacto(c._id); } catch (e) { toast(e.message); return; }
    formulario(r || {});
  };

  function formulario(r) {
    const origen = r.origen || {};
    const muni = D.municipios?.find((m) => m.id === p.municipio)?.nombre || '';
    const calle = p.catastro?.direccion || p.direccion;
    const vul = (r.menores || 0) > 0 || (r.mayores || 0) > 0 || c.vulnerable;
    const pide = (r.pide || '').split(',').filter(Boolean);
    const dijo = (k) => origen[k] ? `<small class="dijo">lo dijo ${h(origen[k].quien)} el ${ddmm(origen[k].fecha)}</small>` : '';
    const borrar = r.borrar_en ? Math.round((new Date(r.borrar_en + 'T12:00:00') - Date.now()) / 864e5) : null;
    caja.innerHTML = `<h4 style="margin:14px 0 6px">🤝 Perfil de contacto del ocupante</h4>
      ${borrar != null && borrar <= 15 ? `<div class="aviso error" id="avisoBorrado">Este perfil se borra automáticamente el ${fecha(r.borrar_en)} (${borrar <= 0 ? 'hoy' : 'en ' + borrar + ' días'}), 6 meses después de cerrar el caso. El acuerdo firmado se conserva.</div>` : r.borrar_en ? `<p class="fuente">Se borrará el ${fecha(r.borrar_en)}.</p>` : ''}
      ${vul ? `<div class="aviso vul"><b>VULNERABLE.</b> ${h(D.legal?.vulnerables?.llano?.slice(0, 420) || 'Con menores o personas mayores los plazos cambian y el juzgado pide informe de Servicios Sociales.')}… <b>Recomendación: Servicios Sociales del municipio y hablarlo con el abogado.</b></div>` : ''}
      <div class="form contacto">
        <div><label>Lo que guardes ahora lo ha dicho</label><div class="dos"><select id="ctQuien"><option>él</option><option>ella</option><option>la persona</option></select><input type="date" id="ctFecha" value="${hoyISO()}"></div></div>
        ${CAMPOS.map(([k, t]) => `<div><label>${t} ${dijo(k)}</label><input data-c="${k}" value="${h(r[k] || '')}" autocomplete="off" ${k === 'telefono' ? 'inputmode="tel"' : ''}></div>`).join('')}
        ${r.telefono && telefonoWa(r.telefono) ? `<a class="boton" href="https://wa.me/${telefonoWa(r.telefono)}" target="_blank" rel="noopener">💬 Abrir WhatsApp</a>` : ''}
        <div><label>Cuántas personas viven (solo el número) ${dijo('adultos')}</label><div class="tres">
          <label>Adultos <input data-c="adultos" type="number" min="0" max="30" value="${r.adultos ?? ''}"></label>
          <label>Menores <input data-c="menores" type="number" min="0" max="30" value="${r.menores ?? ''}"></label>
          <label>Mayores de 65 <input data-c="mayores" type="number" min="0" max="30" value="${r.mayores ?? ''}"></label></div>
          <small class="fuente">Si hay menores o mayores, el caso se marca VULNERABLE.</small></div>
        <div><label>Qué pide ${dijo('pide')}</label><div class="chips-pide">${Object.entries(PIDE).map(([k, t]) => `<label class="chip ${pide.includes(k) ? 'on' : ''}"><input type="checkbox" data-pide="${k}" ${pide.includes(k) ? 'checked' : ''} hidden>${h(t)}</label>`).join('')}</div></div>
        <label class="aviso abogado" style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" id="ctInformado" ${r.informado ? 'checked' : ''} style="width:20px;height:20px;margin-top:2px"> <span>Le he informado de que guardamos estos datos para la negociación${r.informado_en ? ` (el ${fecha(r.informado_en)})` : ''}. <a href="#" id="verAviso">Ver el aviso para leérselo o mandárselo</a></span></label>
        <div id="cajaAviso" class="oculto"><p class="fuente" id="textoAviso"></p><div class="botones"><button class="boton" id="copiarAviso">Copiar</button>${r.telefono && telefonoWa(r.telefono) ? `<a class="boton" target="_blank" rel="noopener" href="${enlaceWa(r.telefono, avisoDatos(MI.email))}">Mandar por WhatsApp</a>` : ''}</div></div>
        <div class="botones"><button class="boton oro" id="ctGuardar">Guardar perfil</button></div>
      </div>
      <h4 style="margin:16px 0 6px">Historial de contactos</h4>
      <table class="t"><tr><th>Fecha</th><th>Quién · canal</th><th>Resumen</th></tr>${(r.historial || []).slice().reverse().map((x) => `<tr><td class="num">${fecha(x.fecha)}</td><td>${h(x.quien)} · ${h(x.canal)}</td><td>${h(x.resumen)}</td></tr>`).join('') || '<tr><td colspan="3" class="fuente">Aún nada.</td></tr>'}</table>
      <div class="form" style="margin-top:6px"><div class="dos"><select id="hCanal">${CANALES.map((x) => `<option>${x}</option>`).join('')}</select><input type="date" id="hFecha" value="${hoyISO()}"></div>
        <textarea id="hResumen" rows="2" placeholder="Resumen de lo hablado (sin nombres de otras personas, salud, origen ni antecedentes)"></textarea><div id="hAviso"></div>
        <div class="botones"><button class="boton" id="hAnadir">Añadir contacto</button></div></div>
      <h4 style="margin:16px 0 6px">Ofertas y respuestas</h4>
      <table class="t"><tr><th>Fecha</th><th class="n">Importe</th><th>Respuesta</th></tr>${(r.ofertas || []).map((x, i) => `<tr><td class="num">${fecha(x.fecha)}</td><td class="n">${miles(x.importe)} €</td><td><input data-resp="${i}" value="${h(x.respuesta || '')}" placeholder="Qué contestó"></td></tr>`).join('') || '<tr><td colspan="3" class="fuente">Aún ninguna.</td></tr>'}</table>
      <div class="dos" style="margin-top:6px"><input id="oImporte" type="number" inputmode="numeric" placeholder="Importe ofrecido (€)"><button class="boton" id="oAnadir">Añadir oferta</button></div>
      <h4 style="margin:16px 0 6px">Acuerdo</h4>
      <div class="form"><div class="dos"><div><label>Estado</label><select id="aEstado">${ESTADOS_ACUERDO.map((x) => `<option ${r.acuerdo?.estado === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div><div><label>Importe (€)</label><input id="aImporte" type="number" value="${h(r.acuerdo?.importe ?? '')}"></div></div>
        <div class="dos"><div><label>Fecha de salida</label><input id="aSalida" type="date" value="${h(r.acuerdo?.salida || '')}"></div><div><label>Fecha de llaves</label><input id="aLlaves" type="date" value="${h(r.acuerdo?.llaves || '')}"></div></div>
        <p class="fuente">El dinero se paga solo al recibir las llaves, con testigo o ante notario, y el acuerdo lo revisa un abogado. El acuerdo firmado se sube en «Documentos».</p></div>
      <h4 style="margin:16px 0 6px">Mensajes de WhatsApp</h4>
      <div class="lista">${plantillasWa({ c: r, yo: MI.email, calle, municipio: muni, vulnerable: vul, propuesta: { importe: r.acuerdo?.importe || (r.ofertas || []).at(-1)?.importe, salida: r.acuerdo?.salida } }).map((t) => `<div class="bloque" style="padding:10px;margin:0"><b>${h(t.titulo)}</b><p style="margin:6px 0;font-size:14px">${h(t.texto)}</p><div class="botones" style="margin-top:4px">${r.telefono && telefonoWa(r.telefono) ? `<a class="boton" target="_blank" rel="noopener" href="${enlaceWa(r.telefono, t.texto)}">Abrir en WhatsApp</a>` : ''}<button class="boton" data-copiar="${h(t.texto)}">Copiar</button></div></div>`).join('')}</div>`;

    const valor = (k) => { const e = caja.querySelector(`[data-c="${k}"]`); return e.type === 'number' ? (e.value === '' ? null : Number(e.value)) : e.value.trim(); };
    const sello = () => ({ quien: $('#ctQuien').value, fecha: $('#ctFecha').value || hoyISO() });
    const guardarCon = async (cambios, msg = 'Guardado') => {
      try { const nuevo = await NB.guardarContacto(c._id, cambios); toast(msg); if ((nuevo.menores || 0) > 0 || (nuevo.mayores || 0) > 0) c.vulnerable = true; formulario(nuevo); } catch (e) { toast(e.message); }
    };
    caja.querySelectorAll('[data-pide]').forEach((x) => x.onchange = () => x.parentElement.classList.toggle('on', x.checked));
    $('#verAviso').onclick = (e) => { e.preventDefault(); $('#textoAviso').textContent = avisoDatos(MI.email); $('#cajaAviso').classList.toggle('oculto'); };
    $('#copiarAviso').onclick = () => navigator.clipboard?.writeText(avisoDatos(MI.email)).then(() => toast('Copiado'));
    caja.querySelectorAll('[data-copiar]').forEach((b) => b.onclick = () => navigator.clipboard?.writeText(b.dataset.copiar).then(() => toast('Copiado')));
    $('#hResumen').oninput = () => { const a = avisosTexto($('#hResumen').value); $('#hAviso').innerHTML = a.length ? `<div class="aviso ojo">Esto no debería guardarse: ${a.map(h).join('; ')}. Puedes guardarlo igual, pero mejor quítalo.</div>` : ''; };
    $('#ctGuardar').onclick = () => {
      const cambios = {}, org = {};
      for (const [k] of CAMPOS) { const v = valor(k); if ((r[k] || '') !== v) { cambios[k] = v; org[k] = sello(); } }
      for (const k of ['adultos', 'menores', 'mayores']) { const v = valor(k); if ((r[k] ?? null) !== v) { cambios[k] = v; org.adultos = sello(); } }
      const pide2 = [...caja.querySelectorAll('[data-pide]:checked')].map((x) => x.dataset.pide).join(',');
      if ((r.pide || '') !== pide2) { cambios.pide = pide2; org.pide = sello(); }
      const inf = $('#ctInformado').checked;
      if (inf !== !!r.informado) { cambios.informado = inf; cambios.informado_en = inf ? hoyISO() : null; }
      const acu = { estado: $('#aEstado').value, importe: $('#aImporte').value ? Number($('#aImporte').value) : null, salida: $('#aSalida').value || null, llaves: $('#aLlaves').value || null };
      if (JSON.stringify(acu) !== JSON.stringify({ estado: r.acuerdo?.estado || 'Sin acuerdo', importe: r.acuerdo?.importe ?? null, salida: r.acuerdo?.salida || null, llaves: r.acuerdo?.llaves || null })) cambios.acuerdo = acu;
      const resp = [...caja.querySelectorAll('[data-resp]')]; if (resp.some((x) => (r.ofertas[x.dataset.resp].respuesta || '') !== x.value)) cambios.ofertas = r.ofertas.map((o, i) => ({ ...o, respuesta: resp[i]?.value ?? o.respuesta }));
      const malos = Object.values(cambios).filter((v) => typeof v === 'string').flatMap((v) => avisosTexto(v));
      if (malos.length && !confirm('Ojo, esto no debería guardarse: ' + malos.join('; ') + '. ¿Guardar igualmente?')) return;
      if (!Object.keys(cambios).length) return toast('No hay cambios');
      if (Object.keys(org).length) cambios.origen = org;
      guardarCon(cambios);
    };
    $('#hAnadir').onclick = () => {
      const resumen = $('#hResumen').value.trim(); if (!resumen) return toast('Escribe un resumen');
      const a = avisosTexto(resumen); if (a.length && !confirm('Ojo, esto no debería guardarse: ' + a.join('; ') + '. ¿Guardar igualmente?')) return;
      guardarCon({ historial: [...(r.historial || []), { fecha: $('#hFecha').value || hoyISO(), quien: MI.email, canal: $('#hCanal').value, resumen }] }, 'Contacto añadido');
    };
    $('#oAnadir').onclick = () => {
      const imp = Number($('#oImporte').value); if (!imp) return toast('Pon el importe');
      guardarCon({ ofertas: [...(r.ofertas || []), { fecha: hoyISO(), importe: imp, respuesta: '' }] }, 'Oferta añadida');
    };
  }
}
