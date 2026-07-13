# Issue #19 transliteration prototype verdict

**Question:** Is automatic basic Mongolian Cyrillic↔Latin transliteration predictable enough for conventional product search?

**Recommendation: do not ship automatic transliteration as the v1 default.** Keep native Cyrillic deterministic search. If Latin discoverability is required, use reviewed explicit aliases or a separately measured opt-in key. This prototype proves bounded transliteration is runnable, but the basic policy creates collisions and the deployed D1 path measured roughly 560ms network / 540–560ms Worker time from Mongolia for 40 products.

## Evidence

- Worker: `https://wf19-search-transliteration-worker.darjs.workers.dev`
- D1: `wf19-search-transliteration-d1`, ID `d300867e-ddaf-4e0d-84c8-960ca32158a0`
- Catalog: 40 synthetic products, SKUs/categories/tags/MNT prices; 40 ordinary contentful FTS5 rows.
- Version: `strict-mn-v1-basic-v1`; strict maps ө→ö, ү→ü, х→kh, ц→ts, ч→ch, ш→sh, ж→j, я→ya, ю→yu, ё→yo. Basic is bounded ASCII policy ö→o, ü→u, kh→h, y→i.
- Proof: `curl -iS https://wf19-search-transliteration-worker.darjs.workers.dev/health`; `curl -iS '.../search?q=ноосон%20цамц&mode=strict'`; `bun run prototypes/search-transliteration/scripts/harness.ts -- --url=...`.
- Final harness run: 22 matrix cases across both modes, 20 expected assertions passed, 2 failed because strict mode observed collisions for `одор`/`үс` (the latter is a real native product match); 13 cases returned multiple products. Strict Latin `usnii boolt`, mixed `ноосон tsamts`, punctuation, SKU `HVӨ001`, and no-match were observed. Basic `одор` returned both `Өдөр тутмын цүнх` and `Ердийн даашинз`, demonstrating the collision cost of ASCII fallback.
- Latency final run: first network 566.31ms; warm network p50 562.46ms and p95 580.13ms; Worker-side warm sample 542ms. One earlier warm sample reached 1,097ms. Network includes caller-to-Cloudflare; Worker/SQL timing is emitted separately.
- Remote migration and seed reported 40 rows read, 280 rows written; D1 count query reported `products=40`, `fts_rows=40`; D1 size was 167,936 bytes.

## Limitations

This is a throwaway 40-row proof, not a production benchmark. It intentionally has no merchant aliases, fuzzy matching, semantics, AI, Vectorize, or Durable Objects. SQLite unicode61 behavior itself contributed observed equivalence/collision behavior, so any future transliteration would need a tokenizer-level collision audit and real catalog examples.

Resources remain deployed for founder review. Cleanup only when explicitly instructed:

```sh
wrangler delete wf19-search-transliteration-worker
wrangler d1 delete wf19-search-transliteration-d1
```
