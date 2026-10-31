# Investigación: cadena de herramientas para procesar y visualizar PDF

Ticket: [#7](https://github.com/Bigelazo/wise-wizard/issues/7). Contexto: ADR-0005 (Fuentes PDF con capa de texto, sub-PDFs por Sección, Citas con Página impresa), ADR-0006 (cada Cita es navegable y resalta el texto citado) y ADR-0002 (self-hosted con `docker compose`, expuesto a internet).

Fecha de la investigación: 2026-10-31. Las versiones y fechas de npm se leyeron del registro (`https://registry.npmjs.org/<paquete>/latest`) ese día.

## Candidatos

| Biblioteca | Versión (2026-10-31) | Licencia | Entorno | Mantenimiento |
|---|---|---|---|---|
| pdf.js / `pdfjs-dist` (Mozilla) | 6.4.299 | Apache-2.0 | Navegador y Node (`>=22.13.0 \|\| >=24`) | Activo; último push al repo el 2026-10-31 |
| `unpdf` (UnJS) | 2.1.0 | MIT | Node 24+, Bun, navegador, serverless | Activo; envuelve pdf.js |
| `pdf-lib` | 1.17.1 | MIT | Node, navegador, Deno, React Native | Última versión publicada el 2021-11-06; último push al repo el 2024-07-17 |
| MuPDF.js (`mupdf`, Artifex) | 1.28.1 | AGPL-3.0-or-later o comercial | Node, Bun, navegadores (WASM) | Activo |
| `@hyzyla/pdfium` (PDFium a WASM) | 3.0.0 | MIT (PDFium: licencia BSD) | Node 22+, navegadores modernos | Activo |
| `@embedpdf/pdfium` / EmbedPDF | 2.15.1 | MIT / Apache-2.0 | Navegador | Activo; v3 en desarrollo |
| qpdf (CLI/C++) | — | Apache-2.0 | Binario nativo | Activo |
| poppler-utils (CLI) | — | GPL | Binario nativo | Activo |

Fuentes: registro npm de cada paquete; `gh api repos/mozilla/pdf.js`, `gh api repos/Hopding/pdf-lib`; [README de pdf-lib](https://github.com/Hopding/pdf-lib/blob/master/README.md) ("Tested in Node, Browser, Deno, and React Native environments"); [README de unpdf](https://github.com/unjs/unpdf/blob/main/README.md) ("Works in Node.js 24+, Bun, browsers, and serverless environments"); README del paquete npm `mupdf` ("can be used in all the usual JavaScript environments: Node, Bun, Firefox, Safari, Chrome, etc."); [README de @hyzyla/pdfium](https://github.com/hyzyla/pdfium/blob/main/README.md) ("Node.js 22 or newer"; "Chrome and Edge 85+, Firefox 79+ and Safari 15+"); [LICENSE de PDFium](https://pdfium.googlesource.com/pdfium/+/refs/heads/main/LICENSE); [README de EmbedPDF](https://github.com/embedpdf/embed-pdf-viewer/blob/main/README.md) ("EmbedPDF v3 is under active development and is not yet recommended for production use."); [README de qpdf](https://github.com/qpdf/qpdf/blob/main/README.md) ("Licensed under the Apache License, Version 2.0"); [README de Poppler](https://gitlab.freedesktop.org/poppler/poppler/-/blob/master/README.md).

## 1. Detectar si un PDF tiene capa de texto

El estándar define el modo de renderizado de texto (operador `Tr`, ISO 32000-1 §9.3.6); el modo 3 dibuja texto invisible, que es lo que usan los PDFs escaneados con OCR para superponer una capa de texto sobre la imagen ([ISO 32000-1, copia de Adobe](https://opensource.adobe.com/dc-acrobat-sdk-docs/pdfstandards/PDF32000_2008.pdf)).

- **pdf.js**: `page.getTextContent()` devuelve `items` de tipo `TextItem` con `str`, `transform`, `width`, `height` y `fontName` ([`src/display/api.js`](https://github.com/mozilla/pdf.js/blob/master/src/display/api.js)). Una página sin `items` con texto no tiene capa de texto. `page.getOperatorList()` expone los operadores de dibujo (imágenes, cambio de modo de texto).
- **unpdf** trae `inspectPages`, que "Measures each page: `textLength`, `invisibleTextLength` (text drawn invisibly, as by OCR layers), `imageCount`, and `imageCoverage` (share of the page covered by images, from 0 to 1)" ([README](https://github.com/unjs/unpdf/blob/main/README.md#inspectpages)). La implementación recorre la lista de operadores de pdf.js y cuenta como invisible el texto con `textRenderingMode === 3 || textRenderingMode === 7` y las imágenes de `paintImageXObject`, `paintInlineImageXObject` y `paintImageMaskXObject` ([`src/inspect.ts`](https://github.com/unjs/unpdf/blob/main/src/inspect.ts)). El README advierte que el umbral es del integrador: "where to draw the line between a text page and a scan depends on your documents", y su ejemplo marca como escaneada una página con `textLength - invisibleTextLength < 20 && imageCoverage > 0.8`.
- **MuPDF.js**: `Page.toStructuredText(options)` y `Page.search(needle, options)` (tipos en `dist/mupdf.d.ts` del paquete npm `mupdf@1.28.1`).
- **poppler-utils** (`pdftotext`, `pdffonts`) sirve desde la línea de comandos, pero es GPL (ver §8).

Hecho relevante: un escaneo con OCR **sí** tiene capa de texto (invisible). Distinguir "PDF nativo" de "escaneo con OCR" requiere mirar el modo de renderizado y la cobertura de imágenes, no solo la presencia de texto.

## 2. Extraer el Índice (outline) como árbol de Secciones con rangos de páginas

El outline del PDF es un árbol de diccionarios enlazados (`/First`, `/Last`, `/Next`, `/Prev`, `/Count`), cuyos ítems apuntan a un destino (`/Dest`) o una acción (`/A`) (ISO 32000-1 §12.3.3, [copia de Adobe](https://opensource.adobe.com/dc-acrobat-sdk-docs/pdfstandards/PDF32000_2008.pdf)). Un ítem apunta a **una** página de inicio; el estándar no define dónde termina una sección.

- **pdf.js**: `pdfDocument.getOutline()` devuelve `Array<OutlineNode>` con `title`, `dest` ("`string | Array<any> | null`"), `url` e `items` (hijos). Si `dest` es un nombre, se resuelve con `getDestination(id)`; el primer elemento del destino explícito es una referencia de página que se convierte en índice con `getPageIndex(ref)`, que "is resolved with the page index, starting from zero" ([`src/display/api.js`](https://github.com/mozilla/pdf.js/blob/master/src/display/api.js)).
- **MuPDF.js**: `Document.loadOutline()` "Returns an array with the outline (also known as table of contents or bookmarks)" ([docs](https://mupdf.readthedocs.io/en/latest/reference/javascript/types/Document.html)); cada `OutlineItem` trae `title`, `uri`, `open`, `down?` (hijos) y `page?` ya resuelto (`dist/mupdf.d.ts`).
- **qpdf** `--json` incluye una clave `outlines` ([manual JSON](https://github.com/qpdf/qpdf/blob/main/manual/json.rst)).
- **pdf-lib** no expone una API de lectura de outline en su README ([README](https://github.com/Hopding/pdf-lib/blob/master/README.md)); habría que recorrer el diccionario `/Outlines` a bajo nivel.

El rango de páginas de una Sección se deduce, no se lee: fin = inicio del siguiente ítem del mismo nivel (o del siguiente ítem de nivel superior) menos uno; para el último, la última página del documento. Fallas conocidas de esa deducción (inferidas del modelo del estándar, sin fuente que las enumere): dos ítems que apuntan a la misma página, ítems fuera de orden, ítems con destinos rotos o nulos (`dest: null` está permitido por el tipo de pdf.js) e ítems que apuntan a una URL en vez de una página.

## 3. Página del PDF → Página impresa (`PageLabel`)

### Con `/PageLabels`

El catálogo puede traer `/PageLabels`, un *number tree* que asigna a índices de página (base 0) diccionarios de etiqueta con `/S` (estilo: `D` decimal, `R`/`r` romanos, `A`/`a` letras), `/P` (prefijo) y `/St` (número inicial, ≥ 1) (ISO 32000-1 §12.4.2, [copia de Adobe](https://opensource.adobe.com/dc-acrobat-sdk-docs/pdfstandards/PDF32000_2008.pdf)). La implementación de pdf.js lo confirma: lee `S`, `P` y `St`, exige `St` entero ≥ 1, genera romanos con `toRomanNumerals` y letras repitiendo el carácter cada 26, y sin `/S` deja solo el prefijo (`currentLabel = ""`) ([`src/core/catalog.js`](https://github.com/mozilla/pdf.js/blob/master/src/core/catalog.js)).

- **pdf.js**: `getPageLabels()` "is resolved with an {Array} containing the page labels that correspond to the page indexes, or `null` when no page labels are present in the PDF file" ([`api.js`](https://github.com/mozilla/pdf.js/blob/master/src/display/api.js)). Un diccionario mal formado lanza `FormatError` en el worker (`catalog.js`).
- **MuPDF.js**: `Page.getLabel(): string` para leer; `PDFDocument.setPageLabels(index, style, prefix, start)` y `deletePageLabels(index)` para escribir (`dist/mupdf.d.ts`).
- **qpdf**: `--json` emite `pagelabels` como arreglo de `{index, label}` ([manual JSON](https://github.com/qpdf/qpdf/blob/main/manual/json.rst)); `--set-page-labels` las escribe y "Starting with qpdf version 8.3, page labels are preserved from all files unless `--remove-page-labels` is specified" ([manual CLI](https://github.com/qpdf/qpdf/blob/main/manual/cli.rst)).

### Sin `/PageLabels`: heurísticas

No hay fuente primaria que estandarice estas heurísticas; lo que sigue es la técnica habitual y sus fallas, descrita sobre las APIs verificadas arriba.

1. **Número en encabezado o pie de página.** Con `getTextContent()` se toman los `TextItem` cuya `transform` (posición) cae en la franja superior o inferior de la página y cuyo `str` es un número arábigo o romano. Se busca un desplazamiento constante `impresa = índice + k` que se cumpla en muchas páginas consecutivas, y se interpolan las páginas sin número (inicios de capítulo, páginas en blanco, láminas).
   - Fallas: números de capítulo, años, notas al pie o números de ecuación en la franja; páginas de inicio de capítulo sin folio; láminas o encartes sin numerar que rompen el desplazamiento; libros escaneados a doble página (una página PDF = dos impresas); PDFs con varias obras o numeración reiniciada por capítulo (p. ej. "3-12"); orden de lectura de pdf.js que separa o une cifras.
2. **Marcado de artefactos.** En PDFs etiquetados, encabezados y pies pueden venir como contenido marcado `/Artifact` de tipo paginación (ISO 32000-1 §14.8.2.2). pdf.js entrega esos marcadores con `getTextContent({ includeMarkedContent: true })` ([`api.js`](https://github.com/mozilla/pdf.js/blob/master/src/display/api.js)). Falla: la mayoría de los PDFs no están etiquetados.
3. **Preliminares en romanos.** Si las primeras páginas llevan i, ii, iii… y luego aparece 1, se ajustan dos tramos (romano y arábigo). Falla: preliminares sin folio, o portada y créditos sin numerar que hacen que el romano detectado no empiece en el índice 0.
4. **Contrastar con el Índice.** Si el outline o la tabla de contenidos impresa dice "Capítulo 3 … 45" y el ítem apunta a la página PDF 57, el desplazamiento es 12. Falla: tablas de contenidos impresas que no son outline (hay que leerlas como texto) y outlines que apuntan a la página anterior o siguiente.

En todos los casos, la etiqueta deducida puede escribirse de vuelta al PDF con MuPDF.js `setPageLabels` o qpdf `--set-page-labels`, para que el resto de la cadena lea siempre `/PageLabels`.

## 4. Dividir un PDF en sub-PDFs por rango de páginas

- **pdf-lib**: `PDFDocument.create()` + `copyPages(srcDoc, indices)` + `addPage` ([README](https://github.com/Hopding/pdf-lib/blob/master/README.md)). Limitación: "**`pdf-lib` does not currently support encrypted documents.**" y lanza error al cargar uno ([README, Encryption Handling](https://github.com/Hopding/pdf-lib/blob/master/README.md#encryption-handling)). No copia outline ni `/PageLabels` (son datos del catálogo, no de la página).
- **MuPDF.js**: `PDFDocument.graftPage(to, srcDoc, srcPage)` y `saveToBuffer(options)` (`dist/mupdf.d.ts`).
- **qpdf**: `qpdf --empty --pages in.pdf 1-20 -- out.pdf`; también `--split-pages[=n]` ([manual CLI](https://github.com/qpdf/qpdf/blob/main/manual/cli.rst)). Conserva las page labels (cita en §3). Sobre el outline: "if you select some pages and not others, bookmarks that point to pages that are in the output file will work, and remaining bookmarks will not work. If you don't want to preserve the primary file's metadata, use `--empty` as the primary input file."
- **poppler-utils** `pdfseparate`/`pdfunite`: GPL.

## 5. DOI, ISBN y APIs de metadatos para la Referencia APA 7

### Detección en el texto

- **DOI**: Crossref recomienda `/^10.\d{4,9}/[-._;()/:A-Z0-9]+$/i`: "For the 74.9M DOIs we have seen this matches 74.4M of them." Agrega `/^10.1002/[^\s]+$/i` para DOIs antiguos de Wiley, y advierte que "even the recommended expression catches DOIs ending with periods, colons, semicolons, hyphens, and underscores" ([blog de Crossref](https://www.crossref.org/blog/dois-and-matching-regular-expressions/)). Falla: la puntuación final y los cortes de línea dentro del DOI.
- **ISBN**: el dígito de control del ISBN-13 usa pesos alternos 1 y 3 módulo 10: "The check digit is equal to 10 minus the remainder resulting from dividing the sum of the weighted products of the first 12 digits by 10 with one exception. If this calculation results in an apparent check digit of 10, the check digit is 0." ([ISBN Users' Manual, Agencia Internacional del ISBN](https://www.isbn-international.org/sites/default/files/ISBN%20Manual%202012%20-corr.pdf)). La biblioteca `isbn3` (MIT, 2.0.12) valida y normaliza ISBN-10/13 ([npm](https://www.npmjs.com/package/isbn3)). El ISBN suele estar en la página de créditos (cerca del inicio).

### Crossref (para DOI)

- Gratis y sin registro: "No sign-up is required to use the REST API." Licencia de los datos: "almost none of the metadata is subject to copyright, and you may use it for any purpose", con la salvedad "Some abstracts contained in the metadata may be subject to copyright by publishers or authors." ([REST API](https://www.crossref.org/documentation/retrieve-metadata/rest-api/)).
- Registro único: `https://api.crossref.org/works/{doi}` ("A single metadata record for a Crossref DOI").
- Pools ([Access and authentication](https://www.crossref.org/documentation/retrieve-metadata/rest-api/access-and-authentication/)): Public "No authentication or identification." (límite 5, concurrencia 1); Polite "Include your email address in the `mailto` parameter or `agent` header." (10, concurrencia 3); Plus con token (150, sin límite de concurrencia). "If you exceed the rate limits, you will receive a 429 HTTP response." La página no indica la unidad; los encabezados de una respuesta real del 2026-10-31 a `/works/{doi}` fueron `x-rate-limit-limit: 5`, `x-rate-limit-interval: 1s`, `x-concurrency-limit: 1`, `x-api-pool: public-single` (público) y `10` / `1s` / `3` / `polite-single` (con `mailto`), es decir, solicitudes por segundo.
- Cita ya formateada por negociación de contenido: `curl -LH "Accept: text/x-bibliography; style=bibtex; locale=en-US" "https://doi.org/10.1126/science.169.3946.635"`; estilos en `https://api.crossref.org/v1/styles`; CSL-JSON con `application/vnd.citationstyles.csl+json`; funciona para "currently Crossref, DataCite, and mEDRA" ([Content negotiation](https://www.crossref.org/documentation/retrieve-metadata/content-negotiation/)). No se verificó que `style=apa` produzca APA 7.

### Open Library (para ISBN)

- Límites: 1 solicitud/s sin identificar y 3 solicitudes/s identificándose: "Identify your application with a `User-Agent` header and `email`", ejemplo `User-Agent: MyLibraryApp (contact@example.org)`. "Please do not use our APIs to bulk download metadata"; para volumen, los volcados mensuales ([Developers API](https://openlibrary.org/developers/api)).
- Endpoints: `/isbn/{ISBN}.json` ("a path of "/isbn" is used, followed by a valid ISBN 10 or 13") y `api/books?bibkeys=ISBN:…&jscmd=data&format=json`, que devuelve `title`, `subtitle`, `authors`, `identifiers`, `publishers`, `publish_places`, `publish_date` (texto), `number_of_pages`, entre otros ([Books API](https://openlibrary.org/dev/docs/api/books)).
- Licencia: la página de licencias no nombra una licencia; dice que Internet Archive "does not assert any new copyright or other proprietary rights" y que "There may be existing rights issues on some contributions" ([Licensing](https://openlibrary.org/developers/licensing)).

### Google Books (para ISBN)

- Requiere identificación: "Requests to the Books API for public data must be accompanied by an identifier, which can be an API key or an access token." Búsqueda por `q=isbn:<n>`; `volumeInfo` trae `title`, `authors`, `publisher`, `publishedDate`, `industryIdentifiers`, `pageCount`, `language` ([Using the API](https://developers.google.com/books/docs/v1/using)). La página no publica la cuota; se ve en la consola de Google Cloud del proyecto.
- Términos: "You may not charge users any fee for the use of your application" sin acuerdo aparte ([Terms](https://developers.google.com/books/terms)); al mostrar resultados, "the "powered by Google" logo must appear adjacent to these results", más un enlace a la página de Google Books o a una vista previa ([Branding](https://developers.google.com/books/branding)).

Ninguna de las tres fuentes entrega por sí sola todos los campos APA 7 de un libro: Open Library y Google Books no exponen un campo explícito de edición en los campos listados arriba, y la fecha viene como texto libre.

## 6. Visor en el navegador: abrir en una página y resaltar una Cita textual

- **pdf.js** (`pdfjs-dist/web/pdf_viewer.mjs`) exporta `PDFViewer`, `PDFLinkService`, `PDFFindController` y `EventBus` ([`web/pdf_viewer.component.js`](https://github.com/mozilla/pdf.js/blob/master/web/pdf_viewer.component.js)). El ejemplo oficial arma el visor y busca con `eventBus.dispatch("find", { type: "", query: SEARCH_FOR })` ([`examples/components/simpleviewer.mjs`](https://github.com/mozilla/pdf.js/blob/master/examples/components/simpleviewer.mjs)). El estado de búsqueda admite `caseSensitive`, `entireWord`, `highlightAll`, `matchDiacritics`, `findPrevious` ([`web/pdf_find_controller.js`](https://github.com/mozilla/pdf.js/blob/master/web/pdf_find_controller.js)).
- El visor completo acepta en el hash `#page=N`, `search=…` y `phrase=true` (búsqueda de frase completa) ([`web/pdf_link_service.js`](https://github.com/mozilla/pdf.js/blob/master/web/pdf_link_service.js)).
- Normalización: el buscador descompone a NFD para comparar diacríticos, y "In "X-\ny", "-\n" is removed because an hyphen at the end of a line between two letters is likely here to mark a break in a word." ([`pdf_find_controller.js`](https://github.com/mozilla/pdf.js/blob/master/web/pdf_find_controller.js)). Así, una cita que en el PDF cruza un salto de línea con guion se encuentra igual.
- Límite: las coincidencias se calculan por página (`_pageMatches[pageIndex]`, `#calculateMatch(pageIndex)`), así que una Cita textual que cruza el salto de página no aparece como una coincidencia única. La búsqueda es exacta tras la normalización: una cita que el modelo transcribió con una diferencia (ligaduras, comillas tipográficas, espacios) no coincide.
- Alternativas: `react-pdf` (MIT, 11.0.0) envuelve pdf.js para React; EmbedPDF (Apache-2.0) se basa en PDFium y su v3 "is not yet recommended for production use" ([README](https://github.com/embedpdf/embed-pdf-viewer/blob/main/README.md)). MuPDF.js `Page.search()` devuelve `Quad[][]` (coordenadas de los rectángulos), útil para resaltar, pero en el navegador implica distribuir código AGPL (§8).

## 7. Footprint en la imagen Docker

Tamaños desempaquetados según el registro npm (2026-10-31): `pdfjs-dist` 34,9 MB (incluye builds moderno y legacy, mapas CMap y fuentes estándar), `mupdf` 14,3 MB (de los cuales `mupdf-wasm.wasm` pesa 10,4 MB), `@hyzyla/pdfium` 14,1 MB, `pdf-lib` 19,5 MB, `unpdf` 3,2 MB (depende de pdf.js). `pdfjs-dist` declara `@napi-rs/canvas` como dependencia opcional (solo para renderizar en Node).

Paquetes Debian *trixie* amd64 ([packages.debian.org](https://packages.debian.org/trixie/qpdf)), tamaño instalado: `qpdf` 341 kB + `libqpdf30` 3.335 kB; `poppler-utils` 723 kB + `libpoppler147` 4.858 kB; `mupdf-tools` 622 kB (+ `libmupdf`). No se midieron las dependencias transitivas (libjpeg, freetype, lcms, etc.) ni una imagen construida.

## 8. Licencias en un despliegue self-hosted y no distribuido

- La AGPL-3.0 define: "To "convey" a work means any kind of propagation that enables other parties to make or receive copies. Mere interaction with a user through a computer network, with no transfer of a copy, is not conveying." Su §13 agrega: "if you modify the Program, your modified version must prominently offer all users interacting with it remotely through a computer network […] an opportunity to receive the Corresponding Source of your version" ([AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0.txt)).
- MuPDF.js: "available under Open Source AGPL and commercial license agreements. If you cannot meet the requirements of the AGPL, please contact Artifex" (README del paquete npm `mupdf`).
  - En el servidor, sin modificar MuPDF, la §13 no se activa; si se modifica, los usuarios remotos (aquí, el único estudiante) deben poder obtener el código fuente.
  - En el navegador, el `.wasm`/`.js` de MuPDF se descarga al cliente: eso es transferir una copia, o sea *convey*, y aplican las obligaciones de distribución de la AGPL sobre la obra que la incluye.
- Poppler: "Poppler is licensed under the GPL, not the LGPL, so programs which call Poppler must be licensed under the GPL as well." ([README](https://gitlab.freedesktop.org/poppler/poppler/-/blob/master/README.md)). Invocar los binarios de poppler-utils como procesos separados y no distribuir la imagen evita el problema de la obra derivada en la práctica; publicar la imagen Docker sí sería distribución.
- pdf.js y qpdf (Apache-2.0), pdf-lib, unpdf, `@hyzyla/pdfium` y react-pdf (MIT) y PDFium (BSD) son permisivas: solo exigen conservar avisos.

## Tabla capacidad × biblioteca

| Capacidad | pdf.js / unpdf | pdf-lib | MuPDF.js | PDFium (`@hyzyla/pdfium`) | qpdf (CLI) | poppler-utils |
|---|---|---|---|---|---|---|
| Detectar capa de texto | Sí: `getTextContent`, `getOperatorList`; unpdf `inspectPages` (texto invisible, cobertura de imagen) | No (sin extracción de texto) | Sí: `toStructuredText` | Sí (extracción de texto); no verificado en detalle | No | Sí: `pdftotext`, `pdffonts` |
| Leer outline | Sí: `getOutline` + `getDestination` + `getPageIndex` | Solo a bajo nivel | Sí: `loadOutline` (página resuelta) | No verificado | Sí: `--json` (`outlines`) | No verificado |
| Leer `/PageLabels` | Sí: `getPageLabels` | Solo a bajo nivel | Sí: `Page.getLabel` | No verificado | Sí: `--json` (`pagelabels`) | No verificado |
| Escribir `/PageLabels` | No | Solo a bajo nivel | Sí: `setPageLabels` | No verificado | Sí: `--set-page-labels` | No |
| Dividir por rango | No | Sí: `copyPages` (sin cifrados) | Sí: `graftPage` | No verificado | Sí: `--pages`, `--split-pages` (conserva labels) | Sí: `pdfseparate` |
| Visor + resaltar cita | Sí: `PDFViewer` + `PDFFindController` | No | Parcial: `search` → quads, sin visor | EmbedPDF | No | No |
| Licencia | Apache-2.0 / MIT | MIT | AGPL-3.0 o comercial | MIT + BSD | Apache-2.0 | GPL |
| Entorno | Navegador + Node | Navegador + Node | Navegador + Node (WASM) | Navegador + Node (WASM) | Nativo | Nativo |

## Implicancias para Wise Wizard

- pdf.js es la única opción verificada que cubre a la vez la ingesta en Node (texto, outline, `/PageLabels`) y el visor con búsqueda y resaltado en el navegador, con licencia Apache-2.0.
- Un PDF escaneado con OCR tiene capa de texto invisible; la regla de rechazo de ADR-0005 depende de si cuenta como "escaneado" el texto en modo de renderizado 3. unpdf ya mide ese texto por separado.
- El rango de páginas de cada Sección no está en el PDF: se deduce del orden de los ítems del outline.
- `/PageLabels` es opcional en el estándar; sin él, la Página impresa es una deducción heurística con fallas conocidas, y el resultado puede persistirse escribiendo `/PageLabels` (MuPDF.js o qpdf).
- pdf-lib no está mantenido activamente (última versión en 2021), no abre PDFs cifrados y no copia outline ni page labels a los sub-PDFs; qpdf sí conserva las page labels al dividir.
- MuPDF.js en el servidor sin modificar no activa la §13 de la AGPL; MuPDF.js en el navegador implica distribuir código AGPL. Poppler es GPL y obliga si se distribuye la imagen.
- El resaltado de pdf.js busca por página y de forma exacta tras normalizar: una Cita textual que cruza de página o no es literal no se resalta sin lógica propia.
- Crossref (DOI) es libre y sin registro, con 5 req/s (10 con `mailto`); Open Library (ISBN) permite 1 req/s (3 identificándose) y prohíbe la descarga masiva; Google Books exige API key, prohíbe cobrar sin acuerdo y exige el logo "powered by Google" junto a los resultados mostrados.
- Ninguna API de libros entrega todos los campos APA 7 (p. ej. edición) de forma estructurada; la Referencia necesita la confirmación del estudiante que ya define el GLOSARIO.

## No verificado

- El texto literal de ISO 32000-1 (§9.3.6, §12.3.3, §12.4.2, §14.8.2.2): no se pudo extraer texto del PDF de Adobe en este entorno; las afirmaciones sobre la estructura de `/PageLabels` se apoyan en la implementación de pdf.js (`catalog.js`).
- Capacidades de outline, page labels y división en `@hyzyla/pdfium` y poppler-utils.
- La cuota por defecto de Google Books y si `style=apa` de la negociación de contenido produce APA 7.
- El tamaño real de una imagen Docker construida con cada opción.
