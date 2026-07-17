# Feature-slice guide

Use this tracer-bullet path to extend one accepted commerce feature through its real runtime seams. Read the [contract authority index](contract-index.md), [domain glossary](domain.md), and [coding standards](coding-standards.md) first.

The current repository demonstrates bootstrap infrastructure: D1 health, Staff authorization, persisted Cart state, direct Storefront reads, and local delivery. It does **not** yet demonstrate a complete commerce mutation, a consequential D1 transaction, a route-specific domain failure union, or mutation-driven Query invalidation. The first accepted implementation of each missing shape becomes its exemplar; do not invent an example in advance.

## Ordered path

### 1. Establish authority and language

Locate the feature in the [contract index](contract-index.md), apply the current [ecommerce system specification](../specs/ecommerce-system.md), then apply the [final scope reconciliation](../wayfinder/final-scope-reconciliation.md) to decisions the specification does not replace. Use terms from the [domain glossary](domain.md). Record the exact issue requirements and contract clauses the slice will prove. Stop if accepted contracts still conflict after applying the full precedence order.

The [bootstrap plan](../architecture/bootstrap-plan.md) navigates landed seams only. It is not domain authority.

### 2. Add contracts only at real runtime seams

Add or extend client-safe Valibot schemas for values crossing HTTP, browser storage, persisted JSON, provider, or package/runtime boundaries. Infer types from the schema and expose them through the owning feature entrypoint. Do not promote kernel-private values or manually recreate producer types.

Nearest patterns:

- [`packages/contracts/src/index.ts`](../../packages/contracts/src/index.ts) owns strict health, error, Cart, Store definition, and Storefront schemas with inferred types.
- [`packages/client/src/cart/index.tsx`](../../packages/client/src/cart/index.tsx) parses persisted Cart JSON before trust.

These are bootstrap contracts, not complete Catalog, Checkout, or mutation contracts.

### 3. Add private persistence

Extend [`packages/kernel/src/db/schema.ts`](../../packages/kernel/src/db/schema.ts), generate the forward migration under [`packages/kernel/migrations/`](../../packages/kernel/migrations/), and keep raw Drizzle access in the feature's private persistence module. Select deliberate projections instead of returning rows. Parse persisted JSON and typed identifiers on read as well as write.

[`packages/kernel/src/staff/persistence.ts`](../../packages/kernel/src/staff/persistence.ts) demonstrates a cohesive feature query object and selected fields. [`packages/kernel/drizzle.config.ts`](../../packages/kernel/drizzle.config.ts) and the existing migration stream demonstrate schema ownership. Neither demonstrates a consequential commerce transaction or ledger write.

### 4. Implement one direct kernel operation

Implement a named feature operation that invokes its persistence object directly. Return Better Result for narrow expected tagged failures; reserve thrown defects for genuinely unexpected states. Keep cross-feature calls in process through other operations, never through the Store's HTTP API. Import fixed Cloudflare bindings only in their owning server modules. Use Ky directly for handwritten outbound HTTP, parse external bodies from unknown with Valibot, and enable retries only when the owning business operation permits replay.

[`packages/kernel/src/db/health.ts`](../../packages/kernel/src/db/health.ts) is the nearest direct Better Result operation. It proves explicit success/failure narrowing for a bounded infrastructure read only. It does not demonstrate domain authorization, current-state predicates, transactions, or a commerce mutation. The first accepted implementation of those behaviors becomes the exemplar.

### 5. Map once in a thin Elysia route

Parse the request, invoke the operation, and map its Result exactly once to a route-specific success DTO or closed error envelope with a meaningful HTTP status. Keep authorization at the accepted command boundary and make private routes `private, no-store`.

[`packages/api/src/index.ts`](../../packages/api/src/index.ts) demonstrates the complete Elysia app, the thin `/api/health` mapping, validated success and 503 envelopes, Staff routing, and private cache policy. Health is bootstrap infrastructure: it does not prove a commerce command, transactional status conflicts.

### 6. Preserve producer-derived client typing

Use the complete Elysia app type through [`packages/client/src/eden.ts`](../../packages/client/src/eden.ts); do not hand-copy route types. At the request boundary, validate both success and failure bodies and throw the exact declared Query error union.

[`packages/client/src/request.ts`](../../packages/client/src/request.ts) demonstrates both-path validation for health, including network, contract, and route errors. Its single unavailable route failure is narrower than future domain unions but establishes the accepted boundary.

### 7. Export Query configuration and invalidate truth

Export reusable `queryOptions` for reads or mutation configuration for writes. Give the configuration the exact data and error types. Successful mutations invalidate every authoritative query made stale by the committed change; do not patch commercial truth into Query caches or Solid stores.

