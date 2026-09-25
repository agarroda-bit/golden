/* Lanzador GOLDEN OCLOCK — abre una app de Apps Script con icono y nombre propios.
   El enlace (con su clave) se pega UNA vez y se guarda solo en este móvil.
   Nunca se guarda en el servidor ni en este archivo. */
(function () {
  'use strict';
  var C = window.LZ; // configuración de cada app (en su index.html)
  var K_ENLACE = 'lz_' + C.id + '_enlace';
  var K_MODO = 'lz_' + C.id + '_modo';

  function leer(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function escribir(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); return true; } catch (e) { return false; } }

  var ua = navigator.userAgent || '';
  var esIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var instalada = window.navigator.standalone === true ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);

  function $(id) { return document.getElementById(id); }
  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    for (var a in (attrs || {})) e.setAttribute(a, attrs[a]);
    if (html != null) e.innerHTML = html;
    return e;
  }

  /* Comprueba y limpia el enlace pegado. Devuelve {ok, url, error, aviso}. */
  function validar(texto) {
    texto = String(texto || '').trim();
    var m = texto.match(/https:\/\/script\.google\.com\/[^\s"'<>]+/);
    if (!m && C.base && /^[A-Za-z0-9_-]{16,}$/.test(texto)) {
      // Solo la clave: se monta el enlace con la dirección de la app.
      var uk = new URL(C.base);
      if (C.vista) uk.searchParams.set('v', C.vista);
      uk.searchParams.set('k', texto);
      return { ok: true, url: uk.toString(), aviso: '' };
    }
    if (!m) return { ok: false, error: 'Eso no parece ni la clave ni el enlace. Copia el valor de la clave entero, sin espacios.' };
    var u;
    try { u = new URL(m[0]); } catch (e) { return { ok: false, error: 'El enlace está cortado. Cópialo otra vez entero.' }; }
    if (!/\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(u.pathname)) return { ok: false, error: 'Ese enlace no es el de la app (tiene que acabar en /exec…).' };
    if (!u.searchParams.get('k')) return { ok: false, error: 'Al enlace le falta la clave (la parte k=…). Copia el enlace completo, no el de sin clave.' };
    var aviso = '';
    if (C.vista && u.searchParams.get('v') !== C.vista) { u.searchParams.set('v', C.vista); aviso = 'He añadido v=' + C.vista + ' al enlace.'; }
    if (C.prefijo && u.pathname.indexOf('/macros/s/' + C.prefijo) !== 0) aviso += (aviso ? ' ' : '') + 'Ojo: este enlace no parece el de ' + C.titulo + ' (esperaba uno que empieza por ' + C.prefijo + '…). Si es el bueno, adelante.';
    return { ok: true, url: u.toString(), aviso: aviso };
  }

  function modoActual() {
    var m = leer(K_MODO);
    if (m === 'marco' || m === 'fuera') return m;
    return C.marcoListo ? 'marco' : 'fuera';
  }

  /* ---------- Pantalla de arranque ---------- */
  function arrancar(enlace) {
    var modo = modoActual();
    var s = $('splash');
    s.style.display = 'flex';
    var cancelado = false;
    $('splash-ajustes').onclick = function (ev) { ev.preventDefault(); cancelado = true; ajustes(); };

    if (modo === 'fuera') {
      $('splash-estado').textContent = 'Abriendo…';
      setTimeout(function () { if (!cancelado) location.replace(enlace); }, 900);
      return;
    }
    // Modo marco: la app dentro, a pantalla completa, con nuestro icono.
    $('splash-estado').textContent = 'Cargando…';
    var f = el('iframe', {
      id: 'marco', src: enlace, title: C.titulo,
      allow: 'camera *; microphone *; geolocation *; clipboard-read *; clipboard-write *; fullscreen *; autoplay *; web-share *'
    });
    document.body.appendChild(f);
    var visto = false;
    function mostrar() { if (visto || cancelado) return; visto = true; s.classList.add('fuera'); setTimeout(function () { s.style.display = 'none'; }, 350); }
    window.addEventListener('message', function (ev) {
      if (ev && ev.data && (ev.data === 'golden-listo' || ev.data.golden === 'listo')) mostrar();
    });
    f.addEventListener('load', function () { setTimeout(mostrar, C.marcoListo ? 2500 : 600); });
    setTimeout(function () {
      if (!visto && !cancelado) { $('splash-ayuda').style.display = 'block'; }
    }, 15000);
    $('splash-abrir-fuera').onclick = function (ev) { ev.preventDefault(); location.href = enlace; };
  }

  /* ---------- Pantalla de ajustes ---------- */
  function ajustes() {
    $('splash').style.display = 'none';
    var m = $('marco'); if (m) m.parentNode.removeChild(m);
    var a = $('ajustes'); a.style.display = 'block';
    var enlace = leer(K_ENLACE);

    $('aviso-instalar').style.display = (esIOS && !instalada) ? 'block' : 'none';
    $('estado-guardado').innerHTML = enlace
      ? '<span class="ok">Guardado en este móvil</span> · termina en …' + enlace.slice(-6).replace(/[<>&]/g, '')
      : '<span class="no">Todavía no hay enlace guardado en este móvil</span>';
    $('campo').value = '';
    $('mensaje').textContent = ''; $('mensaje').className = 'mensaje';

    var modo = modoActual();
    $('modo-marco').checked = modo === 'marco';
    $('modo-fuera').checked = modo === 'fuera';
    $('modo-marco').onchange = $('modo-fuera').onchange = function () {
      escribir(K_MODO, $('modo-marco').checked ? 'marco' : 'fuera');
    };

    $('btn-pegar').onclick = function () {
      if (!navigator.clipboard || !navigator.clipboard.readText) { $('campo').focus(); return; }
      navigator.clipboard.readText().then(function (t) { $('campo').value = t; comprobar(); })
        .catch(function () { $('campo').focus(); msg('No me deja leer el portapapeles: mantén el dedo en la casilla y pulsa Pegar.', 'no'); });
    };
    $('campo').oninput = comprobar;
    function msg(t, c) { $('mensaje').textContent = t; $('mensaje').className = 'mensaje ' + (c || ''); }
    function comprobar() {
      var t = $('campo').value.trim();
      if (!t) { msg(''); return null; }
      var r = validar(t);
      if (!r.ok) { msg(r.error, 'no'); return null; }
      msg('Correcto.' + (r.aviso ? ' ' + r.aviso : ''), r.aviso ? 'ojo' : 'ok');
      return r;
    }
    $('btn-guardar').onclick = function () {
      var r = comprobar();
      if (!r) { if (!$('campo').value.trim()) msg('Pega primero el enlace.', 'no'); return; }
      if (!escribir(K_ENLACE, r.url)) { msg('Este navegador no deja guardar (¿modo privado?). Ábrelo desde el icono de la pantalla de inicio.', 'no'); return; }
      a.style.display = 'none';
      if (location.hash) history.replaceState(null, '', location.pathname);
      arrancar(r.url);
    };
    $('btn-abrir').style.display = enlace ? 'inline-block' : 'none';
    $('btn-abrir').onclick = function () {
      a.style.display = 'none';
      if (location.hash) history.replaceState(null, '', location.pathname);
      arrancar(leer(K_ENLACE));
    };
    $('btn-borrar').style.display = enlace ? 'inline-block' : 'none';
    $('btn-borrar').onclick = function () { escribir(K_ENLACE, ''); ajustes(); msg('Enlace borrado de este móvil.', 'ok'); };
  }

  document.addEventListener('DOMContentLoaded', function () {
    var enlace = leer(K_ENLACE);
    if (!enlace || location.hash === '#ajustes') ajustes(); else arrancar(enlace);
  });
})();
