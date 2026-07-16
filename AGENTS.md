# Agent conventions

Before coding, read [`docs/agents/coding-standards.md`](docs/agents/coding-standards.md) and use the [`contract authority index`](docs/agents/contract-index.md) to find the governing feature contract. For architecture, [`docs/wayfinder/final-scope-reconciliation.md`](docs/wayfinder/final-scope-reconciliation.md) overrides older artifacts.

## North star

- **Fix causes, not symptoms.** Make invalid internal states impossible at their source.
- **Use the simplest maintainable means.** Never add enterprise-style structure or hypothetical extension points.
- This is greenfield software. Prefer a coherent breaking correction over compatibility with a bad internal interface.
- Commit each small coherent change.

## Product scale

Design for independent Stores doing roughly 10–20 Orders per day, comfortably around 50 Orders per day and audiences up to about 50,000 followers. Preserve Store isolation, authorization, validation, atomic commercial and inventory truth, retry idempotency, recoverability, and compact evidence. Do not optimize for unsupported enterprise scale.

## Stack and ownership

Astro 7 SSR runs on Cloudflare Workers. SolidJS powers islands and the `/admin/*` SPA; never React. Elysia owns `/api`. Tailwind v4 Theme output belongs in `src/styles/global.css`; do not hand-edit Zaidan-generated `base.css`.

The target workspace has one minimal Store app and nine shared packages: `contracts`, `kernel`, `api`, `client`, `admin`, `storefront`, `ui`, `integrations`, and `delivery`. See [`docs/architecture/bootstrap-plan.md`](docs/architecture/bootstrap-plan.md).

- Valibot owns runtime contracts. Raw Drizzle rows never cross the browser boundary.
- Better Result is internal. HTTP uses meaningful statuses and typed envelopes; Query data never contains Result containers.
- Server owners import fixed bindings directly from `cloudflare:workers`; do not inject binding wrappers.
- TanStack Query owns remote state, TanStack Form owns forms, URLs own shareable navigation, and Solid stores/context own Cart/session/UI state.
- Mutations invalidate authoritative queries rather than patching cache truth.
- Store customization replaces Astro route presentation while shared packages retain commerce behavior and accessibility.
- Solar Icons only, through deep Solid imports where applicable.

## Hard guardrails

Strict TypeScript: no `any`, unchecked assertions, non-null assertions, ignored errors, or classes except the established error hierarchy. Do not add inline comments outside established TODO seams. Use named exports and feature public entrypoints. Keep routes thin and raw table access inside feature persistence modules. Cross-feature backend calls are direct operations, never HTTP self-calls.

Do not add unit or integration tests, mocks, stubs, or fake providers. Verify frontend work in a real browser; verify API/backend work with real curl or a focused TypeScript CLI harness. For model behavior, build an interactive CLI harness.

Add dependencies only at an accepted owning seam. Do not introduce a competing validation, Result, state, date, icon, motion, logging, utility, or matching stack.

## Repository operations

- UI components: `pnpm dlx shadcn@latest add @zaidan/<name>` into the owning shared UI package.
- Schema changes: update the kernel schema, then run the repository's generate and local-migrate commands.
- Better Auth plugin changes: update its schema-generation config and regenerate.
- Environment variables: update Valibot env contracts, `.dev.vars.example`, public Wrangler vars where applicable, and regenerate binding types.
- Issues and PRDs: [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md).
- Triage labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`.
- Domain language: [`docs/agents/domain.md`](docs/agents/domain.md).

## Proof

Run every applicable repository gate: frozen install, format, lint, TypeScript 7 typecheck, Astro check, Knip, Sherif, dependency-direction checks, and production build. Then run the app through Portless, inspect affected browser behavior, and curl `/api/health` plus relevant cache/no-store headers. Missing credentials or infrastructure means blocked, not passed.
