# Informe — Lupa KDP

Para pegar en el chat de Claude. Noche del 14 al 15/10/2026.

**En una línea:** Lupa KDP está hecha y probada. En Amazon.es (y .com) enseña de cada libro su BSR, las
ventas estimadas al día y al mes, la regalía KDP y la tendencia del BSR; tiene «Ver ventas» y «Analizar
página» en búsquedas y «Los más vendidos», calibración con el informe de KDP, CSV y «Mandar a la
Biblioteca». Probada en Amazon.es de verdad con la sopa de letras y el Murdoku; de Buen Rato todavía no hay
ningún libro a la venta.

## 1. Qué hace, punto por punto

| # | Qué | Estado | Cómo se ha probado |
|---|---|---|---|
| 1 | Extensión de Chrome MV3 con la estructura de VITRINA (copiada de RADAR, su hermana). VITRINA y el Publicador KDP no se han tocado (están en el Mac de Rodri, fuera del alcance de esta sesión) | **Hecho** | Cargada en Chromium con `--load-extension` |
| 2 | Ficha `/dp/`: BSR general y de categorías, precio, formato, páginas, fecha de publicación, reseñas y nota. Panel flotante con ventas/día, ventas/mes y regalía (60 % o 50 % del precio sin IVA menos la impresión de KDP por páginas y tamaño) | **Hecho** | Amazon.es de verdad (2 fichas) + pruebas del lector con páginas reales guardadas |
| 3 | «Ver ventas» en cada libro y «Analizar página» en búsquedas y «Los más vendidos»: de una en una, 4–6 s al azar, como mucho 30 por página, solo la página abierta, nada en segundo plano | **Hecho** | Búsqueda real guardada + simulacros. «Los más vendidos» solo con una página sintética (ver fallos) |
| 4 | Curva BSR→ventas por tienda y formato (tapa blanda / Kindle). De fábrica, la de EE. UU. con la etiqueta «Estimación EE. UU. — sin calibrar para España». Calibración: informe de ventas de KDP + lecturas de BSR de sus libros → curva potencial propia para Amazon.es, con el número de puntos de datos usados. ERROR con motivo si falta un dato | **Hecho** | Pruebas con informes de KDP de prueba (.xlsx y .csv) hechos desde una curva conocida: el ajuste la recupera |
| 5 | Historial de cada lectura (ASIN, fecha y hora, BSR, precio…) en `chrome.storage`, tendencia en el panel, CSV, «Mandar a la Biblioteca» con título, formato y ficha | **Hecho**; la Biblioteca, **a medias**: probada con una copia simulada de su formulario, no dentro de claude.ai | Simulacros |
| 6 | Estilo: fondo oscuro, oro y azul hielo, títulos en Oswald, texto en Rubik, contador animado | **Hecho** | Capturas |
| 7 | Cada cambio con su simulacro, comprobación y commit | **Hecho**: 11 commits, 79 pruebas sin internet en verde | — |

## 2. Archivos creados

Todo en la carpeta **`lupa-kdp/`** del repositorio `agarroda-bit/golden`, rama
**`claude/lupa-kdp-chrome-dndjlm`**. Lo que carga Chrome es **`lupa-kdp/extension`**.

```
lupa-kdp/
├── extension/                 ← lo que carga Chrome (sin compilar, 384 KB)
│   ├── manifest.json          MV3 · permisos: storage, unlimitedStorage, clipboardWrite
│   ├── background.js          service worker: único que guarda (en cola); sin alarmas
│   ├── contenido/             amazon.js (orquesta), panel.js (panel de la ficha),
│   │                          lista.js (búsquedas y «Los más vendidos»), ui.js (estilo, fuentes,
│   │                          contador), biblioteca.js (entrega la idea en la Biblioteca)
│   ├── lib/                   lector (lee Amazon), estimacion (curvas), regalias (KDP), historial,
│   │                          exportar (CSV), calibracion, hojas (lee .xlsx), biblioteca, tiendas, base
│   ├── opciones/              Opciones: Curvas · Calibración · Historial · Biblioteca · Regalía y ritmo
│   ├── fuentes/               Oswald y Rubik (licencia OFL), cargadas desde dentro
│   └── iconos/                lupa de oro (16, 32, 48, 128 px)
├── tests/                     unidad/ (node --test), lectores/, e2e/ (extensión cargada, sin internet),
│                              real/ (Amazon.es de verdad), fixtures/ (páginas reales recortadas)
├── scripts/                   capturar-fixtures, recortar-fixture, fuentes, iconos
├── README.md                  instalar, usar, calibrar, reglas, parte técnica
├── DECISIONES.md              41 decisiones tomadas sin preguntar
├── PROGRESO.md                historial del trabajo
└── INFORME.md                 este informe
```

