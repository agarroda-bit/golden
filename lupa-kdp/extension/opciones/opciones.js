/* Lupa KDP — página de Opciones. */
(function (L) {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const e = L.escaparHTML;

  async function pedir(mensaje) {
    try {
      return (await chrome.runtime.sendMessage(mensaje)) || { ok: false, error: 'Sin respuesta de Lupa.' };
    } catch (err) {
      return { ok: false, error: String((err && err.message) || err) };
    }
  }

  // ------------------------------------------------------------ pestañas

  function mostrarPestana(nombre) {
    for (const b of $$('nav.pestanas button')) b.setAttribute('aria-selected', String(b.dataset.pestana === nombre));
    for (const v of $$('[data-vista]')) v.classList.toggle('oculto', v.dataset.vista !== nombre);
    try {
      localStorage.setItem('lupa:pestana', nombre);
    } catch {
      /* sin almacenamiento local: no pasa nada */
    }
  }

  // ------------------------------------------------------------ curvas

  function tablaPuntos(c) {
    if (c.tipo !== 'tabla') return `<p class="nota">ventas/día = ${e(String(L.redondear(c.a, 4)).replace('.', ','))} × BSR<sup>−${e(String(L.redondear(c.b, 4)).replace('.', ','))}</sup></p>`;
    const filas = c.puntos.map(([b, v]) => `<tr><td class="n">${L.miles(b)}</td><td class="n">${L.cifra(v)}</td><td class="n">${L.cifra(v * L.DIAS_MES)}</td></tr>`).join('');
    return `<div class="tabla"><table><thead><tr><th class="n">BSR</th><th class="n">Ventas/día</th><th class="n">Ventas/mes</th></tr></thead><tbody>${filas}</tbody></table></div>`;
  }

  function pintarCurvas() {
    $('#curvas-fabrica').innerHTML = L.CURVAS_FABRICA.map(
      (c) => `<div class="bloque" data-curva="${e(c.id)}">
        <h3>${e(c.nombre)}</h3>
        <p><span class="chip aviso">De fábrica · ${e(c.pais)}</span> <span class="chip tenue">${e(L.FORMATOS_CURVA[c.formato])}</span></p>
        ${tablaPuntos(c)}
        <p class="nota">${e(c.fuente)} Entre dos puntos se interpola en escala logarítmica; fuera de la tabla se prolonga el último tramo y el panel lo avisa.</p>
      </div>`,
    ).join('');
  }

  // ------------------------------------------------------------ arranque

  async function arrancar() {
    $('#version').textContent = `Versión ${chrome.runtime.getManifest().version}`;
    for (const b of $$('nav.pestanas button')) b.addEventListener('click', () => mostrarPestana(b.dataset.pestana));
    pintarCurvas();
    let inicial = 'curvas';
    try {
      inicial = localStorage.getItem('lupa:pestana') || inicial;
    } catch {
      /* nada */
    }
    if (!$(`nav.pestanas button[data-pestana="${inicial}"]`)) inicial = 'curvas';
    mostrarPestana(inicial);
  }

  L.opciones = { pedir };
  arrancar();
})((globalThis.LUPA = globalThis.LUPA || {}));
