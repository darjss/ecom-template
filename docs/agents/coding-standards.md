# Coding standards

This is the everyday coding contract. Architecture lives in the [final scope reconciliation](../wayfinder/final-scope-reconciliation.md); delivery details live in the accepted Wayfinder contracts.

## Cause-first

> **Fix causes, not symptoms.**

Trace an impossible state to where it became possible, then correct that schema, interface, transition, or caller. Do not preserve a broken model with fallback values, optional chaining, assertions, defensive branches, or a long comment.

This is greenfield software. Prefer a coherent breaking correction across internal callers over compatibility with a bad interface. External input remains untrusted and is always parsed.

## Simplest means

> **Write the simplest maintainable code that achieves the goal through the simplest means. Never introduce enterprise-style complexity for hypothetical needs.**

Start with direct functions, plain data, one feature folder, and existing platform primitives. Add a seam only when it hides real complexity or supports accepted variation.

Reject factories for fixed dependencies, one-implementation interfaces without a concrete benefit, controller/service/repository stacks, command buses, generic internal frameworks, configuration for one fixed choice, distributed solutions to Store-local problems, arbitrary extension registries, and wrappers that merely rename another interface.

Every dependency solves a present problem. A risky or young dependency belongs behind a small replaceable seam; stable Store data never becomes the experiment.

Use the deletion test: if deleting a module removes only indirection, delete it. If its policy would otherwise spread through several callers, it has earned its place.

## Feature locality

Organize by commerce feature. A feature owns its operations, queries, tagged errors, projections, and private persistence. Separate meaningful concerns into files instead of growing one large file. Around 150 lines triggers a cohesion review, not an automatic split.

Avoid catch-all `services`, `repositories`, `helpers`, `utils`, and `types` directories. Expose one explicit feature entrypoint; callers do not import private feature files.

Only persistence modules access raw Drizzle tables. Operations consume cohesive feature query objects. Routes invoke operations. Features call other operations directly, never through HTTP. An atomic money or inventory transition may coordinate D1 without inventing a layer boundary.

## Functional shape

Prefer exported arrow constants, plain functions, and plain objects. Classes are reserved for the established error hierarchy when a real runtime error class is required.

Use positional parameters by default. Introduce a named parameter object when it resolves real ambiguity, several optional values, an unstable public call shape, or too many arguments.

Group related persistence functions in a cohesive feature object such as `catalogQueries`. Prefer pipelines, readable fluent transformations, and exhaustive `dismatch` expressions. Break a chain only at a meaningful boundary: distinct error handling, logging, reuse, or policy.

Use explicit domain names. `confirmedPaymentAmountMnt` is better than `amount` when the surrounding scope does not already establish the meaning.

Keep one-off DTO projections inline when the selected fields are obvious. Name a mapper when it is reused, carries policy, normalizes values, or could drift between callers. Never spread a persistence row into an HTTP response.

## Inference

Treat the executable schema or producing function as the source of truth and infer downstream types. Do not manually duplicate a model type. Use `satisfies` only when it proves an exported shape without widening useful inference.

Exported components and operations use named input types. Colocate a type with its only owner; promote it to `contracts` only when it crosses a real package or runtime seam.

Strict TypeScript means no `any`, unchecked assertions, non-null assertions, `@ts-ignore`, `@ts-nocheck`, or casts that turn unparsed input into trusted data. Isolate an untypable library boundary in one validated adapter.

## Boundary truth

Valibot parses HTTP, forms, environment-derived values, persisted JSON, provider payloads, browser storage, and CMS documents. Infer TypeScript types from those schemas. After parsing, use plain valid internal data rather than constructor wrappers around every value.

Drizzle rows are persistence truth, not browser contracts. Elysia and Eden form one typed producer-to-consumer chain; do not recreate transport types manually on the client.

Server modules import fixed Cloudflare bindings directly from `cloudflare:workers`. Do not thread D1, KV, R2, Workflow, Queue, Email, or Service Bindings through factories.

For external synchronization, create one authoritative reconciliation function that rereads complete current provider state. Webhook events trigger reconciliation; their order and partial payloads are not commercial truth.

## Typed failures

Kernel and integration operations return Better Results for expected narrow tagged failures. Convert throwing SDK and network work once at the integration boundary. Prefer ordinary `await`, early narrowing, and fluent Result transformations; generator composition is exceptional.

Elysia maps each Result once to a meaningful status and route-specific Valibot envelope. Better Result is never serialized over HTTP or placed inside Query data.

The client boundary throws validated tagged route failures so TanStack Query exposes the exact union through `isError`. Expected Query failures may remain tagged data; they do not need a class merely to enter the error channel. Unknown thrown values remain defects, not invented domain failures.

Global Query handling owns behavior common everywhere: network/service toasts, bounded rate-limit presentation, expired Staff-session redirection, and contract-failure reporting. Rich domain failures remain local.

A non-critical external read may fail with an explicit fallback and diagnostic event when the feature can truthfully continue without it. Consequential commerce writes fail closed.

## State ownership

- TanStack Query owns remote state.
- TanStack Form owns editable form state.
- URLs own shareable navigation and filter state.
- Solid stores/context own Cart, session, and transient UI state.
- Solid Primitives storage owns compatible Cart and browser-draft persistence.

Use current Solid Query `useQuery`, `useMutation`, and `useQueries` APIs. Export reusable `queryOptions` and mutation configurations. Create a hook only for genuine reactive composition. Mutations invalidate authoritative queries rather than patching server truth into cache or global state. Optimistic UI requires a measured need plus cancel, rollback, and revalidation; never use it for inventory, price, payment, or fulfillment truth.

Astro performs consolidated Storefront server reads directly in-process. Do not replace one coherent SSR read with fragmented browser round trips or an HTTP self-call.

## Dependencies and presentation

Use native APIs for simple work and `es-toolkit` for real generic operations. Use specialized baseline dependencies only at their owning seams: `dismatch` for union matching, `json-canonicalize` for idempotency hashing, Culori for Theme colors, Micromark for constrained CMS Markdown, and Solid Primitives for reactive persistence. Do not add a competing utility, validation, Result, state, date, icon, motion, logging, or matching library without review.

Use Solid, never React. Start with Zaidan, Kobalte, and Corvu primitives. Solar Icons is the controlled icon family. Astro View Transitions carry route continuity; Motion handles local feedback. Motion never delays input, obscures information, or becomes commerce state, and it always has reduced-motion behavior.

## Comments, privacy, and proof

Code explains what through names, types, and structure. Comments explain only a non-obvious reason, invariant, external constraint, or deliberate tradeoff. Record a decision once and link to it rather than duplicating prose.

Use Evlog at request and consequential background seams. Restricted Customer Auth, Checkout, Order, Payment, and support events may include the full normalized customer phone. It never enters PostHog, URLs, public errors, browser logs, or generic request logs. Never log secrets, OTPs, tokens, bank details, free text, raw provider payloads, or request bodies.

Verification uses the real system: format/lint/type/architecture gates, production build, browser interaction and accessibility inspection, curl, Wrangler bindings, and focused TypeScript CLI harnesses. Do not add unit or integration tests, mocks, stubs, or fake providers as proof.

Before completion:

1. Trace every changed line to the requested outcome.
2. Remove abstractions, branches, comments, and dependencies that did not earn their place.
3. Confirm invalid internal states were eliminated at their source.
4. Confirm every external value is parsed before trust.
5. Run every applicable real proof and inspect the affected browser or API behavior.
6. Commit one coherent change with no unrelated cleanup.
