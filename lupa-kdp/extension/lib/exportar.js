/* Lupa KDP — CSV para Excel (igual que RADAR): UTF-8 con BOM, separador «;», saltos de línea de
   Windows, decimales con coma y protección para que Excel no tome un texto por una fórmula. */
(function (L) {
  'use strict';

  /** Evita que Excel tome un texto por una fórmula («=…», «+…», «-…», «@…»). */
  function seguro(valor) {
    const s = String(valor ?? '');
    return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  }

  function celda(valor) {
    if (typeof valor === 'number') return Number.isFinite(valor) ? String(valor).replace('.', ',') : '';
    const s = seguro(valor);
    return /[;"\n\r]|^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function csv(cabecera, filas) {
    const lineas = [cabecera.map(celda).join(';'), ...filas.map((f) => f.map(celda).join(';'))];
    return `﻿${lineas.join('\r\n')}\r\n`;
  }

  const COLUMNAS_HISTORIAL = [
    'Fecha', 'Hora', 'Tienda', 'ASIN', 'Título', 'Autor', 'Formato', 'BSR general', 'Categoría del BSR', 'Puestos en categorías',
    'Precio', 'Moneda', 'Reseñas', 'Nota', 'Páginas', 'Fecha de publicación', 'Ventas/día estimadas', 'Ventas/mes estimadas',
    'Curva usada', 'Regalía por ejemplar', 'Origen de la lectura', 'Enlace',
  ];

  const dos = (n) => String(n).padStart(2, '0');

  /**
   * Una fila por lectura. Las ventas y la regalía se calculan con las curvas actuales.
   * entradas: registros «h:…»; contexto: { asignacion, curvas, ajustes }.
   */
  function csvHistorial(entradas, contexto = {}) {
    const filas = [];
    const orden = [...(entradas || [])].sort((a, b) => String(a.titulo || '').localeCompare(String(b.titulo || ''), 'es'));
    for (const e of orden) {
      const f = e.ficha || {};
      for (const l of e.lecturas || []) {
        const d = new Date(l.f);
        const fichaLectura = { ...f, tienda: e.tienda, precio: l.precio, precioCatalogo: null, bsr: { general: l.bsr, categoriaGeneral: l.cat, categorias: [], motivo: l.sinBsr || null }, ...(e.prefs || {}) };
        const est = L.estimar(fichaLectura, contexto);
        filas.push([
          L.fechaCorta(l.f),
          `${dos(d.getHours())}:${dos(d.getMinutes())}`,
          e.tienda,
          e.asin,
          e.titulo || '',
          e.autor || '',
          e.formato || '',
          l.bsr ?? '',
          l.cat || '',
          (l.cats || []).map(([p, n]) => `nº ${L.miles(p)} en ${n}`).join(' | '),
          l.precio ?? '',
          l.moneda || '',
          l.resenas ?? '',
          l.nota ?? '',
          f.paginas ?? '',
          f.fechaPublicacion ? L.fechaCorta(`${f.fechaPublicacion}T12:00:00`) : '',
          est.ventas.ok ? L.redondear(est.ventas.dia, 2) : `ERROR: ${est.ventas.motivo}`,
          est.ventas.ok ? L.redondear(est.ventas.mes, 1) : '',
          est.curva ? est.curva.nombre : '',
          est.regalia.ok ? L.redondear(est.regalia.regalia, 2) : `ERROR: ${est.regalia.motivo}`,
          l.origen || '',
          e.url || '',
        ]);
      }
    }
    return csv(COLUMNAS_HISTORIAL, filas);
  }

  /** Nombre de archivo con la fecha: «lupa-kdp-historial_2026-10-15_0130.csv». */
  function nombreArchivo(base, ext = 'csv') {
    const d = new Date();
    return `${base}_${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}_${dos(d.getHours())}${dos(d.getMinutes())}.${ext}`;
  }

  L.exportar = { seguro, celda, csv, csvHistorial, COLUMNAS_HISTORIAL, nombreArchivo };
})((globalThis.LUPA = globalThis.LUPA || {}));
