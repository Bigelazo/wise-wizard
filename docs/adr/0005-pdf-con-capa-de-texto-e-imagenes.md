# Fuentes: PDF con capa de texto e imágenes, sin EPUB

Las Fuentes son PDFs con capa de texto o imágenes. La capa de texto puede ser el OCR invisible de un escaneo, y el PDF debe traer `/PageLabels` o el número de su primera Página impresa, que da el estudiante (ADR-0025). Las Citas usan la Página impresa del documento, no la posición de la página dentro del archivo PDF. Un libro se divide en sub-PDFs según su Índice, que se toma del outline del PDF o, si no lo trae, de las Secciones que propone la IA o arma el estudiante. Los sub-PDFs son partes que siguen las hojas del Índice, y una hoja de más de 10 páginas se corta en partes parejas (ADR-0025). La IA recibe cada Sección como sus partes: un subagente las lee todas con `Read`, y la app limita cada lectura a las Fuentes del Cuaderno y al presupuesto de contexto. El orquestador que dialoga con el estudiante no lee PDFs (ADR-0019).

## Opciones consideradas

- **Convertir todo a EPUB para navegar por índice**: el EPUB no tiene páginas estables, y la conversión rompe fórmulas y tablas.
- **Hacer OCR de los PDFs escaneados sin capa de texto**: queda como idea futura (ADR-0014). Por ahora se rechazan con un mensaje claro. Un escaneo que ya trae OCR invisible se acepta (ADR-0025).
