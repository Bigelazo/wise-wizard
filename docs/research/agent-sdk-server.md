# Claude Agent SDK en un servidor propio con la suscripción Pro

Ticket: #6. Contexto: ADR-0003, ADR-0005, ADR-0006 y los hallazgos de #3 (`research/ai-subscriptions`).

Fecha de la investigación: 2026-10-31. Las fuentes son páginas oficiales consultadas ese día: la documentación de Claude Code y del Agent SDK (en su versión Markdown, `https://code.claude.com/docs/en/<página>.md`), la documentación de la plataforma Claude, los artículos del help center de Anthropic y las declaraciones de tipos del paquete npm `@anthropic-ai/claude-agent-sdk@0.3.316` (la versión `latest` en npm ese día). Las citas son textuales y van en su idioma original. Lo que no está documentado se marca como **no documentado**.

---

## 1. Autenticación en un contenedor

### `claude setup-token` y `CLAUDE_CODE_OAUTH_TOKEN`

- El token dura un año, se genera con el mismo flujo de navegador que `/login` y no se guarda en ningún lado: "For CI pipelines, scripts, or other environments where interactive browser login isn't available, generate a one-year OAuth token with `claude setup-token`" y "It does not save the token anywhere; copy it and set it as the `CLAUDE_CODE_OAUTH_TOKEN` environment variable wherever you want to authenticate" — https://code.claude.com/docs/en/authentication#generate-a-long-lived-token
- Alcance: "This token authenticates with your Claude subscription and requires a Pro, Max, Ultra, Team, or Enterprise plan. It can only make model requests, so it can't establish Remote Control sessions or fetch claude.ai connectors. MCP servers you configure locally still work." — misma página.
- Ámbito OAuth: el token "carries only the `user:inference` scope" — https://code.claude.com/docs/en/agent-sdk/typescript#sdkassistantmessage. Esto importa para el footer (sección 6).
- Modo `--bare`: "Bare mode does not read `CLAUDE_CODE_OAUTH_TOKEN`. If your script passes `--bare`, authenticate with `ANTHROPIC_API_KEY` or an `apiKeyHelper` instead." — https://code.claude.com/docs/en/authentication. Además, "`--bare` is the recommended mode for scripted and SDK calls, and will become the default for `-p` in a future release." — https://code.claude.com/docs/en/headless#start-faster-with-bare-mode. Ese cambio de default se anuncia para `-p`; para el SDK no se encontró ninguna fecha.
- Precedencia: `CLAUDE_CODE_OAUTH_TOKEN` está en el puesto 5 y queda por debajo de `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_API_KEY` y `apiKeyHelper`. "In non-interactive mode (`-p`), the key is always used when present." — https://code.claude.com/docs/en/authentication#authentication-precedence. Si el contenedor tiene una `ANTHROPIC_API_KEY` definida, se cobra por API en vez de usar la suscripción. El help center lo confirma: "If you have an ANTHROPIC_API_KEY environment variable set on your system, Claude Code will use this API key for authentication instead of your Claude subscription … resulting in API usage charges" — https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-or-max-plan
- Paso del token al SDK: la opción `env` "replaces the subprocess environment instead of merging with `process.env`, so pass `{ ...process.env, YOUR_VAR: 'value' }`" — https://code.claude.com/docs/en/agent-sdk/typescript#options. La guía de session storage documenta este caso: "if you run the agent yourself under your own Claude subscription, set `CLAUDE_CODE_OAUTH_TOKEN` in `env` to a token from `claude setup-token`" — https://code.claude.com/docs/en/agent-sdk/session-storage

### Renovación