## 3. Cómo cargarla en Chrome

1. Bajar la rama en zip:
   https://github.com/agarroda-bit/golden/archive/refs/heads/claude/lupa-kdp-chrome-dndjlm.zip
   y descomprimirlo en `~/Proyectos/` (con git: `git fetch origin && git checkout claude/lupa-kdp-chrome-dndjlm`).
2. Chrome → `chrome://extensions`.
3. Encender **Modo de desarrollador** (arriba a la derecha).
4. **Cargar descomprimida** → la carpeta **`lupa-kdp/extension`** (la que tiene `manifest.json`).
5. Pieza de puzle → chincheta en **Lupa KDP**.
6. Abrir la ficha de cualquier libro en Amazon.es: el panel sale arriba a la derecha.

## 4. Las 3 pruebas con Amazon.es de verdad

`npm run test:real`, el 15/10/2026 a las 00:47 UTC: Chromium con Lupa cargada, ventana, perfil temporal que
se borra al acabar, cookies rechazadas, entrada por la portada y pausas de 8 a 15 s. Ninguna comprobación de
robot durante la prueba. Cifras tal como las pintó el panel:

| Libro | BSR leído | Ventas estimadas | Regalía KDP estimada |
|---|---|---|---|
| **Sopa de letras** — «Sopa de Letras en Español - Letra Grande: 5000 Palabras - 224 Puzles» (B0DZ2439GN, Martin Littlewolf, KDP) | **nº 4.634 en Libros** · nº 75 en Juegos y adivinanzas | **9,1 al día · 273 al mes** | **0,76 €** por ejemplar = 50 % × 5,76 € − 2,12 € de impresión (5,99 € con IVA, tapa blanda, 114 págs., tamaño normal, tinta negra) · **207,81 € al mes** |
| **Murdoku** — «Murdoku: Viaje al pasado» (B0H29QB982, Manuel Garand, Ediciones Temas de Hoy) | **nº 8 en Libros** · nº 2 en Juegos y adivinanzas · nº 7 en Misterios · nº 12 en Ficción por género | **1.237 al día · 37.107 al mes**, con el aviso «BSR fuera de la tabla (100–100.000): la cifra se ha prolongado y es menos fiable» | **5,99 €** «si fuera de KDP» = 60 % × 17,21 € − 4,33 € (precio de catálogo 17,90 €, oferta 17,00 €; 224 págs., tamaño grande) · con el aviso de que la editorial no es KDP |
| **Buen Rato** | — | — | **No hay ningún libro de Buen Rato a la venta todavía**: la búsqueda «Buen Rato Recuerdos» en Amazon.es da «No hay resultados». Cuando salga, su ficha enseñará «ERROR — no aparece el puesto en ventas (BSR) en la ficha» hasta su primera venta (está en el simulacro). Para probarlo entonces: `LUPA_BUEN_RATO_ASIN=B0… npm run test:real` |

Todas con la etiqueta **«Estimación EE. UU. — sin calibrar para España»**. Unas horas antes la sopa estaba
en nº 1.415 (21,7 al día) y el Murdoku en nº 5: el BSR se mueve mucho, por eso cada lectura se guarda.

Cómo leerlo: las cifras salen de tablas de Amazon.com. Amazon.es vende bastante menos con el mismo puesto,
así que las 37.107 al mes del Murdoku (nº 8 de todos los libros de Amazon.es, por encima de la tabla de
EE. UU.) no son creíbles para España. Sirven para comparar libros entre sí; para cifras de España hay que
calibrar con las ventas de Rodri.

## 5. Fallos encontrados

1. **Amazon pone en guardia a la IP de la nube de Claude** tras unas pocas páginas: comprobación de robot de
   las 23:30 a las 00:45 UTC; a las 00:46 abrió y pasó la prueba real; a las 00:50 volvió a cerrar, esta vez
   con otra defensa, la **pantalla de verificación del navegador (Akamai «bm-verify»)**. No se ha intentado
   saltar nada. Arreglado en Lupa: esa pantalla ahora también la para cuando lee fichas en segundo plano, y
   tras cualquier comprobación de robot **«Analizar página» espera media hora** (dice hasta qué hora). Antes
   el «!» del icono no se quitaba nunca; ahora se quita con la primera ficha buena pasada esa media hora.
   En el Mac de Rodri, con su red y su sesión, no debería pasar con un uso normal.
