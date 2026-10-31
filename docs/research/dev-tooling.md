# Investigación: roles de las herramientas de desarrollo

Pregunta (issue [#5](https://github.com/Bigelazo/wise-wizard/issues/5)): qué es cada una de estas herramientas, cómo se instala y dónde se conecta al flujo de desarrollo (editor, skills del agente, pre-commit, CI): **graphify**, **ponytail**, **impeccable**, **fallow**, **react-doctor** y la skill **vercel-react-best-practices**. Por cada una: propósito y qué revisa o produce, solapamiento o conflicto con ESLint y Prettier, restricciones que impone al layout o la arquitectura del proyecto, y el punto de invocación recomendado.

Fecha de consulta de las fuentes: 2026-10-31. Las versiones citadas son las publicadas ese día; todas estas herramientas publican versiones con mucha frecuencia.

## Resumen

| Herramienta | Propósito | Instalación | Punto de invocación | Solapamiento con ESLint / Prettier | Restricciones de layout |
|---|---|---|---|---|---|
| graphify | Grafo de conocimiento consultable del repo (código, docs, PDFs) para que el agente consulte en vez de hacer grep | CLI Python `graphifyy` (`uv tool install graphifyy`) + `graphify install` registra la skill | Skill `/graphify` en el agente; hook `PreToolUse` en Claude Code; hook post-commit opcional | Ninguno: no es linter ni formateador | Escribe `graphify-out/`; respeta `.gitignore`, `.graphifyignore`, `.graphifyrc` opcional |
| ponytail | Prompt/skill "lazy senior dev": escribir solo el código necesario; además `/ponytail-review` y `/ponytail-audit` | Plugin de Claude Code (`/plugin marketplace add DietrichGebert/ponytail`) o copiar `AGENTS.md` | Siempre activo en cada sesión del agente, más comandos manuales | Ninguno: guía al agente, no revisa sintaxis ni formato | Ninguna; marca atajos con comentarios `shortcut:` |
| impeccable | Vocabulario de diseño para el agente (critique, audit, polish…) y un detector determinista de "AI slop" en UI | `npx impeccable install` (o plugin de Claude Code) | Hook de diseño tras cada edición de UI del agente; `npx impeccable detect` en terminal o CI | No con ESLint/Prettier; revisa patrones visuales (tipografía, color, espaciado), no código | Escribe `PRODUCT.md`, `DESIGN.md` y `.impeccable/`; su regla `overused-font` marca Inter, la fuente base de dcc-ui-kit |
| fallow | Análisis a nivel de proyecto para TS/JS: código muerto, duplicación, complejidad, ciclos, límites de arquitectura, drift de estilos | `npm install --save-dev fallow` (binario Rust) | Terminal, pre-commit (`fallow hooks install`), GitHub Action `fallow audit`, LSP/VS Code, MCP/skill del agente | Complementa: "Linters … check one file at a time. Fallow checks the project graph, so you run both." Solapamiento parcial con `no-cycle` / `no-unused-modules` | Ninguna por defecto; límites de arquitectura opcionales con presets (`bulletproof`, `layered`, `hexagonal`, `feature-sliced`) |
| react-doctor | Escáner determinista de React (estado/efectos, rendimiento, arquitectura, seguridad, a11y) con puntaje 0–100 | `npx react-doctor@latest`; `… install` (skill); `… ci install` (workflow) | Terminal, skill del agente, GitHub Action por PR; también como plugin de ESLint u oxlint | Sí con ESLint: su regla incluye 100 reglas portadas de los plugins React y jsx-a11y de oxc, que se cruzan con `eslint-plugin-react` / `react-hooks` de `eslint-config-next` | `doctor.config.ts`; `ci install` escribe `.github/workflows/react-doctor.yml`. Licencia "Modified MIT" |
| vercel-react-best-practices | Skill de guía: 70 reglas de rendimiento React/Next.js de Vercel, por prioridad | `npx skills add vercel-labs/agent-skills` | El agente la carga al escribir, revisar o refactorizar código React/Next.js | Ninguno directo: es texto que lee el agente, no se ejecuta como linter | Ninguna estructural; algunas reglas recomiendan dependencias (SWR, `better-all`) |

## graphify

**Identificación.** Sin ambigüedad. La skill local en `~/.claude/skills/graphify/SKILL.md` instala el paquete PyPI `graphifyy` (`uv tool install --upgrade graphifyy`). El repositorio upstream es [Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify) (antes `safishamsi/graphify`, que hoy redirige ahí), licencia Apache-2.0; el paquete es [graphifyy en PyPI](https://pypi.org/project/graphifyy/). La CLI local reporta `graphify 0.9.50`; la última versión en PyPI es 0.9.99 (30-10-2026) ([PyPI](https://pypi.org/project/graphifyy/)).

**Propósito.** "Type `/graphify` in your AI coding assistant and it maps your entire project (code, docs, PDFs, images, videos) into a **knowledge graph** you can **query instead of grepping** through files." ([README](https://github.com/Graphify-Labs/graphify)). El código se analiza localmente con tree-sitter, sin LLM: "Code is parsed with tree-sitter AST: deterministic, no LLM, nothing leaves your machine. (Docs, PDFs, images and video use your assistant's model, or a configured API key, for a semantic pass.)" ([README](https://github.com/Graphify-Labs/graphify)). Cada arista se etiqueta `EXTRACTED` o `INFERRED`.

**Qué produce.** Tres archivos en `graphify-out/`: `graph.html` (visualización interactiva), `GRAPH_REPORT.md` ("key concepts, surprising connections, suggested questions") y `graph.json` ([README](https://github.com/Graphify-Labs/graphify)). Además ofrece `graphify query`, `graphify path` y `graphify explain` sobre `graph.json`, un servidor MCP (extra `graphifyy[mcp]`) y `graphify watch` (extra `graphifyy[watch]`) ([README](https://github.com/Graphify-Labs/graphify)).

**Instalación.** `uv tool install graphifyy` y luego `graphify install`, que "detects your assistant and registers the skill". Con `--project` la skill se escribe dentro del repo, por ejemplo en `.claude/skills/graphify/SKILL.md` ([README](https://github.com/Graphify-Labs/graphify)). Requiere Python 3.10+.

**Puntos de invocación.**
- Skill del agente: `/graphify .` para construir; `/graphify query "<pregunta>"` para consultar ([README](https://github.com/Graphify-Labs/graphify)).
- Integración siempre activa: `graphify claude install`. En Claude Code, "a hook fires automatically before search-style tool calls (and, on Claude Code, before reading source files one by one via the Read/Glob tools) and nudges your assistant toward the graph path." ([README](https://github.com/Graphify-Labs/graphify)). La referencia local de la skill describe además que escribe una sección `## graphify` en el `CLAUDE.md` del proyecto (`~/.claude/skills/graphify/references/hooks.md`).
- Git: `graphify hook install` instala un hook "auto-rebuild on commit + branch checkout (run `graphify update .` after `git pull`)" ([README](https://github.com/Graphify-Labs/graphify)). Según la referencia local, el hook post-commit re-extrae solo archivos de código; "Doc/image changes are ignored by the hook - run `/graphify --update` manually for those." (`~/.claude/skills/graphify/references/hooks.md`).
- No hay un rol de CI documentado para el análisis en sí; `graphify prs` es un tablero de PRs ([README](https://github.com/Graphify-Labs/graphify)).

**Solapamiento con ESLint/Prettier.** Ninguno: no revisa estilo, errores ni formato; construye un grafo para navegación.

**Restricciones de layout.** Escribe en `graphify-out/` en la raíz desde donde se ejecuta. "graphify honors `.gitignore` and supports `--exclude` patterns and a project `.graphifyignore`" y admite un `.graphifyrc` en la raíz para configuración del proyecto ([README](https://github.com/Graphify-Labs/graphify)). Para equipos sugiere "Commit or share the graph" ([README](https://github.com/Graphify-Labs/graphify)). Registra cada consulta en `~/.cache/graphify-queries.log` salvo `GRAPHIFY_QUERY_LOG_DISABLE=1` ([README](https://github.com/Graphify-Labs/graphify)). El README promociona además un producto pago (Graphify Cloud), ajeno a la CLI local.

## ponytail

**Identificación.** Con certeza razonable: [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) (MIT, paquete npm [`@dietrichgebert/ponytail`](https://www.npmjs.com/package/@dietrichgebert/ponytail), v5.3.3). Es el único candidato que es una skill para agentes de código. Alternativas descartadas: el paquete npm [`ponytail`](https://www.npmjs.com/package/ponytail) ("Rethinking maintenance of multiple sites.", sin cambios desde 2022) no tiene relación; existen ports y forks derivados (p. ej. [ilindaniel/ponytail-lite](https://github.com/ilindaniel/ponytail-lite), [dsh-ponytail](https://github.com/gongyijie85/dsh-ponytail)). El propio autor advierte: "Only install ponytail from `DietrichGebert/ponytail` on GitHub or `@dietrichgebert/ponytail` on npm." ([README](https://github.com/DietrichGebert/ponytail)).

**Propósito.** "Makes your AI agent think like the laziest senior dev in the room. The best code is the code you never wrote." ([repo](https://github.com/DietrichGebert/ponytail)). Es un prompt: "Ponytail is one prompt: `skills/ponytail/SKILL.md`. The compact version, for agents that read a rules file, is `AGENTS.md`." Antes de escribir código el agente sube una "escalera": "1 does this need to exist, 2 already in this codebase, 3 does the standard library do it, 4 a native platform feature, 5 an installed dependency, 6 can it be one line, 7 only then the minimum that works, plus one small test if it has logic." Con un límite explícito: "Lazy, not negligent: trust-boundary validation, data-loss handling, security, and accessibility are never on the chopping block." ([README](https://github.com/DietrichGebert/ponytail)).

**Qué produce.** Cambia cómo escribe el agente; además:
- `/ponytail-review`: revisa el diff actual ("bugs, security, real load, risky code without a test, slow paths, and what to cut").
- `/ponytail-audit`: "The same check for the whole repo, most important first."
- `/ponytail-debt`: recopila comentarios `shortcut:` en un registro.
- En Claude Code, una "band" sobre el prompt con costo, tokens y tiempo de la tarea; datos locales en `~/.config/ponytail/band/` ([README](https://github.com/DietrichGebert/ponytail)).

**Instalación.** Claude Code: `/plugin marketplace add DietrichGebert/ponytail` y `/plugin install ponytail@ponytail`. Otros agentes: copiar `AGENTS.md` al proyecto ([README](https://github.com/DietrichGebert/ponytail)). El plugin de Claude Code corre "two tiny Node.js lifecycle hooks, so `node` needs to be on your PATH" ([INSTALL.md](https://github.com/DietrichGebert/ponytail/blob/main/INSTALL.md)). No requiere archivo de configuración ([README](https://github.com/DietrichGebert/ponytail)).

**Punto de invocación.** "Active every session" dentro del agente, con niveles `/ponytail lite|full|ultra|off`; revisión y auditoría bajo demanda ([README](https://github.com/DietrichGebert/ponytail)). No tiene modo CI ni pre-commit documentado.

**Solapamiento con ESLint/Prettier.** Ninguno: no analiza estáticamente ni formatea. `/ponytail-review` se cruza en tema (no en mecanismo) con revisiones de código hechas por otros skills.

**Restricciones de layout.** Ninguna. Deja comentarios `shortcut:` en el código; la palabra se puede cambiar en `CLAUDE.md` o `AGENTS.md` ([README](https://github.com/DietrichGebert/ponytail)).

## impeccable

**Identificación.** Con certeza razonable: [pbakaus/impeccable](https://github.com/pbakaus/impeccable) (Apache-2.0, de Paul Bakaus; paquete npm [`impeccable`](https://www.npmjs.com/package/impeccable) v4.8.0, "Design skills, commands, and anti-pattern detection for AI coding agents"). Coincide con el rol "UI/UX" que le asigna `docs/PROBLEM.md`. "Impeccable started from Anthropic's frontend-design skill." ([README](https://github.com/pbakaus/impeccable)).

**Propósito.** "The design vocabulary for your coding agent. Steer with `polish` and `bolder`, review with `critique` and `audit`, and catch AI slop before it ships." ([README](https://github.com/pbakaus/impeccable)). Tres piezas:
- 24 comandos (`/impeccable critique`, `audit`, `polish`, `harden`, `adapt`, `typeset`, `layout`, etc.). "`critique` scores the design against usability heuristics … `audit` checks accessibility, performance, theming, and responsive behavior, with findings ranked P0 (blocking) to P3 (polish)."
- Un detector: "62 deterministic rules flag the tells above, plus quality problems like cramped padding and skipped headings. No LLM, no API key."
- Archivos de contexto: `/impeccable init` escribe `PRODUCT.md`; `/impeccable document` escribe `DESIGN.md` ([README](https://github.com/pbakaus/impeccable)).

**Instalación.** `npx impeccable install` desde la raíz del proyecto; pregunta si instalar para el proyecto o global y ofrece el hook de diseño. En Claude Code también: `/plugin marketplace add pbakaus/impeccable` ([README](https://github.com/pbakaus/impeccable)).

**Puntos de invocación.**
- Agente (hook): "The design hook scans every UI file your agent edits and hands the findings back before the agent calls the work done." ([README](https://github.com/pbakaus/impeccable)).
- Terminal o CI: `npx impeccable detect src/`, `--json`, `--github` (anotaciones de GitHub Actions). "Source files like JSX and TSX get the pattern rules only. Rules that need a rendered page, such as low contrast and tiny text, run when you scan a URL" ([README](https://github.com/pbakaus/impeccable)). Código de salida `2` si hay hallazgos.
- Navegador: extensión de Chrome; `/impeccable live` sobre el dev server (soporta Next).

**Solapamiento con ESLint/Prettier.** No se solapa con reglas de ESLint ni con formato; revisa decisiones visuales. Sus comprobaciones de accesibilidad (`audit`) se cruzan en tema con jsx-a11y o react-doctor, pero sobre otro objeto (diseño renderizado y patrones visuales).

**Restricciones de layout.** Escribe en `.impeccable/` y en `PRODUCT.md` y `DESIGN.md` en la raíz; el README da un bloque `.gitignore` y lista qué archivos de `.impeccable/` van al repo ([README](https://github.com/pbakaus/impeccable)). Una regla del detector marca fuentes sobreusadas: el ejemplo del README es `npx impeccable ignores add-value overused-font Inter --reason "Brand font"`. dcc-ui-kit define `--dcc-font-body: "Inter", …` ([dcc-ui-kit `src/styles.css`](https://github.com/DCC-FCFM-UCHILE/dcc-ui-kit/blob/main/src/styles.css)). Otros avisos: "Hooks run outside model approval" (el primer edit puede descargar el motor a `~/.impeccable/bin/`), y una solicitud de telemetría al catálogo de impeccable.style que no se desactiva con `telemetry off` ([README](https://github.com/pbakaus/impeccable)).

## fallow

**Identificación.** Con certeza razonable: [fallow-rs/fallow](https://github.com/fallow-rs/fallow) (MIT, Rust; paquete npm [`fallow`](https://www.npmjs.com/package/fallow) v3.38.1). Su descripción encaja exactamente con un proyecto TS/Next.js.

**Propósito.** "Codebase intelligence for TypeScript and JavaScript. Health, complexity hotspots, duplication, architecture boundaries, circular dependencies, design-system drift, and unused code, from one graph." ([repo](https://github.com/fallow-rs/fallow)). Comandos principales: `fallow audit` (puerta sobre archivos cambiados), `fallow health`, `fallow architecture` / `fallow guard`, `fallow dupes`, `fallow health --css` (drift de estilos), `fallow dead-code` / `fallow fix`, y opcionales `mutation`, `security`, `similar-code` ([README](https://github.com/fallow-rs/fallow)). "There is no AI inside the analyzer." "`fallow audit` fails only on findings that a change introduces." ([README](https://github.com/fallow-rs/fallow)).

**Instalación.** `npm install --save-dev fallow` (incluye `fallow`, `fallow-lsp` y `fallow-mcp`) ([README](https://github.com/fallow-rs/fallow)).

**Puntos de invocación.** El README los enumera: "Your terminal | `npx fallow`", "Pull requests | `uses: fallow-rs/fallow@v3`", "Your editor | The VS Code extension or `fallow-lsp`", "Coding agents | `npx fallow agent install`". Además pre-commit: `npx fallow hooks install --target git`. `fallow agent install` "writes an `AGENTS.md` task map, installs the `fallow` and `fallow-setup` skills, registers the MCP server, and adds a gate on `git commit` and `git push`." ([README](https://github.com/fallow-rs/fallow)).

**Solapamiento con ESLint/Prettier.** Complementario por diseño: "Linters such as oxlint, ESLint, and Biome check one file at a time. Fallow checks the project graph, so you run both." Solapamiento parcial: "Some linter plugins (`no-cycle`, `no-unused-modules`) find a subset of the issues that fallow finds" ([fallow vs linters](https://fallow.tools/docs/explanations/fallow-vs-linters/)). La tabla del README: "Unused variable in a function | yes | no", "Unused export that nothing imports | no | yes" ([README en docs.rs](https://docs.rs/crate/fallow-cli/2.76.0/source/README.md)). No compara con Prettier más allá de listarlo como formateador alternativo. Tiene plugins para Next.js (reconoce los exports `page`, `layout`, `loading`, `error`, `route` del App Router), Prisma, Vitest, Playwright, ESLint y Prettier; no para Docker ([frameworks built-in](https://fallow.tools/docs/frameworks/built-in/)). `npx fallow migrate` convierte configuración de knip, jscpd y stylelint ([README](https://github.com/fallow-rs/fallow)).

**Restricciones de layout.** Ninguna por defecto ("Zero config for over 100 frameworks", [npm](https://www.npmjs.com/package/fallow)). Opcionalmente impone límites de arquitectura con presets "`bulletproof`, `layered`, `hexagonal`, and `feature-sliced`" ([README](https://github.com/fallow-rs/fallow)). Configuración en un archivo de config con `entry` e `ignorePatterns`; supresiones con `// fallow-ignore-next-line`. Agentes: "Do not run `fallow watch` in an agent loop, because it does not exit." ([README](https://github.com/fallow-rs/fallow)).

## react-doctor

**Identificación.** Con certeza razonable: [millionco/react-doctor](https://github.com/millionco/react-doctor) (Million Software; npm [`react-doctor`](https://www.npmjs.com/package/react-doctor) v0.9.18; docs en [react.doctor](https://react.doctor/docs)). Existen copias no oficiales (p. ej. `YohanReddy/react-doctor`) que aparecen en búsquedas.

**Propósito.** "React Doctor runs deterministic checks on your code. It reports issues in state and effects, performance, architecture, security, accessibility, and maintainability. Supports React projects built with Next.js, Vite, Astro, TanStack, React Native, and Expo." ([README](https://github.com/millionco/react-doctor)). "Point it at a React project and get a single 0-100 health score, plus the diagnostics behind it." y "React Doctor runs on top of oxlint, so a full scan takes seconds, and the same commit always produces the same number." ([blog v1](https://www.react.doctor/blog/react-doctor-v1)). También graba trazas de rendimiento en runtime: `npx react-doctor@latest scan http://localhost:3000` ([README](https://github.com/millionco/react-doctor)).

**Instalación y puntos de invocación** ([README](https://github.com/millionco/react-doctor)):
- Escaneo: `npx react-doctor@latest`.
- Skill para agentes: `npx react-doctor@latest install` (soporta Claude Code).
- CI: `npx react-doctor@latest ci install` para "Scan each pull request and report the issues it introduces"; escribe `.github/workflows/react-doctor.yml` ([quickstart](https://react.doctor/docs/overview/quickstart)).
- Dentro del lint existente: paquetes [`eslint-plugin-react-doctor`](https://www.npmjs.com/package/eslint-plugin-react-doctor) y [`oxlint-plugin-react-doctor`](https://www.npmjs.com/package/oxlint-plugin-react-doctor). El plugin ESLint usa flat config con `reactDoctor.configs.recommended` y `reactDoctor.configs.next` ([README del plugin](https://github.com/millionco/react-doctor/tree/main/packages/eslint-plugin-react-doctor)).

**Solapamiento con ESLint/Prettier.** Hay solapamiento real con ESLint: "The set now includes 100 rules ported from `oxc-project/oxc`'s React + jsx-a11y linting plugins, exposed alongside React Doctor's own rules under the `react-doctor/*` namespace." ([README del plugin](https://github.com/millionco/react-doctor/tree/main/packages/eslint-plugin-react-doctor)). `eslint-config-next` ya incluye "the `recommended` rule-sets from … `eslint-plugin-react`, `eslint-plugin-react-hooks`, `@next/eslint-plugin-next`" ([Next.js docs](https://nextjs.org/docs/app/api-reference/config/eslint)). La documentación dice: "React Doctor complements your existing lint setup" y "also adopts JSON ESLint or oxlint configuration when present" ([react.doctor/docs](https://react.doctor/docs)). Si React Compiler está activo se declara `capabilities: ["react-compiler"]` para desactivar reglas de memoización redundantes ([README del plugin](https://github.com/millionco/react-doctor/tree/main/packages/eslint-plugin-react-doctor)). No toca formato (sin relación con Prettier).

**Restricciones de layout.** Configuración en `doctor.config.ts` ([README](https://github.com/millionco/react-doctor)). Tiene reglas opcionales de todo el proyecto sobre "unused files, exports, types, dependencies, and import cycles" ([react.doctor/docs](https://react.doctor/docs)), que se cruzan con fallow. El CLI "collects crash reports and anonymous usage data" (opt-out `--no-telemetry`) ([README](https://github.com/millionco/react-doctor)). Licencia "Modified MIT License": requiere permiso escrito para usar el software "as training, fine-tuning, or evaluation data … for training or improving any machine learning model or AI system" o para venderlo como servicio hospedado ([LICENSE](https://github.com/millionco/react-doctor/blob/main/LICENSE)).

## vercel-react-best-practices

**Identificación.** Sin ambigüedad: skill del repositorio oficial [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) ("Vercel's official collection of agent skills", MIT). El directorio es `skills/react-best-practices/`, pero el `name` del frontmatter es `vercel-react-best-practices` ([SKILL.md](https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/SKILL.md)).

**Propósito.** "React and Next.js performance optimization guidelines from Vercel Engineering. This skill should be used when writing, reviewing, or refactoring React/Next.js code to ensure optimal performance patterns." Contiene "70 rules across 8 categories, prioritized by impact" (el README del repo dice todavía "40+ rules"): eliminación de waterfalls y tamaño de bundle (CRITICAL), rendimiento en servidor (HIGH), data fetching en cliente, re-renders, rendering, JavaScript y patrones avanzados ([SKILL.md](https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/SKILL.md), [README](https://github.com/vercel-labs/agent-skills)). Cada regla tiene un archivo en `rules/` con ejemplo incorrecto y correcto; `AGENTS.md` es el documento compilado.

**Instalación.** `npx skills add vercel-labs/agent-skills` ([README](https://github.com/vercel-labs/agent-skills)). Ese comando instala la colección; no verifiqué la opción para instalar solo esta skill.

**Punto de invocación.** "Skills are automatically available once installed. The agent will use them when relevant tasks are detected." ([README](https://github.com/vercel-labs/agent-skills)). Se aplica al escribir componentes o páginas, al implementar data fetching y al revisar rendimiento ([SKILL.md](https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/SKILL.md)). No tiene CLI, hook ni CI.

**Solapamiento con ESLint/Prettier.** No ejecuta nada; es guía que lee el agente. Algunas reglas tratan los mismos temas que reglas de lint (p. ej. `rerender-no-inline-components`, `rerender-dependencies`), pero ESLint las haría cumplir y la skill solo las sugiere.

**Restricciones de layout.** Ninguna estructural. Algunas reglas empujan hacia dependencias o patrones: `client-swr-dedup` ("Use SWR for automatic request deduplication"), `async-dependencies` ("Use better-all for partial dependencies"), `bundle-barrel-imports` ("Import directly, avoid barrel files"), `server-no-shared-module-state` ([SKILL.md](https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/SKILL.md)).

## Implicancias para Wise Wizard

- Las seis herramientas caen en tres grupos según cómo se ejecutan. Solo guían al agente: ponytail y vercel-react-best-practices. Analizan de forma determinista y pueden ir en CI: fallow, react-doctor y el detector de impeccable. Herramienta de navegación del agente: graphify. Ninguna es formateador; ninguna reemplaza a Prettier.
- ESLint (vía `eslint-config-next`, que ya trae `eslint-plugin-react` y `react-hooks`) y react-doctor (100 reglas portadas de React + jsx-a11y de oxc) cubren en parte las mismas reglas. fallow y las reglas opcionales de todo el proyecto de react-doctor se cruzan en código no usado y ciclos de import.
- Cuatro herramientas instalan hooks en el agente o en git: graphify (`PreToolUse` y post-commit), ponytail (lifecycle hooks en Node), impeccable (hook de diseño tras cada edición de UI) y fallow (gate en `git commit`/`git push`). Tres escriben en `AGENTS.md` o `CLAUDE.md` del proyecto: graphify (`claude install`), fallow (`agent install`) y ponytail en su modo sin plugin.
- Archivos y carpetas que aparecerían en el repo: `graphify-out/`, `.graphifyignore`/`.graphifyrc` (opcionales), `.impeccable/`, `PRODUCT.md`, `DESIGN.md`, config de fallow, `doctor.config.ts` y `.github/workflows/react-doctor.yml`.
- dcc-ui-kit usa Inter como fuente de cuerpo, e impeccable tiene una regla `overused-font` que trae Inter como ejemplo. El README documenta cómo permitirla como "Brand font".
- Varias recomendaciones de vercel-react-best-practices suponen dependencias (SWR, `better-all`) que no están en el stack fijo.
- fallow tiene plugins para Next.js, Prisma, Vitest, Playwright, ESLint y Prettier del stack fijo; no tiene plugin para Docker.
- react-doctor e impeccable envían telemetría por defecto (con opt-out); react-doctor tiene licencia MIT modificada con restricciones sobre uso para entrenar IA y reventa como servicio.
- La CLI de graphify instalada localmente (0.9.50) está atrasada respecto de PyPI (0.9.99).
