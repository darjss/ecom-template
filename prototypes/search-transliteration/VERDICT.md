# Issue #19 transliteration prototype verdict — pass 6

## Recommendation

The deletion-key fuzzy structure preserves pass-5 semantics and now meets the <=500ms warm target for both normal and fuzzy prototype traffic. Keep fuzzy visibly low-confidence and candidate-exposing; do not treat this 40-product result as production-scale proof.

## Indexed fuzzy design

The same D1 now has `search_deletion_keys`, an ordinary indexed table containing precomputed one-character deletion keys plus the original token for title, brand, and category terms only, across native/strict/basic representations. Seed integrity: 3,490 deletion rows, 1,386 distinct keys, 40 products, database size 724,992 bytes.

Tiered search is one parameterized SQL statement and one D1 binding call. A CTE selects the highest non-empty stage: exact SKU, native FTS, strict FTS, basic FTS, then deletion-key fuzzy candidates. Query deletion keys are generated in memory, deduplicated, and capped at 80; SQL candidate rows are capped at 500; final results are capped at 20. Fuzzy candidates are still verified with Damerau-Levenshtein <=1 before response. Query tokens remain >=4; no SKU/description/ID/price fuzzy matching; displayed query is unchanged; ambiguity exposes multiple candidates.

The SQL binds the deletion keys plus four staged values (SKU/native/strict/basic) and stays below D1’s 100-parameter limit: maximum 84 bound values. User text never becomes SQL or FTS syntax. No fuzzy service, semantic expansion, aliases, AI, Vectorize, Durable Objects, or new resource was added.

## Live deployment

- Worker: `wf19-search-transliteration-worker`
- URL: https://wf19-search-transliteration-worker.darjs.workers.dev
- Deployment version: `2179c37e-22d0-4cc6-b49a-7ed2005bfc6e`
- D1: `wf19-search-transliteration-d1`, ID `d300867e-ddaf-4e0d-84c8-960ca32158a0`
- Health: HTTP 200, `strict-mn-v2-tiered-basic-v2`

## Behavior proof

```sh
bun run prototypes/search-transliteration/scripts/harness.ts -- --url=https://wf19-search-transliteration-worker.darjs.workers.dev
```

Final harness result: **23/23 tiered assertions passed, 0 failed, 34 multi-result/collision cases** across strict/basic/tiered output. This preserves all 23 pass-5 assertions and includes brand/category, typo, negative, exact SKU, and ambiguity cases.

Observed fuzzy cases:

- `noosn`, `ноосн`: two title candidates, low confidence, multiple exposed.
- `талин`: brand-only substitution, multiple brand candidates.
- `хувчас`: category-only substitution, multiple category candidates.
- `noosno`: transposition, two title candidates.
- `ноосм`: two-edit negative, empty.
- `одр`: short-token negative, empty.

Exact SKU remained unique. Native brand/category reasons remained `brand` and `category/tags`. Availability remains only a tie-break after relevance; it does not outrank title relevance and no raw quantities are exposed.

## Index integrity and query-plan evidence

Remote D1 evidence:

```sql
SELECT count(*) FROM products;                       -- 40
SELECT count(*) FROM search_deletion_keys;           -- 3490
SELECT count(DISTINCT deletion_key) ...;             -- 1386
EXPLAIN QUERY PLAN
SELECT ... FROM search_deletion_keys
WHERE deletion_key IN ('noosn','nooson') ...;
```

The plan reported `SEARCH search_deletion_keys USING COVERING INDEX sqlite_autoindex_search_deletion_keys_1 (deletion_key=?)`; only the final ordering used a temporary B-tree. The `noosn` collision probe returned 4 indexed candidates, all verified before acceptance. Deletion-key collisions are therefore expected candidate expansion, not automatic false positives.

## Latency from Mongolia

The harness ran 60 alternating warm normal requests and 40 alternating warm fuzzy requests from this machine in Mongolia:

Normal tiered:

- first network: `296.59ms`
- network p50/p95: `295.17ms` / `303.22ms`
- Worker/D1 p50/p95: `281ms` / `287ms`
- binding calls p50/p95: `1` / `1`
- <=500ms warm target: **met**

Fuzzy fallback:

- network p50/p95: `297.18ms` / `369.45ms`
- Worker/D1 p50/p95: `283ms` / `288ms`
- binding calls p50/p95: `1` / `1`
- <=500ms warm target: **met**

This replaces the pass-5 2-call, ~0.85–1.2s fuzzy path with a single indexed statement. Normal and fuzzy timings are reported separately.

## Checks and deferred production questions

- Remote migration `0005_fuzzy_deletion_keys.sql`, reseed, deployment, curl, full harness, and 40-request fuzzy proof completed.
- `wrangler types` completed.
- Narrow strict TypeScript with `--skipLibCheck`: `TypeScript: No errors found`.
- `wrangler deploy --dry-run` completed: 38.13 KiB upload, 9.23 KiB gzip.
- No tests added; `git diff --check` required before commit.

Defer production decisions on real-catalog deletion-key collision budgets, query-plan behavior at scale, authoritative inventory/bundle freshness, fuzzy enablement per catalog, and whether brands need a real domain aggregate/admin/page model. Availability remains prototype presentation only; production truth comes from the live inventory/bundle seam.

Cleanup only after explicit instruction:

```sh
wrangler delete wf19-search-transliteration-worker
wrangler d1 delete wf19-search-transliteration-d1
```
