# syntax=docker/dockerfile:1.7
# One image, three jobs: api (default CMD), migrate, seed. See docker-compose.prod.yml.
ARG NODE_VERSION=22-alpine

FROM node:${NODE_VERSION} AS base
WORKDIR /app

# ── deps: everything needed to build ─────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

# ── build: compile the server (tsc) and the client (vite) ────────────────────
FROM deps AS build
COPY shared shared
COPY server server
COPY client client
RUN npm run build -w server && npm run build -w client

# ── prod-deps: runtime dependencies only ─────────────────────────────────────
FROM base AS prod-deps
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev -w server -w shared --include-workspace-root=false --no-audit --no-fund

# ── runtime ──────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS runtime
ENV NODE_ENV=production PORT=4000
WORKDIR /app
RUN apk add --no-cache tini   # PID 1: reaps zombies, forwards SIGTERM for graceful shutdown
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=prod-deps --chown=node:node /app/server/node_modules ./server/node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node shared ./shared
COPY --chown=node:node server/package.json ./server/
COPY --from=build --chown=node:node /app/server/dist ./server/dist
COPY --chown=node:node server/drizzle ./server/drizzle
COPY --from=build --chown=node:node /app/client/dist ./client/dist
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-4000}/health" > /dev/null || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "--enable-source-maps", "server/dist/server.js"]
