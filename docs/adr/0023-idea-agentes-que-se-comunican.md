---
status: proposed
---

# Idea futura: agentes que se comunican entre sí

Los subagentes que leen las Fuentes podrían hablar entre ellos y con el orquestador mientras trabajan, en vez de devolver solo un informe al final. Así, al dividir una Sección, un subagente podría avisarle a otro de un concepto que sigue en sus páginas, o el orquestador podría precisar la tarea a medio camino. Hoy un subagente solo se comunica mediante su informe (ADR-0021). La idea tendría que caber en el tope de 300k (ADR-0019), porque cada mensaje consume el contexto de ambos agentes. Además, no está verificado que el SDK permita mensajes entre subagentes.
