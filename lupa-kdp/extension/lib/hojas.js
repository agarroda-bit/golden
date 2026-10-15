/* Lupa KDP — lectura de hojas de cálculo sin librerías: .xlsx (el formato en que KDP descarga sus
   informes) y .csv. Un .xlsx es un ZIP con XML dentro: se abre el ZIP, se descomprime con
   DecompressionStream (lo trae Chrome) y se leen las hojas. Funciona en Opciones y en Node (pruebas).
   Devuelve siempre [{ nombre, filas: [[celda, celda, …], …] }]: números como número, textos como texto. */
(function (L) {
  'use strict';

  // ------------------------------------------------------------------ ZIP

  async function inflar(datos) {
    const flujo = new Blob([datos]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(flujo).arrayBuffer());
  }

  /** Archivos de un ZIP: Map(nombre → Uint8Array descomprimido). */
  async function leerZip(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let fin = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) {
        fin = i;
        break;
      }
    }
    if (fin < 0) throw new Error('el archivo no es un .xlsx (no tiene el índice de un ZIP)');
    const total = dv.getUint16(fin + 10, true);
    let p = dv.getUint32(fin + 16, true);
    const utf8 = new TextDecoder('utf-8');
    const archivos = new Map();
    for (let k = 0; k < total; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('el .xlsx está dañado (índice del ZIP roto)');
      const metodo = dv.getUint16(p + 10, true);
      const comprimido = dv.getUint32(p + 20, true);
      const lNombre = dv.getUint16(p + 28, true);
      const lExtra = dv.getUint16(p + 30, true);
      const lComentario = dv.getUint16(p + 32, true);
      const local = dv.getUint32(p + 42, true);
      const nombre = utf8.decode(bytes.subarray(p + 46, p + 46 + lNombre));
      p += 46 + lNombre + lExtra + lComentario;
      if (dv.getUint32(local, true) !== 0x04034b50) continue;
      const inicio = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
      const datos = bytes.subarray(inicio, inicio + comprimido);
      if (metodo === 0) archivos.set(nombre, datos);
      else if (metodo === 8) archivos.set(nombre, await inflar(datos));
    }
    return archivos;
  }

  // ------------------------------------------------------------------ XML sencillo

  const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  const desescapar = (s) =>
    String(s).replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, c) => {
      if (c[0] === '#') return String.fromCodePoint(c[1].toLowerCase() === 'x' ? parseInt(c.slice(2), 16) : parseInt(c.slice(1), 10));
      return ENTIDADES[c] ?? m;
    });
  const atributo = (attrs, nombre) => {
    const m = attrs.match(new RegExp(`(?:^|\\s)${nombre}="([^"]*)"`));
    return m ? desescapar(m[1]) : null;
  };
  /** Texto de un trozo con <t>…</t> (y sus «runs»), sin la fonética japonesa <rPh>. */
  const textoDe = (xml) =>
    [...String(xml).replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => desescapar(m[1])).join('');

  /** «AB12» → 27 (columna base 0). */
  const columna = (ref) => {
    const letras = String(ref || '').match(/^[A-Z]+/);
    if (!letras) return null;
    let n = 0;
    for (const c of letras[0]) n = n * 26 + (c.charCodeAt(0) - 64);
    return n - 1;
  };

  function leerHojaXml(xml, compartidas) {
    const filas = [];
    for (const fila of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>|<row\b([^>]*)\/>/g)) {
      const attrs = fila[1] || fila[3] || '';
      const r = Number(atributo(attrs, 'r'));
      const indice = Number.isFinite(r) && r > 0 ? r - 1 : filas.length;
      const celdas = [];
      let siguiente = 0;
      for (const c of (fila[2] || '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const a = c[1];
        const dentro = c[2] || '';
        const col = columna(atributo(a, 'r'));
        const i = col == null ? siguiente : col;
        siguiente = i + 1;
        const tipo = atributo(a, 't');
        const v = dentro.match(/<v>([\s\S]*?)<\/v>/);
        let valor = null;
        if (tipo === 's') valor = v ? compartidas[Number(v[1])] ?? null : null;
        else if (tipo === 'inlineStr') valor = textoDe((dentro.match(/<is>([\s\S]*?)<\/is>/) || [])[1] || '');
        else if (tipo === 'str' || tipo === 'd' || tipo === 'e') valor = v ? desescapar(v[1]) : null;
        else if (tipo === 'b') valor = v ? v[1] === '1' : null;
        else if (v) {
          const n = Number(v[1]);
          valor = Number.isFinite(n) ? n : desescapar(v[1]);
        }
        celdas[i] = valor;
      }
      for (let i = 0; i < celdas.length; i++) if (celdas[i] === undefined) celdas[i] = null;
      filas[indice] = celdas;
    }
    for (let i = 0; i < filas.length; i++) if (!filas[i]) filas[i] = [];
    return filas;
  }

  /** Todas las hojas de un .xlsx. */
  async function leerXlsx(buffer) {
    const zip = await leerZip(buffer);
    const texto = (nombre) => (zip.has(nombre) ? new TextDecoder('utf-8').decode(zip.get(nombre)) : null);
    const libro = texto('xl/workbook.xml');
    if (!libro) throw new Error('el .xlsx no tiene libro (xl/workbook.xml)');
    const compartidas = [...(texto('xl/sharedStrings.xml') || '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textoDe(m[1]));
    const relaciones = new Map([...(texto('xl/_rels/workbook.xml.rels') || '').matchAll(/<Relationship\b([^>]*)\/?>/g)].map((m) => [atributo(m[1], 'Id'), atributo(m[1], 'Target')]));
    const hojas = [];
    for (const m of libro.matchAll(/<sheet\b([^>]*)\/?>/g)) {
      const nombre = atributo(m[1], 'name');
      const destino = relaciones.get(atributo(m[1], 'r:id'));
      if (!destino) continue;
      const ruta = destino.startsWith('/') ? destino.slice(1) : `xl/${destino.replace(/^\.\//, '')}`;
      const xml = texto(ruta);
      if (xml) hojas.push({ nombre, filas: leerHojaXml(xml, compartidas) });
    }
    return hojas;
  }

  // ------------------------------------------------------------------ CSV

  /** CSV con «;», «,» o tabulador (lo adivina), comillas dobles y BOM. */
  function leerCsv(texto, nombre = 'CSV') {
    const s = String(texto || '').replace(/^﻿/, '');
    const primera = s.split(/\r?\n/, 1)[0] || '';
    const cuenta = (c) => primera.split('"').filter((_, i) => i % 2 === 0).join('').split(c).length - 1;
    const sep = [';', '\t', ','].sort((a, b) => cuenta(b) - cuenta(a))[0];
    const filas = [];
    let fila = [];
    let celda = '';
    let comillas = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (comillas) {
        if (c === '"' && s[i + 1] === '"') {
          celda += '"';
          i++;
        } else if (c === '"') comillas = false;
        else celda += c;
      } else if (c === '"') comillas = true;
      else if (c === sep) {
        fila.push(celda);
        celda = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && s[i + 1] === '\n') i++;
        fila.push(celda);
        filas.push(fila);
        fila = [];
        celda = '';
      } else celda += c;
    }
    if (celda !== '' || fila.length) {
      fila.push(celda);
      filas.push(fila);
    }
    return [{ nombre, filas: filas.filter((f) => f.some((x) => String(x).trim() !== '')) }];
  }

  /** Lee un archivo (ArrayBuffer) según su nombre: .xlsx o .csv/.txt/.tsv. */
  async function leerArchivo(nombre, buffer) {
    if (/\.xlsx$/i.test(nombre)) return leerXlsx(buffer);
    if (/\.(csv|txt|tsv)$/i.test(nombre)) return leerCsv(new TextDecoder('utf-8').decode(buffer), nombre);
    if (/\.xls$/i.test(nombre)) throw new Error('es un .xls antiguo: ábrelo en Excel y guárdalo como .xlsx o .csv');
    throw new Error('solo se leen archivos .xlsx o .csv');
  }

  L.hojas = { leerZip, leerXlsx, leerCsv, leerArchivo, columna };
})((globalThis.LUPA = globalThis.LUPA || {}));
