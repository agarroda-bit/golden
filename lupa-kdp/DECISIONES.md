# Decisiones tomadas sin preguntar

El encargo pedía trabajar sin preguntar. Cuando había dudas se eligió lo razonable y se apuntó aquí.
Cualquiera de estas cosas se puede cambiar.

## Carpeta, forma y herramientas

1. **Carpeta `lupa-kdp/` dentro del repositorio `golden`** (rama `claude/lupa-kdp-chrome-dndjlm`), que es
   el que tenía esta sesión de Claude en la nube. VITRINA y el Publicador KDP viven en el Mac de Rodri
   (`~/Proyectos/…`) y no estaban al alcance de esta sesión: **no se ha tocado nada de ninguna de las dos**.
   La estructura copia la de RADAR (`agarroda-bit/radar-extension`), que es hermana de VITRINA y sigue
   sus mismas convenciones; RADAR solo se ha leído, no se ha cambiado.
2. **JavaScript puro, sin compilar**, como RADAR: Chrome carga la carpeta `lupa-kdp/extension` tal cual con
   «Cargar descomprimida». Lo de fuera (`tests/`, `scripts/`) es para probar; Chrome no lo ve.
3. **Playwright 1.63.0 fijado**, como RADAR y VITRINA, porque casa con el Chromium que ya tiene el Mac
   (chromium-1243). En la nube de Claude se usa el Chromium que ya había (`/opt/pw-browsers/chromium`).
4. **Estilo de la casa de la Biblioteca Buen Rato**: noche `#0B0F1A`, oro `#D4A64A`, azul hielo `#5FB8E6`,
   títulos y cifras en Oswald, texto en Rubik, casillas de Rodri en amarillo con «TÚ:». Las dos fuentes van
   dentro de la extensión (licencia SIL OFL, juego «latin») y se cargan desde memoria: no se piden a
   Google ni dependen de lo que deje cargar Amazon.

## Regalía estimada

5. **60 % o 50 %, como KDP desde el 10/06/2025.** El encargo decía «60 % del precio»; KDP paga el 60 % solo
   si el precio de catálogo sin IVA llega a 9,99 € (o 9,99 $) y el 50 % por debajo. Se aplica la regla de
   KDP para no inflar la regalía de los libros baratos; el porcentaje y el umbral se pueden cambiar.
6. **Precio sin IVA.** Amazon.es enseña el precio con el 4 % de IVA de los libros, y KDP calcula la regalía
   sobre el precio sin IVA: se divide entre 1,04 antes de calcular. En Amazon.com no hay IVA en el precio.
7. **Costes de impresión: tablas oficiales de KDP** (consultadas el 14/10/2026): tapa blanda con tinta negra,
   color estándar y color prémium; tapa dura con tinta negra y color prémium; en euros y en dólares. Tamaño
   grande = más de 6,12" (15,55 cm) de ancho o más de 9" (22,86 cm) de alto, sacado de las medidas de la
   ficha. Un número de páginas impar se cobra como el par siguiente.
8. **Tinta negra por defecto.** Amazon no dice la tinta de un libro: el panel supone tinta negra y lo dice;
   si el libro es a color, se cambia en la casilla amarilla «TÚ: tinta» y se recuerda para ese libro.
9. **Si Amazon enseña un precio tachado de catálogo más alto que el de venta, la regalía usa el de
   catálogo** (KDP paga sobre el precio de catálogo aunque Amazon lo rebaje).
10. **Kindle**: 70 % del precio sin IVA entre 2,99 y 9,99 (menos la entrega: 0,10 €/MB en Amazon.es,
    0,15 $/MB en Amazon.com) y 35 % fuera de esa franja. Si la ficha no dice el tamaño del archivo, se
    calcula sin la entrega y se avisa.

## Ventas estimadas

11. **Curvas de EE. UU. de fábrica, con su fuente a la vista**: libros impresos con la tabla pública
    «Amazon Books» de bookcoverslab.com y Kindle con la de profitable.app (las dos de Amazon.com,
    consultadas el 14/10/2026). Las tablas públicas discrepan mucho entre sí (de 2 a 5 veces en el mismo
    BSR); por eso Amazon.es lleva siempre la etiqueta «Estimación EE. UU. — sin calibrar para España»
    hasta que haya una curva calibrada con las ventas de Rodri.
12. **Entre dos puntos de la tabla se interpola en escala logarítmica**; fuera de la tabla se prolonga el
    último tramo y el panel avisa de que es menos fiable.
