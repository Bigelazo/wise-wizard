# Ingesta de Fuentes: ciclo de vida, partes y rechazo

La ingesta deja cada Fuente lista para que la IA la lea y la cite (ADR-0021), y lo hace de forma determinista, sin IA ni red. La IA interviene solo cuando el estudiante lo pide: para proponer el Índice o para asociar una Fuente secundaria. Las dos cosas también se pueden hacer a mano. Así, el Cupo nunca bloquea la ingesta (ADR-0003). Dos reglas sostienen las Citas. La Página impresa sale de `/PageLabels` y nunca de una heurística. Y la IA lee cada Sección completa, en partes que siguen el Índice.

## Consecuencias

- **Ciclo de vida.** El estudiante ve el Estado de la Fuente en la Biblioteca:
  1. **Procesando.** Un trabajo en segundo plano valida el PDF y guarda el outline y, por cada página, su índice en el PDF, su texto extraído con pdf.js (crudo y normalizado como el buscador de pdf.js) y su Página impresa. Si el contenedor se reinicia, el trabajo vuelve a correr desde cero.
  2. **Por revisar.** El estudiante escribe la Referencia a mano y revisa el Índice. No se consulta ninguna API de metadatos (Crossref, Open Library, Google Books) ni se lee el DOI o el ISBN: la Referencia es del estudiante. El Índice sale del outline. Si el PDF no lo trae, el estudiante elige entre "Proponer con IA", armarlo a mano o dejarlo vacío. Un Índice vacío deja el documento entero como una sola Sección, lo que sirve para secundarias breves.
  3. **Lista.** Al confirmar, la app corta el PDF en partes con qpdf y las registra en la lista de permitidos del hook. Desde ahí la Fuente se puede vincular a un Cuaderno.
  4. **Eliminada** (ver abajo).

  Un PDF que no pasa la validación se rechaza con el motivo y qué hacer ("busca la versión digital del editor"). El archivo se borra y la Fuente no queda en la Biblioteca. Solo queda el aviso.

- **Regla de rechazo.**
  - **Capa de texto.** Se acepta el PDF si al menos el 90% de sus páginas tiene texto, visible o invisible. Un escaneo con OCR invisible (modo de renderizado 3/7) cuenta como PDF con capa de texto, y se le avisa al estudiante que algunas Citas pueden no resaltarse bien. El umbral tolera portadas, láminas y páginas en blanco. En esas páginas no se puede citar, pero el subagente las ve igual. Un OCR con errores no produce Citas falsas: el Pasaje no coincide y `cite` lo rechaza.
  - **Página impresa.** Se exige `/PageLabels`. Si el PDF no lo trae, el estudiante puede dar un solo número: "la página 1 del PDF es la página impresa \_\_\_". Si no lo da, el PDF se rechaza. No se usan heurísticas, porque un mapeo equivocado rompe todas las Citas de la Fuente. El número se puede corregir después, y todas las Citas muestran la página corregida.
  - Se rechaza también un PDF corrupto o protegido con contraseña de apertura.

- **Imágenes.** Una imagen (PNG, JPEG, WebP o GIF) solo puede ser Fuente secundaria (ADR-0004). Se sube, el estudiante escribe su Referencia y queda Lista, con su ruta registrada. No tiene texto, Página impresa, Índice ni partes.

- **Rangos de Sección.** Un ítem del outline da solo su página de inicio. Cada Sección termina donde empieza el ítem siguiente del mismo nivel o de uno superior, y la última termina en la última página del PDF. Si el destino del ítem siguiente marca una posición vertical que no está al inicio de su página (`/XYZ` o `/FitH` con `top`), esa página queda en las dos Secciones, como cuando la sección de un paper empieza a media página. Los ítems sin página (`dest: null` o una URL) se descartan. Si los que quedan están fuera de orden, el outline no se usa y se sigue el camino sin outline.

- **Partes.** `Read` entrega un PDF como bloque `document` (texto más imagen de cada página) solo si tiene hasta 10 páginas. Con el parámetro `pages`, en cambio, rasteriza con `pdftoppm` y entrega imágenes sin texto, de a 20 páginas como máximo (tipos y binario del SDK 0.3.316). Por eso:
  - Las partes siguen las hojas del Índice. Un capítulo con 1.1 (8 páginas), 1.2 (14) y 1.3 (2) se corta en 1.1, 1.2 y 1.3, no en tramos fijos. Las páginas de un capítulo antes de su primera sub-Sección forman su propia parte.
  - Una hoja de más de 10 páginas se corta en partes parejas y consecutivas: la 1.2 queda en 7 + 7, no en 10 + 4. Es un corte técnico que el estudiante no ve.
  - Leer una Sección es leer todas sus partes, en orden. Si no caben en 300k, el trabajo se reparte entre subagentes por sub-Sección o por partes (ADR-0019), nunca a mitad de una parte.
  - El hook niega todo `Read` con `pages`. Así, toda lectura es de una parte completa, con texto, fórmulas y figuras, al costo medido de unos 2,250 tokens por página, y no hace falta poppler.

