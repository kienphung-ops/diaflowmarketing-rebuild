# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Diaflow Tower is a gamified tower-climbing web app where users build an "AI office" by recruiting teammates through a referral system. Features include a 3D interactive scene (desktop via React Three Fiber), a 2D mobile fallback, a spin wheel reward arcade, and team/leaderboard mechanics.

## Tech Stack

- **Framework:** Next.js 14 (App Router), React 18, TypeScript 5.9
- **3D:** React Three Fiber + Three.js + Drei
- **Database:** PostgreSQL with Prisma 7.8
- **Cache:** Redis (ioredis)
- **Auth:** JWT via jose, bcryptjs, Google OAuth
- **Email:** Resend (transactional), Klaviyo (marketing)
- **Styling:** Tailwind CSS 3.4

## Commands

```bash
npm run dev          # Dev server on port 3000
npm run build        # prisma generate && next build
npm run lint         # ESLint
npm start            # Production server

npx prisma migrate dev    # Create/apply migrations
npx prisma db seed        # Seed database (prisma/seed.js)
npx prisma studio         # Database GUI
npx prisma generate       # Regenerate Prisma client
```

## Architecture

### Source Layout

- `src/app/` — Next.js App Router pages and 34 API routes
- `src/components/` — React components organized by feature
  - `scene/` — 3D tower scene (Three.js canvas, cameras, characters, furniture, environment)
  - `scene2d/` — Mobile 2D scene fallback
  - `spin/` — Spin wheel modal and mechanics
  - `mobile/` — Mobile-specific UI (bottom nav, tour, share sheet)
  - Top-level: modals (Signup, Leaderboard, Celebration, Share, etc.), Header, MySquadDrawer
- `src/lib/` — Business logic and utilities (auth, floors, spin system, external APIs, rate limiting)
- `src/hooks/` — Custom hooks (useIsDesktop, useIsMobile, useFloorPolling, useFloorPresence, etc.)
- `src/types/` — TypeScript type definitions (tower state, scene types)
- `prisma/` — Schema, migrations, seed data

### Key Entry Points

- `src/app/TowerLanding.client.tsx` — Main app client component; orchestrates modals, state, and game logic
- `src/components/scene/tower/TowerScene.tsx` — 3D scene root
- `src/components/scene2d/Mobile2DScene.tsx` — 2D mobile scene root
- `src/lib/spin/service.ts` — Spin wheel business logic (daily, referral, task spins)
- `src/lib/floors.ts` / `src/lib/floorsDb.ts` — Floor progression logic and DB queries

### Database Conventions

Prisma fields use camelCase; DB columns use snake_case via `@map`. Every model has `@@map("table_name")`. See `prisma/schema.prisma` header comments.

Key models: User, Floor, RecruitedTeammate, SpinGrant, SpinResult, SpinWedge, InviteEvent, AuthToken, TaskCompletion.

### API Route Organization

Routes under `src/app/api/`:
- `auth/*` — Signup, login, logout, OAuth (Google), OTP, password reset, email verification
- `recruit/*` — Add/manage teammates (single and bulk)
- `floors/*` — Tower floor configs and visitor tracking
- `spin/*` — Wheel spins (daily, anonymous, task-based)
- `leaderboard/` — Team rankings
- `user/*` — Settings (visibility, team name, item positions)
- `admin/` — Admin user management

### 3D Scene Architecture

The 3D scene uses React Three Fiber with a cinematic camera system. Characters are configured in `src/components/scene/characters/characters.config.ts`. Scene elements (furniture, environment, lighting) are composed as R3F components under `src/components/scene/`. Desktop detection (`useIsDesktop`) determines 3D vs 2D rendering.

### Spin Wheel System

Located in `src/lib/spin/`. Uses a ledger pattern: `SpinGrant` credits tokens (from daily, referral, task sources), `SpinResult` records outcomes. Wedge configuration is admin-managed via `SpinWedge` table. Anonymous spins use cookie-based `anonId` and migrate to user on signup. Cash rewards capped at $50/user.

## Environment Variables

Required (see `.env.example`): `DATABASE_URL`, `REDIS_DB`, `AUTH_SECRET`, `DIAFLOW_API_KEY`, `APP_API_KEY`, `KLAVIYO_PRIVATE_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_SITE_URL`.

## Path Alias

TypeScript uses `@/*` mapped to `src/*` (configured in tsconfig.json).

## Webpack Notes

`next.config.mjs` transpiles Three.js packages (`three`, `@react-three/fiber`, `@react-three/drei`) and sets `canvas` as a webpack external for SSR compatibility.
