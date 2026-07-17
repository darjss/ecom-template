# Final scope and contract reconciliation

**Decision status:** Founder approved after all Wayfinder child tickets closed.

This document is the final normative amendment for `/to-spec`. It supersedes only the conflicting or overbuilt clauses named below. All other accepted Wayfinder decisions remain in force.

The system serves small independent Stores that usually handle 10–20 Orders per day, should remain comfortable around 50 Orders per day, and may have audiences around 50,000 followers. Prefer the smallest reliable implementation that protects money, inventory, Store isolation, and merchant trust.

## Telegram financial convenience

Telegram Confirm and Reject actions remain a defining Merchant Admin convenience. They do not reproduce web Staff identity, enrollment, role, or session machinery.

Each Store has a founder-maintained private deployment allowlist of Telegram operators. One entry contains an exact numeric Telegram user ID and a short audit label. Changing the allowlist is a founder-controlled configuration and deployment action; Merchant Admin cannot enroll operators or grant Telegram authority. An allowlisted operator is trusted for the Store's Telegram financial actions without a Staff-session or role lookup.

The minimum safety boundary remains:

- authenticate the webhook as Telegram traffic with the Store's webhook secret;
- accept financial callbacks only from an exact allowlisted Telegram user ID;
- use one opaque, bounded action reference created for that Payment message;
- apply current-state predicates before the financial transition;
- reload the Payment, Order, expected amount, and current state before mutation;
- invoke the same kernel Confirm or Reject command used by web Admin;
- record the configured Telegram operator label and user ID as consequential financial evidence.

The closed actor kind used by Payment Entries and consequential Audit Events includes `telegram_operator`. That actor stores the configured short label and exact numeric Telegram user ID without a Staff foreign key or role snapshot. Financial truth remains in the Payment Entry; an Audit Event is used only where the accepted evidence policy requires one and does not duplicate the ledger fact.

One button tap executes the action. There is no Admin enrollment flow, one-time enrollment link, `telegram_bindings` table, Staff-role revalidation, or second confirmation tap. Telegram notifications and all financial actions remain available in web Admin.

This supersedes the enrollment, Staff-binding, role-revalidation, and second-tap clauses in the authentication and interface contracts. It does not weaken webhook authentication, input validation, state revalidation, or audit evidence.

## Customer identity remains in v1

Keep the separate Customer Better Auth instance, SMS OTP login, rolling Customer sessions, optional Order history, verified Guest Order linking, anonymous-first Checkout, and private Guest Tracking Links. Customer Auth remains optional for ordinary Checkout. COD may require the accepted OTP proof.

The Customer and Staff authentication namespaces remain isolated. This feature is not deferred.

## Typed CMS documents

Commercial truth remains relational. Catalog Items, Variants, SKUs, prices, inventory, Orders, Payments, Discounts, Customers, Staff, Media Assets, and consequential evidence do not move into generic JSON storage.

Replace the normalized noncommercial CMS table family with one closed two-slot document table:

```text
cms_documents
  kind            closed CMS document kind
  status          draft | published
  schema_version  positive integer
  content_json    canonical validated JSON
  created_at
  updated_at
  published_at
  primary key (kind, status)
```

The closed document kinds are:

- `storefront_identity`
- `theme`
- `homepage`
- `navigation`
- `locations`
- `policies`
- `announcement`
- `ordering_notices`

This is not a generic Pages or extension-property system. Each kind has one named strict TypeScript type and one matching Valibot schema. Use a discriminated schema map keyed by the closed `kind`; reject unknown kinds, unknown schema versions, unknown fields, malformed TypeIDs, unsupported section variants, and invalid bounds on every write and read. No type assertion may substitute for parsing.

Homepage sections, navigation groups and items, social links, Locations, Policies, and Ordering Notices are bounded arrays inside their owning typed document. Theme tokens remain a versioned typed document. Media and Catalog references use canonical TypeIDs and are checked against relational rows when a Draft is saved and again when it is published. Publication rejects missing, archived, cross-kind, cyclic, or otherwise invalid references.

