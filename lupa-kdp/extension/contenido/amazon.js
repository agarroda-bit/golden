/* Lupa KDP — content script de Amazon.es y Amazon.com.
   Mira qué página tiene Rodri abierta y actúa solo sobre ella:
   · ficha de un libro → lee los datos, guarda la lectura en el historial y pinta el panel flotante;
   · búsqueda o «Los más vendidos» → botones «Ver ventas» y «Analizar página» (lista.js);
   · comprobación de robot de Amazon → no hace nada más y lo avisa.
   No navega por su cuenta ni abre nada que Rodri no haya pedido. */
(function (L) {
  'use strict';

  if (window.top !== window) return; // solo la página principal, no los marcos de anuncios
  if (globalThis.__lupaKdpCargada) return;
  globalThis.__lupaKdpCargada = true;

  const tienda = L.tiendaDeHost(location.hostname);
  if (!tienda) return;

  let fichaActual = null;
  let entradaActual = null;
  let contexto = null;

  async function cargarContexto() {
    const r = await L.ui.pedir({ tipo: 'contexto' });
    contexto = r && r.ok ? { asignacion: r.asignacion, curvas: r.curvas, ajustes: r.ajustes } : {};
    return contexto;
  }

  /** Estimación con las preferencias que haya puesto Rodri para este libro (tinta, tamaño). */
  function calcular(ficha, entrada) {
    const prefs = (entrada && entrada.prefs) || {};
    const fichaCalculo = { ...ficha, ...prefs };
    return { est: L.estimar(fichaCalculo, contexto || {}), prefs };
  }

  // ------------------------------------------------------------------ ficha

  const acciones = {
    async mandarBiblioteca() {
      if (!fichaActual) return;
      const { est } = calcular(fichaActual, entradaActual);
      const idea = L.biblioteca.idea(fichaActual, est);
      // Copia de seguridad en el portapapeles: si la Biblioteca no se rellena sola, se pega a mano.
      const copiada = await L.ui.copiar(idea.texto);
      L.panel.avisoBiblioteca('Abriendo la Biblioteca para mandar la idea…', 'info');
      const r = await L.ui.pedir({ tipo: 'mandarBiblioteca', idea });
      if (!r.ok) {
        L.panel.avisoBiblioteca(`ERROR — ${r.error || 'no se ha podido abrir la Biblioteca'}${copiada ? '. La idea está copiada: pégala en «TÚ: ¿qué libro se te ocurre?» y pulsa «Mandar a la fábrica».' : ''}`, 'error');
        return;
      }
      L.panel.avisoBiblioteca(`Idea preparada: la Biblioteca se abre y la manda sola a la fábrica.${copiada ? ' Si no lo hiciera, la tienes copiada para pegarla.' : ''}`, 'info');
    },
    async exportar(filtro) {
      const r = await L.ui.pedir({ tipo: 'exportarCsv', filtro });
      if (!r.ok) {
        L.panel.avisoBiblioteca(`ERROR — no se ha podido exportar: ${r.error}`, 'error');
        return;
      }
      L.ui.descargar(r.nombre, r.csv);
      L.panel.avisoBiblioteca(`CSV descargado: ${r.lecturas} ${r.lecturas === 1 ? 'lectura' : 'lecturas'} de ${r.libros} ${r.libros === 1 ? 'libro' : 'libros'}.`, 'ok');
    },
    async cambiarPreferencia(campo, valor) {
      if (!fichaActual) return;
      const r = await L.ui.pedir({ tipo: 'preferencias', tienda: fichaActual.tienda, asin: fichaActual.asin, cambios: { [campo]: valor } });
      if (r.ok) entradaActual = r.entrada;
      pintarFicha(false);
    },
  };

  function pintarFicha(animar = true) {
    const { est, prefs } = calcular(fichaActual, entradaActual);
    const tendencia = L.historial.tendencia(entradaActual ? entradaActual.lecturas : []);
    L.panel.mostrar({ ficha: fichaActual, est, tendencia, prefs }, acciones, { animar });
  }

  async function modoFicha() {
    let ficha = L.lector.leerFicha(document, location.href);
    // Solo libros: en un reloj o una cafetera, Lupa no pinta nada ni guarda nada.
    if (!ficha.ok || !L.lector.esLibro(document, ficha)) return;
    // Amazon a veces termina de pintar los detalles un poco después: un segundo intento si falta el BSR.
    if (!Number.isFinite(ficha.bsr.general)) {
      await L.pausa(1500);
      const otra = L.lector.leerFicha(document, location.href);
      if (otra.ok) ficha = otra;
    }
    fichaActual = ficha;
    await cargarContexto();
    // Amazon vuelve a enseñar fichas: si hubo una comprobación de robot hace más de media hora, fuera el «!».
    L.ui.pedir({ tipo: 'limpiarAviso', minutos: L.MINUTOS_TRAS_BLOQUEO });
    const r = await L.ui.pedir({ tipo: 'guardarLectura', ficha, origen: 'ficha' });
    entradaActual = r && r.ok ? r.entrada : null;
    pintarFicha(true);
  }

  // ------------------------------------------------------------------ avisos del service worker

  chrome.runtime.onMessage.addListener((msg, _sender, responder) => {
    if (!msg) return false;
    if (msg.tipo === 'mostrarPanel') {
      responder({ ok: L.panel.volverAMostrar() || (L.lista && L.lista.volverAMostrar && L.lista.volverAMostrar()) || false });
      return false;
    }
    if (msg.tipo === 'bibliotecaResultado') {
      const texto = msg.ok ? 'Idea mandada a la Biblioteca: ya está en «Tus ideas de libro».' : `ERROR — la Biblioteca no ha aceptado la idea: ${msg.motivo || 'no se sabe por qué'}. La tienes copiada para pegarla a mano.`;
      if (L.panel.existe()) L.panel.avisoBiblioteca(texto, msg.ok ? 'ok' : 'error');
      if (L.lista && L.lista.avisoBiblioteca) L.lista.avisoBiblioteca(msg);
      responder({ ok: true });
      return false;
    }
    return false;
  });

  // ------------------------------------------------------------------ arranque

  async function arrancar() {
    const tipo = L.lector.tipoPagina(document, location.href);
    if (tipo === 'robot') {
      // Amazon pide comprobar que es una persona: Lupa no hace nada en esta página y lo avisa. La pantalla
      // de verificación del navegador no se avisa: el navegador la pasa solo y Amazon recarga la página.
      if (!L.lector.esVerificacion(document)) L.ui.pedir({ tipo: 'bloqueo', url: location.href });
      return;
    }
    L.ui.cargarFuentes();
    if (tipo === 'ficha') await modoFicha();
    else if ((tipo === 'busqueda' || tipo === 'mas-vendidos') && L.lista) {
      await cargarContexto();
      await L.lista.iniciar({ tipo, tienda, contexto });
    }
  }

  L.amazon = { recargarContexto: cargarContexto };
  arrancar();
})((globalThis.LUPA = globalThis.LUPA || {}));
