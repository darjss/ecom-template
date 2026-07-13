import { keyFor, normalize, tokensFor, TRANSLITERATION_VERSION } from "./transliteration";

type Mode = "strict" | "basic";
type ProductRow = { id: number; sku: string; name: string; category: string; tags: string; price_mnt: number; rank: number };

type Env = { DB: D1Database };

const json = (body: unknown, status = 200): Response => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
const ftsTerm = (term: string): string => `"${term.replaceAll('"', '""')}"*`;
const compactSku = (value: string): string => normalize(value).replaceAll(" ", "").replaceAll("-", "");

const search = async (db: D1Database, query: string, mode: Mode): Promise<{ products: ProductRow[]; sql_ms: number; normalized_query: string }> => {
  const normalizedQuery = normalize(query);
  const alternatives = tokensFor(query, mode);
  if (alternatives.length === 0) return { products: [], sql_ms: 0, normalized_query: normalizedQuery };
  const expression = alternatives.map((terms) => `(${terms.map(ftsTerm).join(" OR ")})`).join(" AND ");
  const started = performance.now();
  const result = await db.prepare(`SELECT p.id, p.sku, p.name, p.category, p.tags, p.price_mnt, bm25(product_search, 8.0, 3.0, 1.5, 2.0, 6.0, 6.0) AS rank FROM product_search JOIN products p ON p.id = product_search.product_id WHERE product_search MATCH ? ORDER BY rank ASC, p.id ASC LIMIT 20`).bind(expression).all<ProductRow>();
  return { products: result.results, sql_ms: Number((performance.now() - started).toFixed(2)), normalized_query: normalizedQuery };
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") return json({ ok: true, worker: "wf19-search-transliteration-worker", transliteration_version: TRANSLITERATION_VERSION });
    if (url.pathname !== "/search" || request.method !== "GET") return json({ error: "not_found" }, 404);
    const query = url.searchParams.get("q") ?? "";
    const modeValue = url.searchParams.get("mode") ?? "strict";
    if (query.length > 120 || (modeValue !== "strict" && modeValue !== "basic")) return json({ error: "invalid_query" }, 400);
    try {
      const mode: Mode = modeValue === "basic" ? "basic" : "strict";
      const started = performance.now();
      const sku = compactSku(query);
      const exactSku = sku.length >= 4 ? await env.DB.prepare("SELECT id, sku, name, category, tags, price_mnt, 0 AS rank FROM products WHERE sku_normalized = ? LIMIT 20").bind(sku).all<ProductRow>() : { results: [] };
      const lexical = await search(env.DB, query, mode);
      const products = [...exactSku.results, ...lexical.products.filter((product) => !exactSku.results.some((exact) => exact.id === product.id))];
      return json({ mode, transliteration_version: TRANSLITERATION_VERSION, query, normalized_query: lexical.normalized_query, products, counts: { exact_sku: exactSku.results.length, lexical: lexical.products.length }, timing_ms: { total: Number((performance.now() - started).toFixed(2)), sql: lexical.sql_ms } });
    } catch (error) {
      console.error(JSON.stringify({ message: "search_failed", error: error instanceof Error ? error.message : String(error) }));
      return json({ error: "search_failed" }, 500);
    }
  }
};

export { keyFor };
