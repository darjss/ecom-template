# Cached SSR and authoritative live-stock contract

**Decision status:** Accepted for Wayfinder issue #25.

This contract serves small Stores that usually handle 10–20 Orders per day, should remain comfortable around 50 Orders per day, and may have audiences around 50,000 followers. It deliberately uses one Store Worker, D1, Cloudflare's ordinary CDN cache, one batched live endpoint, and synchronous tag purge. It adds no cache service, invalidation graph, queue, Durable Object, event stream, distributed lock, or cache observability system.

## Decision

Anonymous catalog and CMS pages are Astro SSR responses cached in Cloudflare's CDN in front of Worker execution. Cached HTML contains complete public presentation but no stock quantity, sellability, reservation state, or stock-derived structured data. A stable Solid purchase island starts disabled, fetches current Variant availability from one batched `private, no-store` endpoint, and enables purchasing only after fresh truth arrives. Checkout independently revalidates current commercial and inventory truth and never trusts the island or cached HTML.

Use the live Solid island rather than an Astro server island for the purchase boundary. A deferred Astro server island can return fresh HTML with an honest fallback, but Variant changes, quantity controls, batched requests, stale state, and checkout feedback already require client state. Making each control a server-island request adds a second interaction model without improving authority. Astro SSR continues to read D1 directly on HTML cache misses; it does not call the Store's HTTP API.

Cloudflare Cache Tags are the only invalidation mechanism. Consequential Admin publication or Catalog commands commit D1 first, then synchronously call Cloudflare's purge-by-tag API. Success means both completed. A purge failure after commit returns an explicit `published_but_purge_failed` or `saved_but_purge_failed` outcome for a human retry. V1 has no automatic retry worker or rollback.

## Public HTML cache boundary

Public HTML is cacheable only when all of these are true:

- the method is `GET` or `HEAD`;
- the route is on an explicit public Storefront allowlist;
- the response is successful HTML;
- the request is anonymous and has no preview mode;
- the response has no `Set-Cookie` header.

Starting headers are:

```http
Cache-Control: public, max-age=0, must-revalidate
Cloudflare-CDN-Cache-Control: public, max-age=1209600
Cache-Tag: store-shell, product:<canonical-product-id>
```

The browser rechecks at the edge. Cloudflare may retain the response for two weeks, while publication and Catalog writes normally refresh it by tag. Do not add `stale-while-revalidate` in v1: after the purge call succeeds, an extra stale window is unnecessary and makes publication semantics less clear.

Use Cloudflare's default cache key. It already includes scheme, host, path, and query. Each Store has one production host and separate Worker, so no Store identifier belongs in the key. Canonical HTML routes redirect trailing-slash variants, unknown query parameters, and noncanonical filter ordering before a response can be cached. Do not introduce a Worker custom cache key or legacy Cache API.

Canonical links and JSON-LD derive from the configured Production Store domain and canonical route. Product structured data may include current published name, description, image, currency, and non-stock price presentation. It omits `availability`, `inventoryLevel`, and every stock-derived offer assertion.

## Tags and purge

Keep tags broad and understandable:

- `store-shell` for identity, announcement, primary navigation, and footer changes;
- `homepage` for Homepage publication;
- `catalog` for listing, search representation, Product rails, Category, and Collection pages;
- `product:<id>` for one Product or Bundle page;
- `policy:<id>` for one Policy page.

A response may carry more than one tag. Commands know their direct broad tags; there is no persisted dependency graph. Product publication purges `product:<id>` and `catalog`. A shell change purges `store-shell`. A Homepage publication purges `homepage`; if its displayed Catalog references changed, it also purges `catalog`. At this Store size, broad Catalog purge is preferable to maintaining exact fan-out.

Purge uses the Store's fixed Cloudflare zone and a least-privilege `Cache Purge` API token held as a Worker secret. The endpoint never accepts a caller-provided zone, host, tag, or token. Record the command outcome and returned Cloudflare request identifier in ordinary structured logs and the command response. No dashboard, metrics pipeline, or purge ledger is required.

A deployed prototype emitted and consumed `Cache-Tag: wf25-product`, produced `CF-Cache-Status: MISS` followed by `HIT`, and remained stale after D1 Catalog mutation. The current Wrangler OAuth credential could list the zone but received HTTP 401 for purge because it lacks Cache Purge permission. That is a useful fail-closed proof: implementation and provisioning must require the dedicated permission, and must never report publication success when it is absent. Successful tag purge remains a live implementation gate once that scoped token exists.

## Live availability

Use one endpoint:

```http
GET /api/catalog/availability?variantIds=<id>,<id>,...
Cache-Control: private, no-store
```

The request accepts unique canonical Variant IDs, has a small fixed batch limit, and returns only the current purchase-shell facts for those IDs: sellable boolean, available-to-sell quantity when the UI genuinely needs it, current unit price, and a server timestamp. Bundle availability is derived from current component demand in the same authoritative query seam. Unknown, unpublished, or inaccessible Variants are omitted rather than described from cached presentation.

