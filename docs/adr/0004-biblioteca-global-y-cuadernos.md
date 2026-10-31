# Biblioteca global de Fuentes y Cuadernos con una Fuente principal

Cada Fuente se ingresa y procesa una sola vez en la Biblioteca (Referencia, Índice, Progreso de lectura) y se vincula a uno o más Cuadernos. La razón: procesar una Fuente es caro, y el progreso de lectura pertenece al libro, no al ramo. Cada Cuaderno se organiza en torno a exactamente una Fuente principal (un libro o un paper) y cero o más Fuentes secundarias (PDFs o imágenes). Al ingresar una secundaria, la IA la asocia a una o más Secciones de la principal, y el estudiante puede corregir esa asociación. Al generar Cartas de un capítulo, entran también las secundarias asociadas a él.

## Opciones consideradas

- **Cuadernos aislados al estilo NotebookLM**: duplican la ingesta y el progreso de lectura.
- **Biblioteca plana con etiquetas**: pierde la unidad de estudio.
- **Varias Fuentes principales por Cuaderno**: el Cuaderno pierde su eje.