There is at most one Draft and one Published document per kind. Save Draft and Publish use last-write-wins at this operating scale; there are no general optimistic Revision columns, `If-Match` headers, retained CMS history, merge service, or server conflict workflow. Compatible browser-local drafts still restore automatically under the accepted form contract. Publishing validates and replaces the complete Published document, deletes the Draft, then performs the accepted synchronous cache purge.

This replaces the normalized `storefront_identities`, social-link, Theme, Homepage/section, Announcement, Ordering Notice/placement, navigation menu/group/item, Location, and Policy table family. It supersedes earlier CMS expected-Revision and explicit reconciliation clauses. Media Asset metadata and Catalog image relationships remain relational.

## One ephemeral KV namespace per Store

Each Store Deployment Target owns one KV namespace, not separate session and cache namespaces. The stable binding is `EPHEMERAL_KV`.

Logical prefixes isolate:

- Staff and Customer sessions;
- verification and OTP state;
- rate-limit counters;
- Demo Admin state;
- Telegram action references;
- other explicitly disposable short-lived state.

Cloudflare's CDN/Workers Cache owns public storefront caching. D1 owns commerce and durable application truth. KV does not cache Catalog/CMS HTML, stock, Orders, Payments, inventory, or durable jobs.

Provisioning, Wrangler templates, generated binding types, delivery journals, `store:doctor`, cleanup, and live proof create and verify one KV resource. This supersedes the `session KV` plus `cache KV` clauses in the provisioning and operations contracts.

## Bootstrap architecture and package ownership

Issue #31 establishes the approved nine-package workspace:

```text
apps/urnuun-48
packages/contracts
packages/kernel
packages/api
packages/client
packages/admin
packages/storefront
packages/ui
packages/integrations
packages/delivery
```

Store apps are minimal composition roots. Shared packages own runtime contracts, commerce and persistence, the complete Elysia app, Eden and TanStack configuration, browser state, forms, the Solid Admin SPA, the production-capable default Storefront, accessible UI primitives, provider implementations, and Node-only delivery behavior. A Store app owns its Store Profile, deployment identity, static integration selection, assets, seed input, and route-level Storefront presentation. There is no generic slot registry, override framework, Store subclass, copied backend, or Store-local fork of commerce behavior.

`kernel` is organized by commerce feature and may be the largest package. Drizzle schema and migrations remain there. Only persistence modules access raw tables; feature operations consume cohesive feature query objects; routes invoke operations; cross-feature backend work calls operations directly rather than HTTP. Avoid MVC layers, generic repositories, command buses, and catch-all service/helper directories.

Worker bindings use stable names and are imported directly through `import { env } from "cloudflare:workers"` by their owning server modules. Do not construct or inject D1, KV, R2, Workflow, Queue, Email, or Service Binding wrappers through application layers. Static provider selection remains a real seam because accepted implementations vary.

## Current typed data and error flow

Valibot owns HTTP and shared executable runtime contracts. Drizzle owns relational persistence. Browser DTOs are deliberate contract projections rather than exported rows.

Kernel and integration operations use Better Result for expected tagged failures, with ordinary `await`, explicit narrowing, and fluent transformations. Elysia maps the Result once to meaningful status-specific success and `ApiErrorEnvelope` responses. The wire protocol does not serialize Better Result.

The client uses current Solid Query `useQuery`, `useMutation`, and `useQueries` APIs with reusable `queryOptions` and mutation configuration files. The shared request boundary validates success and failure bodies and throws the exact tagged route error union, making Query `isError` typed. Common network, service, rate-limit, expired-session, and contract failures receive global Query behavior. Domain failures requiring richer than a common toast remain with the consuming query or mutation interface. Result containers do not live inside Query data.

TanStack Query owns remote state; TanStack Form owns editable form state; the URL owns shareable navigation and filter state; native Solid stores and context own Cart, session, and transient UI state. Persist the Cart and compatible drafts with Solid Primitives storage. Mutations invalidate authoritative queries rather than manually editing cache truth.

## Bootstrap dependency and tooling baseline

