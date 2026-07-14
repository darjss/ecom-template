# Elysia and Eden interface contract

**Decision status:** Founder directed for Wayfinder issue #24.

This contract defines the shared Store backend module, its Elysia/Eden HTTP interface, its direct Astro SSR read seam, and its background entrypoints. It follows the Target Store complexity budget: usually 10–20 Orders per day, comfortable operation around 50 Orders per day, and merchant audiences up to roughly 50,000 followers.

## Decision

Every generated Store Worker initializes one deep shared backend module. The module captures its repository-owned Store Profile, fixed Worker bindings, and statically chosen external adapters once and returns three entrypoints:

```ts
export interface StoreBackend {
  readonly api: StoreElysiaApp;
  readonly storefront: StorefrontReader;
  readonly background: StoreBackground;
}

export const createStoreBackend = (
  definition: StoreBackendDefinition,
): StoreBackend;
```

- `api` is the complete store-local Elysia application and the type source for Eden.
- `storefront` is the narrow in-process read interface used by Astro SSR on cache misses.
- `background` accepts only scheduled and Workflow work owned by this Store.

This is the shared external seam. Repositories, a command bus, route-family factories, persistence adapters, provider registries, and a generic SDK are implementation details or are excluded.

Store identity is never request data. There is no Store header, Store route parameter, Store field in a command, host-to-Store lookup, or central multi-Store runtime. The bound D1 database establishes ownership, and the build-owned Store Profile supplies the stable application identity and capability ceiling.

Explicitly forbidden shapes include:

```text
X-Store-ID
X-Tenant-ID
/api/stores/:storeId/*
?store=<key>
command.storeId
callback.storeKey
```

The request host is validated against build-owned deployment configuration, but it can only accept or reject a request for the already initialized Store. It never selects a Store or resource binding.

## Designs compared

### One minimal Store backend

One factory returns Elysia, direct storefront reads, and background work. It gives callers three obvious entrypoints while hiding D1 transactions, auth, authorization, commerce state, idempotency, caching, and adapters. Its deletion would spread that complexity back across Astro pages, route handlers, callbacks, and Workflow code, so the module earns its depth.

### Composable route-family toolkit

A flexible alternative exports public-catalog, checkout, Customer, Admin, callback, and auth plugins plus application ports. It makes individual route families replaceable, but generated apps could accidentally omit or reorder authorization, error, cache, and idempotency behavior. It also turns one shared contract into a wide assembly interface. This flexibility is not needed because every Store imports the same kernel.

### Generic query/command dispatcher

A minimal-method alternative exports `query(input)` and `execute(command)`. It has a small signature but a very large effective interface: callers must understand broad discriminated unions, actor rules, idempotency, and error unions. It weakens resource-shaped Eden inference and makes accidental exposure of internal commands easier.

The accepted design is the first option, with named route families composed privately inside the factory. It keeps the external module deep while retaining local implementation structure.

## Composition and static identity

A generated app owns the composition root:

```ts
import { env } from "cloudflare:workers";
import { createStoreBackend } from "@store/kernel";
import { storeProfile } from "./store-profile";
import { paymentAdapter, telegramAdapter } from "./store-adapters";

export const store = createStoreBackend({
  profile: storeProfile,
  deployment: {
    purpose: "production",
    canonicalOrigin: "https://example.mn",
    allowedHosts: ["example.mn"],
  },
  bindings: {
    database: env.DB,
    sessions: env.SESSIONS,
    media: env.MEDIA,
    workflow: env.COMMERCE_WORKFLOW,
    smsGateway: env.SMS_GATEWAY,
  },
  adapters: {
    automatedPayment: paymentAdapter,
    telegram: telegramAdapter,
  },
});

export type StoreApi = typeof store.api;
```

The example is illustrative rather than an SDK layer. Production types remain closed and versioned. The factory validates that Profile capabilities, adapter kinds, deployment purpose, and required bindings agree. Demo-only functionality fails closed in canary and Production.