13. **Ventas al mes = ventas al día × 30.**
14. **Nunca una cifra inventada**: sin BSR general (libro sin ventas, o solo con puesto en categorías), con
    un formato sin curva (audiolibro) o sin precio, el panel enseña ERROR y el motivo.

## Historial

15. **Un registro por libro y tienda** (`h:<tienda>:<ASIN>`) en `chrome.storage.local`, con permiso de
    almacenamiento ilimitado. El service worker es el único que escribe, en cola.
16. **Una lectura idéntica a la anterior (mismo BSR y mismo precio) a menos de 30 minutos no se repite**:
    Amazon actualiza el BSR más o menos cada hora y solo sería ruido en la gráfica.
17. **CSV como el de RADAR**: UTF-8 con BOM, «;», saltos de línea de Windows, decimales con coma y una
    comilla delante de lo que empiece por «=», «+», «-» o «@» para que Excel no lo tome por fórmula.
    Las ventas y la regalía del CSV se calculan con las curvas que haya en ese momento.

## Sin tareas en segundo plano

18. **El service worker no hace nada por su cuenta**: no hay alarmas ni temporizadores. Solo contesta a lo
    que pide la pestaña de Amazon que Rodri tiene abierta o la página de Opciones.

## Búsquedas y «Los más vendidos»

19. **Las fichas se leen en segundo plano desde la propia pestaña de Amazon** (una petición normal con la
    sesión de Rodri, como si abriera la ficha) en vez de abrir pestañas: no llena el navegador de pestañas
    ni ejecuta los scripts de Amazon, y la ficha que llega es la misma.
20. **Ritmo fijo: de una en una, 4 a 6 s al azar entre ficha y ficha y como mucho 30 fichas pedidas a
    Amazon por página.** No se puede cambiar desde Opciones (solo las pruebas automáticas acortan la pausa
    con una marca interna). Las fichas que salen del historial no cuentan ni esperan.
21. **Una ficha leída hace menos de 60 minutos sale del historial** y no se vuelve a pedir (Amazon actualiza
    el BSR más o menos cada hora).
22. **Solo los libros de la página abierta, en su orden**: nunca la página siguiente ni otras listas. Los
    patrocinados también, porque están en la página; el CSV dice cuáles son.
23. **«Ver ventas» libro a libro pasa por la misma cola y la misma pausa**, aunque se pulsen muchos seguidos.
24. **Si Amazon pide comprobar que eres una persona, se para todo en esa página**, lo dice en rojo y pone
    «!» en el icono. No lo intenta saltar.
25. **Resumen de la página ordenado por ventas al día, con fila de TOTAL** (ventas y regalía al mes de los
    libros leídos) y CSV de la página.

## Calibración

26. **Informe de KDP en .xlsx (lector propio, sin librerías) o .csv.** Las columnas se reconocen por su
    nombre en castellano o en inglés; si no, se eligen a mano en casillas amarillas. Fechas de Excel,
    día/mes o mes/día (se deduce de la columna) e informes por días o por meses.
27. **Fuera las unidades gratis y los préstamos** (no mueven el BSR de pago) y las de otras tiendas.
28. **Cada día con BSR de un libro de Rodri es un punto de datos**; un día dentro de las fechas del informe
    sin fila de ventas cuenta como 0, pero solo en libros que salen en el informe. Los libros se enlazan por
    ASIN, ISBN-13 e ISBN-10 (KDP nombra las tapas blandas por su ISBN).
29. **El BSR de cada día es la mediana de sus lecturas**; en informes mensuales, la media geométrica de los
    días con BSR (hacen falta al menos 3 días ese mes).
30. **Ajuste por máxima verosimilitud de Poisson**, no con una recta en logaritmos: con pocas ventas hay
    muchos días con 0 y una regresión con logaritmos no los puede usar. Mínimos: 5 puntos, 3 con ventas y
    un BSR que al menos se duplique; con menos de 30 puntos se avisa de que es orientativa. Se enseñan el nº
    de puntos, los días con ventas, el R² y la gráfica con la curva de EE. UU. al lado.

## Biblioteca

31. **La idea entra por el propio formulario de la Biblioteca Buen Rato**, sin tocar la Biblioteca: Lupa
    abre `claude.ai/artifact/F242UTzquSffkufNJvGgnL`, rellena «¿qué libro se te ocurre?» (título, formato,
    páginas, precio, BSR, ventas estimadas, regalía y el enlace a la ficha), «¿para quién es?» y «¿qué juegos
    lleva?» (deducidos del título), «¿cuándo lo hago?» = «Cuando le toque» y «¿de quién es la idea?» =
    «Lupa KDP», y pulsa «Mandar a la fábrica». La Biblioteca la guarda en su nube con su propio código y
    su Claude la revisa como cualquier otra idea.
