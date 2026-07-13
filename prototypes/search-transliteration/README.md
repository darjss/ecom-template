# PROTOTYPE — issue #19 search transliteration

Throwaway deployed evidence for automatic Mongolian Cyrillic/Latin search. It is not production application behavior and uses only synthetic products.

## Re-run proof

```sh
bun run prototypes/search-transliteration/scripts/seed.ts
wrangler d1 migrations apply wf19-search-transliteration-d1 --remote --config prototypes/search-transliteration/wrangler.jsonc
wrangler d1 execute wf19-search-transliteration-d1 --remote --config prototypes/search-transliteration/wrangler.jsonc --file prototypes/search-transliteration/seed.sql
wrangler deploy --config prototypes/search-transliteration/wrangler.jsonc
bun run prototypes/search-transliteration/scripts/harness.ts -- --url=https://wf19-search-transliteration-worker.darjs.workers.dev
```

The harness prints every case for strict/basic, hit/miss/collision counts, an interactive `--query=...` option, first-request and warm network p50/p95. `network_ms` is measured in Mongolia from the caller; `worker_ms` and `sql_ms` are Worker-side metadata.

The deployed Worker exposes `GET /health` and bounded `GET /search?q=...&mode=strict|basic`. Responses are `private, no-store`. D1 uses an ordinary contentful FTS5 table and parameterized MATCH values; the app constructs quoted FTS terms and never treats user input as raw FTS syntax.
