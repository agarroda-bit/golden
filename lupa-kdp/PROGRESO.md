# PROGRESO — Lupa KDP

Documento vivo. Noche del 14 al 15/10/2026. Arriba lo último.

## Estado

Hecho y probado (79 pruebas sin internet en verde). Prueba real en Amazon.es pasada con la sopa de letras y
el Murdoku; Buen Rato aún no tiene libros a la venta. Informe en `INFORME.md`.

Pendiente de Rodri: instalarla, probar «Mandar a la Biblioteca» con su sesión, mirar una vez «Los más
vendidos» de Libros y, cuando vendan sus libros, calibrar con el informe de KDP.

## Historial

- 15/10, 01:00: informe final. Pantalla de verificación de Akamai reconocida, media hora de espera tras un
  bloqueo, IVA según la dirección de entrega, `npm run fixtures` (no existía) y la prueba real guarda el
  HTML de cada ficha.
- 15/10, 00:50: Amazon vuelve a ponerse en guardia, ahora con su pantalla de verificación del navegador.
  No se insiste.
- 15/10, 00:47: **prueba real con la extensión en Amazon.es**: sopa nº 4.634 → 9,1/día, 273/mes, 0,76 €;
  Murdoku nº 8 → 1.237/día (fuera de tabla, avisado), 5,99 € si fuera KDP; Buen Rato sin libros a la venta.
  Ficha real de la sopa guardada (sustituye a la reconstruida).
- 15/10, 00:40: solo libros (nada en relojes ni otras secciones); aviso de editorial que no es KDP.
- 15/10, madrugada: «Mandar a la Biblioteca» (la idea entra por el formulario de la Biblioteca; bandeja en
  Opciones). Calibración con el informe de KDP (.xlsx/.csv) y ajuste de Poisson. Opciones completas.
  «Ver ventas» y «Analizar página» en búsquedas y «Los más vendidos». Panel flotante de la ficha.
- 14/10, 23:30: Amazon empieza a pedir la comprobación de robot a la IP de la nube de Claude tras unas
  pocas páginas: las pruebas con Amazon de verdad se aplazan y se usan fichas guardadas.
- 14/10, noche: núcleo (cálculos de regalía con las tablas oficiales de KDP, curvas BSR→ventas, lector de
  Amazon, historial, CSV e ideas para la Biblioteca), pruebas unitarias, fuentes, iconos y Opciones (curvas).
