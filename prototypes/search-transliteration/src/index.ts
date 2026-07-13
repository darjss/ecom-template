import { basicTokenVariants, basicVariants, deletionKeys, keyFor, normalize, tokensFor, transliterateBasic, transliterateStrictAscii, TRANSLITERATION_VERSION } from "./transliteration";

type Mode = "strict" | "basic" | "tiered";
type Source = "sku_exact" | "native" | "strict_transliteration" | "basic_fallback" | "fuzzy_fallback";
type Confidence = "exact" | "high" | "medium" | "low";
type MatchField = "sku" | "title" | "brand" | "category/tags" | "description";
type ProductRow = { id: number; sku: string; name: string; category: string; tags: string; price_mnt: number; brand: string; description: string; available: number; merchandising_position: number; rank: number; source?: Source; confidence?: Confidence; matched_field?: MatchField };
type TieredDbRow = ProductRow & { stage: number; source: Source; fuzzy_term: string | null; fuzzy_field: "title" | "brand" | "category" | null; fuzzy_representation: string | null };
type Env = { DB: D1Database };
type SearchResult = { products: ProductRow[]; sql_ms: number; normalized_query: string; source: Source; binding_calls: number; exact_sku_count: number };

const json = (body: unknown, status = 200): Response => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
const ftsTerm = (term: string): string => `"${term.replaceAll('"', '""')}"*`;
const compactSku = (value: string): string => normalize(value).replaceAll(" ", "").replaceAll("-", "");
const nativeGroups = (query: string): string[][] => normalize(query).split(" ").filter((term) => term.length >= 2).map((term) => [term]);
const strictGroups = (query: string): string[][] => normalize(query).split(" ").filter((term) => term.length >= 2).map((term) => [transliterateStrictAscii(term)]);
const allColumns = (representation: "native" | "strict" | "basic"): string => representation === "native" ? "{title_native brand_native category_native tags_native description_native}" : representation === "strict" ? "{title_strict brand_strict category_strict tags_strict description_strict}" : "{title_basic brand_basic category_basic tags_basic description_basic}";
const columnExpression = (columns: string, groups: string[][]): string => groups.map((terms) => `${columns} : (${terms.map(ftsTerm).join(" OR ")})`).join(" AND ");
type PublicProduct = { id: number; name: string; sku: string; brand: string; category: string; price_mnt: number; available: boolean; source?: Source; confidence?: Confidence; matched_field?: MatchField };
const publicProduct = (product: ProductRow): PublicProduct => ({ id: product.id, name: product.name, sku: product.sku, brand: product.brand, category: product.category, price_mnt: product.price_mnt, available: product.available === 1, source: product.source, confidence: product.confidence, matched_field: product.matched_field });

const fieldFor = (product: ProductRow, query: string, source: Source): MatchField => {
  if (source === "sku_exact") return "sku";
  const normalized = normalize(query).split(" ").filter((term) => term.length >= 2);
  const values = source === "strict_transliteration" ? normalized.map(transliterateStrictAscii) : source === "basic_fallback" ? normalized.flatMap((term) => basicVariants(term)) : normalized;
  const transform = (value: string): string => source === "strict_transliteration" ? transliterateStrictAscii(value) : source === "basic_fallback" ? basicVariants(value).join(" ") : normalize(value);
  const fields: Array<[MatchField, string]> = [["title", transform(product.name)], ["brand", transform(product.brand)], ["category/tags", transform(`${product.category} ${product.tags}`)], ["description", transform(product.description)]];
  for (const [field, value] of fields) if (values.every((term) => value.includes(term))) return field;
  return "description";
};

const ftsSearch = async (db: D1Database, expression: string, query: string, source: Source): Promise<SearchResult> => {
  if (!expression) return { products: [], sql_ms: 0, normalized_query: normalize(query), source, binding_calls: 0, exact_sku_count: 0 };
  const started = performance.now();
  const result = await db.prepare("SELECT p.id, p.sku, p.name, p.category, p.tags, p.price_mnt, p.brand, p.description, p.available, p.merchandising_position, bm25(product_search, 8.0, 3.0, 1.5, 2.0, 6.0, 6.0) AS rank FROM product_search JOIN products p ON p.id = product_search.product_id WHERE product_search MATCH ? ORDER BY rank ASC, p.id ASC LIMIT 20").bind(expression).all<ProductRow>();
  return { products: result.results.map((product) => ({ ...product, source, confidence: source === "strict_transliteration" ? "medium" : "low", matched_field: fieldFor(product, query, source) })), sql_ms: Number((performance.now() - started).toFixed(2)), normalized_query: normalize(query), source, binding_calls: 1, exact_sku_count: 0 };
};

