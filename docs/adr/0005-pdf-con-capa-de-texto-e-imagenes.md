# Fuentes: PDF con capa de texto e imágenes, sin EPUB

Las Fuentes son PDFs con capa de texto o imágenes. Las Citas usan la Página impresa del documento, no la posición de la página dentro del archivo PDF. Un libro se divide en sub-PDFs según su Índice, que se toma del outline del PDF o, si no lo trae, de las Secciones que propone la IA. La IA recibe cada Sección como sub-PDF: un subagente lo lee con `Read`, y la app limita cada lectura a las Fuentes del Cuaderno y al presupuesto de contexto. El orquestador que dialoga con el estudiante no lee PDFs (ADR-0019).

## Opciones consideradas

- **Convertir todo a EPUB para navegar por índice**: el EPUB no tiene páginas estables, y la conversión rompe fórmulas y tablas.
- **Aceptar PDFs escaneados con OCR**: queda como idea futura (ADR-0014). Por ahora se rechazan con un mensaje claro.
