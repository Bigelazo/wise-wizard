# Investigación: dcc-ui-kit y su integración con Next.js

Pregunta (issue #4): qué entrega [dcc-ui-kit](https://github.com/DCC-FCFM-UCHILE/dcc-ui-kit) y cómo se construye sobre él una UI de Next.js (App Router, TypeScript) sin librerías de UI ni Tailwind.

Fuentes: el repositorio clonado en la etiqueta `v2.8.1` (commit `68666c5`, 2026-10-15), su sitio de documentación y la documentación oficial de Next.js y React. Las rutas de repo se citan como `v2.8.1:<ruta>` y equivalen a `https://github.com/DCC-FCFM-UCHILE/dcc-ui-kit/blob/v2.8.1/<ruta>`. Consultado el 2026-10-31.

## 1. Distribución, versionado y licencia

**Qué es.** Un kit de CSS plano con un bundle de JavaScript vanilla opcional. No son web components ni componentes de React. El README lo resume: "CSS sin dependencias ni framework: clases planas sobre variables." (`v2.8.1:README.md`).

**Artefactos.** `dist/` está versionado en el repo y lo verifica el CI (`v2.8.1:PUBLICAR.md`). Contiene (`v2.8.1:dist/README.md`, sección 1):

| Archivo | Tamaño | Contenido |
|---|---|---|
| `dcc-ui.min.css` / `dcc-ui.css` | 48 / 76 KB | todo el CSS, con `@font-face` de rutas relativas a `fonts/` |
| `dcc-ui.bundle.min.js` / `.js` | 20 / 29 KB | íconos + comportamiento |
| `dcc-behaviors(.min).js` | 10 / 18 KB | sólo el comportamiento |
| `dcc-icons.js`, `dcc-icons.svg` | 11 / 9 KB | inyector del sprite / sprite suelto |
| `dcc-tokens.css` | 4 KB | "sólo las 51 variables" |
| `fonts/`, `assets/`, `SRI.txt` | | Inter y Poppins en woff2, logotipos, hashes SRI |

**Paquete npm.** `package.json` declara el nombre `@dcc/ui`, versión `2.8.1`, con `exports` para `.`/`./css` (CSS), `./css/min`, `./tokens`, `./icons.svg`, `./icons.js`, `./js`, `./js/min`, `./behaviors`, `./assets/*` y `./fonts/*` (`v2.8.1:package.json`). **No está publicado en el registro de npm**: `npm view @dcc/ui` devuelve `E404`. La forma documentada de instalarlo es desde GitHub:

> `npm i github:DCC-FCFM-UCHILE/dcc-ui-kit#v2.8.1` (`v2.8.1:README.md`)

**CDN.** La documentación indica `https://cdn.dcc.uchile.cl/ui-kit/2.8.1/` (`v2.8.1:dist/README.md`), pero `PUBLICAR.md` lo deja como pendiente: "Pedir a sistemas el DNS de `cdn.dcc.uchile.cl` y su inclusión en el terminador TLS". Al consultarlo, `cdn.dcc.uchile.cl` no respondió (curl `000`), mientras que `https://apps.dcc.uchile.cl/ui-kit/2.8.1/dcc-ui.min.css` respondió `200`. El host alternativo está descrito en `PUBLICAR.md`: "Eso deja el kit servido en `https://apps.dcc.uchile.cl/ui-kit/<versión>/`."

**Versionado.** SemVer, con el significado definido en `v2.8.1:CHANGELOG.md`: "**major** — cambia un nombre de clase, un token, o el markup que una app debe escribir." Hay etiquetas `v1.0.0` a `v2.8.1`. El ritmo es alto: 2.6.0 (2026-09-25), 2.7.0 (2026-10-08), 2.8.0 (2026-10-14) y 2.8.1 (2026-10-15) (`v2.8.1:CHANGELOG.md`). Cada versión publicada vive en una carpeta inmutable, y el kit desaconseja usar un alias `latest` (`v2.8.1:dist/README.md`, sección 1).

**Licencia.** El código es MIT (`v2.8.1:LICENSE`). Lucide es ISC; Inter y Poppins, SIL OFL 1.1. Los logotipos quedan fuera: "Los logotipos del DCC, la FCFM y la Universidad de Chile **no** están cubiertos por la licencia MIT" (`v2.8.1:README.md`). `PUBLICAR.md` dice además que los logos de U. de Chile, FCFM y CNA "son marcadores de posición, no los logos reales".

## 2. El JavaScript del kit frente a React y el render en servidor

**Cómo funciona el bundle.** Es ES5 sin dependencias y se inicializa solo en `DOMContentLoaded`. `init(raiz)` recorre el DOM con `querySelectorAll` y engancha `addEventListener` **a cada elemento**, marcándolo en `el.__dcc` para no repetir el enlace. Expone `window.DCCUI = { init, registrar }` y escucha `htmx:afterSwap` (`v2.8.1:src/behaviors.js`, líneas 1–55 y 563–594). Los componentes agregados en 2.8.0 se enganchan con `DCCUI.registrar` y, en el caso del snackbar, exponen `DCCUI.notificar` (`v2.8.1:src/componentes/snackbar.js`). El bundle también inyecta el sprite de íconos en el documento (`v2.8.1:dist/README.md`, sección 3).

**Qué implica para React.** Como no usa delegación de eventos, el DOM que React monte después de la carga inicial (navegación del cliente, estado condicional) queda sin comportamiento hasta que alguien llame `DCCUI.init(elemento)`: "Si tu app inserta HTML sin recargar la página […] hay que enlazar lo que llegó" (`v2.8.1:dist/README.md`). El script además cambia atributos y clases del DOM (`aria-expanded`, `is-open`, `dataset.open`, en `v2.8.1:src/behaviors.js`) que React considera suyos. El propio kit se pronuncia sobre esto:

> "**En React no uses el JavaScript del kit.** Enlaza manejadores sobre el DOM, que es justo lo que React quiere administrar él. Carga sólo el CSS. Para acordeón, tabs, combobox y paginación usa [Radix] o [Headless UI] y aplícales las clases del kit […]. El único que conviene portar a mano es el calendario." (`v2.8.1:dist/README.md`, sección 4)

Esa recomendación choca con la restricción de Wise Wizard de no usar librerías de UI (`docs/PROBLEM.md`). Sin Radix ni Headless UI, el comportamiento (teclado, ARIA, abrir y cerrar) se reescribe en componentes cliente de React sobre el mismo markup y las mismas clases.

**Hidratación.** React exige que el HTML del servidor coincida con el primer render del cliente: "`hydrateRoot()` expects the rendered content to be identical with the server-rendered content. You should treat mismatches as bugs and fix them." ([react.dev, hydrateRoot](https://react.dev/reference/react-dom/client/hydrateRoot)). Un script que muta atributos antes de que React hidrate puede provocar esos desajustes. Para algo inevitable y de un solo nivel (por ejemplo, `data-dcc-theme` en `<html>` puesto por un script en `<head>`), React ofrece `suppressHydrationWarning`, que "only works one level deep, and is intended to be an escape hatch" (misma fuente).

**Cargar el script en Next (si se usara).** `next/script` con `beforeInteractive` "must be placed inside a root layout" y su ejecución "does not block page hydration"; además, "These scripts run once per document load. A client-side navigation does not run them again" ([Next.js, Script](https://nextjs.org/docs/app/api-reference/components/script)). En consecuencia, las páginas a las que se llega por navegación del cliente no quedan enlazadas a menos que se llame `DCCUI.init`, por ejemplo desde `onReady` o un `useEffect`. No se probó en un proyecto real.

**El CSS en Next.** El CSS sí es compatible de forma directa: "Stylesheets published by external packages can be imported anywhere in the `app` directory" (ejemplo `import 'bootstrap/dist/css/bootstrap.css'`), y en React 19 también sirve `<link rel="stylesheet">` ([Next.js, CSS](https://nextjs.org/docs/app/getting-started/css)). Con el paquete instalado desde GitHub, la importación en `app/layout.tsx` sería `@dcc/ui/css` (o `@dcc/ui/dist/dcc-ui.css`). Next aconseja concentrar los imports de CSS en una sola entrada para que el orden sea predecible (misma fuente). **Sin verificar:** que el bundler de Next resuelva las rutas relativas `url(fonts/…)` del `@font-face` dentro de `node_modules`. Si no lo hace, la alternativa es servir `dist/` desde `public/`, que también es el mismo origen que el sprite necesita.

**Íconos sin el bundle.** Un `<use href>` hacia otro origen "falla en silencio" (`v2.8.1:dist/README.md`, sección 3). Hay tres caminos documentados: el sprite servido desde el mismo origen (`dcc-icons.svg`), el inyector suelto `dcc-icons.js`, o `lucide-react@0.544.0`, que el kit recomienda para React (sección 4). Lucide está fijado en 0.544.0 porque "La versión 1.33 rediseñó el ícono `smile`" (`v2.8.1:README.md`). Un ícono fuera de un componente del kit "se renderiza 0×0" si no se le da tamaño (`v2.8.1:dist/README.md`).

**Alcance de los estilos.** "Sus estilos alcanzan sólo a los elementos con clase `dcc-` y a lo que viva dentro de ellos". La tipografía y el fondo globales se activan con `<body class="dcc-root">` (`v2.8.1:dist/README.md`, sección 2). Las clases llevan el prefijo `dcc-`, los estados `is-*` y los ganchos de JS `js-*` (sección 9).

## 3. Inventario de componentes frente a las necesidades de Wise Wizard

El sitio ([dcc-fcfm-uchile.github.io/dcc-ui-kit/site/](https://dcc-fcfm-uchile.github.io/dcc-ui-kit/site/), v2.8.1) agrupa los componentes en Fundamentos, Diseño (Container, Grilla, Lista de imágenes, Masonry, Stack), Entradas, Visualización de datos, Retroalimentación, Superficies y Navegación. Según `v2.8.1:docs/decisiones-de-diseno.md` (§0.20), el kit cubre "la lista completa de la página "All components" de MUI, salvo las utilidades que sólo existen en React […] y el paquete aparte MUI X". Los resúmenes de cada componente salen de `v2.8.1:src/sitio/componentes/*.html`.

| Necesidad | Qué hay en el kit | Estado |
|---|---|---|
| Navegación | Barra de aplicación y barra lateral (`barra-de-navegacion`), Drawer temporal o persistente sobre `<dialog>` (`cajon`), Tabs, Breadcrumb, **Navegación inferior** ("La barra de destinos principales al pie de una aplicación en el teléfono"), Menú | Cubierto. Ojo: la nav, el pie y la barra lateral son de marca DCC y "se ven oscuros en los dos temas" (`dist/README.md` §8) |
| Formularios | Campo de texto, búsqueda, select y `textarea` con estados de ayuda, error y éxito; área que crece sola (`.js-autosize`, `DCCUI.autoajustar`); checkbox y radio, switch, autocompletar, deslizador, selector de fecha | Cubierto (CSS). El autoajuste es JS del kit y habría que portarlo |
| Subida de archivos | No hay componente. Ningún fragmento de `src/` contiene `type="file"` | **Falta** |
| Árbol para el Índice (`Outline`) | No hay tree view (la búsqueda de `tree`/`árbol`/`treeitem` sólo arroja comentarios). Las piezas más cercanas son el Acordeón (`.dcc-accordion` con `button[aria-expanded]`, no `<details>`) y la Lista | **Falta**. Se puede armar con Lista/Acordeón anidados y el patrón ARIA de tree a mano |
| Hilo tipo chat (`Inquiry`) | No hay burbujas ni hilo de mensajes. Sirven Paper, Card genérica, Avatar, Stack, Progreso y Esqueleto | **Falta** el layout del hilo |
| Carta que se voltea | No hay. Ningún CSS del kit usa `rotateY`, `backface-visibility` ni "flip". Card genérica trae "contenido expandible" | **Falta** la animación de volteo |
| Botones de Calificación (Otra vez / Difícil / Bien / Fácil) | `calificacion` son **estrellas** (radios nativos), lo que no corresponde a la escala FSRS. Lo que sí encaja es el **Botón alternable** en grupo (`.dcc-toggle-group`, `role="group"`, `data-exclusivo`) o el **Grupo de botones**, con los cinco colores del botón | Cubierto con Botón alternable o Grupo de botones |
| Modales | Diálogo sobre `<dialog>` nativo, con `data-dcc-abrir`, `data-dcc-cerrar`, `data-dcc-cierre-fondo`; "El navegador se encarga de atrapar el foco […]; el kit bloquea el scroll del fondo, anima la entrada y la salida, y al cerrar devuelve el foco" | CSS cubierto; la apertura (`showModal`) se hace en React |
| Toasts | Snackbar con `DCCUI.notificar()`; con `data-tipo` toma color de alerta, y los de error usan `role="alert"`; se cierra solo a los 6 s | CSS cubierto; la cola y el temporizador hay que portarlos |
| Pie persistente | Pie institucional completo y "pie plano para aplicaciones internas". Ninguno es fijo: `.dcc-footer` no tiene `position: fixed/sticky` (`src/styles.css`, §13). La navegación inferior tampoco se fija sola (`.dcc-bottom-nav` sólo agrega `env(safe-area-inset-bottom)`) | Estilo cubierto; fijarlo es CSS propio |
| Contenedor para visor PDF embebido | Container ("Centra el contenido […] lo topa en un ancho máximo"), Paper y Grilla. No hay reglas para `iframe`, `embed` ni `object` | **Falta** un contenedor de alto completo y proporción para el visor |
| Otros útiles | Alerta, Progreso (lineal y circular), Esqueleto, Chip, Badge, Indicador, Tooltip, Popover, Línea de tiempo, Tabla ordenable, Paginación | Disponibles |

## 4. Responsive, tema oscuro y accesibilidad

**Responsive.** "Figma sólo define 1440px. Los breakpoints de abajo son inferidos." (`v2.8.1:src/styles.css`, §14). Los cortes son ≤1024, ≤768 y ≤480 px, más otros por componente (560, 600 y 900 px). A ≤768 px las canaletas bajan a 20 px, la nav institucional pasa a hamburguesa y el stepper se pone vertical (`v2.8.1:docs/decisiones-de-diseno.md` §3). Las tablas no se reorganizan: "**La tabla hace scroll horizontal** en pantallas angostas" (misma fuente). El kit no define pantallas de móvil: "El archivo no tiene pantallas" (§2).

**Tema oscuro.** Desde 2.6.0 (`v2.8.1:CHANGELOG.md`): `data-dcc-theme="dark"` o `"auto"` en `<html>` o en cualquier contenedor; sin el atributo, el kit es claro. Los colores se piden por rol (`--dcc-surface`, `--dcc-fg`, `--dcc-border`, `--dcc-danger`…), y el CSS propio de la app debería usar esas mismas variables para seguir el tema (`v2.8.1:dist/README.md` §8). Para que la página no parpadee, el kit recomienda poner el atributo con un `<script>` en `<head>` antes de pintar. Su plantilla lo hace leyendo `localStorage` (`v2.8.1:src/sitio/plantilla.html`, líneas 17–19). En Next eso implica `suppressHydrationWarning` en `<html>` (ver §2).

**Accesibilidad.** El README dice "Todo con teclado y ARIA donde corresponde, y respetando `prefers-reduced-motion`" (`v2.8.1:README.md`). Hay varias reglas `@media (prefers-reduced-motion: reduce)` en `src/styles.css` y una clase `.dcc-sr-only` (`v2.8.1:CHANGELOG.md` 2.8.0). Casi todo el teclado y el ARIA dinámico **vive en el JS del kit**, y se pierde si sólo se carga el CSS. Son excepciones la Calificación, que "funciona sin JS" con radios nativos, y el Diálogo y el Drawer, que se apoyan en `<dialog>`. El propio kit reconoce brechas de contraste: "**lightblue y green siguen bajo el mínimo AA de 4,5:1** para texto pequeño", y el antetítulo de la tarjeta da "**4,43 : 1**" (`v2.8.1:docs/decisiones-de-diseno.md`). Aparece como pendiente en `PUBLICAR.md`.

**Tipografía y espaciado.** Poppins para títulos de exhibición e Inter para el resto (`tipografia`). No hay utilidades de espaciado al estilo de Box: "No hay utilidades de espaciado al estilo de Box: el kit no usa `!important`" (`decisiones-de-diseno.md` §0.20). El espaciado entre bloques queda a cargo de Stack, Grilla y CSS propio.

## 5. Lo que habría que construir sobre sus tokens y estilos

1. **Comportamiento en React** de todo lo interactivo, sin Radix ni Headless UI: abrir y cerrar el Diálogo y el Drawer (`showModal`), tabs, acordeón, menú, autocompletar, la cola del snackbar, el textarea autoajustable y el grupo de botones alternables. El markup y las clases se copian de la documentación.
2. **Subida de archivos** (campo y zona de arrastre) con los estilos de `dcc-input` y `dcc-btn`.
3. **Árbol del Índice** con el patrón ARIA tree (`role="tree"`/`treeitem`, flechas), sobre Lista o Acordeón.
4. **Hilo de Consulta**: burbujas o bloques de mensaje, Citas incrustadas y un compositor fijo abajo en el móvil.
5. **Carta que se voltea**: animación 3D con `prefers-reduced-motion`, sobre Card genérica o Paper.
6. **Barra de Calificación** de cuatro valores, con Botón alternable o Grupo de botones.
7. **Pie o barra inferior fija** (posición, `safe-area`, compensar el alto del contenido).
8. **Contenedor del visor PDF**: altura de viewport, desborde y estructura responsive.
9. **Selector de tema** que escriba `data-dcc-theme` sin parpadeo.
10. **Íconos en React**: componente propio sobre el sprite del mismo origen, o `lucide-react@0.544.0`.

## Implicancias para Wise Wizard

- El kit es CSS más JS vanilla, no una librería de componentes de React. Su CSS entra en Next sin fricción conocida; su JS, según su propia guía, no debe usarse con React.
- La guía del kit propone Radix o Headless UI para el comportamiento en React, cosa que la restricción de `docs/PROBLEM.md` prohíbe. Todo el comportamiento interactivo y su accesibilidad quedan como trabajo propio.
- No hay paquete en el registro de npm. Se instala desde GitHub con una etiqueta fija (`#v2.8.1`) o se copia `dist/`. El CDN `cdn.dcc.uchile.cl` no estaba operativo al consultarlo; `apps.dcc.uchile.cl/ui-kit/` sí.
- El kit cambia rápido (cuatro versiones en tres semanas) y una versión major puede cambiar clases o markup. Conviene fijar la etiqueta.
- Faltan por completo: subida de archivos, árbol, hilo de chat, carta que se voltea y contenedor para PDF. La Calificación del kit son estrellas y no sirve para Otra vez, Difícil, Bien y Fácil.
- El responsive para teléfono está inferido, no diseñado, y la app tiene que fijar por su cuenta los elementos que deben quedar fijos.
- El tema oscuro existe y se basa en tokens por rol. El CSS propio debe usar esos tokens, y la nav, el pie y la barra lateral siguen siendo de marca DCC en ambos temas.
- La identidad visual es institucional del DCC, y los logos no son MIT ni reales todavía. Una app personal tiene que decidir si los muestra.
