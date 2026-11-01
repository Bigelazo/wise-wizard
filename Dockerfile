# syntax=docker/dockerfile:1

FROM node:26-trixie-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

FROM base AS deps
COPY --from=oven/bun:1.4.4-slim /usr/local/bin/bun /usr/local/bin/bun
# postinstall runs `prisma generate`, so the schema and its config go in first.
COPY package.json bun.lock prisma.config.ts ./
COPY prisma ./prisma
RUN bun install --frozen-lockfile

FROM deps AS build
COPY . .
RUN bun run build

FROM base AS runtime
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000
RUN mkdir -p /data/sources && chown node:node /data/sources
COPY --from=build --chown=node:node /app/.next/standalone ./
USER node
EXPOSE 3000
CMD ["node", "server.js"]
