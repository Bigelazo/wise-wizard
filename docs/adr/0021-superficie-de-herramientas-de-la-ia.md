# Superficie de herramientas de la IA y sus contratos

Toda actividad con IA tiene la misma forma: una sesión con un orquestador y subagentes (ADR-0019). La app la abre con un mensaje de tarea, ya sea una Consulta, la generación de Cartas, un Control de lectura, una Sesión de repaso en modo _escribir_, o, en la ingesta, proponer un Índice o asociar una Fuente secundaria (ADR-0025). La IA solo actúa sobre el dominio con un conjunto pequeño de herramientas propias. Cada herramienta queda atada, al abrir la sesión, a su Cuaderno y a su actividad. Proponer un Índice es una actividad de la Biblioteca, así que esa sesión queda atada a la Fuente en vez de a un Cuaderno. El Cuaderno o la Fuente nunca es un parámetro, así que ninguna llamada puede salirse de ellos. El respaldo estricto (ADR-0006) se cumple por construcción en un punto: solo existe una Cita que la app encontró literalmente en la Página impresa.

## Consecuencias

- **Agentes.** El orquestador tiene `Agent` y `outline`. Hay un solo tipo de subagente genérico, `reader`, con `Read` y todas las herramientas propias salvo `Agent`. Los subagentes especializados son la idea del ADR-0020. El prompt de sistema de `reader` trae las reglas de respaldo, de `cite`, del informe y de `Read`. Cada delegación le pasa la tarea y las Secciones a leer (sus partes, con ruta y rango de páginas). Una Sección se lee completa, con todas sus partes en orden (ADR-0025).
- **Herramientas.** Todas devuelven solo texto, hasta 20k tokens. Un error se devuelve con `isError` y el motivo en texto, para que el agente corrija.

  | Herramienta             | Quién                  | Entrada → salida                                                                                                                                                                                         | Errores                                                                                |
  | ----------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
  | `outline`               | orquestador y `reader` | `sectionId?`, `query?` → árbol de Secciones del Cuaderno: id, título, Páginas impresas, número de páginas, si está leída, rutas de sus partes en orden y las Fuentes secundarias asociadas con sus rutas | Sección desconocida; resultado sobre 20k → pide acotar por `sectionId`                 |
  | `card_questions`        | `reader`               | `sectionId` → preguntas de las Cartas y Cartas propuestas ya existentes en esa Sección, para no repetirlas                                                                                               | Sección desconocida                                                                    |
  | `cite`                  | `reader`               | `sourceId`, `pageLabel`, `kind` (`quotation` / `paraphrase`), `passage`, `text?` (la Paráfrasis) → id de la Cita y su Página impresa (`C12 · p. 47`)                                                     | el Pasaje no aparece, cruza un salto de página o es ambiguo; Fuente fuera del Cuaderno |
  | `propose_cards`         | `reader`               | `[{ question, answer, citationId }]` → Cartas propuestas creadas, y las rechazadas con su motivo                                                                                                         | Cita que no es de esta sesión; campos vacíos                                           |
  | `propose_reading_check` | `reader`               | `sectionId`, de 3 a 5 `[{ question, citationIds }]` (al menos una Cita cada una) → preguntas del Control de lectura creadas                                                                              | cantidad fuera de rango; Cita inválida                                                 |
  | `record_assessment`     | `reader`               | `targetId`, `feedback`, `citationIds` (al menos una), `proposedRating` (solo en un Repaso), `gaps: [{ description, citationId }]` (solo en un Control de lectura) → Evaluación guardada                  | campo que no corresponde al tipo de objetivo; Cita inválida                            |
  | `page_text`             | `reader` (ingesta)     | `fromPage`, `toPage` (Páginas impresas) → texto extraído de esas páginas, marcado con su Página impresa                                                                                                  | rango fuera de la Fuente; resultado sobre 20k → pide un rango menor                    |
  | `propose_outline`       | `reader` (ingesta)     | `[{ title, level, startPage }]` → Índice propuesto, guardado para que el estudiante lo revise                                                                                                            | páginas fuera de orden o fuera de la Fuente; niveles que saltan; lista vacía           |
  | `associate_sections`    | `reader` (ingesta)     | `sectionIds` (al menos uno) → asociación de la secundaria propuesta, guardada para que el estudiante la revise                                                                                           | Sección que no es de la Fuente principal del Cuaderno                                  |

  Las Fuentes secundarias de una Sección vienen dentro de `outline` y no tienen una herramienta aparte: son menos herramientas y la interfaz queda más profunda.

- **Cómo se valida una Cita.** `cite` busca el Pasaje en el texto por página que la ingesta extrae con pdf.js. Lo busca solo en las páginas de esa Fuente, normalizado igual que el buscador de pdf.js: NFD, sin el guion de fin de línea y con los espacios colapsados.
  - Si coincide en una sola página, la Página impresa sale de esa coincidencia y no de lo que dijo el modelo. La Cita guarda el índice de esa página en el PDF, y la Página impresa se calcula al mostrarla, así que corregir el mapeo de una Fuente corrige todas sus Citas (ADR-0025). El Pasaje se guarda tal como aparece en la capa de texto, así que el visor lo encuentra y lo resalta (búsqueda exacta, una sola página).
  - Si coincide en varias páginas, vale la Página impresa que dijo el modelo si está entre ellas. Si no está, la Cita es ambigua y se pide un Pasaje más largo.
  - Si no coincide, o si cruza un salto de página, se rechaza con el motivo ("no aparece en pp. 45–80", "cruza pp. 46–47: divídela"). El subagente corrige o deja de afirmar.
  - Una Paráfrasis también lleva un Pasaje literal. Así se puede resaltar, y la reformulación es lo que ve el estudiante.
  - Una Cita a una Fuente imagen no lleva Pasaje. Solo se comprueba que la Fuente sea del Cuaderno, y al abrirla se muestra la imagen completa.
