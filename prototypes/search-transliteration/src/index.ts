import { basicTokenVariants, keyFor, normalize, tokensFor, transliterateStrictAscii, TRANSLITERATION_VERSION } from "./transliteration";

type Mode = "strict" | "basic" | "tiered";
type Source = "sku_exact" | "native" | "strict_transliteration" | "basic_fallback";
type Confidence = "exact" | "high" | "medium" | "low";
type ProductRow = { id: number; sku: string; name: string; category: string; tags: string; price_mnt: number; rank: number; source?: Source; confidence?: Confidence };
type TieredDbRow = ProductRow & { stage: number; source: Source };
type Env = { DB: D1Database };
type SearchResult = { products: ProductRow[]; sql_ms: number; normalized_query: string; source: Source; binding_calls: number; exact_sku_count: number };

const json = (body: unknown, status = 200): Response => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
const ftsTerm = (term: string): string => `"${term.replaceAll('"', '""')}"*`;
const compactSku = (value: string): string => normalize(value).replaceAll(" ", "").replaceAll("-", "");
const nativeGroups = (query: string): string[][] => normalize(query).split(" ").filter((term) => term.length >= 2).map((term) => [term]);
const strictGroups = (query: string): string[][] => normalize(query).split(" ").filter((term) => term.length >= 2).map((term) => [transliterateStrictAscii(term)]);
const columnExpression = (column: string, groups: string[][]): string => groups.map((terms) => `${column} : (${terms.map(ftsTerm).join(" OR ")})`).join(" AND ");

const ftsSearch = async (db: D1Database, table: "product_search", expression: string, query: string, source: Source): Promise<SearchResult> => {
  if (!expression) return { products: [], sql_ms: 0, normalized_query: normalize(query), source, binding_calls: 0, exact_sku_count: 0 };
  const started = performance.now();
  const result = await db.prepare(`SELECT p.id, p.sku, p.name, p.category, p.tags, p.price_mnt, bm25(${table}, 8.0, 3.0, 1.5, 2.0, 6.0, 6.0) AS rank FROM ${table} JOIN products p ON p.id = ${table}.product_id WHERE ${table} MATCH ? ORDER BY rank ASC, p.id ASC LIMIT 20`).bind(expression).all<ProductRow>();
  return { products: result.results, sql_ms: Number((performance.now() - started).toFixed(2)), normalized_query: normalize(query), source, binding_calls: 1, exact_sku_count: 0 };
};

const tieredSearch = async (db: D1Database, query: string): Promise<SearchResult> => {
  const nativeExpression = columnExpression("native_key", nativeGroups(query)) || "__empty_native__";
  const strictExpression = columnExpression("strict_key", strictGroups(query)) || "__empty_strict__";
  const basicExpression = columnExpression("basic_key", basicTokenVariants(query)) || "__empty_basic__";
  const sql = `WITH candidates AS (
    SELECT id, sku, name, category, tags, price_mnt, 0.0 AS rank, -1 AS stage, 'sku_exact' AS source FROM products WHERE sku_normalized = ?
    UNION ALL
    SELECT p.id, p.sku, p.name, p.category, p.tags, p.price_mnt, bm25(product_search_tiered, 10.0, 1.0, 1.0, 1.0, 1.0) AS rank, 0 AS stage, 'native' AS source FROM product_search_tiered JOIN products p ON p.id = product_search_tiered.product_id WHERE product_search_tiered MATCH ?
    UNION ALL
    SELECT p.id, p.sku, p.name, p.category, p.tags, p.price_mnt, bm25(product_search_tiered, 1.0, 1.0, 1.0, 1.0, 10.0) AS rank, 1 AS stage, 'strict_transliteration' AS source FROM product_search_tiered JOIN products p ON p.id = product_search_tiered.product_id WHERE product_search_tiered MATCH ?
    UNION ALL
    SELECT p.id, p.sku, p.name, p.category, p.tags, p.price_mnt, bm25(product_search_tiered, 1.0, 1.0, 1.0, 10.0, 1.0) AS rank, 2 AS stage, 'basic_fallback' AS source FROM product_search_tiered JOIN products p ON p.id = product_search_tiered.product_id WHERE product_search_tiered MATCH ?
  ), selected AS (SELECT MIN(stage) AS stage FROM candidates)
  SELECT id, sku, name, category, tags, price_mnt, rank, stage, source FROM candidates WHERE stage = (SELECT stage FROM selected) ORDER BY rank ASC, id ASC LIMIT 20`;
  const started = performance.now();
  const result = await db.prepare(sql).bind(compactSku(query), nativeExpression, strictExpression, basicExpression).all<TieredDbRow>();
  const products = result.results.map((product) => ({ ...product, confidence: product.source === "sku_exact" ? "exact" as const : product.source === "native" ? "high" as const : product.source === "strict_transliteration" ? "medium" as const : "low" as const }));
  const source = products[0]?.source ?? "basic_fallback";
  return { products, sql_ms: Number((performance.now() - started).toFixed(2)), normalized_query: normalize(query), source, binding_calls: 1, exact_sku_count: products.filter((product) => product.source === "sku_exact").length };
};

