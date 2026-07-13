# Issue #19 transliteration prototype verdict — pass 5

## Recommendation

Founder-approved resilience is viable as a bounded prototype, with one important production deferral: keep fuzzy fallback visibly low-confidence and expose candidates; do not make it a silent typo correction. Normal tiered search remains under the 500ms warm target. Fuzzy fallback does not meet that target on this prototype and should remain an explicitly slower recovery path until production-scale evidence exists.

## Search document and metadata

The same remote D1 was migrated/reseeded with 40 synthetic products carrying:

- five synthetic brands (`Талын Од`, `Хөх Тэнгэр`, `Алтан Өргөө`, `Цагаан Сар`, `Нүүдэл`)
- existing categories/tags
- synthetic descriptions
- synthetic `available` boolean and merchandising position

A resilient ordinary/contentful FTS5 document indexes title, brand, category, tags, and description representations. Weights favor title, then brand, category/tags, and description. Product fields are returned with `matched_field` (`sku`, `title`, `brand`, `category/tags`, or `description`) so brand/category hits explain themselves. Category has an ordinary indexed `products.category` seam and `/products?category=...` filter; this does not imply a production Brand aggregate/admin/page model.

Availability is only an equal-relevance tie-break (`available DESC`, then merchandising position, then stable ID). The prototype exposes only `available` presentation, never stock quantities. Production availability remains authoritative live inventory/bundle truth, not FTS truth.

## Tiered and fuzzy behavior

Normal tiered stage order is unchanged: exact SKU/native, strict transliteration, bounded basic fallback. It remains one parameterized SQL statement and one D1 binding call. Only when all stages return no useful result does fuzzy fallback run.

Fuzzy policy:

- normalized query tokens must all be at least 4 characters
- Damerau-Levenshtein edit distance 1: missing, extra, substituted, and transposed character cases
- only title, brand, and category search terms participate
- no SKU, description, IDs, prices, or displayed-query rewriting
- candidate term query is bounded to 500 rows; result count is capped at 20
- fuzzy adds one ordinary D1 candidate-binding call, so fuzzy requests report `binding_calls=2`; normal requests report 1
- fuzzy results are `source=fuzzy_fallback`, `confidence=low`, and expose multiple candidates when present
- if fuzzy finds no candidate, the response stays empty/basic-fallback rather than claiming fuzzy success

The fuzzy support table contains only synthetic title/brand/category terms and representations. User input remains bound data; it is never interpolated into SQL or FTS syntax.

## Live deployment

- Worker: `wf19-search-transliteration-worker`
- URL: https://wf19-search-transliteration-worker.darjs.workers.dev
- Deployment version: `463d44e8-f377-42b5-8887-3209bd402f3e`
- D1: `wf19-search-transliteration-d1`, ID `d300867e-ddaf-4e0d-84c8-960ca32158a0`
- Health version: `strict-mn-v2-tiered-basic-v2`
- D1 seed: 40 products; 2,019 rows written; database size 389,120 bytes

## Proof results

Full prior and extended harness command:

```sh
bun run prototypes/search-transliteration/scripts/harness.ts -- --url=https://wf19-search-transliteration-worker.darjs.workers.dev
```

Result: **23/23 tiered assertions passed, 0 failed, 34 multi-result/collision cases across strict/basic/tiered output**. This includes all prior 15 tiered assertions plus brand/category and six typo/negative cases. Exact SKU remained unique and prior ambiguity policy remained unchanged.

Extended cases observed:

- native brand-only `Талын Од`: brand reason, high confidence, 8 brand products
- native category-only `Хувцас`: category/tags reason, high confidence, 8 products
- Cyrillic missing character `ноосн`: fuzzy fallback, two title candidates
- Latin missing character `noosn`: fuzzy fallback, two title candidates
- brand substitution `талин`: fuzzy fallback, eight brand candidates
- category substitution `хувчас`: fuzzy fallback, eight category candidates
- transposition `noosno`: fuzzy fallback, two title candidates
- two-edit negative `ноосм`: empty; no false fuzzy match
- short negative `одр`: empty because the 4-character minimum rejects fuzzy generation
- `өдөр`: title match ranks above the unavailable category/tag match, showing relevance before availability tie-break
- exact SKU samples remain one product with `source=sku_exact`

Fuzzy fallback negative/no-match probes use two bindings (normal one-statement stage plus bounded fuzzy candidate lookup), while ordinary no-match stays empty and does not report a fuzzy result.

## Latency from Mongolia

The harness ran 60 alternating warm normal tiered requests (`odor` / `nooson tsamts`) and 20 alternating warm fuzzy requests (`noosn` / `хувчас`) from this machine in Mongolia.

Normal tiered:

- first network: `296.10ms`
- network p50/p95: `294.25ms` / `302.74ms`
- Worker total p50/p95: `281ms` / `289ms`
- aggregate D1 p50/p95: `281ms` / `289ms`
- binding calls p50/p95: `1` / `1`
- <=500ms warm target: **met**

Fuzzy fallback:

- network p50/p95: `865.94ms` / `1234.47ms`
- Worker total p50/p95: `846ms` / `1219ms`
- aggregate D1 p50/p95: `846ms` / `1219ms`
- binding calls p50/p95: `2` / `2`
- <=500ms warm target: **not met**

Fuzzy timing is explicitly separate because it includes the normal one-statement miss plus the bounded term-candidate D1 call. The 500ms target remains met for normal search only.

## Simple founder CLI

```sh
bun prototypes/search-transliteration/scripts/try-search.ts
bun prototypes/search-transliteration/scripts/try-search.ts 'noosn'
bun prototypes/search-transliteration/scripts/try-search.ts 'талын од'
bun prototypes/search-transliteration/scripts/try-search.ts 'хувцас'
```

The CLI prints matched names/SKUs, brand, category, matched field/reason, availability presentation, source, confidence, ambiguity, network, Worker, D1, and binding-call timing. The list mode fetches deployed products and does not hardcode catalog data.

## Checks and deferred production questions

- Remote migration `0004_search_resilience.sql`, remote seed, deployment, health curl, category/product curl, full harness, and extended CLI matrix completed.
- `wrangler types` completed.
- Narrow strict TypeScript with `--skipLibCheck`: `TypeScript: No errors found`.
- `wrangler deploy --dry-run` completed: 36.85 KiB upload, 8.88 KiB gzip.
- No unit/integration tests added.

Before production, defer decisions on: authoritative inventory/bundle freshness and availability semantics; whether fuzzy should be enabled for every catalog; collision/false-positive budgets from real catalog data; candidate-table/query-plan behavior at scale; and whether brand/category fields need a real domain aggregate. Do not expose prototype synthetic availability as commercial truth.

Cleanup only after explicit instruction:

```sh
wrangler delete wf19-search-transliteration-worker
wrangler d1 delete wf19-search-transliteration-d1
```