Bank transfer and cash on delivery are kernel behavior, not adapters. Real external variation justifies static seams for the selected automated-payment provider, the private SMS Gateway, and optional Telegram integration. D1, KV, R2, Drizzle repositories, cache policy, and commerce behavior do not receive speculative adapter interfaces.

There is no adapter array, runtime registry, plugin discovery, dynamic import, arbitrary provider name, or provider-supplied Admin interface. Changing a provider choice requires a repository change and deployment. Adapters authenticate and translate external evidence; they never choose authorization, amounts, Payment state, inventory effects, Order transitions, retries, or audit evidence.

## Astro 7 request composition

Astro 7 `src/fetch.ts` is the one HTTP dispatcher. Elysia owns `/api`; Astro owns pages and assets:

```ts
import type { Fetchable } from "astro";
import { FetchState, astro } from "astro/fetch";
import { store } from "./store";

const fetch = async (request: Request): Promise<Response> => {
  const pathname = new URL(request.url).pathname;

  if (pathname === "/api" || pathname.startsWith("/api/")) {
    return store.api.fetch(request);
  }

  return astro(new FetchState(request));
};

export default { fetch } satisfies Fetchable;
```

The Elysia application keeps `prefix: "/api"` and `aot: false`. The existing catch-all Astro API route is removed when this seam is implemented so there is only one HTTP dispatch path.

Astro SSR imports `store.storefront` directly. It never uses Eden or HTTP to call its own Worker, never creates a second public CMS representation, and never accepts authoritative stock from cached page data.

```ts
export interface StorefrontDocument<T> {
  readonly value: T;
  readonly headers: Headers;
}

export interface StorefrontReader {
  readonly homepage: () => Promise<StorefrontDocument<HomepageView>>;
  readonly catalog: (
    input: CatalogPageInput,
  ) => Promise<StorefrontDocument<CatalogPageView>>;
  readonly catalogItem: (
    slug: string,
  ) => Promise<StorefrontDocument<CatalogItemView>>;
  readonly search: (
    input: SearchInput,
  ) => Promise<StorefrontDocument<SearchPageView>>;
  readonly content: (
    input: ContentPageInput,
  ) => Promise<StorefrontDocument<ContentPageView>>;
}
```

The returned headers are opaque policy owned by the backend and copied to the Astro response. Cacheable documents omit authoritative availability. Purchase islands start in an honest checking/disabled state and request fresh availability.

## HTTP route organization

Queries use `GET`, except bounded batch or quote operations whose structured inputs require `POST`. Commands use `POST`, `PUT`, or `DELETE`. There is no generic `/commands` endpoint.

### Public catalog and availability

```text
GET  /api/catalog/search
POST /api/catalog/availability
```

Public catalog JSON is added only for a real browser consumer. Astro SSR reads catalog and CMS presentation through `storefront`, not through duplicate HTTP routes.

Search preserves the accepted interface:

```text
GET /api/catalog/search?q=<term>&category=<slug>&collection=<slug>&page=<n>&limit=<n>
```

- `q` is required.
- Pages are 1-based and capped at 100.
- `limit` defaults to 24 and is capped at 48.
- The implementation fetches `limit + 1` and returns `hasNext`; it does not calculate an unnecessary total count.
- Unknown query parameters fail validation.
- Search returns the accepted match source, field, confidence, and ambiguity metadata.

Availability accepts at most 50 requested selections in one body. Each selection is a Variant or Bundle TypeID plus a positive requested quantity and a caller correlation key. The response returns only whether that requested selection is currently sellable and the server check time. It never exposes raw inventory quantity. Availability is advisory; Checkout revalidates and reserves all commercial truth atomically.

Search and live availability remain `private, no-store` under the accepted current contracts. A future stock-free public catalog response may use semantic edge tags when a demonstrated browser consumer needs it.

### Checkout

```text
POST /api/checkout/quote
POST /api/checkout/orders
POST /api/checkout/orders/:orderId/switch-to-bank-transfer
```

A quote recalculates the submitted Cart intent without storing a Cart or server checkout draft. It returns integer-MNT lines, Discount Adjustments, Delivery Option and fee, total, and an opaque commercial fingerprint.

