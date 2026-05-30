# syntax=docker/dockerfile:1
#
# diaflow-tower (Next.js 14 + Prisma) — production image, standalone build.
#
# Stages : base -> deps -> builder -> runner (slim, standalone-only).
# Final  : ships `.next/standalone` + `.next/static` + `public` + `prisma/`.
#
# CI writes `.env` before the build (base64 of DEV_ENV_B64 / UAT_ENV_B64 /
# PROD_ENV_B64) so NEXT_PUBLIC_* values are baked into the client bundle.
#
# Requires: `output: "standalone"` in next.config.mjs, AND a committed
# lockfile (yarn.lock OR package-lock.json). The install step exits 1 if
# none is found.

ARG NODE_IMAGE=public.ecr.aws/docker/library/node:20-bookworm-slim

# ── base ─────────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS base
WORKDIR /app

# ── deps: install production dependencies ────────────────────────────────────
FROM base AS deps
# Manifests + Prisma schema (postinstall runs `prisma generate`, needs schema)
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* .npmrc* ./
COPY prisma ./prisma
RUN \
  if   [ -f yarn.lock ];         then corepack enable && yarn install --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ];    then corepack enable && pnpm install --frozen-lockfile; \
  else echo "Lockfile not found — commit yarn.lock or package-lock.json before building." && exit 1; \
  fi

# ── builder: full source + Next.js build ─────────────────────────────────────
FROM base AS builder
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN \
  if   [ -f yarn.lock ];         then corepack enable && yarn build; \
  elif [ -f package-lock.json ]; then npm run build; \
  elif [ -f pnpm-lock.yaml ];    then corepack enable && pnpm run build; \
  fi

# ── runner: slim runtime — standalone output only ────────────────────────────
FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

# Standalone tree: `server.js` + pruned node_modules (includes @prisma/client)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# `.next/static` and `public` are NOT included in standalone — copy them.
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# Prisma schema — needed only if you later run `prisma migrate deploy` from
# the running container. The Prisma engines + generated client are already
# in node_modules via the standalone trace.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
