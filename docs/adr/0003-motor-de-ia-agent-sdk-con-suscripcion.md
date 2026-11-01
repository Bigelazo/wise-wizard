# Motor de IA: Claude Agent SDK con la suscripción Pro

La IA corre dentro de Wise Wizard con el Claude Agent SDK, autenticado con un token de la suscripción Pro del estudiante (`claude setup-token` → `CLAUDE_CODE_OAUTH_TOKEN`). Hay dos condiciones: no pagar nada más allá de la suscripción y que la IA viva dentro de la app. El motor queda detrás de un puerto propio: el resto de la app nunca importa el SDK, y pasar a API key significa solo cambiar de adaptador.

## Consecuencias

- **Uso estrictamente propio.** El help center de Anthropic indica que el Agent SDK con login de plan "draw[s] from your subscription limits", y los términos prohíben ofrecer ese login a otros usuarios. El caso de una app propia usada solo por el suscriptor no aparece mencionado explícitamente, así que queda un riesgo residual de cambio de política.
- **Cupo compartido.** La IA de la app y el uso de Claude Code como desarrollador consumen el mismo cupo (5 horas y semanal). Por eso la ingesta es determinista siempre que se pueda y la IA lee de a una Sección.
- **El footer de la app muestra el cupo restante**, de 5 horas y semanal, con la hora de reinicio de cada ventana. Sale del último `rate_limit_event` que recibió el motor, que llega una vez por sesión, en la primera respuesta. Se muestra con su antigüedad porque no es un valor en vivo: la app no ve lo que consume Claude Code. Si una petición se rechaza por cupo, el footer indica qué ventana se agotó y cuándo se reinicia. Los porcentajes vienen en `unifiedWindows`, un campo sin tipos ni documentación. Si falta o cambia de forma, se conserva la última lectura válida, o "sin datos", y la app deja un warning en el log. La lectura vive en memoria. Se descartaron `usage_report` (no funciona con `setup-token`, y con `/login` la credencial expira y reabre la pregunta de los términos), las sesiones de refresco (gastan cupo) y `api/oauth/usage` (choca con los términos).
- **Multiusuario exige migrar a API key** (ver ADR-0010).
- **Sin las Citations nativas de la Messages API.** Las Citas se construyen con herramientas propias que entregan el texto marcado con su Página impresa.
- **El "extra usage" de la cuenta queda desactivado**, para que en el peor caso las peticiones se rechacen en vez de cobrarse.

## Opciones consideradas

- **Messages API con API key**: cobra por token. Los créditos mensuales de API vienen solo con Max, no con Pro.
- **claude.ai con Wise Wizard como conector MCP**: está permitido y no cuesta nada, pero obliga a alternar entre apps.
- **Backend que lanza `claude -p`**: tiene la misma zona gris que el SDK y una interfaz más pobre.
- **Otros proveedores** (OpenAI, Google, GitHub Copilot, coding plans, modelos locales): sus términos lo prohíben, lo dejan en zona gris o no alcanzan los 300k de contexto. La investigación está en el ticket "Research: subscription-based AI engines".
- **Pasar a Max 5x para usar los créditos de API**: cuesta 80 USD más al mes.