Order placement submits the Cart intent, recipient facts, selected Payment method, and the displayed fingerprint. The server recalculates all facts and rejects any commercial change with the current structured quote, even when the new result is cheaper. The fingerprint is only a comparison aid and never makes browser values authoritative.

`POST /api/checkout/orders` requires an `Idempotency-Key` header. The browser generates one key per deliberate submit and retains it across transport retries. The kernel hashes the normalized command. The same key and hash return the original result; the same key with another hash returns an idempotency conflict.

Successful anonymous placement returns the Order summary, provider customer action when needed, Guest Tracking Link, and a separate short-lived Order Action token when an unconfirmed automated Payment may switch to bank transfer. The Order Action token:

- authorizes only that switch on that Order and Payment;
- is sent in a header rather than a URL;
- expires no later than the automated-Payment deadline;
- cannot read tracking, Customer history, or perform cancellation or confirmation;
- is unnecessary when an authenticated Customer owns the Order.

The Guest Tracking Link remains strictly read-only and cannot be reused as mutation authority.

### Customer and guest access

```text
ALL /api/auth/customer/*
GET /api/customer/orders
GET /api/customer/orders/:orderId
GET /api/tracking/:token
```

Customer routes derive authority from the Customer Better Auth session. Guest tracking resolves one non-recoverably stored bearer capability and returns one Order projection. Tracking responses are `private, no-store`, `noindex`, and `Referrer-Policy: no-referrer`; the page includes no third-party resources that could receive its URL.

### Staff Admin

```text
ALL /api/auth/staff/*

GET /api/admin/overview
GET /api/admin/orders
GET /api/admin/orders/:orderId
GET /api/admin/products
GET /api/admin/products/:productId
GET /api/admin/bundles
GET /api/admin/bundles/:bundleId
GET /api/admin/inventory
GET /api/admin/discounts
GET /api/admin/content/:kind
GET /api/admin/staff
GET /api/admin/audit

POST /api/admin/products
PUT  /api/admin/products/:productId
POST /api/admin/products/:productId/publish
POST /api/admin/products/:productId/archive
POST /api/admin/products/:productId/reactivate
POST /api/admin/products/:productId/variants/:variantId/reactivate
POST /api/admin/bundles
PUT  /api/admin/bundles/:bundleId
POST /api/admin/bundles/:bundleId/publish
POST /api/admin/bundles/:bundleId/archive
POST /api/admin/bundles/:bundleId/reactivate
POST /api/admin/discounts
PUT  /api/admin/discounts/:discountId
POST /api/admin/discounts/:discountId/activate
POST /api/admin/discounts/:discountId/deactivate
POST /api/admin/inventory/:variantId/adjust
POST /api/admin/orders/:orderId/accept-cod
POST /api/admin/orders/:orderId/cancel
POST /api/admin/orders/:orderId/complete
POST /api/admin/fulfillments/:fulfillmentId/start
POST /api/admin/fulfillments/:fulfillmentId/mark-ready
POST /api/admin/fulfillments/:fulfillmentId/hand-off
POST /api/admin/fulfillments/:fulfillmentId/delivery-failed
POST /api/admin/fulfillments/:fulfillmentId/returned
POST /api/admin/fulfillments/:fulfillmentId/picked-up
POST /api/admin/fulfillments/:fulfillmentId/complete
POST /api/admin/payments/:paymentId/confirm
POST /api/admin/payments/:paymentId/reject
POST /api/admin/payments/:paymentId/refunds
PUT  /api/admin/content/:kind/draft
POST /api/admin/content/:kind/publish
POST /api/admin/media
POST /api/admin/staff/:staffId/approve
POST /api/admin/staff/:staffId/change-role
POST /api/admin/staff/:staffId/revoke
DELETE /api/admin/staff/:staffId
POST /api/admin/telegram/enrollment
DELETE /api/admin/telegram/enrollment
```

Static intention-revealing paths preserve narrow Eden inputs and errors. The command boundary still checks current state and rejects a Delivery transition on Pickup or the inverse.

Admin collections use simple 1-based numbered pages, bounded page sizes, deterministic ordering, `hasNext`, and no unnecessary totals. This is sufficient at Target Store scale and easier to debug than cursor machinery.

