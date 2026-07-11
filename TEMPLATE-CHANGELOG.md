# Template changelog

## v2.0.0 — 2026-07-07

Full rewrite. Replaces the v1 (Astro 5 + alchemy + bun) template.

- Astro 7 SSR on `@astrojs/cloudflare` 14, SolidJS integration, Tailwind v4
- Elysia API under `/api` with typed error envelope, Eden treaty client, auth macros (`requireAuth`, `requireAdmin`)
- Drizzle on D1 with cuid2 ids, `timestamp_ms` columns, generated better-auth schema
- better-auth: email/password, magic link, TOTP 2FA, Google (env-gated), organizations, admin, SSO (flag-gated), KV secondary storage with D1 session fallback
- Polar billing through `@polar-sh/better-auth` behind a `PaymentProvider` seam; Polar MCP agent guide in `docs/agents/polar.md` plus SDK setup script
- Zaidan/Kobalte UI (vega style, neutral, Inter), TanStack solid-query, valibot forms, solid-sonner
- Edge cache middleware (`caches.default`) with a per-route config map
- SPA under `/app` via `@solidjs/router`: projects CRUD, settings (profile, 2FA, org members), billing, admin
- Toolchain: pnpm + vite-plus (oxlint/oxfmt), wrangler-generated runtime types
