/* Lupa KDP — utilidades comunes.
   Todos los archivos de lib/ son scripts sencillos que cuelgan lo suyo de globalThis.LUPA:
   así sirven igual en el content script, en Opciones, en el service worker (import con efecto)
   y en las pruebas de Node, sin ningún paso de compilación (como RADAR). */
(function (L) {
  'use strict';

  L.version = '0.1.0';

  /** Minúsculas, sin acentos y con los espacios normalizados (para comparar textos). */
  L.normalizar = (texto) =>
    String(texto ?? '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[   ‎‏]/g, ' ')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

  /** Texto limpio: sin marcas invisibles de dirección (Amazon las mete en las fichas) y espacios normales. */
  L.limpiar = (texto) =>
    String(texto ?? '')
      .replace(/[‎‏‪-‮⁦-⁩]/g, '')
      .replace(/[   ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  L.pausa = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

  /** Número al azar entre min y max. */
  L.aleatorio = (min, max) => min + Math.random() * (max - min);

  /** Entero con separadores de miles en cualquier idioma: «nº 1.234», «#1,234», «1 234» → 1234. */
  L.entero = (texto) => {
    if (texto == null) return null;
    const digitos = String(texto).replace(/[^\d]/g, '');
    if (!digitos) return null;
    const n = Number.parseInt(digitos, 10);
    return Number.isFinite(n) ? n : null;
  };

  /**
   * Número decimal escrito a la española o a la inglesa.
   * «12,99» → 12.99 · «1.234,50» → 1234.5 · «1,234.50» → 1234.5 · «4.5» → 4.5 · «1.234» → 1234.
   */
  L.decimal = (texto) => {
    if (texto == null) return null;
    let s = String(texto).replace(/[^\d,.-]/g, '');
    if (!/\d/.test(s)) return null;
    const coma = s.lastIndexOf(',');
    const punto = s.lastIndexOf('.');
    if (coma >= 0 && punto >= 0) {
      // El último separador es el decimal.
      if (coma > punto) s = s.replace(/\./g, '').replace(',', '.');
      else s = s.replace(/,/g, '');
    } else if (coma >= 0) {
      // «12,99» y «4,5» son decimales; «1,234» y «1,234,567» (grupos de tres) son miles.
      s = /^-?[1-9]\d{0,2}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
    } else if (punto >= 0) {
      // «1.234» y «1.234.567» son miles; «4.5» o «12.99» son decimales.
      if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    }
    const n = Number.parseFloat(s);
    return Number.isFinite(n) ? n : null;
  };

  /** Redondeo a «dec» decimales (sin sorpresas de coma flotante en los casos normales). */
  L.redondear = (n, dec = 2) => {
    if (n == null || !Number.isFinite(n)) return null;
    const f = 10 ** dec;
    return Math.round((n + Number.EPSILON) * f) / f;
  };

  const FORMATOS_MONEDA = new Map();
  /** 12.99 → «12,99 €» (o «12,99 US$»). */
  L.dinero = (n, moneda = 'EUR') => {
    if (n == null || !Number.isFinite(n)) return '—';
    if (!FORMATOS_MONEDA.has(moneda)) {
      FORMATOS_MONEDA.set(moneda, new Intl.NumberFormat('es-ES', { style: 'currency', currency: moneda, minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    }
    return FORMATOS_MONEDA.get(moneda).format(n).replace(/ /g, ' ');
  };

  /** 1234 → «1.234» (también con 4 cifras, como se escribe a mano en España). */
  L.miles = (n) => {
    if (n == null || !Number.isFinite(n)) return '—';
    const signo = n < 0 ? '-' : '';
    return signo + String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  /** Cifra de ventas legible: 0,4 · 3,2 · 12 · 1.234. */
  L.cifra = (n) => {
    if (n == null || !Number.isFinite(n)) return '—';
    const a = Math.abs(n);
    if (a >= 100) return L.miles(n);
    if (a >= 10) return String(Math.round(n));
    if (a >= 1) return String(L.redondear(n, 1)).replace('.', ',');
    if (a >= 0.1) return String(L.redondear(n, 2)).replace('.', ',');
    return String(L.redondear(n, 3)).replace('.', ',');
  };

  /** 0.123 → «12 %». */
  L.porcentaje = (n, dec = 0) => (n == null || !Number.isFinite(n) ? '—' : `${String(L.redondear(n * 100, dec)).replace('.', ',')} %`);

  const dos = (n) => String(n).padStart(2, '0');
  /** ISO → «14/10/2026» (hora de Madrid del ordenador). */
  L.fechaCorta = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()}`;
  };
  /** ISO → «14/10/2026 23:15». */
  L.fechaHora = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${L.fechaCorta(iso)} ${dos(d.getHours())}:${dos(d.getMinutes())}`;
  };
  /** Fecha local del ordenador en formato AAAA-MM-DD (para agrupar lecturas por día). */
  L.dia = (fecha) => {
    const d = fecha instanceof Date ? fecha : new Date(fecha);
    if (Number.isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
  };

  const MESES = {
    enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
    jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
    ene: 1, abr: 4, ago: 8, dic: 12,
  };

  /**
   * Fecha escrita en una ficha de Amazon → «AAAA-MM-DD» (o null).
   * «3 marzo 2024», «3 de marzo de 2024», «March 3, 2024», «3 Mar. 2024», «2024-03-03», «03/03/2024».
   */
  L.fechaTexto = (texto) => {
    const s = L.normalizar(texto).replace(/\./g, ' ');
    let m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return `${m[1]}-${dos(+m[2])}-${dos(+m[3])}`;
    m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return `${m[3]}-${dos(+m[2])}-${dos(+m[1])}`;
    m = s.match(/(\d{1,2})\s*(?:de\s+)?([a-z]+)\s*(?:de\s+)?(\d{4})/);
    if (m && MESES[m[2]]) return `${m[3]}-${dos(MESES[m[2]])}-${dos(+m[1])}`;
    m = s.match(/([a-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
    if (m && MESES[m[1]]) return `${m[3]}-${dos(MESES[m[1]])}-${dos(+m[2])}`;
    m = s.match(/([a-z]+)\s+(?:de\s+)?(\d{4})/);
    if (m && MESES[m[1]]) return `${m[2]}-${dos(MESES[m[1]])}-01`;
    return null;
  };

  /** «AAAA-MM-DD» → «3 mar 2024». */
  L.fechaBonita = (aaaammdd) => {
    if (!aaaammdd) return '';
    const m = String(aaaammdd).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return String(aaaammdd);
    const nombres = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
    return `${+m[3]} ${nombres[+m[2] - 1]} ${m[1]}`;
  };

  L.escaparHTML = (texto) =>
    String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  /** Huella corta (FNV-1a de 32 bits en hexadecimal) para identificar textos. */
  L.huella = (texto) => {
    let h = 0x811c9dc5;
    const s = String(texto ?? '');
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  };

  /** Mediana de una lista de números (ignora los vacíos). */
  L.mediana = (numeros) => {
    const l = (numeros || []).filter((n) => typeof n === 'number' && Number.isFinite(n)).sort((a, b) => a - b);
    if (!l.length) return null;
    const m = Math.floor(l.length / 2);
    return l.length % 2 ? l[m] : (l[m - 1] + l[m]) / 2;
  };

  /** Copia profunda de datos JSON. */
  L.copia = (valor) => (valor == null ? valor : JSON.parse(JSON.stringify(valor)));

  /** Un dato que no se ha podido leer: siempre con su motivo, nunca una cifra inventada. */
  L.error = (motivo) => ({ ok: false, motivo: String(motivo) });
})((globalThis.LUPA = globalThis.LUPA || {}));