Every Admin response is `private, no-store`. Staff session middleware derives the Staff Member and role; route bodies cannot supply actor identity, role, or permissions. Owner-only Staff/auth changes and Owner-or-Manager financial actions are enforced again at the shared command seam. Final-Owner protection, session deletion, Telegram revocation, state predicates, and Audit Events remain inside the backend.

Ordinary Catalog, settings, and CMS writes use last-write-wins. The approved D1 schema removed general optimistic Revision columns, so these routes do not accept `expectedRevision`, `If-Match`, or a synthetic replacement. Consequential Order, Payment, inventory, Fulfillment, and Staff commands remain safe through named transitions, conditional D1 updates, uniqueness, atomic batches, immutable entries, and idempotency where transport retry is plausible.

### Provider callbacks

```text
POST /api/callbacks/automated-payment
POST /api/callbacks/telegram
```

Each Store has at most one statically registered automated-payment adapter, so the path does not accept a caller-selected provider. Callback processing authenticates and parses provider evidence, validates canonical references and TypeIDs, resolves Store-local state, and invokes the same private commerce command used by Admin or background work.

Provider event IDs and Telegram update/action IDs supply scoped idempotency where they can cause a business effect. Duplicate authenticated evidence returns the provider-appropriate already-processed acknowledgement. Invalid signatures are rejected; temporary infrastructure failure returns a retryable provider response. Callback responses are always `no-store`.

## Auth integration and actor ownership

The backend constructs and mounts separate Staff and Customer Better Auth instances at the fixed paths above. Their tables, cookies, secrets, KV prefixes, and session rules remain isolated.

Route middleware derives one internal actor from authenticated evidence:

```ts
export type CommandActor =
  | StaffActor
  | CustomerActor
  | ProviderActor
  | TelegramActor
  | SystemActor
  | AnonymousCheckoutActor;
```

This type is private to the backend. No public DTO accepts it. Google proves a Staff email but does not grant Store authority; Customer Auth cannot authorize Admin; provider evidence cannot choose a Staff actor; Telegram rechecks the current Staff binding and role before a command.

## Background work

Background work is direct and store-local rather than HTTP:

```ts
export interface StoreBackground {
  readonly scheduled: (input: {
    readonly scheduledAt: number;
    readonly cron: string;
  }) => Promise<void>;
  readonly workflow: StoreWorkflowEntrypoint;
}
```

Cron accepts only configured bounded reconciliation/expiry work. It cannot carry an arbitrary command or Store selector. Workflow steps call the same private idempotent commands used by HTTP handlers, while D1 remains commerce truth. Workflow state coordinates retries only.

`src/fetch.ts` owns HTTP dispatch. The generated Store deployment entry owns the platform wiring that exports Cron and Workflow handlers and delegates to `store.background`; it must not add another application interface.

## Schema and validation ownership

Elysia route modules own TypeBox schemas for HTTP params, query, headers, bodies, bounded arrays/strings, and response status shapes. Unknown input keys fail. TypeBox adapts transport data; it does not become a second commerce model.

Valibot owns complete shared documents and values used outside HTTP: TanStack Form inputs, CMS/Theme documents, Personalization, immutable JSON snapshots, normalization, and persistence read validation. A complete document has one canonical Valibot definition rather than manually duplicated TypeBox and Valibot schemas.

Application TypeIDs serialize as canonical plain strings. Every external and persistence value is parsed with `fromString(value, expectedPrefix)` before entering typed application code. Wrong-prefix, malformed, or non-canonical IDs fail validation. Store identity is not encoded in an ID. No unchecked cast or type assertion bridges this seam.

Money is always a non-negative integer MNT amount. Timestamps are UTC Unix milliseconds. Pagination, quantities, strings, arrays, file size/type, and idempotency keys have explicit platform bounds.

## Response and error contract

Successful queries and commands return route-specific DTOs. Every non-success response uses one envelope:

