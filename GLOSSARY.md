# Wise Wizard

Aplicación personal de estudio que aplica repetición espaciada y active recall sobre la bibliografía del propio estudiante, con una IA que tutorea, crea material de repaso y evalúa lo aprendido.

Cada término indica entre paréntesis su nombre en código.

## Lenguaje

### Material de estudio

**Biblioteca** (`Library`):
El conjunto de todas las Fuentes del estudiante, independiente de cualquier Cuaderno.
_Evitar_: Colección, repositorio

**Fuente** (`Source`):
Un material de referencia (libro, paper, imagen) incorporado una sola vez a la Biblioteca, con sus datos bibliográficos.
_Evitar_: Documento, archivo, material

**Índice** (`Outline`):
El árbol de Secciones de una Fuente.
_Evitar_: Tabla de contenidos, TOC, marcadores

**Sección** (`Section`):
Una parte de una Fuente delimitada por un rango de páginas, que la IA puede consultar por separado del resto de la Fuente.
_Evitar_: Chunk, fragmento, capítulo (un capítulo es solo un tipo de Sección)

**Página impresa** (`PageLabel`):
El número de página que aparece impreso en el documento y que se usa al citar. Es distinto de la posición de la página dentro del archivo PDF.
_Evitar_: Página del PDF, número de página (sin calificar)

**Cuaderno** (`Notebook`):
La unidad de estudio del estudiante (p. ej. "Cálculo II"), que agrupa las Fuentes que usa y todo el estudio hecho sobre ellas. Una Fuente puede pertenecer a varios Cuadernos.
_Evitar_: Materia, ramo, curso, proyecto

**Fuente principal** (`primary` source role):
La Fuente extensa (un libro o un paper) en torno a la cual se organiza un Cuaderno. Es un rol dentro del Cuaderno, no una propiedad de la Fuente.
_Evitar_: Libro base, texto guía

**Fuente secundaria** (`secondary` source role):
Una Fuente de menor extensión (un PDF o una imagen) que complementa a la Fuente principal de un Cuaderno y está asociada a una o más de sus Secciones. Todo Cuaderno tiene exactamente una Fuente principal y cero o más secundarias.
_Evitar_: Anexo, material complementario

**Progreso de lectura** (`ReadingProgress`):
La Página impresa en la que el estudiante declara ir dentro de una Fuente. Las Secciones que terminan antes de esa página se consideran leídas. Pertenece a la Fuente, no al Cuaderno.
_Evitar_: Avance, porcentaje leído

**Referencia** (`Reference`):
Los datos bibliográficos de una Fuente en formato APA 7 (autores, año, título, edición, editorial o revista, DOI), confirmados por el estudiante.
_Evitar_: Metadatos, bibliografía

**Cita** (`Citation`):
La mención de una Referencia, con su Página impresa, que respalda una afirmación concreta de la IA. Puede ser una Cita textual o una Paráfrasis.
_Evitar_: Referencia (la Referencia describe la Fuente; la Cita respalda una afirmación)

**Cita textual** (`Quotation`):
Una Cita que reproduce literalmente el texto de la Fuente, en su idioma original.
_Evitar_: Quote, extracto

**Paráfrasis** (`Paraphrase`):
Una Cita que reformula el contenido de la Fuente en el idioma de la interfaz, con los términos técnicos en su idioma original entre paréntesis.
_Evitar_: Resumen, cita indirecta

### Actividades de estudio

**Consulta** (`Inquiry`):
Un hilo de conversación del estudiante con la IA, dentro de un Cuaderno y sobre sus Fuentes, en el que cada respuesta se respalda con Citas. Si las Fuentes no cubren una pregunta, la IA lo declara y no responde.
_Evitar_: Chat, query, pregunta (sin calificar)

**Carta** (`Card`):
Una pregunta con su respuesta esperada, perteneciente a un Cuaderno, que se repasa con repetición espaciada.
_Evitar_: Tarjeta, flashcard, ficha

**Cita de origen** (`OriginCitation`):
La Cita que vincula una Carta con el lugar de la Fuente del que proviene. Toda Carta generada por la IA tiene una; en las Cartas creadas a mano es opcional.
_Evitar_: Fuente de la carta

**Carta propuesta** (`CardProposal`):
Una Carta generada por la IA que no entra a repaso hasta que el estudiante la aprueba, edita o descarta.
_Evitar_: Borrador, sugerencia

**Repaso** (`Review`):
Una presentación de una Carta al estudiante, según la repetición espaciada, junto con su resultado.
_Evitar_: Práctica, estudio

**Sesión de repaso** (`ReviewSession`):
Una tanda de Repasos de un Cuaderno hecha en un único modo: _voltear_ (el estudiante se califica solo) o _escribir_ (el estudiante responde por escrito y recibe una Evaluación).
_Evitar_: Ronda, práctica

**Calificación** (`Rating`):
El resultado de un Repaso en la escala de cuatro valores de la repetición espaciada: Otra vez, Difícil, Bien o Fácil.
_Evitar_: Nota, puntaje (la Evaluación puede tener puntaje; la Calificación no)

**Control de lectura** (`ReadingCheck`):
Un conjunto breve de preguntas que la IA plantea sobre una Sección que el estudiante registró como leída.
_Evitar_: Quiz, prueba, test

**Vacío** (`Gap`):
Un aspecto de una Sección que el estudiante no respondió bien en un Control de lectura. Se puede usar como alcance al pedir Cartas.
_Evitar_: Error, falla, debilidad

**Evaluación** (`Assessment`):
El juicio de la IA sobre una respuesta escrita del estudiante, en un Repaso o en un Control de lectura. Incluye retroalimentación y, en un Repaso, una Calificación propuesta que el estudiante confirma o cambia.
_Evitar_: Nota, corrección

### Uso de la IA

**Cupo** (`Quota`):
El límite de uso de la suscripción Pro, en dos ventanas (5 horas y semanal), compartido entre la IA de la app y el uso de Claude Code del desarrollador.
_Evitar_: Límite, rate limit, tokens restantes
