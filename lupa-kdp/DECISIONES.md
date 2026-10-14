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
