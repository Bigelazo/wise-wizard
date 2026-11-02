# Presupuesto de contexto: orquestador y subagentes con un tope de 300k

Ningún contexto de la IA supera los 300k tokens. El tope es un límite de calidad: lejos de él, el modelo no se degrada (la "dumb zone"). No es un límite de capacidad, porque en Pro los modelos traen 1M, y el SDK no lo ofrece como opción, así que lo impone la app. Para que una Consulta pueda ser larga sin dejar de leer las Fuentes completas, la IA se divide en dos roles. El **orquestador** dialoga con el estudiante y nunca carga PDFs. Los **subagentes** nativos del SDK leen con `Read` las Secciones completas, parte por parte (ADR-0025), incluidas fórmulas, tablas y figuras, y le devuelven al orquestador un informe con sus Citas.

## Consecuencias

- **Herramientas.** El orquestador tiene la herramienta `Agent` y las herramientas propias de texto (Índice, Cartas propuestas, etc.), sin `Read`. Los subagentes tienen `Read` y las herramientas propias de texto. Un hook `PreToolUse` niega todo `Read` fuera de las Fuentes del Cuaderno y todo `Read` que, sumado al uso actual de ese subagente, supere el tope. La estimación es de 2,250 tokens por página (#15). La negación lleva el motivo en texto para que el subagente pida menos.
- **Presupuesto de retorno.** Las herramientas propias devuelven solo texto, hasta 20k tokens por llamada. El informe de un subagente tiene un tope de unos 8k tokens. Ninguna herramienta propia entrega PDFs, porque no puede hacerlo (#15).
- **Medición.** Se usa el `usage` de cada mensaje (`input_tokens + cache_creation_input_tokens + cache_read_input_tokens`); el de cada subagente se distingue por `parent_tool_use_id`. Antes de cada lectura, la app estima su costo por número de páginas. No se usa `getContextUsage({ detail: 'full' })`, porque no se sabe si gasta Cupo.
- **Lo que ve el estudiante.** La Consulta muestra el porcentaje de contexto usado por el orquestador. Mientras trabaja un subagente, se muestra qué lee (p. ej. "Leyendo Cap. 3, pp. 45–80"), sin cifras de tokens.
- **Compactación.** El orquestador compacta dentro del mismo hilo antes del tope (`CLAUDE_CODE_AUTO_COMPACT_WINDOW=300000`). Cada Consulta es un solo hilo. Tras el evento `compact_boundary`, el orquestador avisa al estudiante que hubo una Compactación y le dice qué conserva: temas, Secciones consultadas y conclusiones con sus Citas. Las Citas ya dadas siguen navegables porque viven en la app. Los subagentes no compactan (`DISABLE_COMPACT`): su tope lo asegura el hook.
- **Por actividad:**

  | Actividad                           | Qué se carga                                                                                                                 | Si no cabe                                                                              |
  | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
  | Consulta                            | Orquestador: diálogo, Índice e informes. Subagente: las Secciones del tema y sus Fuentes secundarias                         | El subagente se divide en sub-Secciones; el orquestador compacta                        |
  | Cartas de un capítulo               | Un subagente por sub-Sección, con sus Fuentes secundarias y las preguntas de las Cartas ya propuestas, para evitar repetidas | Más subagentes: por sub-Sección y, si una hoja del Índice no cabe, por rango de páginas |
  | Control de lectura                  | Un subagente lee la Sección y prepara las preguntas con sus Citas                                                            | Igual que en Cartas                                                                     |
  | Evaluación                          | La Carta y la página de su Cita de origen, con una página antes y otra después (~7k tokens)                                  | No aplica                                                                               |
  | Asociación de una Fuente secundaria | La secundaria (su texto con `page_text`, o la imagen con `Read`) y el Índice de la principal, sin sus PDFs                   | `page_text` corta en el tope y se asocia con lo leído (ADR-0025)                        |

- **Sin verificar en vivo, pero respaldado por los tipos del SDK 0.3.316:** que un hook `PreToolUse` niegue un `Read` hecho dentro de un subagente, y que los subagentes nativos corran dentro del subproceso del orquestador en vez de abrir uno propio (~1 GiB cada uno). Se comprueba en el primer spike de implementación.

## Opciones consideradas

- **Texto extraído con su Página impresa, más imágenes de página a pedido**: rinde 3–4 veces más, pero arriesga perder fórmulas, tablas y figuras, que son lo que más comprensión genera.
- **Un solo agente al que la app adjunta el sub-PDF en dos pasos** (la IA elige la Sección y la app la adjunta como bloque `document`): cada tema nuevo suma un PDF entero al mismo contexto, y una Consulta larga llega pronto al tope.
- **Subagentes lanzados por la app desde una herramienta propia**, cada uno una sesión aparte con el PDF adjunto: evitan `Read`, pero obligan a programar la cola y la concurrencia, y cada uno es un subproceso de ~1 GiB. El riesgo de `Read` (que lea archivos fuera de las Fuentes, como el entorno con el token) lo cierra el hook.
- **Continuación en una Consulta nueva, sembrada con un resumen**: corta el hilo. Con un orquestador que no carga PDFs, la compactación dentro del mismo hilo basta.
- **Cerrar la Consulta al llegar al tope**: pone un muro sin necesidad.