32. **Copia de seguridad en el portapapeles**: si la idea no entra (Biblioteca sin sesión, cambios en la
    página), el panel lo dice con el motivo y la idea se puede pegar a mano. En Opciones está la bandeja con
    el estado de cada idea y «Reintentar». Solo entran solas las ideas de las últimas 24 horas.
33. **Permiso solo para `*.frame.claudeusercontent.com`**, donde claude.ai pinta las páginas de Claude. El
    script no hace nada salvo en el marco que tiene el formulario de la Biblioteca, y solo cuando la propia
    página ya ha conectado con su nube: claude.ai abre antes un marco escondido de «calentamiento» en el
    mismo dominio, y ahí Lupa no se queda con ninguna idea.
34. **Sin permiso «tabs» ni acceso a todas las webs**: solo Amazon.es, Amazon.com y ese marco.

## Solo libros

35. **Lupa solo actúa en libros.** En la ficha de un reloj o de cualquier otra cosa no pinta nada ni guarda
    nada (se reconoce un libro por la ficha de libro, el ISBN, la longitud de impresión, el formato o el
    puesto en Libros / Tienda Kindle). En las búsquedas, «Ver ventas» solo sale en tarjetas que enseñan un
    formato de libro; sin libros en la página no sale ni la barra. «Los más vendidos» solo en las listas de
    Libros y de Kindle.

## Pruebas con Amazon de verdad

36. **Desde la nube de Claude, Amazon.es pidió la comprobación de robot tras unas pocas páginas** (la IP de
    la nube queda marcada) y no se ha intentado saltar. Las fichas reales de la sopa de letras y del Murdoku
    se leyeron con el lector de páginas de Claude (otra red) y con eso se reconstruyeron dos fichas con la
    estructura y los textos reales para los simulacros. La prueba con la extensión en Amazon.es de verdad
    está lista para el Mac de Rodri: `npm run test:real` (ventana visible, perfil temporal, cookies
    rechazadas, pausas de 8-15 s, se para si sale la comprobación de robot).
37. **15/10 a las 00:46 UTC Amazon volvió a abrir la puerta** y la prueba real con la extensión cargada pasó
    (sopa y Murdoku leídos; Buen Rato aún no está a la venta). La ficha de la sopa se guardó de verdad y
    sustituye a la reconstruida; la del Murdoku sigue reconstruida. Tres minutos después Amazon volvió a
    ponerse en guardia, ahora con otra defensa (siguiente punto).
38. **Pantalla de verificación del navegador (Akamai, «bm-verify»)**: una página casi en blanco que hace una
    prueba con JavaScript y recarga. Si llega al leer una ficha en segundo plano («Ver ventas», «Analizar
    página»), cuenta como comprobación de robot: Lupa se para y lo avisa (una descarga no ejecuta esa prueba,
    ni se intenta). En una pestaña normal no se avisa: el navegador de Rodri la pasa solo, como siempre, y
    Amazon recarga la ficha. Se reconoce por su `meta refresh` con «bm-verify» y su script
    `/_sec/verify?provider=interstitial`, solo en páginas sin texto a la vista.
39. **Media hora sin «Analizar página» después de una comprobación de robot** (dice hasta qué hora). «Ver
    ventas» libro a libro sí funciona. El «!» del icono se quita con la primera ficha que se lea bien pasada
    esa media hora.
40. **El IVA del precio depende de la dirección de entrega de Amazon.** Con la misma sopa de letras: 5,99 €
    entregando en Madrid y 5,76 € (= 5,99 / 1,04) entregando en Estados Unidos. Lupa lee la dirección de la
    cabecera («Entrega en Madrid 28013», «Enviar a Estados Unidos»): península y Baleares (o si no se ve) →
    se quita el 4 %; Canarias, Ceuta, Melilla y fuera de la UE → el precio ya viene sin IVA y no se quita
    (se avisa); otro país de la UE → lleva el IVA de allí, se quita el 4 % y se avisa de que puede variar unos
    céntimos. Para Rodri, con su dirección en España, no cambia nada.
41. **`npm run fixtures` guarda las páginas nuevas aparte** (`tests/fixtures/nuevas/`), sin pisar las de las
    pruebas: el BSR cambia cada hora y las pruebas de siempre llevan cifras fijas. `npm run test:lectores`
    comprueba que Lupa sigue leyendo enteras las nuevas, sin cifras fijas.
