# Agent conventions

Scope authority: [issue #115](https://github.com/darjss/ecom-template/issues/115) and [`docs/recovery-brief.md`](docs/recovery-brief.md). Everything in `docs/archive/` is historical evidence — never scope. If an archived artifact conflicts with the brief, the brief wins; do not resurrect it.

## North star

- **Fix causes, not symptoms.** Make invalid states impossible at their source.
- **Full capability, minimal mechanism.** The feature list is broad; every feature ships with the smallest implementation that preserves commerce truth.
- Greenfield: prefer a coherent breaking correction over compatibility with a bad interface.
- Commit small coherent changes.

## Product scale

Independent Stores doing 10–20 Orders/day, comfortable at 50, audiences up to ~50,000 followers. If a design needs a ledger, a rotation, or a second table "for integrity," it is wrong until proven otherwise.

## Stack

Astro 7 SSR on Cloudflare Workers. SolidJS islands and `/admin/*` SPA; never React. Elysia owns `/api`, Eden types the client. D1 via Drizzle. Tailwind v4.

- Valibot owns runtime contracts; raw Drizzle rows never cross the browser boundary.
- Better Result is internal; HTTP uses meaningful statuses and typed envelopes.
- Server code imports bindings directly from `cloudflare:workers`.
- TanStack Query owns remote state, TanStack Form owns forms, URLs own navigation, Solid stores own Cart/session/UI state.
- Mutations invalidate authoritative queries rather than patching cache.
- Solar Icons only, deep Solid imports.

## Simplicity caps (binding)

- One table per concept. **No** ledger, entries, allocation, debt, or rotation tables.
- Status + timestamp columns instead of state-history tables.
- Provider is payment truth: store provider ref + status + confirmedBy/At only.
- Cache purge is synchronous after admin write; log failures.
- Guest tracking = the Order token in the URL.
- Inventory = atomic `onHand`/`reserved` counters moved at placement.
- Every new table needs a one-line justification in its PR.

## UI law

- Zaidan controls: `pnpm dlx shadcn@latest add @zaidan/<name>` into `packages/ui`. Raw `<input>`/`<select>`/`<textarea>` in new UI is a blocker.
- No Tailwind-class string constants shared across files — extract a component.
- Admin is routed; the Order inbox is its home.
- Storefront follows the committed pantry direction in `DESIGN.md`; adapt composition, not just decoration.

## Hard guardrails

Strict TypeScript: no `any`, unchecked assertions, non-null assertions, ignored errors, or classes outside the established error hierarchy. No inline comments outside TODO seams. Named exports, feature public entrypoints, thin routes, raw table access only inside feature persistence modules. Cross-feature backend calls are direct operations, never HTTP self-calls.

No unit/integration tests, mocks, stubs, or fake providers. Blocked beats fake green.

Add dependencies only at an accepted owning seam; never a competing validation, Result, state, date, icon, motion, logging, utility, or matching stack.

## Repository operations

- Schema changes: update the kernel schema, run the repo's generate + local-migrate commands.
- Better Auth plugin changes: update schema-generation config and regenerate.
- Env vars: update Valibot env contracts, `.dev.vars.example`, Wrangler vars, regenerate binding types.
- Domain language: `CONTEXT.md`.

## Gates

Per PR: format, lint, typecheck, production build — green. UI PRs add one desktop + one mobile screenshot of the affected route, taken by the agent in a real browser. API PRs add one real curl of the affected endpoint.

Per slice: the agent runs a full browser walkthrough of the user journey plus the full gate suite (Astro check, Knip, Sherif, dependency direction). One correction pass; a second failure escalates to the human instead of spawning another review loop.

Gates green and product approved are separate states. A slice is done when a working user journey exists, not when checks pass.