const editDistanceOne = (left: string, right: string): number => {
  if (left === right) return 0;
  if (Math.abs(left.length - right.length) > 1) return 2;
  const matrix = Array.from({ length: left.length + 1 }, (_, row) => Array.from({ length: right.length + 1 }, (_, column) => row === 0 ? column : column === 0 ? row : 0));
  for (let row = 1; row <= left.length; row++) for (let column = 1; column <= right.length; column++) {
    matrix[row]![column] = Math.min(matrix[row - 1]![column]! + 1, matrix[row]![column - 1]! + 1, matrix[row - 1]![column - 1]! + (left[row - 1] === right[column - 1] ? 0 : 1));
    if (row > 1 && column > 1 && left[row - 1] === right[column - 2] && left[row - 2] === right[column - 1]) matrix[row]![column] = Math.min(matrix[row]![column]!, matrix[row - 2]![column - 2]! + 1);
  }
  return matrix[left.length]![right.length]!;
};

const fuzzyForms = (token: string): Array<{ representation: string; term: string }> => [...new Map([...[{ representation: "native", term: token }], { representation: "strict", term: transliterateStrictAscii(token) }, ...basicVariants(token).map((term) => ({ representation: "basic", term }))].map((form) => [`${form.representation}:${form.term}`, form])).values()];
const fuzzyKeysForQuery = (query: string): string[] => {
  const tokens = normalize(query).split(" ").filter(Boolean);
  if (tokens.length === 0 || tokens.length > 10 || tokens.some((token) => token.length < 4)) return [];
  return [...new Set(tokens.flatMap((token) => fuzzyForms(token).flatMap((form) => deletionKeys(form.term))))].slice(0, 80);
};
const fuzzyMatches = (rows: TieredDbRow[], query: string): ProductRow[] => {
  const tokens = normalize(query).split(" ").filter(Boolean);
  const matches = new Map<number, { product: TieredDbRow; distances: number[]; fields: Set<MatchField> }>();
  for (const token of tokens) {
    const tokenMatches = rows.filter((row) => row.fuzzy_term !== null && fuzzyForms(token).some((form) => form.representation === row.fuzzy_representation && editDistanceOne(form.term, row.fuzzy_term ?? "") <= 1));
    for (const candidate of tokenMatches) {
      const form = fuzzyForms(token).find((item) => item.representation === candidate.fuzzy_representation && editDistanceOne(item.term, candidate.fuzzy_term ?? "") <= 1);
      if (!form) continue;
      const current = matches.get(candidate.id) ?? { product: candidate, distances: [], fields: new Set<MatchField>() };
      current.distances.push(editDistanceOne(form.term, candidate.fuzzy_term ?? ""));
      current.fields.add(candidate.fuzzy_field === "title" ? "title" : candidate.fuzzy_field === "brand" ? "brand" : "category/tags");
      matches.set(candidate.id, current);
    }
  }
  return [...matches.values()].filter((match) => match.distances.length >= tokens.length).sort((left, right) => (left.distances.reduce((sum, value) => sum + value, 0) - right.distances.reduce((sum, value) => sum + value, 0)) || (right.product.available - left.product.available) || (left.product.merchandising_position - right.product.merchandising_position) || (left.product.id - right.product.id)).slice(0, 20).map((match) => ({ ...match.product, source: "fuzzy_fallback" as const, confidence: "low" as const, matched_field: [...match.fields][0] ?? "title" }));
};

