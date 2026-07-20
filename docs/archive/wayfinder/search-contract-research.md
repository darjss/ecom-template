# Wayfinder issue #19 — deterministic search contract

## Decision

Wayfinder v1 uses conventional, store-scoped D1 search for published products. The contract supports product-first results, bounded category/collection shortcuts, exact SKU lookup, and a tiered Mongolian Cyrillic-to-Latin recovery path. It does not use maintained Latin aliases, AI, Vectorize, semantic expansion, or unbounded fuzzy search.

This is an application contract, not the complete D1 schema owned by #23.

## Architecture comparison

The inspected vit-store v2 revision is **`878c937c3621ab35002e453da563f6ba551d6e86`** (branch `v2`): a global `product-search-global` Durable Object with in-memory MiniSearch, central PostgreSQL loading, and chunked snapshots—not DO SQLite FTS. One DO per Store would scale across Stores, but D1 FTS5 wins for v1 because it preserves one transactional truth and avoids a second consistency domain and remote search hop. The reusable evidence is limited to a document-builder boundary and explicit rebuild/status proof; vit-store's global topology, semantic expansion, and stock-first ranking are not this contract.

Reconsider a D1+DO-derived index only after measured D1 latency, throughput, or size failure against the accepted 10k/real-catalog gate. Until then, the extra consistency domain is not justified.

## Drizzle boundary

Drizzle's FTS5 limitation is real: stable Drizzle has no SQLite virtual-table schema primitive or first-class `MATCH`/`bm25()` helpers ([upstream issue](https://github.com/drizzle-team/drizzle-orm/issues/2046)). Contain it to **one ordered custom SQL migration** for the ordinary/contentful FTS table and **one server-only `catalog-search` repository** for typed parameterized search, projection writes, and rebuild/status diagnostics. Do not declare a fake FTS `sqliteTable`; all dynamic values stay in tagged-template parameters, never `sql.raw()`. Canonical rows, FTS projection, and normalized SKU are built before and written in one D1 `batch()`, whose rollback behavior is documented by Cloudflare ([D1 batch](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)).
## Reconciled choices