The bootstrap installs the important approved dependencies rather than inviting later agents to choose competing foundations. This includes Better Result, TypeID, Evlog, date-fns with timezone support, Motion, Solar Icons for Solid, `es-toolkit`, `dismatch`, `@solid-primitives/storage`, Culori, Micromark, and Ky alongside the accepted Astro, Solid, Elysia/Eden, Drizzle, Better Auth, Valibot, TanStack, Zaidan, Kobalte, Corvu, and Tailwind stack. Culori is owned by the Theme compiler, Micromark by constrained CMS rendering, and Ky by handwritten outbound HTTP. Framework fetch handlers and transports remain framework interfaces. External bodies remain unknown until Valibot parsing, and retries are enabled only when the owning business operation permits replay. Major additions require explicit review; do not add competing utility, validation, state, icon, date, logging, HTTP, animation, or pattern-matching systems ad hoc.

TypeScript 7 is canonical. A side-by-side TypeScript 6 compatibility package exists only while Astro's programmatic language tooling requires the old API. Oxfmt owns formatting. Oxlint begins with Letstri's initializer and incorporates applicable Antfu general and Solid rules. A narrow Antfu ESLint pass handles only `.astro` until Oxlint supports that parser. Biome and a duplicate general ESLint pass are excluded. Knip, Sherif, dependency-direction checks, format, lint, TypeScript/Astro checks, and build run in CI.

## Default presentation and motion

Өрнүүн 48 remains the fictional Reference Store. Shared `storefront` and `admin` packages provide polished, functional defaults that a Store may ship unchanged. Store-specific Astro routes may replace presentation while preserving shared readers, DTOs, availability, Cart, Checkout, navigation safety, forms, errors, and accessibility behavior.

Solar Icons replaces Lucide under a controlled family policy. Tailwind v4 utilities are mandatory for application and component styling, using established tokens and utilities before arbitrary values. Raw CSS is limited to global theme, token, and base output or capabilities Tailwind cannot express; it never owns page or component styles or relocated utility rules. Storefront navigation uses a consistent ambient layer of Astro View Transition motion. Persist continuity elements where correct, use shared product imagery and Motion-driven interaction feedback, and animate header, mobile navigation, Cart, search, variants, add-to-cart, and Checkout without delaying input or obscuring information. Reduced-motion behavior removes spatial movement while preserving state feedback.

## Proportional operations and launch proof

Keep Cloudflare-native logs, D1 metrics and Time Travel, account notifications, compact Admin attention states, the five human runbooks, a separate privacy-first PostHog project per Production Store, the seven-event allowlist, and masked sampled session replay. Restricted server-side Evlog events for Customer Auth, Checkout, Order, Payment, and support diagnosis may include the full normalized customer phone because it is the practical support lookup identifier. Phone never enters PostHog, URLs, public errors, browser logs, or indiscriminate request logging. Session replay remains easy-to-operate product evidence and retains all accepted privacy boundaries: no network capture, no identification, masked input, redacted query strings, and no recording on Checkout, auth, tracking, or Admin.

Reduce ceremony as follows.

### Diagnostic command

`store:doctor` verifies only:

- canonical URL, TLS, deployed commit, and migration head;
- expected binding identities and required secret names without values;
- bounded D1 read/write;
- one `EPHEMERAL_KV` write/read/delete;
- bounded R2 put/head/get/delete;
- cache-purge permission against a reserved tag.

It does not probe payment providers, send Telegram messages, or send SMS. Those integrations are proven through real sandbox or merchant-authorized launch journeys.

### Canary and Production proof

A consequential shared-kernel release runs the complete eight-scenario Reference Store canary suite once for that commit. Applying the same proven commit to a Production Store requires only Store-specific proof of deployment identity, bindings, migration head, canonical host, cache/privacy boundary, enabled provider journey, and one representative storefront-to-Admin Order path. Do not repeat the complete synthetic canary suite independently for every Production Store.

Store-owned storefront changes rerun only the affected Storefront, accessibility, SEO, cache, and performance proof. They do not rerun unrelated payment, inventory, auth, or recovery scenarios.

### Accessibility

The shared kernel and Merchant Admin receive the full WCAG 2.2 AA browser, keyboard, zoom, reflow, reduced-motion, and representative screen-reader proof on canary for consequential shared releases. Each Store activation proves its custom Home, listing/search, Product, Cart, and Checkout composition plus Theme contrast and one representative purchase path. It does not repeat every unchanged shared Admin flow.

