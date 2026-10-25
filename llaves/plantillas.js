// Plantillas descargables, rellenas con los datos del piso. Se bajan como .doc (Word y Pages las abren).
// Reglas de siempre: acuerdo voluntario, por escrito, revisado por un abogado, pago al entregar las llaves,
// con testigo o ante notario. Nada de presiones, amenazas, cortes de suministro ni empresas «desokupa».
const h = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const eur = (x) => (x == null ? '________ €' : String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' €');
const hoy = () => new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

export const PLANTILLAS = [
  { id: 'oferta', nombre: 'Carta de oferta al banco o propietario' },
  { id: 'guion', nombre: 'Guion de la primera conversación' },
  { id: 'acuerdo', nombre: 'Borrador de acuerdo de entrega de llaves' },
];

const envolver = (titulo, cuerpo, marca) => `<!doctype html><html><head><meta charset="utf-8"><title>${h(titulo)}</title>
<style>body{font-family:Georgia,'Times New Roman',serif;font-size:12pt;line-height:1.5;max-width:17cm;margin:2cm auto;color:#111}
h1{font-size:16pt;margin:0 0 12pt}h2{font-size:13pt;margin:16pt 0 6pt}.marca{border:2px solid #b00;color:#b00;padding:6pt 10pt;font-weight:bold;margin-bottom:14pt;text-align:center}
.hueco{background:#fff3a8}li{margin-bottom:4pt}.nota{font-size:10pt;color:#555;border-top:1px solid #ccc;margin-top:24pt;padding-top:8pt}</style></head>
<body>${marca ? `<div class="marca">${marca}</div>` : ''}${cuerpo}</body></html>`;

