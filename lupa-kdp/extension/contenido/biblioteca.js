/* Lupa KDP — entrega de ideas en la Biblioteca Buen Rato.

   La Biblioteca es una página de Claude (claude.ai/artifact/…) cuyo contenido va en un marco de
   *.frame.claudeusercontent.com. Este script solo hace algo en el marco que tiene el formulario
   «Tus ideas de libro» (form#fIdea): pide al service worker la idea pendiente que mandó Rodri desde
   Amazon, espera a que la Biblioteca conecte con su nube, rellena las casillas como lo haría él y
   pulsa «Mandar a la fábrica». La propia Biblioteca guarda la idea con su código de siempre.
   Después le dice a Lupa si la idea ha entrado (o por qué no). */
(function () {
  'use strict';

  if (globalThis.__lupaBibliotecaCargada) return;
  globalThis.__lupaBibliotecaCargada = true;

  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
  async function esperar(condicion, max, cada = 250) {
    const fin = Date.now() + max;
    for (;;) {
      let v = null;
      try {
        v = condicion();
      } catch {
        v = null;
      }
      if (v) return v;
      if (Date.now() > fin) return null;
      await dormir(cada);
    }
  }

  async function pedir(mensaje) {
    try {
      return await chrome.runtime.sendMessage(mensaje);
    } catch {
      return null;
    }
  }

  /** Pone un valor como si lo escribiera una persona (para que la página se entere). */
  function poner(el, valor) {
    const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, valor);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /** Elige en un desplegable la opción con ese texto (o ese valor); si no existe, la primera. */
  function elegir(select, texto) {
    if (!select) return;
    const op = [...select.options].find((o) => o.text.trim() === texto || o.value === texto) || select.options[0];
    if (op) poner(select, op.value);
  }

  const contiene = (texto) => [...document.querySelectorAll('#listaIdeas .idea .t, #listaIdeas .t')].some((el) => el.textContent.trim() === texto.trim());

  /** Estado de la nube de la Biblioteca cuando su propio código ya ha arrancado (o null si no arranca). */
  function estadoNube() {
    const t = ((document.querySelector('#dbstate') || {}).textContent || '').trim();
    return !t || /conectando/i.test(t) ? null : t;
  }

  async function entregar({ idea }, estado) {
    const form = document.querySelector('form#fIdea');
    // 1) Sin nube (Biblioteca abierta sin sesión), no puede guardar ideas.
    if (/solo lectura|sin conexi/i.test(estado)) return { ok: false, motivo: 'la Biblioteca está en solo lectura: ábrela en claude.ai con tu cuenta' };
    // 2) Las casillas, como las rellenaría Rodri.
    const texto = form.querySelector('#iTexto');
    if (!texto) return { ok: false, motivo: 'la Biblioteca ha cambiado: no encuentro la casilla «¿qué libro se te ocurre?»' };
    poner(texto, idea.texto);
    elegir(form.querySelector('#iPublico'), idea.publico);
    elegir(form.querySelector('#iFormato'), idea.formato);
    elegir(form.querySelector('#iPrisa'), idea.prisa || 'normal');
    const autor = form.querySelector('#iAutor');
    if (autor) poner(autor, idea.autor || 'Lupa KDP');
    // 3) «Mandar a la fábrica».
    const boton = form.querySelector('button[type="submit"]') || [...form.querySelectorAll('button')].find((b) => /mandar a la f[aá]brica/i.test(b.textContent));
    if (!boton) return { ok: false, motivo: 'la Biblioteca ha cambiado: no encuentro el botón «Mandar a la fábrica»' };
    boton.click();
    // 4) ¿Ha entrado? La Biblioteca avisa con su mensaje y la idea sale en la lista.
    const r = await esperar(() => {
      const aviso = (document.querySelector('#toast') || {}).textContent || '';
      if (/no se pudo guardar|sin conexi/i.test(aviso)) return { ok: false, motivo: `la Biblioteca dice: «${aviso.trim()}»` };
      if (contiene(idea.texto) && (/idea mandada/i.test(aviso) || texto.value === '')) return { ok: true };
      return null;
    }, 20000);
    return r || { ok: false, motivo: 'la Biblioteca no ha confirmado la idea en 20 segundos' };
  }

  async function arrancar() {
    // claude.ai abre antes un marco de «calentamiento» escondido en el mismo dominio: ahí no se hace nada.
    if (/^\/_warmup\b/.test(location.pathname)) return;
    // Solo en el marco de la Biblioteca (el formulario de ideas aparece enseguida).
    const form = await esperar(() => document.querySelector('form#fIdea #iTexto') && document.querySelector('form#fIdea'), 15000, 300);
    if (!form) return;
    // Antes de coger ninguna idea, que el código de la propia Biblioteca haya arrancado y dicho cómo está
    // su nube: en un marco donde la página no funciona, Lupa no se queda con la idea de nadie.
    const estado = await esperar(estadoNube, 30000);
    if (!estado) return;
    // Todas las ideas pendientes, de una en una.
    for (let i = 0; i < 20; i++) {
      const r = await pedir({ tipo: 'ideaPendiente' });
      if (!r || !r.ok || !r.item) return;
      const resultado = await entregar(r.item, estadoNube() || estado);
      await pedir({ tipo: 'ideaEntregada', id: r.item.id, ok: resultado.ok, motivo: resultado.motivo || null });
      if (!resultado.ok) return;
      await dormir(1500);
    }
  }

  arrancar();
})();