const tieredSearch = async (db: D1Database, query: string): Promise<SearchResult> => {
  const nativeExpression = columnExpression(allColumns("native"), nativeGroups(query)) || "__empty_native__";
  const strictExpression = columnExpression(allColumns("strict"), strictGroups(query)) || "__empty_strict__";
  const basicExpression = columnExpression(allColumns("basic"), basicTokenVariants(query)) || "__empty_basic__";
  const fuzzyKeys = fuzzyKeysForQuery(query);
  const fuzzyParams = fuzzyKeys.length > 0 ? fuzzyKeys : ["__empty_fuzzy__"];
  const fuzzyPlaceholders = fuzzyParams.map(() => "?").join(",");
  const sql = `WITH fuzzy_candidates AS (
    SELECT d.term AS fuzzy_term, d.field AS fuzzy_field, d.representation AS fuzzy_representation, d.product_id FROM search_deletion_keys d WHERE d.deletion_key IN (${fuzzyPlaceholders}) ORDER BY d.deletion_key ASC, d.product_id ASC LIMIT 500
  ), candidates AS (
    SELECT id, sku, name, category, tags, price_mnt, brand, description, available, merchandising_position, 0.0 AS rank, -1 AS stage, 'sku_exact' AS source, NULL AS fuzzy_term, NULL AS fuzzy_field, NULL AS fuzzy_representation FROM products WHERE sku_normalized = ?
    UNION ALL
    SELECT p.id, p.sku, p.name, p.category, p.tags, p.price_mnt, p.brand, p.description, p.available, p.merchandising_position, bm25(product_search_resilient, 12.0, 8.0, 4.0, 4.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0) AS rank, 0 AS stage, 'native' AS source, NULL, NULL, NULL FROM product_search_resilient JOIN products p ON p.id = product_search_resilient.product_id WHERE product_search_resilient MATCH ?
    UNION ALL
    SELECT p.id, p.sku, p.name, p.category, p.tags, p.price_mnt, p.brand, p.description, p.available, p.merchandising_position, bm25(product_search_resilient, 1.0, 1.0, 1.0, 1.0, 1.0, 12.0, 8.0, 4.0, 4.0, 1.0, 1.0, 1.0, 1.0, 1.0) AS rank, 1 AS stage, 'strict_transliteration' AS source, NULL, NULL, NULL FROM product_search_resilient JOIN products p ON p.id = product_search_resilient.product_id WHERE product_search_resilient MATCH ?
    UNION ALL
    SELECT p.id, p.sku, p.name, p.category, p.tags, p.price_mnt, p.brand, p.description, p.available, p.merchandising_position, bm25(product_search_resilient, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 12.0, 8.0, 4.0, 4.0, 1.0) AS rank, 2 AS stage, 'basic_fallback' AS source, NULL, NULL, NULL FROM product_search_resilient JOIN products p ON p.id = product_search_resilient.product_id WHERE product_search_resilient MATCH ?
    UNION ALL
    SELECT p.id, p.sku, p.name, p.category, p.tags, p.price_mnt, p.brand, p.description, p.available, p.merchandising_position, 0.0 AS rank, 3 AS stage, 'fuzzy_fallback' AS source, f.fuzzy_term, f.fuzzy_field, f.fuzzy_representation FROM fuzzy_candidates f JOIN products p ON p.id = f.product_id
  ), selected AS (SELECT MIN(stage) AS stage FROM candidates)
  SELECT id, sku, name, category, tags, price_mnt, brand, description, available, merchandising_position, rank, stage, source, fuzzy_term, fuzzy_field, fuzzy_representation FROM candidates WHERE stage = (SELECT stage FROM selected) ORDER BY rank ASC, available DESC, merchandising_position ASC, id ASC LIMIT 500`;
  const started = performance.now();
  const result = await db.prepare(sql).bind(...fuzzyParams, compactSku(query), nativeExpression, strictExpression, basicExpression).all<TieredDbRow>();
  const selectedSource = result.results[0]?.source;
  const fuzzyProducts = selectedSource === "fuzzy_fallback" ? fuzzyMatches(result.results, query) : [];
  const products = selectedSource === "fuzzy_fallback" ? fuzzyProducts : result.results.slice(0, 20).map((product) => ({ ...product, confidence: product.source === "sku_exact" ? "exact" as const : product.source === "native" ? "high" as const : product.source === "strict_transliteration" ? "medium" as const : "low" as const, matched_field: fieldFor(product, query, product.source) }));
  const source: Source = products.length > 0 ? products[0]?.source ?? "basic_fallback" : selectedSource === "fuzzy_fallback" ? "basic_fallback" : selectedSource ?? "basic_fallback";
  return { products, sql_ms: Number((performance.now() - started).toFixed(2)), normalized_query: normalize(query), source, binding_calls: 1, exact_sku_count: products.filter((product) => product.source === "sku_exact").length };
};