| Question | v1 contract | Rejected alternative / reason |
| --- | --- | --- |
| FTS storage | Ordinary/contentful SQLite FTS5 product index | External-content/contentless FTS reduces duplication but makes synchronization or hydration the application's responsibility; avoid that failure mode in the first small conventional catalog. [SQLite FTS5](https://www.sqlite.org/fts5.html#external_content_tables) |
| Search normalization | Keep display/catalog text unchanged. Build versioned search keys with `NFKC → full Unicode case fold → NFC`, map Unicode whitespace and punctuation/separators to spaces, collapse and trim. | NFC-only misses compatibility forms; NFKC must not mutate merchant display text. Unicode defines NFC/NFKC in [UAX #15](https://www.unicode.org/reports/tr15/) and case folding in [UTR #21](https://www.unicode.org/reports/tr21/). |
| Cyrillic/Latin | No maintained aliases. Search native Cyrillic first, then deterministic strict transliteration, then bounded basic ASCII fallback; return source/confidence and multiple low-confidence basic candidates rather than a false winner. | Silent script merging and arbitrary alias administration are replaced by a versioned, prototype-validated tiered contract. Preserve distinctions such as ө/о, ү/у, and ё/е in native matching. [Unicode Mongolian](https://www.unicode.org/mwg/mwg3docs/mwg3-2UnicodeV12MongolianBlockR.pdf), [CLDR transliteration guidance](https://cldr.unicode.org/index/cldr-spec/transliteration-guidelines), [Mongolian dictionary](https://toli.gov.mn/r). |
| Pagination | Numbered, 1-based pages for the shareable storefront URL (`page`, default 1, max 100), bounded page size (recommend 24, hard max 48). | Opaque keyset cursors are more robust for deep/live-changing result sets but add URL/debugging complexity unnecessary for the initial bounded UX. Revisit if measured catalog scale makes page 100 or counts costly. |
| SKU separators | Natural-language fields never compact punctuation. SKU lookup has a separately materialized compact key: compatibility-normalized, case-folded, trimmed, removing only ASCII `-`, ASCII `/`, and Unicode whitespace; no other character is removed. Exact compact equality ranks first. | FTS tokenization alone is not exact SKU search; the physical lookup shape remains #23 scope. |
| Caching | Search API and autocomplete are `private, no-store`; canonical+FTS+SKU updates are immediately visible after the transaction. | Public caching belongs to the shared-kernel owning ticket and requires inventory-aware invalidation or omitting live availability. |

The contentful-index choice duplicates searchable text, but keeps ranking, snippets, hydration, and repair straightforward. Use FTS5 `unicode61`, application-normalized values, and a small prefix index (initial hypothesis `prefix='2 3'`); do not use `porter` for Mongolian or `trigram` as the default. D1 documents FTS5 support ([SQL statements](https://developers.cloudflare.com/d1/sql-api/sql-statements/)); SQLite documents [tokenizers](https://www.sqlite.org/fts5.html#tokenizers), [prefix indexes](https://www.sqlite.org/fts5.html#prefix_indexes), and [trigram](https://www.sqlite.org/fts5.html#the_trigram_tokenizer).

## Indexed entities and fields

- **Products (one public result per product):** weighted searchable title, brand text metadata, slug, subtitle/short description, searchable description, normalized tags, category names, collection names, and useful variant display names/options. This does not decide a first-class Brand aggregate, admin workflow, or Brand page.
- **Variants:** SKU metadata is separately indexed; matching a variant returns its parent product. Do not expose unpublished variant data.
- **Shortcuts:** published categories and collections use lightweight indexed lookups. Return `kind`, `id`, `label`, `slug`, and canonical URL.
- Only published, non-deleted, public products and shortcuts enter the public index. Public results hydrate/include the authoritative live sellable presentation boolean at request time, never in FTS; never expose authoritative stock.

Product result fields are `id`, `slug`, `name`, subtitle/short description, primary image URL/alt, lowest display price in MNT, `priceFrom`, and a public/available presentation flag. Canonical tables remain the source of truth; FTS IDs are only lookup keys.

## Matching and ranking

The server applies the same versioned normalization to indexed values and queries. Empty normalized queries are invalid. `unicode61` provides ordinary Unicode word/prefix tokenization; punctuation acts as a separator in application search keys. Exact SKU is checked first and is never fuzzy. This document defines version **`strict-mn-v2-tiered-basic-v2`** and runs native → strict → basic. Its complete pinned mapping is:

```text
strict:       а a  б b  в v  г g  д d  е e  ё yo  ж j  з z  и i  й y
              к k  л l  м m  н n  о o  ө ö  п p  р r  с s  т t  у u
              ү ü  ф f  х kh  ц ts  ч ch  ш sh  щ shch  ъ ""  ы y  ь ""
              э e  ю yu  я ya
strict-ASCII: same, except ө oe and ү ue
basic (ordered alternatives): ө [o,u], ү [u,i], ё [yo,eo], й [i,y],
                              х [h,kh], ц [c,ts]
```

Basic alternatives expand left-to-right, preserve order, deduplicate by first occurrence, and cap at 8 variants per normalized token. Results report matched source and confidence; ambiguous low-confidence stages return all bounded candidates in deterministic order and never select a false winner. The displayed query is unchanged. Mapping changes require a new version, reindex, and proof.

Search fields are weighted title and brand text metadata, then category/tags, then description. Relevance is primary. Authoritative live sellable availability breaks ties, but raw stock count is neither exposed nor indexed/ranked; bundle/variant availability truth remains owned by commerce/inventory contracts.

The fuzzy fallback is disabled until a 10k-product proof passes all thresholds: at least 95% expected typo recovery, zero negative-fixture false positives, and Mongolia warm p95 ≤500ms. After that gate, it runs only after native/strict/basic stages are empty, for tokens ≥4, with fuzzy forms native → strict → basic, precomputed deletion keys for title/brand/category only, max 80 deletion keys, 500 verified candidates, and at most 20 product results; basic-stage product results are also capped at 20. Only candidates with verified Damerau-Levenshtein edit distance exactly 1 are accepted; exact/native/transliteration stages handle distance 0. Fuzzy results are low confidence and never match SKU, description, IDs, prices, or semantic expansions.

Use parameterized FTS `MATCH`, weighted `bm25()` (lower is better), and deterministic total ordering: selected match tier/relevance first; authoritative live sellable boolean descending; merchandising position ascending with null last; normalized name ascending; stable product ID ascending. For fuzzy matches, edit distance and field relevance precede those terminal tie-breakers. Availability is request-time live commerce/inventory truth, never FTS projection or raw count. Products precede bounded category/collection shortcuts. Escape/build FTS terms server-side; never interpolate raw FTS syntax.

## SKU contract

Materialize a unique/indexed SKU lookup keyed by `store_id + sku_compact` and retain the canonical SKU for display. SKU normalization uses the search compatibility/case pipeline, then removes only ASCII `-`, ASCII `/`, and Unicode whitespace; no other character is removed. `HV-Ө-001`, `hv-ө-001`, and `HVӨ001` therefore match; compact joining is never applied to natural-language fields. Exact lookup precedes FTS and returns the canonical parent product.

## URL and API semantics

Canonical storefront navigation is:

`GET /search?q=<term>&category=<slug>&collection=<slug>&page=<n>`

`q` is required, URL-encoded, trimmed/normalized server-side, and preserved in user-facing spelling. Category and collection filters are optional and composable canonical slugs. API unknown parameters return 400; HTML strips unknown parameters via canonical redirect. Page defaults to 1, max 100; canonical HTML page size defaults to 24. The URL is shareable, SSR-renderable, and restored by browser history. Autocomplete is ephemeral: debounce roughly 150–250ms, start at two characters, return at most six products and three shortcuts, do not change history, and navigate only on Enter/selection/“see all.” Pass Solid Query's `signal` to fetch so obsolete requests are cancelled ([TanStack cancellation](https://tanstack.com/query/latest/docs/framework/solid/guides/query-cancellation)).

Recommended internal endpoint: `GET /api/catalog/search` with `q`, `category`, `collection`, `page`, and API-only `limit`. `limit` is an integer 1..48, default 24; it is the effective `products.pageSize`, and the query fetches `limit + 1`. Non-default `limit` is not canonical HTML state but enters any future cache key. Each item carries the canonical product presentation fields listed above plus only the four search metadata fields `matchedSource`, `matchedField`, `confidence`, and response-level `ambiguity` shown below. Response:

```json
{
  "query": "user spelling",
  "normalizedQuery": "server key",
  "products": {
    "items": [{
      "id": "product-id", "slug": "product-slug", "name": "...",
      "matchedSource": "native", "matchedField": "title", "confidence": "high"
    }],
    "page": 1, "pageSize": 24, "hasNext": false
  },
  "ambiguity": null,
  "shortcuts": { "categories": [], "collections": [] }
}
```

`matchedSource` is one of `sku_exact`, `native`, `strict_transliteration`, `basic_fallback`, or `fuzzy_fallback`; `matchedField` is one of `sku`, `title`, `brand`, `category/tags`, or `description`; confidence is `exact`, `high`, `medium`, or `low`. `ambiguity` is exactly `null | "multiple_low_confidence"`. When non-null, the returned bounded `products.items` are the candidates in deterministic order; no separate winner, duplicate IDs, or object hierarchy is introduced. Canonical product presentation remains owned by the product contract/#23 and is not expanded here. Use the repository's stable error envelope; API unknown parameters and invalid input return 400. HTML strips unknown parameters via canonical redirect. Canonical HTML uses `page` with default page size 24. Prefer `hasNext` via `limit + 1` over exact totals.

## Filters, indexes, and consistency seam

Apply publication/visibility and category/collection relationship filters in the same query. Add ordinary B-tree indexes for store scope, visibility, relation keys, compact SKU, and proven filter/sort predicates. Validate actual plans with `EXPLAIN QUERY PLAN`; D1 recommends indexes and query-plan inspection ([indexes](https://developers.cloudflare.com/d1/best-practices/use-indexes/)).

The initial write path must update canonical product/variant/category/collection/tag/brand-text rows, contentful FTS rows, and normalized SKU atomically in one D1 transaction/batch; successful updates are immediately visible. The fuzzy deletion-key projection is not initial functional v1 machinery: create its storage, backfill, and rebuild only if the 10k promotion gate passes. Disposable proof may use it without making it part of production v1. D1 `batch()` runs prepared statements sequentially and rolls back on failure ([D1 Database API](https://developers.cloudflare.com/d1/worker-api/d1-database/)). Publish only after indexing succeeds; provide an explicit rebuild/backfill/repair operation for recovery, not normal consistency.

Search and API responses are normatively `private, no-store`. Public caching is deferred to the shared-kernel owning ticket: a cacheable representation must either omit live availability or use inventory-aware versioning/invalidation; catalog version alone is insufficient. Never cache private, cart, customer, or authoritative stock data.

## Prototype evidence and proof boundary

The throwaway prototype on published branch `prototype/issue-19-search-transliteration`, immutable commit `4f9ff9773ce0f85cca768da99ed461bfdacafd0e`, used the same real D1/Worker shape with 40 synthetic products. Its deployed review URL is https://wf19-search-transliteration-worker.darjs.workers.dev; it remains deployed pending explicit cleanup and is not production code.

The real remote harness passed **23/23 assertions**. One staged, parameterized D1 statement/binding call covered exact SKU, native, strict, basic, and dormant fuzzy stages with at most 84 parameters (80 deletion keys plus tier values, below D1's 100-parameter limit). The deletion-key plan used a covering index for `deletion_key IN (...)`; the prototype had 3,490 deletion rows, 1,386 distinct keys, and a 724,992-byte database. Warm requests from Mongolia measured normal-tier Worker p50/p95 **281/287ms** and dormant fuzzy-path p50/p95 **283/288ms**, with one binding call in each case. Fuzzy candidates remained edit-distance verified, bounded, low-confidence, and ambiguous where appropriate; exact SKU stayed unique, availability never outranked title relevance, and raw stock was not exposed.

These measurements validate the contract shape, not production scale. This document is the single normative authority for the transliteration mapping; the future production shared module implements it. Mapping changes require a new contract version, reindex, and proof. The prototype used locale lowercase (`toLocaleLowerCase("mn-MN")`), so it does not prove full Unicode case-fold equivalence; that remains an implementation proof requirement. At 10k products and with a real catalog, repeat false-positive/collision and query-plan proof, deletion-key/DB-size growth, p50/p95 cold/warm latency, write-to-visible freshness, and availability/bundle correctness. Fuzzy promotion remains blocked unless all three thresholds pass.

## Proof contract

Use a fictional, synthetic catalog—not merchant fixture data—in local/sandbox D1. At the expected v1 upper bound plus a larger stress size, prove with the real migration and index path:

- native Cyrillic, strict transliteration, bounded basic ASCII alternatives, source/confidence reporting, ambiguity exposure, punctuation-as-space, the named mapping version, and preservation of ё/е, ө/о, ү/у distinctions; full Unicode case-fold equivalence must be proved separately;
- exact and compact SKU behavior, no natural-language compaction, product-first ordering, deterministic page/tie behavior, filters, unpublished exclusion, and bounded no-results recovery;
- index update visibility after one successful transaction, rebuild/repair, no stale FTS rows, no cross-store rows, and no stock leakage;
- FTS query plans with no normal-path unbounded scan, result bounds, FTS/database size, and representative p50/p95 API timings;
- `curl -i` API shape, 400 cases, and `private, no-store` headers; `agent-browser` desktop/mobile behavior for expand, debounce/cancellation, Enter, shortcut/product navigation, Escape, refresh/share URL, and back/forward.

Run repository checks only when directly applicable to this documentation artifact; the implementation proof later must run `pnpm typecheck && pnpm lint && pnpm build` plus real local migration/API/browser verification.

## Deferred inputs and proof work

- #23 owns the physical product/variant/SKU schema and the final canonical product presentation; Brand aggregate/admin/page design remains out of scope.
- Commerce/inventory owns the authoritative live sellable boolean and bundle/variant availability computation; search must hydrate it at request time rather than project it into FTS.
- The implementation must run the 10k/real-catalog fuzzy promotion gate, full Unicode case-fold proof, deletion-key collision/size proof, and cache/inventory freshness proof. Future public caching belongs to the shared-kernel owning ticket; initial search remains `private, no-store`.
- Reconsider D1+DO-derived indexing only after measured D1 latency, throughput, or size failure against the accepted gate.
