# El problema

## Quién

Un estudiante que además es el desarrollador de Wise Wizard. Estudia con libros y papers extensos, apoyados por material secundario más breve (apuntes en PDF, fotos de referencia). Lee en un Kindle con KOReader y quiere estudiar también desde el celular.

## Qué le pasa

Quiere aprender más y mejor, pero en sus horas de estudio no tiene herramientas para aplicar metodologías de aprendizaje con evidencia, como la **repetición espaciada** y el **active recall**. Las herramientas que existen resuelven partes sueltas:

- **Anki** agenda bien los repasos, pero las cartas se escriben a mano y nadie evalúa si una respuesta está bien.
- **NotebookLM** conversa sobre la bibliografía y la cita, pero no agenda repasos ni evalúa lo aprendido a lo largo del tiempo.

Ninguna de las dos une las piezas: leer, comprobar lo que quedó, convertir lo que no quedó en material de repaso y repasarlo en el momento justo.

## Qué necesita

Una aplicación en la que una IA:

1. responda **solo con su bibliografía de referencia**, citándola en APA 7 con la página impresa del documento;
2. le **cree Cartas** a partir de esa bibliografía para repasarlas con repetición espaciada;
3. lo **evalúe constantemente**: al repasar, cuando responde por escrito, y después de cada lectura.

## Restricciones

- **Costo:** el uso de la IA debe caber en la suscripción Claude Pro que ya paga, sin cobros extra (ADR-0003).
- **Contexto:** ninguna ventana de contexto de la IA puede superar los 300k tokens. Por eso los libros se dividen en Secciones según su Índice, y la IA lee solo la Sección que necesita.
- **Diseño:** la interfaz se construye completamente con [dcc-ui-kit](https://github.com/DCC-FCFM-UCHILE/dcc-ui-kit) ([sitio](https://dcc-fcfm-uchile.github.io/dcc-ui-kit/site/)), sin librerías de UI ni Tailwind.
- **Stack:** Next.js, TypeScript, Prisma, Docker, graphify, ponytail, ESLint, Prettier, Playwright y Vitest. Para la calidad: impeccable (UI/UX), fallow, react-doctor y la skill `vercel-react-best-practices`.