The Solid island has four visible states:

1. `checking`: neutral fallback, quantity and purchase disabled;
2. `ready`: current Variant price and availability shown, purchase enabled only within current bounds;
3. `unavailable`: fresh truth says it cannot be purchased, purchase disabled;
4. `stale`: request failed or checkout rejected the quote, stale facts may remain visible but purchase is disabled.

Variant changes abort obsolete requests and start a fresh check. One mounted product rail or page batches all visible Variant IDs rather than issuing one request per control. Search remains `private, no-store` in v1 and returns non-stock Product presentation; a result's purchase shell uses the same batched availability endpoint only when displayed.

Do not put live availability in cached HTML, public search cache, KV, client storage, or a second inventory projection. D1 commerce and inventory tables remain authoritative.

## Checkout boundary

The browser submits identities, selected Options, Personalizations, quantity, and its quoted values. The checkout command reloads the current published Product and Variant, price, Bundle component demand, inventory balance and reservations, Discount validity, Delivery quote inputs, and required Personalization definitions. It calculates the authoritative quote and atomically reserves inventory when placement succeeds.

A stale quote returns a typed conflict such as `price_changed`, `selection_changed`, `unavailable`, or `insufficient_stock`, together with the current safe correction needed by the UI. It does not silently accept stale price or decrement inventory based on client availability. Idempotent placement and atomic reservation remain owned by the accepted commerce contract.

## Never shared-cache

The middleware is deny-first. Anything not matched by the narrow public Storefront allowlist receives `Cache-Control: private, no-store`; any downstream Cloudflare cache header or cache tag is removed. This includes:

- Cart and Checkout;
- Payment, Order, Customer, and Guest Tracking Link responses;
- live availability and inventory truth;
- Better Auth and every response that reads or writes a session;
- Merchant Admin, CMS Draft, and preview-sensitive rendering;
- provider callbacks, Telegram actions, scheduled endpoints, and internal commands;
- error, redirect, validation, and authorization responses.

Static hashed assets and public media use their separate immutable asset policy. Public JSON is added to the allowlist only when a real consumer and explicit non-stock representation justify it.

## Prototype evidence

The disposable prototype ran as an Astro 7 Worker on `wf25-cache.darjs.dev` with real D1, KV session bindings, Cloudflare CDN caching, a Solid island, a deferred Astro server island, Elysia endpoints, and no mocked application service.

From Cloudflare's Ulaanbaatar colo (`CF-Ray: ...-ULN`):

- cold HTML, 10 unique cache keys: p75 1,389 ms, p95 1,697 ms;
- warm HTML, 10 requests after priming: p75 42 ms, p95 51 ms;
- batched live availability, 30 requests: p50 203 ms, p75 212 ms, p95 312 ms, one 944 ms tail.

Warm HTML met the accepted p75 below 50 ms and p95 below 100 ms target within sampling noise. Cold rendering is intentionally reported separately. The earlier 150 ms live-availability target was not credible from this real ULN-to-D1 path. V1 accepts a 350 ms p95 live target, keeps the checking fallback honest, and records tails during implementation proof. Do not add KV stock, a Durable Object, or distributed replication to chase 150 ms. Revisit only if implementation on the final schema materially exceeds 350 ms p95 under the same proof or merchant evidence shows conversion harm.

The proof also established:

- cached HTML stayed on Catalog version 1 after D1 moved to version 2;
- the live Solid island and deferred server island both showed current zero stock while cached HTML stayed reusable;
- no stock token or stock-derived JSON-LD appeared in the HTML;
- no-store search returned the new Product name while cached Product HTML retained the old name;
- changing a Variant from 31,900 MNT to 32,900 MNT after hydration caused checkout to reject the stale quote;
- a browser network failure moved the purchase shell to stale and disabled purchase;
- public HTML had no `Set-Cookie` header;
- availability, search, checkout, auth, Cart, Customer, tracking, Payment, Order, inventory, preview, and Admin paths all returned `private, no-store`; Cloudflare reported `BYPASS` where applicable.

The prototype implementation commits are `5de4f86`, `e1c16d0`, and `933cef0`. They are evidence only and are removed from the accepted branch tip rather than becoming production implementation.

## Implementation gates

Before production acceptance:

1. prove a successful purge-by-tag with the provisioned least-privilege token, then prove the next canonical request is a miss and contains the committed publication;
2. inspect cached HTML and JSON-LD for every reference Product/Bundle availability edge case;
3. mutate inventory and price behind warm HTML and verify the live island and checkout conflict paths in a real browser;
4. run the deny-first response matrix against every implemented sensitive route;
5. measure cold HTML, warm HTML, and batched availability from ULN on the final Worker and D1 schema;
6. verify canonical redirects prevent duplicate cache keys and no cacheable response sets a cookie.