[`packages/client/src/query/health.ts`](../../packages/client/src/query/health.ts) demonstrates typed reusable `queryOptions`, while [`packages/client/src/query/client.ts`](../../packages/client/src/query/client.ts) demonstrates global handling for shared failures. No mutation configuration or invalidation exemplar has landed. The first accepted commerce mutation must establish that pattern from its contract rather than copying a fabricated example.

### 8. Compose shared behavior in Admin or Storefront

Consume the client configuration from shared Admin or Storefront behavior. TanStack Query owns remote state, TanStack Form owns editable form state, URLs own shareable navigation, and Solid stores/context own Cart, session, and transient UI state.

- [`packages/admin/src/index.tsx`](../../packages/admin/src/index.tsx) composes QueryClient and the health query in the shared Admin SPA.
- [`packages/admin/src/StaffLoginForm.tsx`](../../packages/admin/src/StaffLoginForm.tsx) demonstrates validated form-boundary behavior.
- [`packages/storefront/src/CartIsland.tsx`](../../packages/storefront/src/CartIsland.tsx) and [`packages/client/src/cart/index.tsx`](../../packages/client/src/cart/index.tsx) demonstrate local Cart ownership.
- [`apps/urnuun-48/src/pages/index.astro`](../../apps/urnuun-48/src/pages/index.astro) uses the direct [`StorefrontReader`](../../packages/kernel/src/storefront/reader.ts) and composes a Solid island without an HTTP self-call.

These surfaces are bootstrap presentation, not proof of authoritative Catalog availability or Checkout. Style application and component surfaces with Tailwind v4 utilities, preferring established tokens and utilities over arbitrary values. Raw CSS belongs only to global theme, token, and base output or a capability Tailwind cannot express, never to page or component styles or relocated utility rules.

### 9. Regenerate and prove the real path

Run intentional generation only after changing its owner:

- `pnpm auth:generate` after Better Auth plugin/schema configuration changes;
- `pnpm db:generate` after kernel schema changes;
- `pnpm bindings:generate` after binding or environment-contract changes.

Then run the repository's non-mutating generated drift check and every applicable plain-pnpm gate from [`package.json`](../../package.json). Apply local migrations through `pnpm db:migrate:local`. Prove the affected path through the real Store: curl the API and cache headers, inspect D1 effects, and use a real browser for Admin or Storefront behavior. [`packages/delivery/src/cli.ts`](../../packages/delivery/src/cli.ts) owns the local apply/proof seam and keeps unavailable remote behavior fail-closed.

Do not add tests, mocks, stubs, fake providers, or temporary source examples as proof. Missing credentials or infrastructure is blocked, not passed.

## Stop before introducing

- an HTTP self-call between Astro, routes, or backend features;
- a raw Drizzle row as a DTO or browser contract;
- Better Result serialized over HTTP or stored in Query data;
- a generic service, repository, controller, command bus, or helper layer;
- a D1, KV, R2, Workflow, Queue, Email, or Service Binding wrapper;
- a manual cache patch for authoritative remote truth;
- a fake provider or simulated infrastructure success;
- a dependency without an accepted owner and present need.

## Completion evidence

Copy this table into the implementation report and replace each placeholder with exact evidence. Remove rows that are genuinely not applicable and state why.

| Requirement                  | Owning contract or issue clause      | Changed artifact                   | Real proof command or observation | Outcome or blocker |
| ---------------------------- | ------------------------------------ | ---------------------------------- | --------------------------------- | ------------------ |
| Runtime contract             | `<link and clause>`                  | `<schema or entrypoint>`           | `<parse/API evidence>`            | `<pass/blocker>`   |
| Persistence and migration    | `<link and clause>`                  | `<schema, migration, persistence>` | `<migration and D1 evidence>`     | `<pass/blocker>`   |
| Kernel operation             | `<link and clause>`                  | `<operation entrypoint>`           | `<real API/CLI path>`             | `<pass/blocker>`   |
| HTTP and typed client        | `<link and clause>`                  | `<route, request, Query config>`   | `<curl statuses/envelopes>`       | `<pass/blocker>`   |
| Admin or Storefront behavior | `<link and clause>`                  | `<shared UI composition>`          | `<browser path and viewport>`     | `<pass/blocker>`   |
| Generated artifacts          | `<owning configuration>`             | `<generated paths>`                | `<non-mutating drift command>`    | `<pass/blocker>`   |
| Repository gates             | [`package.json`](../../package.json) | `<affected workspace>`             | `<exact plain-pnpm commands>`     | `<pass/blocker>`   |