### Recovery drills

Run the destructive D1 Time Travel restore drill on the fictional canary before the first Production Store launches and before a migration intended to delete or rewrite consequential data. Remove the fixed six-month drill ceremony. A real recovery defect or materially changed restore procedure may justify another drill.

All other accepted recovery rules remain: Production restores are human-authorized, Store-local, provider-reconciled, and never automatic.

## Later-ticket precedence corrections

The following final decisions resolve stale clauses in earlier artifacts:

- V1 Staff roles are exactly `owner`, `manager`, and `staff`; there is no Fulfillment Staff role.
- COD placement performs its accepted immediate inventory effect and creates an Awaiting Confirmation cash Payment. There is no `AcceptCodOrder` command, route, or Canary Scenario. Authorized cash collection uses the ordinary Payment confirmation command. The Reference Store COD scenario proves OTP-backed placement, immediate inventory consumption, and later cash confirmation instead.
- Live availability uses `GET /api/catalog/availability?variantIds=...`, is batched, and is `private, no-store`.
- Public search uses one `CatalogItemSearchResult` discriminated by `kind: product | bundle`. Published Products and Bundles share one FTS projection and endpoint. A Variant SKU resolves to its Product; a Bundle SKU resolves to its Bundle. Category and Collection shortcuts remain separate result kinds, not separate indexes.
- Elysia HTTP uses route-specific success DTOs and one closed `ApiErrorEnvelope` with meaningful HTTP status codes. Internal kernel operations may use typed Results, but the HTTP adapter maps them once. Serialized Result containers, client `Result.deserialize`, Result instances inside Query data, and a second transport-level `InfrastructureFailure` hierarchy are not part of the wire protocol. Route-specific tagged failures enter typed Query `isError` states instead.
- Customer OTP has one policy: five-minute single-use code; replacement invalidates the previous code; five verification attempts; 30-second resend cooldown; at most five sends per normalized phone per day; and at most ten sends per IP per 15 minutes. Send rate-limit counters use the prefixed `EPHEMERAL_KV` namespace with accepted best-effort eventual consistency; D1 retains atomic challenge consumption. Earlier overlapping hourly phone/IP windows are removed.
- Ordinary Catalog, settings, and typed CMS Draft writes are last-write-wins. General aggregate Revision columns and expected-Revision HTTP contracts are absent. Consequential state transitions retain atomic current-state predicates.
- Cloudflare Workflow may coordinate payment expiry, provider inspection, notifications, and repair, but D1 remains the only commerce truth. The accepted schema has no generic job table, outbox, notification-delivery table, or Failed Notifications subsystem.
- A committed commerce mutation followed by failed Workflow creation returns an explicit retryable partial outcome when the request observes the failure. A bounded scheduled reconciliation pass detects overdue authoritative Payment, Reservation, and unresolved business state and starts or repairs required Workflow work.
- Notification failure never changes commerce state. Workflow retries and Cloudflare Workflow visibility are sufficient in v1; Admin attention is driven only by unresolved authoritative business state, not by a duplicate notification queue.

## Decisions explicitly retained

The following reviewed scope remains intentional rather than accidental complexity:

- Telegram financial Confirm and Reject actions under the simplified founder allowlist;
- separate Staff and Customer authentication namespaces;
- both Byl and direct QPay adapters, with exactly one manually configured per Store;
- privacy-masked sampled PostHog session replay;
- one independently deployed Worker, D1, KV, R2, secrets, and custom Store app per Store;
- relational money, inventory, Payment, Order, SKU, Discount, identity, and evidence models;
- anonymous-first Checkout, Guest Tracking Links, atomic inventory safety, current-state external commands, and checkout revalidation;
- one fictional Reference Store canary, resumable provisioning, and one-Store-at-a-time human delivery.

## `/to-spec` handoff rule

The specification must apply this reconciliation before copying any earlier contract. When an earlier artifact conflicts with this document, this document wins. The specification should describe one coherent current contract and omit superseded alternatives rather than preserving historical contradictions.