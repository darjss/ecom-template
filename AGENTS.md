# Agent conventions

Astro 7 SSR on Cloudflare Workers. SolidJS islands (never React). Tailwind v4 — theme lives in `src/styles/global.css` + `src/styles/base.css` (Zaidan vega; don't hand-edit base.css).

## Layout

- `src/pages` — Astro routes; `/app/[...path].astro` hosts the Solid SPA (`src/components/app`), `/api/[...slug].ts` hosts Elysia (`src/server/api`)
- `src/server` — API (`api/`), db (`db/`), auth (`lib/auth.ts`), billing seam (`billing/`)
- `src/lib` — client-shared code: Eden client (`api.ts`), auth client, plans, cache map, form helper, queries
- `src/middleware` — edge cache + session guard

## Product scale and complexity budget

- Target small independent Stores: typically 10–20 Orders per day, designed comfortably for roughly 50 Orders per day and merchant audiences up to roughly 50,000 followers. These are sizing assumptions, not artificial hard limits.
- Prefer the smallest reliable design for this scale. Do not chase hypothetical scale, generic platform flexibility, regulatory ceremony, distributed coordination, or enterprise operations without current evidence.
- Preserve basic safety and a strong code foundation: Store isolation, authorization, validation, atomic commercial and inventory truth, idempotency where retries occur, recoverable operations, and compact evidence for consequential actions.
- Add an abstraction or seam only when it hides real complexity or supports an accepted variation. Avoid speculative services, adapters, event systems, configuration layers, and extension points.

## Rules

- Strict TS, no `any`, no type assertions, named exports only, no classes except the error hierarchy (`AppError`, `ApiError`)
- No inline comments except the TODO seams already present
- Files stay small and single-purpose; ~150 lines needs a reason
- API: one Elysia plugin per concern, TypeBox `t` validation, throw `AppError` subclasses; keep `aot: false`
- Client data: solid-query through the shared `queryClient`; mutations invalidate queries — never poke the cache
- Forms: TanStack Form + Valibot; keep credential forms out of local draft persistence
- Icons: `lucide-solid/icons/<name>` deep imports only — the barrel import breaks SSR in workerd
- UI components: `pnpm dlx shadcn@latest add @zaidan/<name>` into `src/components/ui`
- DB: cuid2 ids + createdAt/updatedAt via `src/server/db/columns.ts`; explicit indexes; after schema changes run `pnpm db:generate && pnpm db:migrate:local`
- Auth schema changes (new plugins): edit `scripts/auth-schema.config.ts` to match `src/server/lib/auth.ts`, run `pnpm auth:generate`
- Env vars: add to `src/env.ts` (valibot), `.dev.vars.example`, and `wrangler.jsonc` vars if public; rerun `wrangler types`

## Agent skills

### Issue tracker

Issues and PRDs are tracked in GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

The canonical triage labels are `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repository. See `docs/agents/domain.md`.

## Verify

`pnpm typecheck && pnpm lint && pnpm build`, then `pnpm dev` and curl `/api/health`.
