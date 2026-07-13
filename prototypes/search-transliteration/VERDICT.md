# Issue #19 transliteration prototype verdict — pass 2

**Question:** Can bounded automatic transliteration be useful without merchant-maintained aliases?

## Diagnosis of pass 1

The two failed assertions were not one bug:

1. `distinct ү/у` used query `үс` but expected no result. The catalog contains the real native product `Үсний боолт`; this was a harness expectation defect, not transliteration failure. The corrected tiered case expects that native result.
2. The strict `одор` failure was a real FTS/query-contract defect in the old path. The old strict key stores `өдөр` and strict `ödör`, but the deployed strict query `odor` returned `Өдөр тутмын цүнх` and `Ердийн даашинз` anyway. This is evidence that the old FTS/tokenizer path made `ö`/`o` match despite `remove_diacritics 0`; it was not a safe strict distinction.
3. The two-product `odor` result is also inherent ambiguity: the synthetic catalog has `Өдөр` in both the title/tags of product 2 and tags of product 5. ASCII `odor` cannot identify which intended meaning the shopper wants. Tiered therefore exposes both candidates only at low-confidence basic fallback; it does not silently rank one as exact.

The old `SKU punctuation` broad lexical results were a separate query-construction defect in legacy strict/basic FTS: FTS tokenized the SKU into ordinary terms. Tiered performs normalized exact SKU lookup first and returns the exact product source.

## Pass 2 implementation

Added and deployed `mode=tiered` without a new resource:

1. Native normalized Cyrillic and exact normalized SKU first.
2. Strict ASCII transliteration second (`ө→oe`, `ү→ue`, digraphs such as `х→kh`, `ц→ts`, `ч→ch`, `ш→sh`, `я→ya`, `ю→yu`, `ё→yo`).
3. Bounded basic fallback last. It caps per-token variants at 8 and includes common `ө→o/u`, `ү→u/i`, `ё→yo/eo`, `й→i/y`, `х→h/kh`, `ц→c/ts` alternatives. No aliases, fuzzy matching, semantic expansion, AI, Vectorize, or Durable Objects.

Each stage uses column-scoped FTS AND groups with prefix terms; basic alternatives are OR'd only within each token group. Results expose `source`, `confidence`, and `ambiguity`. Policy is `expose_multiple` for more than one low-confidence basic-fallback candidate; native, strict, and exact SKU results are not hidden or falsely promoted.

## Live proof

- Worker: `https://wf19-search-transliteration-worker.darjs.workers.dev`
- Worker version: `18c38388-3381-40d0-9b93-62fba5928fac`
- Worker: `wf19-search-transliteration-worker`
- Same D1: `wf19-search-transliteration-d1`, ID `d300867e-ddaf-4e0d-84c8-960ca32158a0`
- D1 migration `0003_tiered_fts.sql` applied; seed retained 40 synthetic products and added 40 tiered FTS rows. D1 size after seed: 212,992 bytes.
- Health curl returned 200 and version `strict-mn-v2-tiered-basic-v2`.
- Exact proof command: `bun run prototypes/search-transliteration/scripts/harness.ts -- --url=https://wf19-search-transliteration-worker.darjs.workers.dev`

The tiered matrix covers `odor`, `udur`, `usnii boolt`, `nooson tsamts`, mixed script, native `өдөр`/`үс`/`ус`, `ё/е`, `х`/`ц` digraphs, two SKUs, prefix, and no-match. Result: **15/15 tiered assertions passed; 0 failed; 24 multi-result cases across all three comparison modes**. Tiered observations:

- `odor` and `udur`: `basic_fallback`, low confidence, both `Өдөр тутмын цүнх` and `Ердийн даашинз`, `ambiguity=expose_multiple`.
- `usnii boolt`: basic fallback, one `Үсний боолт` result.
- `nooson tsamts` and mixed `ноосон tsamts`: strict transliteration, two hyphen/punctuation-equivalent product candidates.
- `өдөр`, `үс`, `ус`, and prefix `ноо`: native high-confidence path.
- `ес`: no result; no silent ё/е merge.
- `HVӨ001` and `hv-ц-002`: exact SKU source and one product each.
- `tsagaan`: strict transliteration source; no-match remains empty.

Legacy comparison remains intentionally visible: old strict `odor` still returns the same two products (the diagnosed FTS defect), while tiered reaches basic fallback only after strict ASCII returns no result. Old basic SKU punctuation still shows broad lexical noise; tiered does not.

Latency from this machine in Mongolia with 60 warm requests alternating `odor` and `nooson tsamts`:

- first network: `1133.70ms`
- warm network p50/p95: `1119.16ms` / `1132.86ms`
- Worker total p50/p95: `1102ms` / `1114ms`
- D1 SQL p50/p95: `1102ms` / `1114ms`

The tiered fallback cost is visible: a low-confidence fallback may execute native, strict, and basic D1 queries sequentially. Network includes caller-to-Cloudflare; Worker and D1 values are emitted inside the Worker. Native-only requests were observed around 277ms D1/Worker, while fallback requests were around 1.1s.

## Recommendation

Founder direction is feasible only with an explicit low-confidence contract. Ship the tiered shape for further product validation, not as silent fuzzy search: exact SKU/native first, strict transliteration second, and basic fallback only when higher-confidence stages are empty. Expose multiple basic candidates rather than inventing a winner. Before production, measure real catalog collisions and optimize fallback query latency; automatic basic transliteration is useful for `usnii boolt`, but `odor`/`udur` proves it is inherently ambiguous.

Cleanup only after explicit instruction:

```sh
wrangler delete wf19-search-transliteration-worker
wrangler d1 delete wf19-search-transliteration-d1
```