2. **Las fichas de Amazon.es de hoy no son como las de los ejemplos de internet**: el BSR viene como
   «nº1.415» sin espacio, las páginas como «Longitud de impresión», el formato en la línea del autor
   («Formato: Tapa blanda»), el precio a veces solo en el selector de formatos («desde 5,99 €») y sin
   subtítulo con la fecha. Lector ajustado y probado con las páginas reales.
3. **El precio depende de la dirección de entrega**: la misma sopa sale a 5,99 € entregando en Madrid y a
   5,76 € (sin IVA) entregando en Estados Unidos. Arreglado: Lupa lee la dirección de la cabecera y solo
   quita el 4 % de IVA si el precio lo lleva (lo avisa si no). Con la dirección de Rodri en España no
   cambia nada.
4. **La regla de la regalía no es «60 % del precio»**: desde el 10/06/2025 KDP paga el 60 % solo si el precio
   sin IVA llega a 9,99 €, y el 50 % por debajo; y siempre sobre el precio **sin IVA**. Lupa aplica la regla
   de KDP (se puede cambiar en Opciones). Ojo con los libros de Buen Rato: el precio que se pone en KDP para
   Amazon.es va **sin IVA**, así que un libro a 12,99 € en KDP saldrá en Amazon.es a **13,51 €**.
5. **Las tablas públicas de EE. UU. discrepan mucho entre sí** (de 2 a 5 veces en el mismo BSR) y no dicen
   nada de España: por eso la etiqueta va siempre a la vista hasta calibrar.
6. **Murdoku con medidas raras**: Amazon da 26 × 1 × 12 cm, que no casa con la portada; Lupa lo toma como
   12 de ancho por 26 de alto y sale «tamaño grande» (más de 22,86 cm). Da igual para la regalía, porque no es
   de KDP, y lo dice.
7. **«Mandar a la Biblioteca» no se ha podido probar dentro de claude.ai** (hace falta la sesión de Rodri):
   probado con una copia simulada del formulario de la Biblioteca, incluido el marco escondido de
   «calentamiento» que abre claude.ai (en las pruebas se quedaba con la idea; arreglado). Si en la de verdad
   no entrara, la idea queda copiada para pegarla y en Opciones → Biblioteca con «Reintentar».
8. **«Los más vendidos» de verdad sin probar**: Amazon cerró antes de llegar a esa página. Probado con una
   página sintética que sigue las estructuras conocidas de Amazon y con varias formas de llevar el ASIN.
   La búsqueda sí está probada con una página real.
9. **`npm run fixtures` no existía** (estaba en `package.json` sin su script): hecho; guarda las páginas
   nuevas aparte (`tests/fixtures/nuevas/`) y `npm run test:lectores` dice si Lupa las sigue leyendo.
10. **El repositorio `golden` es público**: lleva solo el código de Lupa, sin ventas ni datos de la
    Biblioteca. Si Rodri lo prefiere privado, se puede pasar a un repositorio propio como RADAR.

## 6. Pruebas sin internet (15/10, todas en verde)

- **39 unitarias**: regalías (tablas de impresión, 60/50 %, IVA según la entrega, Kindle), curvas, historial,
  CSV, ideas para la Biblioteca, calibración (lector de .xlsx, columnas, fechas, ajuste).
- **7 del lector** contra páginas reales recortadas (sopa del 15/10, búsqueda real, comprobación de robot y
  pantalla de verificación reales) y sintéticas (Kindle, sin BSR); el Murdoku, reconstruido de la ficha real.
- **33 con la extensión cargada en Chromium** y Amazon y la Biblioteca simulados: panel, listas (ritmo de
  4–6 s, tope de 30, parada por robot, caché de 60 min), bloqueos, Opciones, calibración, Biblioteca, solo
  libros.

## 7. PENDIENTE (lo que tiene que hacer Rodri)

1. **Instalar la extensión** (apartado 3) y abrir la ficha de un libro en Amazon.es.
2. **Probar una vez «Mandar a la Biblioteca»** con la sesión de Claude abierta y decir si la idea entró en
   «Tus ideas de libro».
3. **Abrir «Los más vendidos» de Libros** una vez y mirar si sale «Ver ventas» en cada libro. Si no sale:
   `cd ~/Proyectos/golden/lupa-kdp && npm install && npm run fixtures && npm run test:lectores` y pasarle el
   resultado a Claude.
4. **Cuando salgan los libros de Buen Rato**: abrir sus fichas en Amazon.es a diario (cada visita guarda el
   BSR) y a las 2–4 semanas subir el informe de KDP en Opciones → Calibración → «Usar esta curva».
5. Opcional: `npm run test:real` en el Mac (las 3 fichas con su red; deja capturas en `.tmp/real/`).