- **Citas por id.** El informe del subagente y la respuesta del orquestador citan con marcadores `[[C12]]`, y la app muestra cada uno como una Cita navegable. Un marcador que no corresponde a una Cita validada en esa sesión se quita y se registra en el log. Así, el orquestador no puede inventar Citas. **Límite:** se garantiza que toda Cita existe, no que toda afirmación lleve una. Lo segundo depende del prompt.
- **Estilo de citación.** El modelo nunca escribe una cita formateada. Una Cita se guarda como datos (Fuente, índice de página del PDF, tipo, Pasaje, texto), y la app la formatea al mostrarla a partir de la Referencia. Hoy el único estilo es APA 7 y vive en un solo lugar. Cambiar de estilo no toca prompts, herramientas ni Citas guardadas (idea en el ADR-0022).
- **Informe del subagente.** Es texto libre con marcadores de Cita, de hasta unos 8k tokens. Lo estructurado ya queda guardado con las herramientas. Si un informe se pasa del tope, la app lo registra en el log y no lo recorta.
- **Quién escribe en la base.** Las herramientas del subagente guardan al momento de llamarlas, después de validar. El informe solo resume ("12 Cartas propuestas de §3.2"), así que en una generación con muchos subagentes las Cartas no pasan por el contexto del orquestador. No se salta ningún control humano: las Cartas propuestas esperan la aprobación del estudiante, y la Calificación propuesta, su confirmación (ADR-0007). Los mensajes de la Consulta los guarda la app a partir del stream.
- **Contrato del hook `PreToolUse`.** Funciona con una lista de permitidos. Al dividir una Fuente en partes, la app registra la ruta de cada parte resuelta con `realpath` y la vincula a {Fuente, Sección, rango de páginas del PDF, número de páginas} (ADR-0025). Un `Read` se permite solo si se cumplen tres condiciones: lo hace un subagente (el input del hook trae `agent_id`), la ruta está registrada para una Fuente del Cuaderno y el costo estimado, sumado al uso actual de ese subagente, no pasa de 300k.
  - Páginas: el total del archivo, que es de 10 como máximo. Cada página se estima en 2,250 tokens. Todo `Read` con `pages` se niega: con ese parámetro, `Read` entrega imágenes sin texto en vez del bloque `document` (ADR-0025).
  - Imágenes: ⌈ancho/28⌉ × ⌈alto/28⌉, con un máximo de 4,784.
  - Uso actual: el último `usage` de los mensajes que llevan ese `agent_id`.

  Todo lo demás se niega con el motivo en texto, incluido cualquier `Read` del orquestador. Como se permite solo lo registrado, quedan cerrados también archivos como `/proc/self/environ`, que contiene el token.

- **Puerto y adaptador (ADR-0003).** Fuera del SDK queda el módulo profundo:
  - las operaciones de dominio de cada herramienta, con entrada y salida tipadas;
  - el verificador de Pasajes;
  - la política de lectura (`canRead(path, pages, used) → allow | deny(reason)`);
  - la resolución de marcadores;
  - el formateador APA 7.

  En el adaptador del SDK quedan los `tool()` con Zod y `createSdkMcpServer`, la `AgentDefinition` de `reader`, los prompts (que nombran `Agent` y `Read`), la conexión del hook, el seguimiento del uso por `agent_id` y las opciones de compactación. Otro motor solo reemplazaría el adaptador.

- **Requisito bloqueante.** Que el hook niegue un `Read` hecho dentro de un subagente es la base de la seguridad de `Read`, y todavía no está verificado en vivo (ADR-0019). El primer issue de implementación lo comprueba antes que cualquier otra funcionalidad con IA. Si falla, `Read` no se habilita y se reabre el ADR-0019 con la alternativa de subagentes lanzados por la app con el sub-PDF como bloque `document`. El mismo spike comprueba si los subagentes comparten el subproceso. Esto afecta solo a la RAM, no a estos contratos. También comprueba que un `Read` sin `pages` de una parte de 10 páginas llegue como `document` (ADR-0025).

## Opciones consideradas

- **Forma mixta**: la Evaluación como un solo agente con las páginas adjuntas en un bloque `document`. Ahorra un paso de modelo por respuesta, pero agrega una segunda forma al adaptador y una excepción a "el orquestador nunca carga PDFs". Puede volver más adelante como optimización.
- **Confiar en la Página impresa que dice el modelo**: el modelo lee el número impreso en la imagen, pero se puede equivocar. La coincidencia en la capa de texto no se equivoca.
- **Paráfrasis sin Pasaje**: no habría nada que resaltar, y el ADR-0006 exige que toda Cita sea navegable.
- **Informe con esquema validado** (una herramienta `submit_report`): agrega fricción y no aporta, porque lo estructurado ya queda guardado con las herramientas.
- **El orquestador como único escritor**: cada Carta pasaría dos veces por el contexto y chocaría con el tope de ~8k del informe.
- **Hook con lista de prohibidos**: tarde o temprano se olvida una ruta sensible.
- **Doble defensa desde el inicio** (un usuario del sistema operativo que solo puede leer los sub-PDFs y el token pasado por otra vía): es infraestructura construida antes de saber si hace falta. Si el spike falla, la salida ya está descrita.
