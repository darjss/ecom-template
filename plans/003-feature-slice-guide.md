# Add the canonical feature-slice guide

Base: `f748ab739274ed57e57e115c081a3c68bc249733`

## Why

The bootstrap provides real but narrow health, Staff, Cart, Storefront, and delivery seams. Subsequent agents need a single navigation recipe for extending those seams without inventing controller/service/repository stacks, manually recreating transport types, or copying bootstrap-only infrastructure behavior into commerce features.

## Scope

Add `docs/agents/feature-slice.md` and link it from `AGENTS.md` and the contract index.

The guide must describe the ordered tracer-bullet path:

1. identify authoritative contract and domain terms;
2. add or extend client-safe Valibot contracts only for real runtime seams;
3. add private Drizzle schema/migration and a feature persistence module;
4. implement a direct kernel operation with Better Result tagged expected failures;
5. map once in a thin Elysia route to meaningful status-specific envelopes;
6. consume the producer-derived Eden type in `client`, validate both response paths, and throw the exact Query error union;
7. export `queryOptions` or mutation configuration and invalidate authoritative queries;
8. compose shared Admin/Storefront behavior without moving remote state into Solid stores;
9. regenerate intentional artifacts and prove the real API/browser/D1 path.

For each step, link to current real files that demonstrate the nearest accepted pattern. State explicitly where the current example is bootstrap infrastructure rather than a complete commerce mutation. Include a short anti-pattern list and stop conditions: no HTTP self-call, raw row DTO, Result over HTTP, generic service/repository layer, binding wrapper, manual cache patch, fake provider, or unowned dependency.

Include a requirement-to-evidence completion table agents can copy into implementation reports.

## Boundaries

Do not add example source files, fake domain features, templates, generators, or copied code snippets likely to drift. Do not claim the health route demonstrates transactions or consequential writes. Keep the guide navigational and executable through links and commands.

## Verification

- Every linked source/doc path exists.
- The guide agrees with `AGENTS.md`, coding standards, the contract index, and issue #33.
- `pnpm format:check` and `git diff --check` pass.

## Stop conditions

If no current source demonstrates a required future pattern, say that the first accepted implementation becomes the exemplar; do not invent one in documentation.
