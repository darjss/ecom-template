# PROTOTYPE — issue #19 search transliteration

Throwaway deployed evidence for automatic Mongolian Cyrillic/Latin search. It is not production application behavior and uses only synthetic products. Pass 3 keeps `mode=tiered` semantics but evaluates SKU/native/strict/basic candidates in one parameterized D1 statement and one binding call.

## Re-run proof

```sh
bun run prototypes/search-transliteration/scripts/seed.ts
wrangler d1 migrations apply wf19-search-transliteration-d1 --remote --config prototypes/search-transliteration/wrangler.jsonc
wrangler d1 execute wf19-search-transliteration-d1 --remote --config prototypes/search-transliteration/wrangler.jsonc --file prototypes/search-transliteration/seed.sql
wrangler deploy --config prototypes/search-transliteration/wrangler.jsonc
bun run prototypes/search-transliteration/scripts/harness.ts -- --url=https://wf19-search-transliteration-worker.darjs.workers.dev
```

The harness prints every case for strict/basic/tiered, confidence/source/ambiguity/binding-call output, hit/miss/collision counts, an interactive `--query=...` option, first-request and 60-request warm network/Worker/D1/binding-call p50/p95. `network_ms` is measured in Mongolia from the caller; `worker_ms` and `d1_sql_ms` are Worker-side metadata.

The deployed Worker exposes `GET /health` and bounded `GET /search?q=...&mode=strict|basic`. Responses are `private, no-store`. D1 uses an ordinary contentful FTS5 table and parameterized MATCH values; the app constructs quoted FTS terms and never treats user input as raw FTS syntax.
