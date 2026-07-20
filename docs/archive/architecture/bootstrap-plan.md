# Ecommerce workspace bootstrap plan

**Status:** Landed historical execution plan — issue #31 closed by PR #34 at merge `f748ab739274ed57e57e115c081a3c68bc249733`

## Outcome

This plan records how the SaaS starter was replaced with a pnpm monorepo proving one production-shaped Өрнүүн 48 Store without implementing commerce features prematurely. It is historical execution guidance for the landed bootstrap seams, not current domain authority. The result is a clean package graph, one real Astro/Elysia/Solid vertical slice, strict tooling, and a default UI foundation subsequent issues can extend.

## Workspace

```text
apps/
  urnuun-48/            Astro 7 Store app and Cloudflare Worker
packages/
  contracts/            Valibot contracts, DTOs, TypeIDs, tagged errors
  kernel/               feature operations, Drizzle, D1, migrations, background work
  api/                  complete Elysia app and HTTP mapping
  client/               Eden, Query/Form configs, Cart and browser persistence
  admin/                shared Solid Admin SPA
  storefront/           default Astro/Solid Storefront behavior and presentation
  ui/                   Zaidan, Kobalte, Corvu, Solar Icons, tokens, motion
  integrations/         Byl, QPay, SMS, Telegram implementations
  delivery/             Node-only Store generation, apply, migration, and proof CLI
```

Store apps are minimal composition roots. Өрнүүн 48 owns its Store Profile, assets, seed inputs, static provider selection, deployment configuration, and route-level Storefront presentation. Shared packages own behavior. No Store app copies commerce, API, query, form, Cart, Admin, schema, migration, or accessibility code.

## Dependency direction

```text
contracts
  ↑ kernel ← api
  ↑ client ← admin
       ↑      storefront
ui ───────────┘
integrations → contracts
delivery      Node-only
apps          compose approved package entrypoints
```

`client` may depend on `api` only for the Elysia app type. `kernel` never imports concrete integrations or presentation. Private cross-package source imports and cycles fail CI.

## Kernel shape

`kernel/src` is organized by commerce feature rather than MVC layers:

```text
db/{database,schema,migrations}
catalog/
content/
checkout/
inventory/
orders/
payments/
fulfillment/
customers/
staff/
storefront/
background/
observability/
```

Only persistence modules access raw tables. Operations consume cohesive feature query objects. Routes call operations. Features call other operations directly, never through HTTP. Transactional commands may coordinate D1 while raw table access remains contained. Package size alone is not a reason to split `kernel`.

Server modules import fixed Cloudflare bindings directly from `cloudflare:workers`. Do not inject D1, `EPHEMERAL_KV`, R2, Workflow, Queue, Email, or Service Binding wrappers through factories. Static provider selection remains a real composition seam.

## Typed browser path

1. Drizzle owns relational persistence.
2. Valibot owns HTTP and shared runtime contracts.
3. Kernel operations return Better Results for expected tagged failures.
4. Elysia maps each Result once to meaningful HTTP statuses and route-specific DTOs or `ApiErrorEnvelope` values.
5. Eden supplies the complete route type to `client`.
6. Reusable `queryOptions` and mutation configs parse responses and expose exact tagged Query errors.
7. QueryClient handles common network, service, rate-limit, expired-session, and contract failures globally.
8. Domain failures requiring richer UI remain local to the consuming query or mutation.

Do not serialize Better Result over HTTP or place Result containers inside Query data.

## State and presentation

- TanStack Query owns remote state.
- TanStack Form owns editable form state.
- URLs own shareable navigation and filter state.
- Solid stores/context own Cart, session, and transient UI state.
- Solid Primitives storage persists Cart and compatible drafts.
- Mutations invalidate authoritative queries instead of patching cache truth.
- Astro SSR renders public Storefront routes; Solid islands own commerce interaction.
- `/admin/*` is an authenticated Astro shell containing the shared Solid SPA.
- Shared Storefront/Admin defaults must be polished and usable, not empty route placeholders.
- Store customization replaces Astro route presentation, not shared behavior.
- Astro View Transitions and Motion provide a consistent ambient motion layer with reduced-motion alternatives.

## Bootstrap dependencies

Install the approved baseline during #31 so later agents do not choose competing foundations. Alongside the accepted framework, auth, database, UI, query, form, validation, date, motion, logging, and icon packages, include:

- `better-result`
- `dismatch`
- `es-toolkit`
- `@solid-primitives/storage`
- `culori`
- `micromark`
- `sherif`

Install now; use only at the owning seam. Major additions require review.

## Tooling

- TypeScript 7 is canonical; keep TS6 only as the temporary Astro programmatic-API compatibility package.
- Oxfmt formats.
- Oxlint starts from Letstri and includes applicable Antfu general and Solid rules.
- Antfu ESLint runs only on `.astro` until Oxlint supports Astro parsing.
- Biome and a duplicate general ESLint pass are absent.
- Knip, Sherif, and dependency checks enforce repository hygiene.
- CI runs frozen install, format, lint, TS7 typecheck, Astro check, Knip, Sherif, dependency checks, and build.

## Implementation sequence

1. Remove superseded SaaS, organization, project, Polar, pricing, and generic marketing surfaces.
2. Establish workspace manifests, package entrypoints, TypeScript configs, dependency rules, formatter, linters, Knip, Sherif, and CI.
3. Create the nine package shells with real public entrypoints and no placeholder domain abstractions.
4. Move Drizzle foundation and generated bindings into `kernel`; establish direct `env` access and one migration stream.
5. Build the complete Elysia app seam, direct Astro Storefront reader, and bounded background entrypoint.
6. Build the Eden request boundary, QueryClient, reusable query configuration pattern, form foundation, persisted Cart store, and typed global/local error behavior.
7. Build Өрнүүн 48's production-shaped Astro shell, default Storefront foundation, Admin SPA shell, Solar icon policy, and motion foundation.
8. Add delivery command shells and manifests that fail clearly where later provisioning behavior is intentionally absent.
9. Prove the real workspace through build, browser, curl, and `/api/health`.

Commit after each coherent step. Every intermediate commit must typecheck or clearly isolate the temporary mechanical move it performs.

## Proof

Completion requires:

- format, lint, TS7, Astro, Knip, Sherif, dependency, and build gates passing;
- Өрнүүн 48 running through Portless;
- real browser proof for Storefront and Admin shells at mobile and desktop sizes;
- curl proof for `/api/health` and cache headers;
- generated Cloudflare binding types and local D1/KV/R2 wiring;
- no remaining SaaS/Polar surface or forbidden package edge;
- no unit/integration tests, mocks, fake providers, or placeholder business implementations.

Normative details remain in `docs/wayfinder/final-scope-reconciliation.md` and the accepted Wayfinder contracts. This plan is an execution map, not a second source of domain truth.