const legacySearch = async (db: D1Database, query: string, mode: "strict" | "basic"): Promise<SearchResult> => ftsSearch(db, "product_search", tokensFor(query, mode).map((terms) => `(${terms.map(ftsTerm).join(" OR ")})`).join(" AND "), query, mode === "strict" ? "strict_transliteration" : "basic_fallback");

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") return json({ ok: true, worker: "wf19-search-transliteration-worker", transliteration_version: TRANSLITERATION_VERSION });
    if (url.pathname !== "/search" || request.method !== "GET") return json({ error: "not_found" }, 404);
    const query = url.searchParams.get("q") ?? "";
    const modeValue = url.searchParams.get("mode") ?? "strict";
    if (query.length > 120 || !["strict", "basic", "tiered"].includes(modeValue)) return json({ error: "invalid_query" }, 400);
    try {
      const mode: Mode = modeValue === "basic" ? "basic" : modeValue === "tiered" ? "tiered" : "strict";
      const started = performance.now();
      if (mode === "tiered") {
        const result = await tieredSearch(env.DB, query);
        return json({ mode, transliteration_version: TRANSLITERATION_VERSION, query, normalized_query: result.normalized_query, source: result.source, confidence: result.products[0]?.confidence ?? "low", ambiguity: result.source === "basic_fallback" && result.products.length > 1 ? "expose_multiple" : "none", products: result.products, counts: { exact_sku: result.exact_sku_count, lexical: result.products.length }, timing_ms: { total: Number((performance.now() - started).toFixed(2)), sql: result.sql_ms, binding_calls: result.binding_calls } });
      }
      const sku = compactSku(query);
      const skuStarted = performance.now();
      const exactSku = sku.length >= 4 ? await env.DB.prepare("SELECT id, sku, name, category, tags, price_mnt, 0 AS rank FROM products WHERE sku_normalized = ? LIMIT 20").bind(sku).all<ProductRow>() : { results: [] };
      const skuSqlMs = sku.length >= 4 ? performance.now() - skuStarted : 0;
      const lexical = await legacySearch(env.DB, query, mode);
      const exactProducts = exactSku.results.map((product) => ({ ...product, source: "sku_exact" as const, confidence: "exact" as const }));
      const source: Source = exactProducts.length > 0 ? "sku_exact" : lexical.source;
      const confidence: Confidence = source === "sku_exact" ? "exact" : source === "strict_transliteration" ? "medium" : "low";
      const products = [...exactProducts, ...lexical.products.filter((product) => !exactProducts.some((exact) => exact.id === product.id)).map((product) => ({ ...product, source, confidence }))];
      return json({ mode, transliteration_version: TRANSLITERATION_VERSION, query, normalized_query: lexical.normalized_query, source, confidence, ambiguity: source === "basic_fallback" && products.length > 1 ? "expose_multiple" : "none", products, counts: { exact_sku: exactProducts.length, lexical: lexical.products.length }, timing_ms: { total: Number((performance.now() - started).toFixed(2)), sql: Number((skuSqlMs + lexical.sql_ms).toFixed(2)), binding_calls: (sku.length >= 4 ? 1 : 0) + lexical.binding_calls } });
    } catch (error) {
      console.error(JSON.stringify({ message: "search_failed", error: error instanceof Error ? error.message : String(error) }));
      return json({ error: "search_failed" }, 500);
    }
  }
};

export { keyFor };
