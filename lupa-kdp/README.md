# LUPA KDP · ventas estimadas de cada libro en Amazon

Extensión de Chrome (uso privado) que, mientras navegas por Amazon.es o Amazon.com, enseña de cada
libro su puesto en ventas (BSR), las **ventas estimadas al día y al mes**, la **regalía KDP** por ejemplar
y al mes, y cómo se ha movido su BSR desde que lo miraste. Con un botón manda el libro como idea nueva a
la **Biblioteca Buen Rato**.

## Instalar en Chrome (una vez)

1. Baja la carpeta de la extensión. Lo más fácil: abre
   https://github.com/agarroda-bit/golden/archive/refs/heads/claude/lupa-kdp-chrome-dndjlm.zip ,
   descomprime el zip y deja la carpeta en `~/Proyectos/`.
   (Con git: `cd ~/Proyectos/golden && git fetch origin && git checkout claude/lupa-kdp-chrome-dndjlm`.)
2. En Chrome escribe en la barra de direcciones: `chrome://extensions`
3. Arriba a la derecha, enciende **Modo de desarrollador**.
4. Pulsa **Cargar descomprimida** y elige la carpeta **`lupa-kdp/extension`** (la de dentro, la que tiene
   `manifest.json`).
5. Pieza de puzle (arriba a la derecha) → chincheta en **Lupa KDP** (una lupa de oro).

Si algún día cambia el código: `chrome://extensions` → Lupa KDP → flecha circular (Recargar), y recarga
las pestañas de Amazon que tengas abiertas.

## Cómo se usa en 1 minuto

1. **Abre la ficha de un libro** en Amazon.es (o Amazon.com). Arriba a la derecha sale el panel de Lupa:
   ventas al día y al mes (con su etiqueta: de dónde sale la cifra), puesto en ventas general y en sus
   categorías, regalía KDP por ejemplar y al mes con la cuenta hecha, la tendencia del BSR y los datos de
   la ficha. El panel se mueve arrastrando la cabecera, se pliega con «–» y se cierra con «×» (el icono
   de Lupa lo vuelve a abrir).
2. **En una búsqueda o en «Los más vendidos»** de Libros o Kindle sale **«Ver ventas»** en cada libro: lee
   su ficha y pinta debajo las ventas, el BSR y la regalía. Abajo a la derecha, **«Analizar página»** lo
   hace con todos los libros de la página, de uno en uno, y al acabar enseña un resumen ordenado por
   ventas con su fila de TOTAL y **«CSV de esta página»**.
3. **«Mandar a la Biblioteca»** (en el panel de la ficha): se abre la Biblioteca Buen Rato y la idea entra
   sola en «Tus ideas de libro», con el título, el formato y la ficha del libro. El panel te dice si ha
   entrado. Si no entra (por ejemplo, si no tienes la sesión de Claude abierta), la idea ya está copiada:
   pégala en «TÚ: ¿qué libro se te ocurre?» y pulsa «Mandar a la fábrica».
4. **«CSV de este libro» / «CSV de todo»**: todas las lecturas guardadas (fecha y hora, BSR, precio,
   reseñas…) para abrir en Excel.

## Qué significan las cifras

- **Ventas estimadas.** Salen del BSR general (el de «Libros» o «Tienda Kindle») con una curva BSR →
  ventas. De fábrica son curvas de **Amazon EE. UU.** (tablas públicas), por eso en Amazon.es salen con la
  etiqueta **«Estimación EE. UU. — sin calibrar para España»**: Amazon.es vende bastante menos que
  Amazon.com con el mismo puesto, así que esas cifras sirven para comparar libros, no para prometer. En
  cuanto calibres la tuya (abajo), la etiqueta pasa a **«Calibrada con tus ventas de Amazon.es · N puntos
  de datos»**.
- **Regalía KDP** por ejemplar, como la paga KDP: **60 % del precio sin IVA si llega a 9,99 €, 50 % si no
  llega**, menos el **coste de impresión** de KDP según páginas, tamaño (normal o grande, sacado de las
  medidas) y tinta. En Amazon.es el precio lleva un 4 % de IVA que se quita antes. Amazon no dice la tinta:
  Lupa supone **negra** y en la casilla amarilla **«TÚ: tinta del libro»** la cambias (se recuerda para ese
  libro). Si no se ven las medidas, sale **«TÚ: tamaño del libro»** para elegirlo. Si la editorial no es
  KDP (Planeta, etc.), lo avisa: es la regalía que tendría si lo fuera. Ojo: Amazon enseña el precio según
  la **dirección de entrega** de arriba a la izquierda; con una dirección de fuera de España (o de Canarias)
  lo enseña ya sin IVA y Lupa no se lo vuelve a quitar (lo avisa).
- **ERROR — motivo.** Si un dato no se puede leer, Lupa no se lo inventa: lo dice. Lo más normal es
  «no aparece el puesto en ventas (BSR) en la ficha»: Amazon no enseña BSR en libros que todavía no han
  vendido (por ejemplo, un libro tuyo recién publicado).
- **Tendencia del BSR.** Cada vez que Lupa lee una ficha (al abrirla, con «Ver ventas» o con «Analizar
  página») guarda la lectura; la gráfica del panel va más arriba cuanto mejor es el puesto.

## Calibrar la curva con tus ventas (cuando tus libros empiecen a vender)

1. Abre las fichas de **tus** libros en Amazon.es de vez en cuando (mejor a diario): cada vez se guarda su
   BSR. Cuantos más días, mejor.
