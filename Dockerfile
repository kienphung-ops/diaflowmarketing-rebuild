# syntax=docker/dockerfile:1
#
# diaflow-tower (Next.js 14 + Prisma) — production image, `next start` runtime.
#
# Stages : base -> deps -> builder -> runner.
# Final  : ships full `.next/` + production node_modules + source + prisma/,
#          started with `yarn start` (next start) on PORT 3000.
#
# CI writes `.env` before the build (base64 of DEV_ENV_B64 / UAT_ENV_B64 /
# PROD_ENV_B64) so NEXT_PUBLIC_* values are baked into the client bundle.
#
# Requires: committed lockfile (yarn.lock OR package-lock.json). The install
# step exits 1 if none is found.

ARG NODE_IMAGE=public.ecr.aws/docker/library/node:22-bookworm-slim

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

# ── runner: full runtime — `next start` via yarn ─────────────────────────────
FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs \
    && corepack enable

# Full production runtime (no standalone): ship .next, deps, manifests,
# prisma schema, and assets. `next start` reads `.next/` and resolves
# server modules from node_modules at request time.
COPY --from=builder --chown=nextjs:nodejs /app/package.json /app/yarn.lock* /app/package-lock.json* /app/pnpm-lock.yaml* ./
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/next.config.mjs ./next.config.mjs

USER nextjs
EXPOSE 3000
CMD ["yarn", "start"]
