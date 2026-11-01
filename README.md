# Wise Wizard

App personal de estudio que agenda repasos con repetición espaciada y usa IA sobre los libros y apuntes del estudiante. El problema que resuelve está en [`docs/PROBLEM.md`](docs/PROBLEM.md).

## Requisitos

- [Node.js](https://nodejs.org/) 26 (LTS; la versión está en `.nvmrc`). Es el runtime de Next.js.
- [Bun](https://bun.sh/) 1.4 (la versión está en `packageManager`). Es el gestor de paquetes y ejecuta los scripts.
- [Docker](https://www.docker.com/) con Compose, para Postgres y la imagen de la app.
- [uv](https://docs.astral.sh/uv/), para instalar graphify: `uv tool install --upgrade graphifyy`.
- [Claude Code](https://code.claude.com/), para los plugins y skills del proyecto.

## Primera vez

```sh
bun install
cp .env.example .env
bun run setup
```

- `.env` trae valores de ejemplo para desarrollo local. Si el puerto 5432 del host ya está ocupado, define `DB_PORT` y usa ese puerto en `DATABASE_URL`. `CLAUDE_CODE_OAUTH_TOKEN` queda vacío hasta que se conecte el Agent SDK (ADR-0003).
- `bun run setup` se corre una vez por clon. Instala los git hooks de graphify, que viven en `.git/hooks` y no se versionan, y los plugins de Claude Code declarados en `.claude/settings.json` (ponytail, impeccable y mattpocock-skills): Claude Code no los descarga solo a partir de la configuración del proyecto. Antes hay que abrir Claude Code una vez en el repo y aceptar el diálogo de confianza de la carpeta.

## Comandos

| Comando                     | Qué hace                                                                                                                    |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `docker compose up -d db`   | Levanta solo Postgres para desarrollo local.                                                                                |
| `bun run dev`               | Servidor de desarrollo en http://localhost:3000.                                                                            |
| `bun run check`             | Todos los gates salvo e2e: lint, tipos, formato, tests unitarios, fallow, react-doctor e impeccable. Es lo que corre el CI. |
| `bun run format`            | Formatea con Prettier.                                                                                                      |
| `bun run test`              | Tests unitarios con Vitest (`bun test` es otro runner, el de Bun).                                                          |
| `bun run build`             | Build de producción (`output: "standalone"`).                                                                               |
| `bun run test:e2e`          | Tests de Playwright en desktop y móvil contra el build; corre `bun run build` antes.                                        |
| `docker compose up --build` | App y Postgres en contenedores; `GET /api/health` responde 200 si la base de datos está arriba.                             |
