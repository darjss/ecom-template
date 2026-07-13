import { basicTokenVariants, keyFor, normalize, tokensFor, transliterateStrictAscii, TRANSLITERATION_VERSION } from "./transliteration";

type Mode = "strict" | "basic" | "tiered";
type Source = "sku_exact" | "native" | "strict_transliteration" | "basic_fallback";
type ProductRow = { id: number; sku: string; name: string; category: string; tags: string; price_mnt: number; rank: number; source?: Source; confidence?: "exact" | "high" | "medium" | "low" };
type Env = { DB: D1Database };

type SearchResult = { products: ProductRow[]; sql_ms: number; normalized_query: string; source: Source };
const json = (body: unknown, status = 200): Response => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
const ftsTerm = (term: string): string => `"${term.replaceAll('"', '""')}"*`;
const compactSku = (value: string): string => normalize(value).replaceAll(" ", "").replaceAll("-", "");
const nativeGroups = (query: string): string[][] => normalize(query).split(" ").filter((term) => term.length >= 2).map((term) => [term]);
const strictGroups = (query: string): string[][] => normalize(query).split(" ").filter((term) => term.length >= 2).map((term) => [transliterateStrictAscii(term)]);
const columnExpression = (column: string, groups: string[][]): string => groups.map((terms) => `${column} : (${terms.map(ftsTerm).join(" OR ")})`).join(" AND ");

const ftsSearch = async (db: D1Database, table: "product_search" | "product_search_tiered", expression: string, query: string, source: Source, columnWeight: number): Promise<SearchResult> => {
  if (!expression) return { products: [], sql_ms: 0, normalized_query: normalize(query), source };
  const started = performance.now();
  const result = await db.prepare(`SELECT p.id, p.sku, p.name, p.category, p.tags, p.price_mnt, bm25(${table}, 10.0, 1.0, 1.0, 1.0, ${columnWeight}) AS rank FROM ${table} JOIN products p ON p.id = ${table}.product_id WHERE ${table} MATCH ? ORDER BY CASE WHEN p.name = ? THEN -100 ELSE 0 END, rank ASC, p.id ASC LIMIT 20`).bind(expression, query).all<ProductRow>();
  return { products: result.results, sql_ms: Number((performance.now() - started).toFixed(2)), normalized_query: normalize(query), source };
};

const tieredSearch = async (db: D1Database, query: string): Promise<SearchResult> => {
  const native = await ftsSearch(db, "product_search_tiered", columnExpression("native_key", nativeGroups(query)), query, "native", 10);
  if (native.products.length > 0) return native;
  const strict = await ftsSearch(db, "product_search_tiered", columnExpression("strict_key", strictGroups(query)), query, "strict_transliteration", 10);
  if (strict.products.length > 0) return { ...strict, sql_ms: native.sql_ms + strict.sql_ms };
  const basic = await ftsSearch(db, "product_search_tiered", columnExpression("basic_key", basicTokenVariants(query)), query, "basic_fallback", 10);
  return { ...basic, sql_ms: native.sql_ms + strict.sql_ms + basic.sql_ms };
};

const legacySearch = async (db: D1Database, query: string, mode: "strict" | "basic"): Promise<SearchResult> => {
  const alternatives = tokensFor(query, mode);
  return ftsSearch(db, "product_search", alternatives.map((terms) => `(${terms.map(ftsTerm).join(" OR ")})`).join(" AND "), query, mode === "strict" ? "strict_transliteration" : "basic_fallback", 10);
};

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
      const sku = compactSku(query);
      const skuStarted = performance.now();
      const exactSku = sku.length >= 4 ? await env.DB.prepare("SELECT id, sku, name, category, tags, price_mnt, 0 AS rank FROM products WHERE sku_normalized = ? LIMIT 20").bind(sku).all<ProductRow>() : { results: [] };
      const skuSqlMs = sku.length >= 4 ? performance.now() - skuStarted : 0;
      const lexical = mode === "tiered" ? await tieredSearch(env.DB, query) : await legacySearch(env.DB, query, mode);
      const source: Source = exactSku.results.length > 0 ? "sku_exact" : lexical.source;
      const confidence = source === "sku_exact" ? "exact" : source === "native" ? "high" : source === "strict_transliteration" ? "medium" : "low";
      const exactProducts = exactSku.results.map((product) => ({ ...product, source: "sku_exact" as const, confidence: "exact" as const }));
      const products = [...exactProducts, ...lexical.products.filter((product) => !exactSku.results.some((exact) => exact.id === product.id)).map((product) => ({ ...product, source, confidence }))];
      return json({ mode, transliteration_version: TRANSLITERATION_VERSION, query, normalized_query: lexical.normalized_query, source, confidence, ambiguity: source === "basic_fallback" && products.length > 1 ? "expose_multiple" : "none", products, counts: { exact_sku: exactSku.results.length, lexical: lexical.products.length }, timing_ms: { total: Number((performance.now() - started).toFixed(2)), sql: Number((skuSqlMs + lexical.sql_ms).toFixed(2)) } });
    } catch (error) {
      console.error(JSON.stringify({ message: "search_failed", error: error instanceof Error ? error.message : String(error) }));
      return json({ error: "search_failed" }, 500);
    }
  }
};

export { keyFor };