- El token de `setup-token` no se refresca solo. Cuando falla con 401: "Claude Code keeps sending the value you set after a request fails with a 401, rather than switching to a stored login's token. … Generate a fresh token with `claude setup-token` and restart with it" — https://code.claude.com/docs/en/errors (sección de login expirado).
- La alternativa es un `/login` completo persistido en el contenedor, en `~/.claude/.credentials.json` con modo `0600` en Linux (https://code.claude.com/docs/en/authentication, "Credential management"). Ese login también expira y depende de que Claude Code logre refrescarlo: "Once the stored login expires and can't be refreshed, each model request fails with `Login expired · Please run /login`". Tres días antes aparece un aviso al iniciar: "Your login expires in 3 days · run /login to renew" — misma página, "Renew an expiring login". La duración de ese login no está publicada.

### Política de uso (recordatorio de #3, verificado de nuevo)

- "Unless previously approved, Anthropic does not allow third party developers to offer claude.ai login or rate limits for their products, including agents built on the Claude Agent SDK." — https://code.claude.com/docs/en/agent-sdk/overview
- "developers may not collect, store, or intermediate Claude.ai credentials or session tokens — sign-in to a Claude account must complete through Anthropic's own flow." y "Advertised usage limits for Pro, Max, and Ultra plans assume ordinary, individual usage of Claude Code and the Agent SDK." — https://code.claude.com/docs/en/legal-and-compliance
- "when you're signed in with your Claude plan, the Claude Agent SDK and claude -p still draw from your subscription limits." (actualización del 7 de octubre de 2026) — https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan

## 2. Herramientas: operaciones propias y bloqueo de las incorporadas

### Herramientas propias en el mismo proceso (SDK MCP server)

- Se definen con `tool()` y un esquema Zod, y se registran con `createSdkMcpServer`: "The server runs in-process inside your application, not as a separate process." — https://code.claude.com/docs/en/agent-sdk/custom-tools
- Nombre completo de cada herramienta: "`mcp__{server_name}__{tool_name}`, where `{server_name}` is the key you give the server in `mcpServers`" (misma página).
- Lo que devuelve el handler: `content` con bloques `text`, `image`, `audio`, `resource` o `resource_link`, más `structuredContent` e `isError` como opcionales (misma página).
- `readOnlyHint: true` permite que Claude ejecute en paralelo las herramientas sin efectos secundarios (misma página, "Add tool annotations").

Ejemplo oficial (TypeScript, de la misma página):

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "What's the temperature in San Francisco?",
  options: {
    mcpServers: { weather: weatherServer },
    allowedTools: ["mcp__weather__get_temperature"]
  }
})) {
  if (message.type === "result" && message.subtype === "success") {
    console.log(message.result);
  }
}
```

### Desactivar las herramientas incorporadas (web, Bash, escritura de archivos)

- "`tools: []` | Availability | All built-ins are removed. Claude can only use your MCP tools." — https://code.claude.com/docs/en/agent-sdk/custom-tools#configure-allowed-tools
- "To remove a built-in entirely, omit it from `tools` or list its bare name in `disallowedTools` …; both keep the tool out of context so Claude never attempts it." (misma página). En cambio, `allowedTools` "does not restrict Claude to only these tools" — https://code.claude.com/docs/en/agent-sdk/typescript#options
- Modo `dontAsk`: en ese modo se salta el callback de permisos "and the tool is denied" — https://code.claude.com/docs/en/agent-sdk/permissions
- Aislamiento de la configuración del desarrollador (CLAUDE.md, hooks y skills de `~/.claude`): `settingSources: []` "disable[s] user, project, and local settings" — https://code.claude.com/docs/en/agent-sdk/claude-code-features. `strictMcpConfig: true` usa "only the servers passed in `mcpServers` and ignore[s] project `.mcp.json`, user settings, plugin-provided MCP servers, and claude.ai connectors" — https://code.claude.com/docs/en/agent-sdk/typescript#options. Advertencia del modo no bare: "Without `--bare`, a `-p` session runs the hooks in a project's `.claude/settings.json` and connects the servers in its `.mcp.json`, even in a folder you've never trusted." — https://code.claude.com/docs/en/headless
- System prompt: si se omite, el SDK usa un "minimal prompt". El preset `claude_code` hay que pedirlo explícitamente — https://code.claude.com/docs/en/agent-sdk/typescript#options (fila `systemPrompt`).

## 3. Interacción: streaming, sesiones y concurrencia

### Streaming al navegador

- Con `includePartialMessages: true`, el SDK entrega mensajes `StreamEvent` con "raw API events as they arrive". El texto llega en eventos `content_block_delta` con `delta.type === "text_delta"` — https://code.claude.com/docs/en/agent-sdk/streaming-output. El SDK no trae transporte al navegador. La guía de hosting indica que "the container exposes an HTTP or WebSocket endpoint and maps each active session to a long-lived query" — https://code.claude.com/docs/en/agent-sdk/hosting

### Sesiones y resume (Consultas de varios turnos)

- "Resume takes a specific session ID. You track the ID. Required when you have multiple sessions" — https://code.claude.com/docs/en/agent-sdk/sessions. El ID viene en `session_id` del mensaje result y del mensaje `system` init.
- Almacenamiento: "Claude Code stores sessions under `~/.claude/projects/<encoded-cwd>/*.jsonl`" y "Same machine only: the session file still needs to exist on the current machine." (misma página). Para que sobrevivan reinicios del contenedor está el adaptador `SessionStore`: "Default local disk is lost on restart, scale-down, or a move to a different node. For any session a user expects to resume, mirror the transcript to durable storage with a SessionStore adapter." — https://code.claude.com/docs/en/agent-sdk/hosting
- `forkSession`, `persistSession: false` y `continue` también existen como opciones — https://code.claude.com/docs/en/agent-sdk/typescript#options
- En sesiones de larga vida se agregan turnos con `streamInput()`, y `startup()` / `prewarm()` precalientan el proceso — https://code.claude.com/docs/en/agent-sdk/hosting

### Concurrencia

- "One agent session maps to one subprocess. Running N concurrent sessions means N subprocesses" y "1 GiB RAM, 5 GiB disk, and 1 CPU per agent is a reasonable starting point" — https://code.claude.com/docs/en/agent-sdk/hosting
- No se encontró ningún límite documentado de sesiones concurrentes por cuenta de suscripción. Todas las sesiones consumen el mismo cupo: "Usage counts against the session and weekly allowances at the same time. A single burst of heavy activity, such as a large workflow fanout, can exhaust the weekly allowance before the session window resets." — https://code.claude.com/docs/en/errors#youve-hit-your-session-limit

## 4. Contexto: medir tokens por sesión y controlar la compactación

### Ventana disponible en Pro

- En Claude Code, con Pro: Opus 5.5, Sonnet 5.5 y Haiku 5.5 tienen 1M tokens. Solo los `[1m]` de Opus 4.6 y Sonnet 4.6 exigen usage credits en Pro — https://support.claude.com/en/articles/8606394-how-large-is-the-context-window-on-paid-claude-plans. "Fable 5.1, Fable 5, Sonnet 5 and later, Haiku 5.5, and Opus 4.7 and later run with the 1M window by default" — https://code.claude.com/docs/en/model-config#extended-context

### Medición

- `query.getContextUsage()` devuelve `totalTokens`, `maxTokens`, `percentage` y un desglose por categoría (`system_prompt`, `mcp_tools`, `messages`, `free_space`, etc.). Con `detail: 'full'` (el default) cuenta con "token-counting API requests. These requests don't appear in the message stream"; con `{ detail: 'summary' }` "No token-count requests go out, and the per-category numbers are approximate." — https://code.claude.com/docs/en/agent-sdk/typescript#sdkcontrolgetcontextusageresponse. No está documentado si esos token-counting requests consumen cupo de la suscripción. La página solo dice "On the Anthropic API, token counting isn't billed."
- Cada `SDKAssistantMessage.message.usage` trae `input_tokens`, `cache_creation_input_tokens` y `cache_read_input_tokens`. Para el statusline, el uso de contexto se define como "input tokens only: `input_tokens + cache_creation_input_tokens + cache_read_input_tokens`" — https://code.claude.com/docs/en/statusline. `ModelUsage` del result incluye `contextWindow` — https://code.claude.com/docs/en/agent-sdk/typescript#modelusage

### Compactación

- Umbral: `CLAUDE_CODE_AUTO_COMPACT_WINDOW` acepta "from `100000` to `1000000` tokens" y tiene precedencia sobre `autoCompactWindow`, `/autocompact` y `--autocompact` — https://code.claude.com/docs/en/model-config#set-the-auto-compact-window y https://code.claude.com/docs/en/env-vars. Si no se configura, los modelos con 1M "compact before the window fills, at about 967K tokens by default".
- Desactivarla: `DISABLE_AUTO_COMPACT=1` "disable[s] automatic compaction … The manual `/compact` command remains available"; `DISABLE_COMPACT=1` "disable[s] all compaction" — https://code.claude.com/docs/en/env-vars
- Eventos: `SDKCompactBoundaryMessage` (`subtype: "compact_boundary"`, `compact_metadata.trigger` y `pre_tokens`), además de los hooks `PreCompact` y `PostCompact` — https://code.claude.com/docs/en/agent-sdk/typescript
- El SDK no tiene una opción que corte la sesión al llegar a N tokens. Un tope de 300k depende de la app: puede leer `usage` o `getContextUsage()` y dejar de enviar turnos, o fijar el umbral de compactación en 300000.

## 5. Entrada: sub-PDFs e imágenes

### Por dónde entran al modelo

1. **En el mensaje de usuario.** En el modo de entrada por streaming (`AsyncIterable<SDKUserMessage>`), `message` es un `MessageParam` de la API, y la documentación dice "send images and documents in `message.content`" — https://code.claude.com/docs/en/agent-sdk/typescript#sdkusermessage. El ejemplo oficial con imagen está en https://code.claude.com/docs/en/agent-sdk/streaming-vs-single-mode:
   ```typescript
   content: [
     { type: "text", text: "Review this architecture diagram" },
     { type: "image", source: { type: "base64", media_type: "image/png",
       data: await readFile("diagram.png", "base64") } }
   ]
   ```
   Para PDF, la página habla de "documents" pero **no trae un ejemplo con un bloque `document`**.
2. **Como resultado de una herramienta propia.** El bloque `image` se pasa en base64: "A PNG, JPEG, GIF, or WebP image reaches Claude as visual input" — https://code.claude.com/docs/en/agent-sdk/custom-tools#images. Hay bloques `resource` con `blob` binario (solo en TypeScript), pero **no está documentado** que un `resource` con `mimeType: application/pdf` llegue a Claude como documento.
3. **Con la herramienta incorporada `Read`.** Lee PDFs con `pages` ("1-5"): "A read that returns the `pdf` output carries a summary `text` block followed by a `document` block. One that returns the `parts` output carries … one block per extracted page: an `image` block" — https://code.claude.com/docs/en/agent-sdk/typescript (sección Read). Usarla exige habilitar `Read` y tener el archivo en disco.

### Costo en tokens

- PDF: "Each page typically uses 1,500–3,000 tokens depending on content density." y "Because each page is converted into an image, the same image-based cost calculations are applied." — https://platform.claude.com/docs/en/build-with-claude/pdf-support#estimate-your-costs. Cada página entra como texto extraído más la imagen de la página.
- Imagen: "An image, therefore, costs `⌈width / 28⌉ × ⌈height / 28⌉` visual tokens." En los modelos "Claude 4.7 and later" el máximo es de 2,576 px y 4,784 tokens visuales por imagen. Ejemplos: 1000×1000 son 1,296 tokens y 1920×1080 son 2,691 — https://platform.claude.com/docs/en/build-with-claude/vision#resolution-and-token-cost
- Límites por request: "Maximum pages per request | 600 (100 when the request's context window is under 1M tokens)" y 128 MB — https://platform.claude.com/docs/en/build-with-claude/pdf-support

## 6. Cupo: modelos, error al agotarlo y lectura del restante (footer)

### Modelos en Pro y su peso relativo

- Tabla de https://claude.com/pricing: en Pro, Opus "Yes", Sonnet "Yes", Haiku "Yes", y Fable "Usage credits" (se paga aparte, no sale del cupo). Límite cada 5 horas: Pro "1x", Max "5x". Semanal: Pro "1x".
- Modelo por defecto en Pro: "defaults to Opus 5.5" — https://code.claude.com/docs/en/model-config#default-model-setting
- El peso relativo de cada modelo en el cupo **no está publicado**. Lo único documentado es cualitativo: "Your usage is affected by several factors, including the length and complexity of your conversations, the features you use, which Claude model you're chatting with, and the effort level you've selected." — https://support.claude.com/en/articles/11647753-how-do-usage-and-length-limits-work. Como referencia indirecta están los precios de API por MTok de entrada y salida: Opus 5.5 $4/$20, Sonnet 5.5 $2/$10, Haiku 5.5 $0.10/$0.50 (≤100K) — https://claude.com/pricing. Que el cupo siga esas proporciones **no está documentado**.
- También pueden existir límites semanales por familia: "You've hit your Opus limit" / "You've hit your Sonnet limit", y "The Opus and Sonnet limits each apply only to requests to that model family" — https://code.claude.com/docs/en/errors#youve-hit-your-session-limit

### Qué pasa al llegar al límite con extra usage desactivado

- Mensajes documentados: "You've hit your session limit · resets 3:45pm", "You've hit your weekly limit · resets Mon 12:00am". "Claude Code blocks further requests until the reset time shown in the message." — https://code.claude.com/docs/en/errors#youve-hit-your-session-limit
- Forma en el SDK:
  - `SDKAssistantMessage.error` toma el valor `'rate_limit'`, "which is a 429 against your quota", distinto de `'overloaded'` (529) — https://code.claude.com/docs/en/agent-sdk/typescript#sdkassistantmessage
  - `SDKResultMessage` trae `api_error_status` ("the HTTP status code of the API error that terminated the conversation") — misma página.
  - `SDKRateLimitEvent` (`type: "rate_limit_event"`) trae `rate_limit_info.status: "allowed" | "allowed_warning" | "rejected"`, `resetsAt?` y `utilization?`. Con `errorCode: "credits_required"` "the rejection is from a claude.ai subscription whose included usage is exhausted, and the session cannot continue until the user buys usage credits" — https://code.claude.com/docs/en/agent-sdk/typescript#sdkratelimitevent
  - Las declaraciones de tipos del paquete (`sdk.d.ts` en `@anthropic-ai/claude-agent-sdk@0.3.316`) agregan campos que la página no menciona: `rateLimitType?: 'five_hour' | 'seven_day' | 'seven_day_opus' | 'seven_day_sonnet' | 'seven_day_overage_included' | 'overage'`, `overageStatus`, `overageDisabledReason` (incluye `'overage_not_provisioned'` y `'out_of_credits'`), `isUsingOverage` y `surpassedThreshold`. El comentario del tipo dice "Rate limit information for claude.ai subscription users." Son tipos publicados, pero sin documentación en prosa.
- Reintentos: con `CLAUDE_CODE_RETRY_WATCHDOG`, "Claude Code fails at once when a standard-speed request gets a `429` that reports a spend limit or exhausted usage credits" — https://code.claude.com/docs/en/errors. La espera automática hasta el reset está documentada solo "In an interactive session".
- Extra usage: si está desactivado, "Once disabled, you'll only have access to your plan's included usage." — https://support.claude.com/en/articles/12429409-extra-usage-for-paid-claude-plans
- Margen al cortar: "If you reach your five-hour session limit while Claude Code is partway through a response, it may keep working briefly … On the Pro plan, it applies up to once per weekly usage period." — https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-or-max-plan

### ¿Se puede leer el cupo restante de 5 h y semanal por programa?

**Documentado:**

1. **`/usage` enviado como prompt al SDK → `SDKAssistantMessage.usage_report`** (tipo `SDKUsageReport`, marcado como experimental). `rate_limits.limits[]` trae filas con `kind` ("such as `session`, `weekly_all`, or `weekly_scoped`"), `percent` ("Share of the window used, 0-100"), `resets_at` (ISO 8601), `severity` e `is_active` — https://code.claude.com/docs/en/agent-sdk/typescript#sdkusagereport. **Requisitos:** "The session authenticates with a claude.ai credential", "The credential shows a known plan type or carries the `user:profile` scope", "The account isn't on usage-based billing". Y textualmente: "**A `claude setup-token` token passed as `CLAUDE_CODE_OAUTH_TOKEN` doesn't qualify by default, because it carries only the `user:inference` scope.**" `rate_limits` "is `null` when Claude Code couldn't get the plan's usage, for example when the session's OAuth token lacks the `user:profile` scope." Requiere Agent SDK v0.3.273 o posterior.
2. **`rate_limit_event` en el stream** (ver arriba): trae `utilization` y `resetsAt`, y `rateLimitType` en los tipos. La página dice "Emitted when the session encounters a rate limit". **No está documentado** con qué frecuencia se emite con `status: "allowed"`, ni si se emite con un token de `setup-token`. Verificado en ejecución en #15 (sección 7): se emite con `setup-token`, una vez por sesión, y el porcentaje viene en un campo no tipado (`unifiedWindows`).
3. **JSON de entrada del statusline**: `rate_limits.five_hour.used_percentage`, `rate_limits.seven_day.used_percentage` y `resets_at` en epoch. "appears only for claude.ai Pro, Max, and Ultra subscribers … Even then, it appears only after the first API response in the session." — https://code.claude.com/docs/en/statusline. El statusline está documentado para la interfaz interactiva. **No está documentado** que se ejecute en sesiones del SDK o de `-p`.
4. **Cabeceras `anthropic-ratelimit-unified-*`**: la guía de gateways dice que "Claude Code reads them on successful responses to show usage against plan limits to developers signed in with claude.ai, and on a `429` to tell a plan limit or spend cap from a temporary throttle" — https://code.claude.com/docs/en/llm-gateway-protocol#response-headers. Se documenta la existencia de la familia de cabeceras, no sus nombres ni su formato. Están en las respuestas que recibe el subproceso `claude`. El SDK no las expone, salvo a través de `rate_limit_event`.
5. Fuera de programa: claude.ai, en Settings > Usage, muestra "Current session" y el próximo reset semanal — https://support.claude.com/en/articles/11647753

**No documentado (observado, no usar sin evaluar los términos):**

- El binario local de Claude Code (v2.1.316) contiene la cadena `api/oauth/usage` y cabeceras como `anthropic-ratelimit-unified-5h-utilization`, `-5h-reset`, `-7d-utilization` y `-7d-reset`. Se vio con `strings` sobre el binario y no se ejecutó nada. **Ninguna página oficial documenta el endpoint `api/oauth/usage`** (se buscó en `llms-full.txt` de code.claude.com sin resultados).
- Riesgo con los términos: para llamar a ese endpoint desde código propio habría que sacar el token OAuth de la suscripción y usarlo fuera del binario de Claude Code. Eso choca con "developers may not collect, store, or intermediate Claude.ai credentials or session tokens" (https://code.claude.com/docs/en/legal-and-compliance) y con la prohibición de "third-party tools that misrepresent their identity to Anthropic's servers" (https://support.claude.com/en/articles/13189465-log-in-to-your-claude-account, citado en #3). Además, el token de `setup-token` no tiene `user:profile`. Que ese endpoint lo exija **no está documentado**, pero el SDK documenta esa misma condición para `usage_report`.

## 7. Verificación en vivo con el token de `setup-token` (#15)

Spike desechable (fuera del repo), ejecutado el 2026-10-31 con `@anthropic-ai/claude-agent-sdk@0.3.316`, Node v26.10.0 y `claude-haiku-5-5`, autenticado solo con `CLAUDE_CODE_OAUTH_TOKEN` de `claude setup-token` (el script abortaba si había `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN` o `apiKeyHelper`; el mensaje `init` reportó `"apiKeySource":"none"`). Opciones: `tools: []` (salvo `Read` en el experimento E), `settingSources: []`, `strictMcpConfig: true`, `permissionMode: "dontAsk"`, `persistSession: false`, sin `--bare`, entrada por streaming. La página de prueba fue una página de texto corrido de un libro de texto (un PDF de una página, 42.4 KB). Los extractos son del log de la ejecución, recortados.

Experimentos: A = tres turnos de una palabra en una misma sesión, con 5 llamadas a `getContextUsage({ detail: 'full' })` entre el primero y el segundo; B = herramienta MCP propia que devuelve la página como `resource` con `blob`; C = pregunta sin PDF (línea base); D = misma pregunta con la página como bloque `document` en el mensaje de usuario; E = la herramienta `Read` sobre la página en un directorio vacío.

### `rate_limit_event`

- **Se emite con un token de `setup-token`**, con `status: "allowed"`, **una sola vez por sesión, junto a la primera respuesta**. Los turnos siguientes de la misma sesión no traen ninguno. Esto coincide con el comentario del tipo en `sdk.d.ts`: "Rate limit event emitted when rate limit info changes."
  ```
  rateLimitEventsPerTurn: A#1 1 · A#2 0 · A#3 0 · B#1 1 · C#1 1 · D#1 1 · E#1 1
  ```
- **`utilization` no viene en el nivel superior** de `rate_limit_info`. El porcentaje de las dos ventanas llega en `unifiedWindows`, un campo que **no está en los tipos de la 0.3.316** ni en la documentación:
  ```json
  {"status":"allowed","resetsAt":1793508000,"rateLimitType":"five_hour",
   "overageStatus":"rejected","overageDisabledReason":"org_level_disabled","isUsingOverage":false,
   "unifiedWindows":{"five_hour":{"utilization":0.4,"resetsAt":1793508000,"status":"allowed"},
                     "seven_day":{"utilization":0.12,"resetsAt":1793944800,"status":"allowed"}}}
  ```
  `utilization` parece una fracción de 0 a 1 con dos decimales (0.39 en una corrida anterior, 0.4 en esta). `resetsAt` está en segundos epoch. `rateLimitType` es `"five_hour"` y el `resetsAt` de nivel superior es el de esa ventana. `overageStatus: "rejected"` con `"org_level_disabled"` concuerda con tener el extra usage desactivado.

### `getContextUsage()` y el cupo

- **No se pudo medir.** Para comparar `utilization` antes y después hace falta un `rate_limit_event` posterior a las llamadas, y en la misma sesión no llegó ninguno (A#2 y A#3: 0 eventos). Además, la resolución observada es de 0.01 de la ventana de 5 horas, muy gruesa para el costo de un conteo de tokens.
- La otra vía de lectura del cupo, `usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET({ skipBehaviors: true })` (método del `Query` en los tipos), tampoco sirve con este token:
  ```
  "subscription_type":null,"rate_limits_available":false,"rate_limits":null
  ```
- Lo observado: `full` y `summary` devolvieron el mismo `totalTokens` (605) en esa sesión, y ningún request apareció en el stream ni en `model_usage`.

### Sub-PDF desde una herramienta propia

- **Un `resource` con `blob` `application/pdf` no llega a Claude como documento.** El SDK guarda el binario en disco (bajo `~/.claude/projects/…/tool-results/`, aun con `persistSession: false`) y le pasa al modelo solo una línea de texto:
  ```
  [Resource from book at wisewizard://section/1.pdf] Binary content (application/pdf, 42.4KB) saved to …/tool-results/mcp-book-blob-….pdf
  ```
  El modelo respondió `NO_PDF`, y la entrada creció solo 260 tokens tras el resultado de la herramienta (1148 → 1408).
- **Vías que sí funcionan**, ambas con la cita textual correcta de la primera oración ("There are two general approaches to fighting complexity, …"):
  - **Bloque `document` en el mensaje de usuario** (D): `{ type: "document", source: { type: "base64", media_type: "application/pdf", data } }` dentro de `message.content` del `SDKUserMessage`.
  - **`Read`** (E): el resultado lleva un bloque `text` ("PDF file read: …/section.pdf (42.4KB)") seguido de un bloque `document`. Exige habilitar `Read` y tener el archivo en disco.
- La página usada no tenía número impreso y el modelo lo dijo ("No page number is printed on this page") en vez de inventarlo. La lectura de la Página impresa queda probada solo en una corrida previa con otro documento de una página, que no se cita aquí por contener datos personales.

### Tokens por página

- **2,253 tokens** para la página del libro como bloque `document`: entrada total de D (2,917) menos la de la línea base C (664), contando `input_tokens + cache_creation_input_tokens + cache_read_input_tokens`. Cae dentro del rango documentado de 1,500–3,000 por página.
- Con `Read`, la entrada creció 2,442 tokens tras el resultado de la herramienta (1,772 → 4,214), lo que incluye el bloque de texto y el turno de la llamada.
- Es una sola página de un solo libro: la densidad varía según el contenido.

## Implicancias para Wise Wizard

- Con `CLAUDE_CODE_OAUTH_TOKEN` de `setup-token`, el SDK hace llamadas al modelo con la suscripción Pro, siempre que no se use `--bare` y que no haya `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN` ni `apiKeyHelper` en el entorno del subproceso. El token dura un año y no se renueva solo. Al vencer, las llamadas fallan con 401 hasta que alguien genere otro token en un navegador.
- Las operaciones del dominio se pueden exponer como herramientas en el mismo proceso con `createSdkMcpServer`. Con `tools: []`, Claude no ve ninguna herramienta incorporada: ni WebSearch, ni WebFetch, ni Bash, ni Write. `settingSources: []` y `strictMcpConfig: true` dejan fuera la configuración de `~/.claude` y los conectores de claude.ai.
- El SDK no incluye el streaming al navegador. Entrega deltas `text_delta` que la app tiene que reenviar por HTTP o WebSocket. Las sesiones se retoman por ID desde transcripts JSONL locales. Para que sobrevivan a un reinicio del contenedor hace falta un `SessionStore` o un volumen persistente. Cada sesión concurrente es un subproceso, con alrededor de 1 GiB de RAM como base.
- Los modelos actuales tienen 1M tokens de contexto en Pro. El tope de 300k no existe como opción del SDK. La app lo puede imponer leyendo `usage` o `getContextUsage()`, y `CLAUDE_CODE_AUTO_COMPACT_WINDOW=300000` mueve la compactación a ese umbral. `DISABLE_AUTO_COMPACT` y `DISABLE_COMPACT` existen.
- Un sub-PDF llega como documento por dos vías verificadas: un bloque `document` en el mensaje de usuario, o la herramienta `Read`, que exige habilitar `Read` y tener el archivo en disco. **Una herramienta propia no puede entregar un PDF**: el `resource` con `blob` se guarda en disco y el modelo solo ve la ruta. Las herramientas propias sirven para entregar texto (por ejemplo, texto marcado con su Página impresa) e imágenes. Una página de libro de texto costó 2,253 tokens como `document`.
- Pro incluye Opus, Sonnet y Haiku. Fable solo con usage credits. El peso de cada modelo en el cupo no está publicado. Al agotar el cupo con extra usage desactivado, la petición se rechaza con error `rate_limit` (429), `rate_limit_event` con `status: "rejected"` y el mensaje "You've hit your session/weekly limit · resets …".
- Para el footer: la única vía documentada con porcentaje y reset de 5 h y semanal es `usage_report` (enviar `/usage` al SDK). Según la documentación, esa vía **no funciona con un token de `setup-token`**, porque le falta el scope `user:profile`. Con una credencial de `/login` sí funcionaría, pero esa credencial expira y necesita refrescarse. En cambio, `rate_limit_event` **sí llega con `setup-token`** y trae la utilización y el reset de 5 h y semanal en `unifiedWindows`, pero solo una vez por sesión (en la primera respuesta) y en un campo que no está en los tipos, que puede cambiar sin aviso. El footer puede tomar el valor de la sesión más reciente; dentro de una sesión larga queda desactualizado. El endpoint `api/oauth/usage` no está documentado, y usarlo desde código propio choca con los términos.

## Sin verificar

- Si los token-counting requests de `getContextUsage()` en modo `full` consumen cupo de la suscripción. **No verificable con un token de `setup-token`** (sección 7): `rate_limit_event` no vuelve a llegar dentro de la sesión, `usage_EXPERIMENTAL…` devuelve `rate_limits: null` y la resolución de `utilization` es de 0.01 de la ventana de 5 horas.
- Cuánto dura un login de `/login`.
