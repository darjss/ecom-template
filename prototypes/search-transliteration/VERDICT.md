# Issue #19 transliteration prototype verdict — pass 3

## Accepted semantic baseline

No aliases. Exact SKU/native first; strict automatic transliteration second; bounded basic fallback last. Basic ambiguity exposes multiple candidates instead of selecting a winner. Strict/basic legacy modes remain available for comparison.

## Performance change

Tiered mode now evaluates all four candidate stages in one parameterized D1 binding call and one SQL statement:

- CTE `candidates` uses `UNION ALL` for exact SKU, native, strict, and basic rows.
- A `selected` CTE chooses `MIN(stage)`; only the highest-confidence non-empty stage is returned, while all rows in that stage remain available.
- Exact SKU is stage -1 and remains unique through the indexed unique canonical SKU path.
- Native/strict/basic stage expressions are generated as quoted, parameter-bound FTS values. User text never becomes SQL or FTS syntax.
- Basic alternatives remain capped by the existing per-token 8-variant limit.
- No aliases, fuzzy matching, semantic expansion, AI, Vectorize, Durable Objects, or new Cloudflare resource were added.

This was chosen over parallel D1 calls because D1 is single-threaded; one statement is the minimum binding-call shape and lets the database evaluate the candidate branches in one request.

## Live deployment

- Worker: `wf19-search-transliteration-worker`
- URL: https://wf19-search-transliteration-worker.darjs.workers.dev
- Deployment version: `7989d346-ad60-4512-a7d9-73391504819b`
- Same D1: `wf19-search-transliteration-d1`, ID `d300867e-ddaf-4e0d-84c8-960ca32158a0`
- Health returned HTTP 200 and `strict-mn-v2-tiered-basic-v2`.
- Resources intentionally remain deployed.

## Proof

Exact command:

```sh
bun run prototypes/search-transliteration/scripts/harness.ts -- --url=https://wf19-search-transliteration-worker.darjs.workers.dev
```

The real harness ran strict/basic comparison samples and 15 tiered cases covering `odor`, `udur`, `usnii boolt`, `nooson tsamts`, mixed script, ө/о, ү/у, ё/е, digraphs, exact/punctuated SKUs, prefix, and no-match. Result: **15/15 tiered assertions passed, 0 failed, 24 multi-result cases across all modes**.

Tiered behavior remained unchanged:

- `odor` and `udur`: basic fallback, low confidence, both `Өдөр тутмын цүнх` and `Ердийн даашинз`, `expose_multiple`.
- `usnii boolt`: basic fallback, one `Үсний боолт`.
- `nooson tsamts` and mixed `ноосон tsamts`: strict transliteration, two punctuation-equivalent products.
- `өдөр`, `үс`, `ус`, and `ноо`: native high-confidence path.
- `ес`: empty; no silent ё/е merge.
- `khuvtsas` and `tsagaan`: strict digraph paths.
- `HVӨ001` and `hv-ц-002`: exact SKU source, one product each.
- `квантын дуран`: empty.

Every tiered case reported `binding_calls=1`. Exact SKU remained unique: both SKU cases returned exactly one product and `source=sku_exact`; the punctuated SKU did not broaden into lexical candidates. Ambiguous basic fallback remained two candidates with `ambiguity=expose_multiple`.

Legacy comparison remained intentionally visible: strict `odor` still demonstrates the old FTS `ö/o` collision, and legacy SKU punctuation remains broad; neither affects tiered selection.

## Latency from Mongolia

The harness ran 60 alternating warm tiered requests (`odor` / `nooson tsamts`) from this machine in Mongolia:

- First network: `290.70ms`
- Warm network p50/p95: `289.32ms` / `298.81ms`
- Worker total p50/p95: `280ms` / `289ms`
- Aggregate D1 SQL p50/p95: `280ms` / `289ms`
- Binding calls p50/p95: `1` / `1`

The previous fallback baseline was approximately 1.1s with three sequential tiered D1 searches. The one-statement path is approximately 0.84s faster in the previous mixed fallback sample and now stays below the **<=500ms warm target**: target met for this 40-product prototype. This is network-observed from the current machine and not a production-scale guarantee.

## Checks

- Remote migration/seed from the existing D1 completed before proof.
- `wrangler deploy --dry-run` completed: 29.94 KiB upload, 7.42 KiB gzip.
- Narrow TypeScript check passed with `--strict --skipLibCheck`: `TypeScript: No errors found`.
- Actual deployment, `/health` curl, native/strict/basic samples, and real 60-request harness completed.
- No unit/integration tests were added, per repository policy.

## Final founder-review convenience

Added prototype-only `GET /products?limit=20` with integer limit validation (`1..20`), deterministic `id ASC` ordering, synthetic `name`, `sku`, `category`, and `price_mnt` fields only, and `private, no-store`. `limit=21` returned HTTP 400 with `max:20`.

Added the dependency-light CLI `bun prototypes/search-transliteration/scripts/try-search.ts`. No arguments or `--list` fetches 18 deployed products and suggests `өдөр`, `odor`, `udur`, `usnii boolt`, and `nooson tsamts`; positional queries call tiered mode and print source, confidence, ambiguity, network, Worker, D1, and binding-call timing. The live prototype URL is the explicit default; `--url` is optional.

Live convenience proof returned HTTP 200 and sample products `Ноосон цамц`, `Өдөр тутмын цүнх`, `Үсний боолт`. CLI proof succeeded for `usnii boolt` (one low-confidence basic result), `odor` (two candidates with `expose_multiple`), and `өдөр` (native high-confidence results).

## Remaining risks and recommendation

The semantic recommendation is unchanged and now has a viable latency shape: retain tiered mode with explicit low-confidence ambiguity exposure. Remaining risks are FTS ranking quality at larger catalogs, basic transliteration collision rate on real merchant text, the single-statement SQL plan at scale, and the 40-product-only benchmark. Before production, run representative catalog collision/latency sampling and verify query plans; do not silently promote basic candidates.

Cleanup only after explicit instruction:

```sh
wrangler delete wf19-search-transliteration-worker
wrangler d1 delete wf19-search-transliteration-d1
```