export function plantilla(id, { p, caso = {}, legal, municipio }) {
  const c = p.catastro || {};
  const dir = c.exacta ? `${c.direccion}${c.escalera ? ', escalera ' + c.escalera : ''}${c.planta ? ', planta ' + c.planta : ''}${c.puerta ? ', puerta ' + c.puerta : ''}` : p.direccion;
  const ref = c.rc || '<span class="hueco">[referencia catastral]</span>';
  const anuncio = (p.enlaces || []).map((e) => `${e.fuente}: ${e.url}`).join('; ');
  const oferta = p.calc?.escenarios?.[1]?.oferta ?? p.ofertaMax;
  const nombreArchivo = (s) => `${s}-${(c.rc || p.id).replace(/[^A-Za-z0-9]/g, '').slice(0, 20)}.doc`;

  if (id === 'oferta') {
    return {
      archivo: nombreArchivo('oferta'),
      html: envolver('Oferta de compra', `
<p><span class="hueco">[Tu nombre y apellidos]</span><br><span class="hueco">[DNI]</span> · <span class="hueco">[teléfono]</span> · <span class="hueco">[correo]</span></p>
<p>A la atención de ${h(p.fuente === 'A mano' ? 'la propiedad' : p.fuente)}<br>Referencia del anuncio: ${h(anuncio || '[enlace]')}</p>
<p>${h(municipio)}, ${hoy()}</p>
<h1>Oferta de compra</h1>
<p>Me dirijo a ustedes para presentar una oferta de compra sobre la vivienda situada en <b>${h(dir)}</b>, ${h(municipio)}, referencia catastral <b>${ref}</b>.</p>
<p>Conozco que la vivienda no está libre de ocupantes (situación indicada en el anuncio: «${h(p.situacionFuente || 'situación especial')}») y que no es posible visitarla por dentro. Por ese motivo, y teniendo en cuenta el tiempo y los costes necesarios hasta disponer de la posesión, ofrezco:</p>
<p style="font-size:14pt"><b>Precio ofertado: <span class="hueco">${eur(oferta)}</span></b> (${eur(p.precio)} es el precio publicado).</p>
<h2>Condiciones</h2>
<ol>
<li>La compra se hace en el estado posesorio actual, sin que la propiedad tenga que entregar la vivienda libre.</li>
<li>Antes de firmar arras, la propiedad facilitará: nota simple actualizada del Registro, certificado de deuda de la comunidad de propietarios (art. 9 de la Ley de Propiedad Horizontal), último recibo de IBI e información de cualquier procedimiento judicial en curso sobre la vivienda.</li>
<li>La vivienda se transmitirá libre de cargas y embargos, y con las deudas de comunidad e IBI anteriores a la venta a cargo de la propiedad o descontadas del precio.</li>
<li>Pago mediante transferencia o cheque bancario en el acto de la escritura ante notario.</li>
<li>Esta oferta es válida durante 15 días naturales desde hoy.</li>
</ol>
<p>Quedo a su disposición para cualquier aclaración.</p>
<p>Atentamente,</p><p><br><span class="hueco">[firma]</span></p>
<div class="nota">Antes de enviarla: revisa el precio con la calculadora (escenario normal) y, si es tu primera compra, enséñasela a tu abogado.</div>`),
    };
  }

  if (id === 'guion') {
    return {
      archivo: nombreArchivo('guion-conversacion'),
      html: envolver('Guion de la primera conversación', `
<h1>Guion de la primera conversación con las personas que viven en la vivienda</h1>
<p><b>Vivienda:</b> ${h(dir)}, ${h(municipio)}</p>
<p><b>Antes de ir:</b> ya eres el propietario (escritura firmada). Ve de día, sin prisa, solo o con una persona de confianza, nunca en grupo. No entres si no te invitan. Lleva por escrito tu teléfono y una copia de la nota simple a tu nombre.</p>
<h2>1. Presentarte</h2>
<p>«Hola, buenos días. Me llamo <span class="hueco">[tu nombre]</span>. Soy el nuevo propietario de esta vivienda; la he comprado al <span class="hueco">[banco / anterior propietario]</span>. Vengo solo a presentarme y a hablar con calma, sin ninguna prisa.»</p>
<h2>2. Escuchar</h2>
<p>«Me gustaría conocer vuestra situación y saber qué planes tenéis.» Escucha sin interrumpir. <b>No apuntes nombres ni datos personales</b>: solo lo que ellos te den voluntariamente para seguir hablando (por ejemplo, un teléfono).</p>
<p>Si te cuentan que hay niños, personas mayores o una situación difícil: «Entiendo. Hay ayudas de los Servicios Sociales del Ayuntamiento que pueden orientaros; si queréis, os paso el contacto.» Marca el caso como VULNERABLE en LLAVES y habla con tu abogado antes de seguir.</p>
<h2>3. Proponer, sin presión</h2>
<p>«Mi idea es llegar a un acuerdo que os venga bien a vosotros también: una fecha razonable para dejar la vivienda y una ayuda económica para la mudanza, que os pagaría el mismo día que me entreguéis las llaves, todo por escrito y con un abogado o ante notario.»</p>
<p>«No hace falta que me contestéis hoy. Os dejo mi teléfono y lo pensáis tranquilamente.»</p>
<h2>4. Despedirte</h2>
<p>«Gracias por atenderme. Cualquier duda, me llamáis.»</p>
<h2>Nunca</h2>
<ul><li>Amenazar, presionar, levantar la voz ni insistir si dicen que no.</li><li>Cortar el agua, la luz o el gas, cambiar la cerradura con gente dentro ni entrar sin permiso.</li><li>Ir con personas o empresas de «desokupación».</li><li>Pagar nada por adelantado sin entregar las llaves.</li></ul>
<p>Todo eso puede ser delito (coacciones, allanamiento) y además anula cualquier acuerdo.</p>
<div class="nota">Después de la conversación, apunta en LLAVES la fecha y lo que se ha hablado (sin datos personales) y el siguiente paso.</div>`),
    };
  }

  // acuerdo
  return {
    archivo: nombreArchivo('borrador-acuerdo-llaves'),
    html: envolver('Borrador de acuerdo de entrega de llaves', `
<h1>ACUERDO PRIVADO DE ENTREGA VOLUNTARIA DE LA POSESIÓN</h1>
<p>En ${h(municipio)}, a <span class="hueco">[fecha]</span>.</p>
<h2>Reunidos</h2>
<p>De una parte, <span class="hueco">[nombre, DNI y domicilio del propietario]</span>, en adelante «la Propiedad».</p>
<p>De otra parte, <span class="hueco">[nombre y documento de identidad de cada persona que vive en la vivienda y firma]</span>, en adelante «los Ocupantes». (Estos datos solo los pone el abogado el día de la firma, con su consentimiento.)</p>
<h2>Exponen</h2>
<ol><li>Que la Propiedad es titular de la vivienda situada en <b>${h(dir)}</b>, ${h(municipio)}, referencia catastral <b>${ref}</b>, según la escritura de <span class="hueco">[fecha]</span> ante el notario <span class="hueco">[nombre]</span>.</li>
<li>Que los Ocupantes residen actualmente en la vivienda y, de forma libre y voluntaria, desean dejarla y entregar la posesión en las condiciones de este acuerdo.</li></ol>
<h2>Acuerdan</h2>
<ol>
<li><b>Entrega.</b> Los Ocupantes dejarán la vivienda vacía de personas y de sus enseres, y entregarán todas las llaves a la Propiedad, como muy tarde el día <span class="hueco">[fecha]</span> a las <span class="hueco">[hora]</span>.</li>
<li><b>Compensación.</b> La Propiedad abonará a los Ocupantes la cantidad de <span class="hueco">${eur(p.calc?.ajustes?.llaves)}</span> en concepto de ayuda para la mudanza, <b>en el mismo acto de la entrega de llaves</b>, mediante <span class="hueco">[transferencia / cheque bancario]</span>, y nunca antes.</li>
<li><b>Acta de entrega.</b> La entrega se hará en presencia de <span class="hueco">[un testigo / notario]</span>, que firmará el acta junto a las partes, con fotografías del estado de la vivienda y lectura de contadores.</li>
<li><b>Suministros.</b> Los suministros seguirán funcionando con normalidad hasta la entrega. Las facturas hasta esa fecha corren a cargo de <span class="hueco">[quien se acuerde]</span>.</li>
<li><b>Renuncias.</b> Con la entrega, las partes no tendrán nada más que reclamarse por razón de la ocupación, salvo lo previsto en este acuerdo.</li>
<li><b>Procedimientos.</b> Si hay algún procedimiento judicial en curso, la Propiedad <span class="hueco">[desistirá / pedirá su archivo]</span> una vez recibidas las llaves.</li>
<li><b>Incumplimiento.</b> Si la entrega no se produce en la fecha pactada, no se pagará la compensación y <span class="hueco">[consecuencia a redactar por el abogado]</span>.</li>
<li><b>Voluntariedad.</b> Las partes declaran que firman libremente, que han podido consultar con quien han querido y que nadie les ha presionado.</li>
</ol>
<p>Y en prueba de conformidad, firman por duplicado.</p>
<p><br>La Propiedad &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Los Ocupantes &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Testigo</p>
<div class="nota">Borrador orientativo generado por LLAVES el ${hoy()}. No es asesoramiento jurídico. ${legal?.vulnerables ? 'Si hay menores, personas mayores o una familia vulnerable, los plazos y requisitos cambian: consulta con el abogado y con Servicios Sociales.' : ''}</div>`, 'PARA REVISAR POR ABOGADO — NO FIRMAR SIN SU REVISIÓN'),
  };
}
