# saas-starter

A SaaS starter template on Cloudflare Workers: Astro 7 SSR + SolidJS islands + Elysia API (typed end to end via Eden) + better-auth on D1 + Polar billing + Tailwind v4 with the Zaidan/Kobalte component registry.

## Stack

- Astro 7 (`@astrojs/cloudflare` 14), SolidJS, Tailwind v4
- Elysia mounted under `/api` via a catch-all endpoint, Eden treaty client in `src/lib/api.ts`
- Drizzle on D1, KV for sessions + cache, better-auth (email/password, magic link, TOTP 2FA, Google, organizations, admin, SSO behind a flag)
- Polar for billing via `@polar-sh/better-auth`, behind a thin `PaymentProvider` seam
- TanStack solid-query, hand-rolled forms with valibot, solid-sonner toasts, lucide-solid icons (deep imports only)
- Toolchain: pnpm + vite-plus (`vp lint`, `vp fmt`), `astro check` for types

## Quickstart

```bash
pnpm install                 # also generates worker-configuration.d.ts
cp .dev.vars.example .dev.vars   # fill secrets
pnpm db:migrate:local
pnpm seed                    # admin@example.com / password123
pnpm dev                     # http://localhost:4321
```

Verify: `curl localhost:4321/api/health`.

Deploy: create the D1 database and two KV namespaces, fill the ids in `wrangler.jsonc`, `wrangler secret put` each secret from `.dev.vars.example`, then `pnpm deploy`.

Billing: follow `docs/agents/polar.md` (MCP-driven) or run `pnpm polar:setup` (SDK fallback).

## Swap points per project

- **Hero** — `src/components/marketing/Hero.tsx` is the landing hero island; replace this one file per project.
- **Plans catalog** — `src/lib/plans.ts`; paid plans map to Polar products via `POLAR_PRODUCT_ID_<SLUG>` env vars (see `src/server/billing/polar.ts`).
- **Payment provider** — implement `PaymentProvider` (`src/server/billing/provider.ts`) and swap the export in `src/server/billing/index.ts`.
- **Edge cache map** — `src/lib/cache-config.ts`: route pattern → s-maxage. Only cached for GET + HTML + no session cookie; `/app` and `/api` are never cached.
- **Email** — `src/server/lib/email.ts` logs to console; replace `sendEmail` with a real provider.
- **SSO** — set `SSO_ENABLED=true` to enable the `@better-auth/sso` plugin; to move to WorkOS later, swap that one plugin entry in `src/server/lib/auth.ts`.

## Commands

| Command | What |
| --- | --- |
| `pnpm dev` / `pnpm build` | dev server / production build |
| `pnpm preview` | run the built worker in miniflare via `wrangler dev` |
| `pnpm typecheck` / `pnpm lint` / `pnpm fmt` | astro check / oxlint / oxfmt |
| `pnpm auth:generate` | regenerate better-auth Drizzle schema (uses `scripts/auth-schema.config.ts`) |
| `pnpm db:generate` | drizzle-kit migration from schema changes |
| `pnpm db:migrate:local` / `:remote` | apply migrations to D1 |
| `pnpm seed` | seed local D1 with an admin user + demo project |
| `pnpm polar:setup` | create Polar products from the plans catalog |

## Notes

- Astro 7's advanced routing (`src/fetch.ts`) was evaluated as the Elysia mount point but the dev server hangs with it on `@astrojs/cloudflare` 14.1.x (withastro/astro#17181), so the API mounts through `src/pages/api/[...slug].ts`. Switching later is a two-file change: add `src/fetch.ts`, delete the catch-all.
- Elysia runs with `aot: false` (workerd forbids runtime codegen).
- better-auth sessions live in KV with D1 fallback (`storeSessionInDatabase: true`) to avoid the KV-expiry logout issue (better-auth#4203).