```ts
export interface ApiErrorEnvelope {
  readonly error: {
    readonly code:
      | "unauthorized"
      | "forbidden"
      | "not_found"
      | "validation"
      | "conflict"
      | "rate_limited"
      | "unavailable"
      | "internal";
    readonly message: string;
    readonly details?: ErrorDetails;
  };
}
```

- `400` is reserved for malformed protocol/query syntax where applicable.
- `401` means authentication or a required narrow capability is absent or invalid.
- `403` means authenticated authority lacks the operation.
- `404` does not reveal inaccessible Store-local records.
- `409` carries typed state, idempotency, or changed-checkout conflict details.
- `422` carries field-addressable validation details.
- `429` carries a bounded retry time.
- `503` represents a temporary owned/external dependency outage when retry is safe.
- `500` hides internal details and records server diagnostics without direct PII.

Error details are a closed JSON-safe union, not `unknown`, stack traces, database errors, or provider payloads. All error responses are `no-store`.

An identical idempotent replay returns the original successful status and DTO. An already-resolved transition with the same intended outcome may return current success; an incompatible current state returns a typed conflict. Infrastructure exceptions never become successful domain results.

## Eden callers

The browser uses one same-origin Eden client inferred from the complete Elysia app:

```ts
import { treaty } from "@elysiajs/eden";
import type { StoreApi } from "@/store";

export const createBrowserApi = (origin: string) =>
  treaty<StoreApi>(origin, {
    fetch: { credentials: "include" },
  }).api;
```

The browser initializes this with `window.location.origin`. There is no Store header and no server-side localhost fallback. Astro SSR uses `store.storefront` instead. TanStack Query passes its abort signal through Eden for search and other replaceable reads.

Mutations invalidate shared query keys after success; clients do not patch server truth directly. Credential forms remain outside local draft persistence.

## Cache directives

The backend owns cache classification, and route handlers cannot opt out ad hoc:

- anonymous stock-free storefront HTML may receive long Cloudflare edge caching and semantic tags;
- search and autocomplete are currently `private, no-store`;
- live availability is `private, no-store`;
- Checkout, Customer, tracking, Payment, Order, inventory truth, auth, callbacks, preview, and all Admin routes are `private, no-store`;
- cacheable responses never set cookies or vary by session, Staff, Customer, or Cart;
- publication commits D1 first and then performs the accepted targeted purge, including its partial-outcome reporting;
- cached structured data omits live availability.

The cached-SSR prototype ticket owns proof of the edge pipeline. This interface contract prevents the HTTP and SSR seams from bypassing that policy.

## Hidden implementation and locality

The Store backend hides:

- Drizzle statements, the one FTS raw-SQL repository, and D1 batch ordering;
- TypeID generation and persistence codecs;
- Product, Bundle, Discount, Checkout, Order, Payment, inventory, and Fulfillment invariants;
- Bundle demand expansion and atomic reservation/consume/release behavior;
- Commercial Snapshots and financial/inventory entries;
- idempotency hashes, result replay, state predicates, and compact Audit Events;
- Staff role checks, final-Owner protection, session revocation, and Telegram authority;
- Customer linking and non-recoverable Guest Tracking capabilities;
- Better Auth construction and namespace isolation;
- search normalization, FTS ranking, and SKU lookup;
- R2 keys and media authorization;
- cache headers, tags, purge, and no-store enforcement;
- provider evidence translation and acknowledgement mapping;
- Workflow creation and retry coordination.

HTTP handlers remain thin transport adapters: validate, derive authority, invoke the private query or command, serialize, and map the response. Astro pages render returned presentation documents. External adapters translate evidence. None of those callers can reach persistence or redefine commerce truth.

## Explicit exclusions

V1 does not add:

- a central API or shared multi-Store Worker;
- caller-selected Store identity;
- a public generic command/query endpoint;
- an exported repository or storage-neutral commerce layer;
- an SDK wrapper around Eden;
- a runtime provider registry or extension mechanism;
- generalized optimistic revisions after the schema decision removed them;
- cursor pagination, event sourcing, an outbox, or a D1 job runner;
- a self-HTTP data path for Astro SSR;
- raw public stock quantities;
- shared caching for private or commercial-truth responses.
