# ---------------------------------------------------------------------------
# Stage 1: build (installs dev deps, generates Prisma client, compiles TS)
# ---------------------------------------------------------------------------
FROM node:22-slim AS build
WORKDIR /app

# Prisma needs OpenSSL at runtime; ca-certificates for outbound TLS (Gemini/Google)
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Copy manifests first for better layer caching
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/scheduler/package.json ./packages/scheduler/
COPY packages/shared/package.json ./packages/shared/

# Install all workspace deps (including dev, needed to compile)
RUN npm ci

# Copy the rest of the sources
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps

# Generate Prisma Client and compile all TypeScript packages
RUN npm run prisma:generate -w @deconstruct/api && npm run build

# Drop dev dependencies for a lean runtime image
RUN npm prune --omit=dev

# Re-generate after prune: `npm prune` can treat the generated client as
# extraneous and remove it.
RUN npm run prisma:generate -w @deconstruct/api

# ---------------------------------------------------------------------------
# Stage 2: runtime
# ---------------------------------------------------------------------------
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Create an unprivileged user
RUN useradd --system --uid 1001 --create-home nodeapp

COPY --from=build --chown=nodeapp:nodeapp /app/node_modules ./node_modules
COPY --from=build --chown=nodeapp:nodeapp /app/package.json ./package.json
COPY --from=build --chown=nodeapp:nodeapp /app/prisma ./prisma
COPY --from=build --chown=nodeapp:nodeapp /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=nodeapp:nodeapp /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=nodeapp:nodeapp /app/apps/api/public ./apps/api/public
COPY --from=build --chown=nodeapp:nodeapp /app/apps/api/prisma ./apps/api/prisma

USER nodeapp
EXPOSE 3000

CMD ["node", "apps/api/dist/index.js"]