- **Almacenamiento.** El original y sus partes viven en el volumen de Docker, en `/data/sources/<sourceId>/`. El registro de rutas, resueltas con `realpath`, vive en Postgres: cada parte con {Fuente, Sección, rango de páginas del PDF, número de páginas}. Si se edita el Índice de una Fuente Lista, la app vuelve a cortar las partes y reemplaza el registro de una vez. Las Citas, las Cartas y el Progreso de lectura no cambian, porque no apuntan a una parte.

- **Citas.** Una Cita guarda el índice de su página en el PDF, y la Página impresa se calcula al mostrarla. Corregir el mapeo corrige todas las Citas de la Fuente.

- **IA en la ingesta.** Tiene la misma forma de sesión que el resto (orquestador más `reader`) y tres herramientas propias (ADR-0021): `page_text`, `propose_outline` y `associate_sections`. Proponer el Índice es una actividad de la Biblioteca, así que su sesión queda atada a la Fuente. Asociar una secundaria queda atada al Cuaderno y a la secundaria, y ocurre al vincularla a un Cuaderno, porque depende de cuál es la Fuente principal de ese Cuaderno.
  - **Sin outline**, el `reader` lee solo el texto con `page_text`, a unos 500 tokens por página en vez de 2,250. Primero busca la tabla de contenidos impresa en las primeras ~20 páginas, y si no la encuentra, recorre el texto buscando títulos. Si llega al tope, propone con lo que alcanzó a leer.
  - **Para asociar**, el `reader` recibe el Índice de la principal con `outline` y lee la secundaria con `page_text` si es un PDF, o con `Read` si es una imagen.
  - Las dos son propuestas: el estudiante las revisa, edita o descarta.

- **Cupo agotado.** `propose_outline` y `associate_sections` guardan en una sola llamada, al final, así que un corte no deja nada a medias. La app muestra qué ventana se agotó y cuándo se reinicia ("Cupo agotado (ventana de 5 horas). Se reinicia a las 15:45.") y ofrece "Reintentar". No reintenta sola, porque el Cupo es compartido con Claude Code. Mientras tanto, el estudiante puede armar el Índice o elegir las Secciones a mano, y una secundaria sin asociar ya queda en el Cuaderno.

- **Borrar una Fuente.** Se borran el archivo, las partes, el texto por página y el registro de rutas. La Fuente queda Eliminada, con su Referencia y su mapeo de Página impresa, y sale de los Cuadernos. Las Cartas y las Citas se mantienen, con su Pasaje y su cita formateada. Al abrir una de esas Citas se muestra "El documento fue eliminado" en vez del visor. Una Fuente principal no se puede borrar mientras lo sea de un Cuaderno.

- **Sin verificar en vivo.** El umbral de 10 páginas y los topes de páginas por mensaje y por turno de `Read` (`CLAUDE_CODE_FILE_READ_MAX_PDF_PAGES_PER_MESSAGE` / `_PER_TURN`) salen de la descripción de la herramienta y del binario, no de una ejecución. Lo comprueba el spike del ADR-0021. Que pdf.js entregue `top` en los destinos explícitos sale del estándar (ISO 32000-1 §12.3.2.2), no de su código.

## Opciones consideradas

- **Partes fijas de 10 páginas**: cortan una sub-Sección por la mitad sin necesidad. La unidad de lectura tiene que salir del Índice.
- **Permitir `Read` con `pages`**: las páginas llegan como imágenes sin texto, de a 20, con un costo por página sin medir y con poppler (GPL) en la imagen.
- **Deducir la Página impresa con heurísticas** (folio en encabezado o pie, tramos en romanos, contraste con el outline): todas tienen fallas conocidas, y un mapeo equivocado rompe todas las Citas de la Fuente. Confirmarlo en una pantalla de muestras suma una gestión que el MVP no necesita.
- **Rechazar todo PDF sin `/PageLabels`**: dejaría fuera muchos papers publicados, cuya página 1 suele ser, por ejemplo, la 245 impresa. Un solo número del estudiante los cubre sin heurísticas.
- **Rechazar los escaneos con OCR**: dejaría fuera libros que sí funcionan. Un OCR con errores falla de forma segura en `cite`.
- **Precargar la Referencia con Crossref, Open Library o Google Books**: agrega red, límites de uso, términos y un paso que el estudiante igual tiene que revisar, porque ninguna entrega todos los campos APA 7.
- **Proponer el Índice leyendo el PDF**: cuesta unas cuatro veces más Cupo que leer el texto, y para encontrar títulos basta el texto.
- **Reintentar solo al reiniciarse el Cupo**: gasta un Cupo que el estudiante puede estar usando en Claude Code.
- **Borrar en cascada las Cartas y las Citas**: pierde el estudio hecho. Dejar las Cartas sin Cita de origen rompe el ADR-0006. Conservar la Fuente como Eliminada mantiene las dos cosas.