const legacySearch = async (db: D1Database, query: string, mode: "strict" | "basic"): Promise<SearchResult> => ftsSearch(db, tokensFor(query, mode).map((terms) => `(${terms.map(ftsTerm).join(" OR ")})`).join(" AND "), query, mode === "strict" ? "strict_transliteration" : "basic_fallback");

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") return json({ ok: true, worker: "wf19-search-transliteration-worker", transliteration_version: TRANSLITERATION_VERSION });
    if (url.pathname === "/products" && request.method === "GET") {
      const rawLimit = url.searchParams.get("limit") ?? "20";
      const limit = Number(rawLimit);
      if (!Number.isInteger(limit) || limit < 1 || limit > 20) return json({ error: "invalid_limit", max: 20 }, 400);
      const category = (url.searchParams.get("category") ?? "").trim();
      const statement = category ? "SELECT name, sku, brand, category, price_mnt, available FROM products WHERE category = ? ORDER BY id ASC LIMIT ?" : "SELECT name, sku, brand, category, price_mnt, available FROM products ORDER BY id ASC LIMIT ?";
      const result = category ? await env.DB.prepare(statement).bind(category, limit).all() : await env.DB.prepare(statement).bind(limit).all();
      return json({ prototype: true, products: result.results.map((product) => ({ ...product, available: product.available === 1 })) });
    }
    if (url.pathname !== "/search" || request.method !== "GET") return json({ error: "not_found" }, 404);
    const query = url.searchParams.get("q") ?? "";
    const modeValue = url.searchParams.get("mode") ?? "strict";
    if (query.length > 120 || !["strict", "basic", "tiered"].includes(modeValue)) return json({ error: "invalid_query" }, 400);
    try {
      const mode: Mode = modeValue === "basic" ? "basic" : modeValue === "tiered" ? "tiered" : "strict";
      const started = performance.now();
      if (mode === "tiered") {
        const result = await tieredSearch(env.DB, query);
        return json({ mode, transliteration_version: TRANSLITERATION_VERSION, query, normalized_query: result.normalized_query, source: result.source, confidence: result.products[0]?.confidence ?? "low", ambiguity: result.source === "basic_fallback" && result.products.length > 1 || result.source === "fuzzy_fallback" && result.products.length > 1 ? "expose_multiple" : "none", products: result.products.map(publicProduct), counts: { exact_sku: result.exact_sku_count, lexical: result.products.length }, timing_ms: { total: Number((performance.now() - started).toFixed(2)), sql: result.sql_ms, binding_calls: result.binding_calls } });
      }
      const sku = compactSku(query);
      const skuStarted = performance.now();
      const exactSku = sku.length >= 4 ? await env.DB.prepare("SELECT id, sku, name, category, tags, price_mnt, brand, description, available, merchandising_position, 0 AS rank FROM products WHERE sku_normalized = ? LIMIT 20").bind(sku).all<ProductRow>() : { results: [] };
      const skuSqlMs = sku.length >= 4 ? performance.now() - skuStarted : 0;
      const lexical = await legacySearch(env.DB, query, mode);
      const exactProducts = exactSku.results.map((product) => ({ ...product, source: "sku_exact" as const, confidence: "exact" as const, matched_field: "sku" as const }));
      const source: Source = exactProducts.length > 0 ? "sku_exact" : lexical.source;
      const confidence: Confidence = source === "sku_exact" ? "exact" : source === "strict_transliteration" ? "medium" : "low";
      const products = [...exactProducts, ...lexical.products.filter((product) => !exactProducts.some((exact) => exact.id === product.id)).map((product) => ({ ...product, source, confidence }))];
      return json({ mode, transliteration_version: TRANSLITERATION_VERSION, query, normalized_query: lexical.normalized_query, source, confidence, ambiguity: source === "basic_fallback" && products.length > 1 ? "expose_multiple" : "none", products: products.map(publicProduct), counts: { exact_sku: exactProducts.length, lexical: lexical.products.length }, timing_ms: { total: Number((performance.now() - started).toFixed(2)), sql: Number((skuSqlMs + lexical.sql_ms).toFixed(2)), binding_calls: (sku.length >= 4 ? 1 : 0) + lexical.binding_calls } });
    } catch (error) {
      console.error(JSON.stringify({ message: "search_failed", error: error instanceof Error ? error.message : String(error) }));
      return json({ error: "search_failed" }, 500);
    }
  }
};

export { keyFor };