2. En KDP → **Informes**, descarga el informe de pedidos o de ventas (.xlsx).
3. Lupa → **Opciones** (icono de Lupa fuera de Amazon, o «Opciones» en el panel) → pestaña
   **Calibración** → sube el informe en **«TÚ: informe de KDP»**. Si Lupa no reconoce las columnas, te
   enseña las primeras filas y eliges tú cuál es la fecha, el libro y las unidades.
4. Elige tienda y formato (Amazon.es · tapa blanda) → **«Calcular la curva»**. Sale la curva, **cuántos
   puntos de datos** ha usado, los días con ventas, la gráfica con tus datos y la comparación con la de
   EE. UU. Con pocos datos no calibra y te dice cuántos hay.
5. **«Usar esta curva en Amazon.es (tapa blanda)»**. Desde ese momento el panel usa tu curva y lo dice.

Si tienes lecturas de BSR apuntadas en otro sitio, súbelas en un CSV con columnas `Fecha;ASIN;BSR`.

## Reglas que no se saltan

- **Solo lo que tienes delante**: Lupa lee la ficha abierta o los libros de la búsqueda o lista que tienes
  en pantalla. Nunca abre otras páginas por su cuenta (ni la página siguiente de la búsqueda) y **no hace
  nada en segundo plano**: ni alarmas ni tareas programadas.
- **Ritmo de persona** en «Analizar página»: de una en una, **4 a 6 segundos al azar** entre ficha y ficha
  y **como mucho 30 fichas por página**. Una ficha leída hace menos de 60 minutos sale del historial y no
  se vuelve a pedir.
- **Si Amazon pide comprobar que eres una persona** (o pone su pantalla de verificación al leer una ficha en
  segundo plano), Lupa se para del todo, lo dice en rojo y pone «!» en su icono. No intenta saltarlo:
  resuélvelo tú. Durante **media hora** «Analizar página» no funciona (dice hasta qué hora); «Ver ventas»
  libro a libro sí.
- **Solo libros**: en la ficha de un reloj o de cualquier otra cosa, Lupa no pinta nada.

## Si Amazon cambia sus fichas

Los textos que Lupa reconoce están en `extension/lib/tiendas.js` y los selectores en
`extension/lib/lector.js`. Para ver qué se ha roto:

1. `cd ~/Proyectos/golden/lupa-kdp && npm run fixtures` — saca páginas nuevas de Amazon.es (Chromium con
   ventana, perfil temporal, cookies rechazadas, pausas de persona) en `tests/fixtures/nuevas/`.
2. `npm run test:lectores` — dice qué dato ya no se lee en cada página nueva.
3. Arreglar el texto en `tiendas.js` o el selector en `lector.js`, pasar `npm test` y `npm run test:real`, y
   recargar la extensión en `chrome://extensions`.

Una ficha concreta que falle también vale: Chrome → «Guardar como…» y
`node scripts/recortar-fixture.mjs <ficha.html> tests/fixtures/nuevas/<nombre>.html ficha <dirección>`.

---

## Para Claude (técnico)

- `extension/` es lo que carga Chrome, **sin compilar** (como RADAR): `manifest.json` (MV3), `background.js`
  (service worker, módulo; único que escribe en `chrome.storage.local`, en cola), `contenido/` (Amazon:
  `amazon.js` orquesta, `panel.js` panel de la ficha, `lista.js` búsquedas y «Los más vendidos», `ui.js`
  sombra, estilo, fuentes y contador; Biblioteca: `biblioteca.js`), `lib/` (todo cuelga de
  `globalThis.LUPA`: `lector`, `estimacion`, `regalias`, `historial`, `exportar`, `calibracion`, `hojas`,
  `biblioteca`, `tiendas`, `base`), `opciones/`, `fuentes/` (Oswald y Rubik, OFL) e `iconos/`.
- Almacenamiento: `h:<tienda>:<ASIN>` (lecturas del libro), `curvas`, `asignacion` (curva por tienda y
  formato), `ajustes`, `calibracion` (informe importado), `biblioteca` (bandeja de ideas), `ultimoBloqueo`
  (hora de la última comprobación de robot).
- Permisos: `storage`, `unlimitedStorage`, `clipboardWrite`; webs: Amazon.es, Amazon.com y
  `*.frame.claudeusercontent.com` (marco de la Biblioteca). Sin `tabs`, sin alarmas.
- Pruebas: `npm test` (unitarias con `node --test`; lector contra páginas de Amazon guardadas; la
  extensión cargada en Chromium con Amazon y la Biblioteca simulados, sin internet: todo lo que no sirve la
  prueba va a un proxy muerto). `npm run test:real` abre Amazon.es de verdad (ventana visible, perfil
  temporal, cookies rechazadas): las tres fichas del encargo; deja en `.tmp/real/` lo que enseña el panel,
  capturas y el HTML de cada ficha.
- Playwright fijado a 1.63.0 (casa con el Chromium del Mac, chromium-1243). En la nube de Claude se usa
  `/opt/pw-browsers/chromium` (o `LUPA_CHROMIUM=/ruta/al/chrome`).
- `tests/datos/generar-kdp.py` genera informes de KDP de prueba desde una curva conocida (la prueba de
  calibración comprueba que el ajuste la recupera).
- Decisiones en `DECISIONES.md`, estado en `PROGRESO.md`, informe en `INFORME.md`.
