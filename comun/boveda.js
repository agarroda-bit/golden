/* Bóveda del Lanzador: las claves largas de cada página se guardan en ESTE aparato, cifradas con el PIN de 4 cifras.
   - El PIN no se guarda en ningún sitio: solo sirve para descifrar la bóveda de este aparato.
   - Con el PIN solo (sin la bóveda de este aparato) no se puede leer nada de lo publicado.
   - 5 PIN fallados seguidos → la bóveda se borra y hay que dar de alta el aparato otra vez.
   Uso: Boveda.abrir({ titulo }) → Promise<{ leer, guardar, borrar, enlaceAlta }>  (o null si se cancela)        */
(function () {
  'use strict';
  var K = 'lz_boveda', K_FALLOS = 'lz_boveda_fallos', ITER = 310000, MAX_FALLOS = 5;
  var enc = new TextEncoder(), dec = new TextDecoder();
  function leerLS(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function escribirLS(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function b64(u) { var s = ''; u = new Uint8Array(u); for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); }
  function deb64(s) { var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }

  function clave(pin, sal, iter) {
    return crypto.subtle.importKey('raw', enc.encode(String(pin)), 'PBKDF2', false, ['deriveKey']).then(function (base) {
      return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: sal, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
  }
  function cifrar(k, obj, sal, iter) {
    var iv = crypto.getRandomValues(new Uint8Array(12));
    return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, k, enc.encode(JSON.stringify(obj))).then(function (c) {
      return { v: 1, iter: iter, sal: b64(sal), iv: b64(iv), datos: b64(c) };
    });
  }
  function descifrar(k, sobre) {
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: deb64(sobre.iv) }, k, deb64(sobre.datos)).then(function (b) { return JSON.parse(dec.decode(b)); });
  }
  function sobre() { try { return JSON.parse(leerLS(K) || 'null'); } catch (e) { return null; } }

  // 27/10/2026 · clave_comun: la clave larga de la APP sirve en todas las páginas. Cualquier página sin clave propia usa esta,
  // y cuando una página guarda la suya se copia también aquí. (Reparto no la escribe: puede llevar la RD_CLAVE, que solo vale allí.)
  var COMUN = 'clave_comun', DAN_COMUN = ['enlace_app', 'enlace_vender', 'central_clave'];
  function claveDe(v) {
    v = String(v || ''); var m = v.match(/[?&]k=([^&\s#]+)/), c = m ? decodeURIComponent(m[1]) : v.trim();
    return /^[A-Za-z0-9_-]{20,}$/.test(c) && c.indexOf('tk_') !== 0 ? c : '';
  }

  // Una bóveda abierta: los secretos en memoria y la clave para volver a guardarlos.
  function abierta(k, sal, iter, secretos) {
    var cola = Promise.resolve();
    if (!secretos[COMUN]) { for (var i = 0; i < DAN_COMUN.length; i++) { var c0 = claveDe(secretos[DAN_COMUN[i]]); if (c0) { secretos[COMUN] = c0; cola = cola.then(function () { return cifrar(k, secretos, sal, iter).then(function (s) { escribirLS(K, JSON.stringify(s)); }); }); break; } } }
    function persistir() {
      cola = cola.then(function () { return cifrar(k, secretos, sal, iter).then(function (s) { escribirLS(K, JSON.stringify(s)); }); });
      return cola;
    }
    return {
      leer: function (n) { return secretos[n] == null ? null : secretos[n]; },
      guardar: function (n, v) { if (v == null || v === '') delete secretos[n]; else { secretos[n] = v; if (DAN_COMUN.indexOf(n) >= 0 && claveDe(v)) secretos[COMUN] = claveDe(v); } return persistir(); },
      // La clave larga de esta página: la suya si la tiene; si no, la común.
      clave: function (n) { return claveDe(secretos[n]) || secretos[COMUN] || ''; },
      // Lo que se manda a la app como k=: la clave larga si la hay (llave de emergencia, no caduca); si no, el token del PIN.
      credencial: function (n) { var c = claveDe(secretos[n]) || secretos[COMUN] || ''; if (c) return c; return Number(secretos[T_CADUCA] || 0) > Date.now() ? (secretos[T_TOKEN] || '') : ''; },
      borrar: function (n) { delete secretos[n]; return persistir(); },
      nombres: function () { return Object.keys(secretos); },
      // Enlace para dar de alta otro aparato: lleva la bóveda cifrada con el mismo PIN (sin la sesión de LLAVES, que va por correo).
      enlaceAlta: function (base) {
        var copia = {}; Object.keys(secretos).forEach(function (n) { if (n.indexOf('llaves') !== 0) copia[n] = secretos[n]; });
        return cifrar(k, copia, sal, iter).then(function (s) { return (base || location.origin + '/golden/paginas/') + '#alta=' + encodeURIComponent(btoa(JSON.stringify(s))); });
      },
    };
  }

  // ---------- Acceso con PIN contra la app de Google (27/10/2026) ----------
  // La app guarda solo la huella del PIN; con el PIN bueno devuelve un token de 30 días que va aquí, en la bóveda.
  // 5 PIN fallados seguidos en la app → bloqueo de 30 min y aviso a Telegram. La clave larga sigue valiendo de emergencia.
  var APP = 'https://script.google.com/macros/s/AKfycbwOLqVhaEyF0_Q8HulkLjmeTECJQIsxuA3yK0MDHE63S3H_031GVNy0ZHiSHKRiiBLj/exec';
  var T_TOKEN = 'token_golden', T_CADUCA = 'token_caduca', RENOVAR_MS = 7 * 86400000;
  function app(params) {
    var u = new URL(APP); u.searchParams.set('v', 'pin'); Object.keys(params).forEach(function (n) { u.searchParams.set(n, params[n]); });
    return fetch(u.toString(), { method: 'GET', redirect: 'follow', cache: 'no-store' }).then(function (r) { return r.text(); }).then(function (t) {
      try { return JSON.parse(t); } catch (e) {
        return { ok: false, caida: true, error: /No autorizado/.test(t) ? 'La app de Google aún no tiene el acceso con PIN (falta subir la versión nueva).' : 'La app de Google no responde bien ahora mismo. Prueba en un minuto.' };
      }
    }, function () { return { ok: false, caida: true, error: 'Sin conexión con la app de Google. Mira la cobertura y vuelve a probar.' }; });
  }
  // Con la bóveda ya abierta y el PIN en la mano: consigue (o renueva) el token. Devuelve {ok} o {ok:false, error}.
  function asegurarToken(B, pin) {
    var cad = Number(B.leer(T_CADUCA) || 0);
    if (B.leer(T_TOKEN) && cad - Date.now() > RENOVAR_MS) return Promise.resolve({ ok: true });
    return app({ f: 'entrar', p: pin }).then(function (r) {
      if (r.ok && r.token) return Promise.all([B.guardar(T_TOKEN, r.token), B.guardar(T_CADUCA, String(r.caduca))]).then(function () { return { ok: true }; });
      // La app aún no tiene PIN: si este aparato tiene la clave larga, el PIN se da de alta con ella (una sola vez, sin pedir nada).
      if (r.sinPin && B.leer(COMUN)) return app({ f: 'alta', p: pin, k: B.leer(COMUN) }).then(function (r2) {
        if (r2.ok && r2.token) return Promise.all([B.guardar(T_TOKEN, r2.token), B.guardar(T_CADUCA, String(r2.caduca))]).then(function () { return { ok: true }; });
        return r2;
      });
      return r;
    });
  }

  // ---------- Teclado del PIN ----------
  var CSS = '.bv-fondo{position:fixed;inset:0;z-index:99999;background:radial-gradient(120% 90% at 50% 15%,#22344A,#0B1118 65%);display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#EFE9DC;padding:env(safe-area-inset-top) 16px env(safe-area-inset-bottom)}' +
    '.bv-caja{width:min(340px,100%);text-align:center}.bv-tit{font-size:22px;font-weight:800;letter-spacing:.04em;color:#F3C969;margin:0 0 4px}' +
    '.bv-sub{font-size:14px;color:#9DB0BC;min-height:38px;margin:0 0 14px;line-height:1.35}.bv-puntos{display:flex;gap:16px;justify-content:center;margin:6px 0 18px}' +
    '.bv-punto{width:16px;height:16px;border-radius:50%;border:2px solid #F3C969;transition:background .12s}.bv-punto.on{background:#F3C969}' +
    '.bv-teclas{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.bv-teclas button{height:64px;border-radius:50%;border:1px solid #2E4555;background:rgba(255,255,255,.06);color:#EFE9DC;font-size:26px;font-weight:600;cursor:pointer;-webkit-tap-highlight-color:transparent}' +
    '.bv-teclas button:active{background:rgba(243,201,105,.3)}.bv-teclas .bv-vacia{visibility:hidden}.bv-teclas .bv-borrar{font-size:18px;border-radius:14px}' +
    '.bv-err{color:#FF9A9D}.bv-temblor{animation:bvt .35s}@keyframes bvt{25%,75%{transform:translateX(-9px)}50%{transform:translateX(9px)}}' +
    '.bv-link{background:none;border:0;color:#9DB0BC;text-decoration:underline;margin-top:18px;font-size:13px;cursor:pointer}';

  function teclado(opc) {
    // opc: { titulo, sub, alPin(pin) → Promise<true|string(error)>, extra: [{texto, accion}] }
    return new Promise(function (resolver) {
      if (!document.getElementById('bv-css')) { var st = document.createElement('style'); st.id = 'bv-css'; st.textContent = CSS; document.head.appendChild(st); }
      var f = document.createElement('div'); f.className = 'bv-fondo'; f.setAttribute('role', 'dialog'); f.setAttribute('aria-label', opc.titulo);
      f.innerHTML = '<div class="bv-caja"><p class="bv-tit"></p><p class="bv-sub"></p><div class="bv-puntos">' + '<span class="bv-punto"></span>'.repeat(4) +
        '</div><div class="bv-teclas">' + [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (n) { return '<button type="button" data-n="' + n + '" aria-label="' + n + '">' + n + '</button>'; }).join('') +
        '<button type="button" class="bv-vacia" tabindex="-1"></button><button type="button" data-n="0" aria-label="0">0</button><button type="button" class="bv-borrar" aria-label="Borrar">⌫</button></div><div class="bv-extra"></div></div>';
      f.querySelector('.bv-tit').textContent = opc.titulo;
      var sub = f.querySelector('.bv-sub'); sub.textContent = opc.sub || '';
      (opc.extra || []).forEach(function (x) { var b = document.createElement('button'); b.type = 'button'; b.className = 'bv-link'; b.textContent = x.texto; b.onclick = function () { cerrar(); x.accion(resolver); }; f.querySelector('.bv-extra').appendChild(b); });
      var pin = '', ocupado = false;
      function pintar() { f.querySelectorAll('.bv-punto').forEach(function (p, i) { p.classList.toggle('on', i < pin.length); }); }
      function cerrar() { document.removeEventListener('keydown', tecla); f.remove(); }
      function pulsar(n) {
        if (ocupado || pin.length >= 4) return;
        pin += n; pintar();
        if (pin.length === 4) {
          ocupado = true; sub.textContent = 'Comprobando…'; sub.classList.remove('bv-err');
          Promise.resolve(opc.alPin(pin)).then(function (r) {
            if (r === true) { cerrar(); resolver(true); return; }
            if (r && typeof r === 'object' && r.aviso) { sub.textContent = r.aviso; sub.classList.remove('bv-err'); pin = ''; pintar(); ocupado = false; return; }
            var caja = f.querySelector('.bv-caja'); caja.classList.remove('bv-temblor'); void caja.offsetWidth; caja.classList.add('bv-temblor');
            sub.textContent = r || 'PIN incorrecto'; sub.classList.add('bv-err'); pin = ''; pintar(); ocupado = false;
            if (typeof r === 'object' && r && r.cerrar) { cerrar(); resolver(r.valor); }
          });
        }
      }
      function tecla(e) { if (/^[0-9]$/.test(e.key)) pulsar(e.key); else if (e.key === 'Backspace') { pin = pin.slice(0, -1); pintar(); } }
      f.querySelectorAll('[data-n]').forEach(function (b) { b.onclick = function () { pulsar(b.getAttribute('data-n')); }; });
      f.querySelector('.bv-borrar').onclick = function () { if (!ocupado) { pin = pin.slice(0, -1); pintar(); } };
      document.addEventListener('keydown', tecla);
      document.body.appendChild(f);
    });
  }

  function crear(titulo, inicial) {
    var primero = null;
    var sal = crypto.getRandomValues(new Uint8Array(16)), resultado = null;
    return teclado({
      titulo: titulo, sub: 'Elige un PIN de 4 cifras para este aparato',
      alPin: function (pin) {
        if (!primero) { primero = pin; return { aviso: 'Repítelo para confirmarlo' }; }
        if (pin !== primero) { primero = null; return 'No coinciden. Elige el PIN otra vez'; }
        return clave(pin, sal, ITER).then(function (k) {
          var secretos = inicial || {};
          return cifrar(k, secretos, sal, ITER).then(function (s) {
            if (!escribirLS(K, JSON.stringify(s))) return 'Este navegador no deja guardar (¿modo privado?)';
            escribirLS(K_FALLOS, '0'); resultado = abierta(k, sal, ITER, secretos); return true;
          });
        });
      },
    }).then(function (ok) { return ok === true ? resultado : null; });
  }

  function desbloquear(titulo, s) {
    var resultado = null;
    var sal = deb64(s.sal);
    return teclado({
      titulo: titulo, sub: 'Escribe tu PIN',
      alPin: function (pin) {
        return clave(pin, sal, s.iter).then(function (k) {
          return descifrar(k, s).then(function (secretos) { escribirLS(K_FALLOS, '0'); resultado = abierta(k, sal, s.iter, secretos); return true; });
        }).catch(function () {
          var n = Number(leerLS(K_FALLOS) || 0) + 1; escribirLS(K_FALLOS, String(n));
          if (n >= MAX_FALLOS) { escribirLS(K, null); escribirLS(K_FALLOS, null); return { cerrar: true, valor: 'bloqueada' }; }
          return 'PIN incorrecto · te quedan ' + (MAX_FALLOS - n) + ' intento' + (MAX_FALLOS - n === 1 ? '' : 's');
        });
      },
      extra: [{ texto: 'He olvidado el PIN: borrar la bóveda de este aparato', accion: function (r) { if (confirm('Se borran de este aparato las claves guardadas. Tendrás que darlo de alta otra vez. ¿Seguro?')) { escribirLS(K, null); escribirLS(K_FALLOS, null); r('borrada'); } else r(null); } }],
    }).then(function (ok) { return ok === true ? resultado : ok; });
  }

  // Si se abre un enlace de alta (#alta=…), se importa la bóveda de otro aparato: se abre con el mismo PIN.
  function importarAlta() {
    var m = (location.hash || '').match(/#alta=([^&]+)/);
    if (!m) return false;
    try { var s = JSON.parse(atob(decodeURIComponent(m[1]))); if (s && s.datos && s.sal) { escribirLS(K, JSON.stringify(s)); escribirLS(K_FALLOS, '0'); } } catch (e) {}
    history.replaceState(null, '', location.pathname + location.search);
    return true;
  }

  // Entrar en una página con el PIN y nada más. Devuelve Promise<bóveda abierta> (con .credencial(nombre) para la k=) o null si se cancela.
  // - Aparato con bóveda: el PIN la abre aquí y, si hace falta, pide el token a la app.
  // - Aparato o navegador nuevo: el PIN se comprueba en la app; si es bueno, se crea la bóveda con ese PIN y el token dentro.
  // Nunca pide la clave larga: si la app falla, el error sale en el propio teclado y se puede reintentar.
  function acceso(opc) {
    opc = opc || {};
    importarAlta();
    var titulo = opc.titulo || 'GOLDEN OCLOCK', propia = opc.propia || '', resultado = null, s = sobre();
    function listo(B) {
      return B.credencial(propia) ? true : 'La app no ha dado acceso. Prueba otra vez.';
    }
    if (s) {
      var sal = deb64(s.sal);
      return teclado({
        titulo: titulo, sub: 'Escribe tu PIN',
        alPin: function (pin) {
          var abrir = resultado ? Promise.resolve(resultado) : clave(pin, sal, s.iter).then(function (k) {
            return descifrar(k, s).then(function (secretos) { escribirLS(K_FALLOS, '0'); resultado = abierta(k, sal, s.iter, secretos); return resultado; });
          });
          return abrir.then(function (B) {
            var migrar = opc.migrar || {}, ps = [];
            Object.keys(migrar).forEach(function (n) { if (migrar[n] && B.leer(n) == null) ps.push(B.guardar(n, migrar[n])); });
            return Promise.all(ps).then(function () { return asegurarToken(B, pin); }).then(function (r) {
              if (r.ok) return listo(B);
              if (B.credencial(propia)) return true;   // la app falla pero este aparato tiene la clave larga: se entra con ella
              return r.error || 'La app no ha dado acceso.';
            });
          }, function () {
            var n = Number(leerLS(K_FALLOS) || 0) + 1; escribirLS(K_FALLOS, String(n));
            if (n >= MAX_FALLOS) { escribirLS(K, null); escribirLS(K_FALLOS, null); return { cerrar: true, valor: 'bloqueada' }; }   // se vuelve a empezar como aparato nuevo
            return 'PIN incorrecto · te quedan ' + (MAX_FALLOS - n) + ' intento' + (MAX_FALLOS - n === 1 ? '' : 's');
          });
        },
        extra: [{ texto: 'He olvidado el PIN: borrar la bóveda de este aparato', accion: function (r) { if (confirm('Se borran de este aparato las claves guardadas. Luego entras con el PIN de siempre. ¿Seguro?')) { escribirLS(K, null); escribirLS(K_FALLOS, null); r('borrada'); } else r(null); } }],
      }).then(function (ok) {
        if (ok === true) return resultado;
        if (ok === 'borrada' || ok === 'bloqueada') return acceso(opc);
        return null;
      });
    }
    // Sin bóveda en este aparato: el PIN lo comprueba la app.
    return teclado({
      titulo: titulo, sub: 'Escribe tu PIN',
      alPin: function (pin) {
        return app({ f: 'entrar', p: pin }).then(function (r) {
          if (r.sinPin) return 'La app aún no tiene tu PIN. Ábrela una vez en el móvil donde ya entras y vuelve aquí.';
          if (!r.ok || !r.token) return r.error || 'La app no ha dado acceso.';
          var sal = crypto.getRandomValues(new Uint8Array(16)), secretos = opc.migrar ? JSON.parse(JSON.stringify(opc.migrar)) : {};
          secretos[T_TOKEN] = r.token; secretos[T_CADUCA] = String(r.caduca);
          return clave(pin, sal, ITER).then(function (k) {
            return cifrar(k, secretos, sal, ITER).then(function (sb) {
              escribirLS(K, JSON.stringify(sb)); escribirLS(K_FALLOS, '0');
              resultado = abierta(k, sal, ITER, secretos);   // si el navegador no deja guardar (modo privado), se entra igual: solo vale para esta visita
              return true;
            });
          });
        });
      },
    }).then(function (ok) { return ok === true ? resultado : null; });
  }
  // La app dice «No autorizado» con un token: se olvida (al volver a entrar con el PIN se pide otro).
  function olvidarToken(B) { return B ? Promise.all([B.guardar(T_TOKEN, null), B.guardar(T_CADUCA, null)]) : Promise.resolve(); }

  window.Boveda = {
    acceso: acceso,
    olvidarToken: olvidarToken,
    existe: function () { return !!sobre(); },
    MAX_FALLOS: MAX_FALLOS,
    // Abre la bóveda (o la crea). migrar: {nombre: valor} de claves que ya estaban en claro en este aparato.
    abrir: function (opc) {
      opc = opc || {};
      importarAlta();
      var s = sobre();
      if (!s) return crear(opc.titulo || 'Crea tu PIN', opc.migrar);
      return desbloquear(opc.titulo || 'Escribe tu PIN', s).then(function (r) {
        if (r === 'bloqueada' || r === 'borrada') { if (opc.alBloquear) opc.alBloquear(r); return null; }
        if (r && opc.migrar) { var ps = []; Object.keys(opc.migrar).forEach(function (n) { if (opc.migrar[n] && r.leer(n) == null) ps.push(r.guardar(n, opc.migrar[n])); }); return Promise.all(ps).then(function () { return r; }); }
        return r;
      });
    },
    borrarTodo: function () { escribirLS(K, null); escribirLS(K_FALLOS, null); },
    teclado: teclado,
    importarAlta: importarAlta,
    _interno: { clave: clave, cifrar: cifrar, descifrar: descifrar, app: app },
  };
})();
