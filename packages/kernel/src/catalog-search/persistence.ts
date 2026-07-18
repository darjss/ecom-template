import {
  BundleIdSchema,
  CatalogItemIdSchema,
  CatalogItemSearchResultSchema,
  ProductIdSchema,
  type CatalogItemSearchResult,
  type CatalogSearchResponse,
} from "@ecom/contracts";
import { env } from "cloudflare:workers";
import { and, asc, eq, or } from "drizzle-orm";
import * as v from "valibot";
import { catalogMediaQueries } from "../catalog-media/persistence";
import { compactSku } from "../catalog/sku";
import { database } from "../db/database";
import {
  catalogItemCategories,
  catalogItemCollections,
  catalogItems,
  categories,
  collections,
  skus,
  variants,
} from "../db/schema";

const normalizationVersion = "krilleer-cyr-lat-v1" as const;
const cyrillicToLatin = new Map([
  ["щ", "shch"],
  ["ш", "sh"],
  ["ч", "ch"],
  ["ц", "c"],
  ["ё", "yo"],
  ["ю", "yu"],
  ["я", "ya"],
  ["е", "ye"],
  ["ж", "j"],
  ["х", "h"],
  ["а", "a"],
  ["б", "b"],
  ["в", "v"],
  ["г", "g"],
  ["д", "d"],
  ["э", "e"],
  ["з", "z"],
  ["и", "i"],
  ["й", "yy"],
  ["к", "k"],
  ["л", "l"],
  ["м", "m"],
  ["н", "n"],
  ["о", "o"],
  ["п", "p"],
  ["р", "r"],
  ["с", "s"],
  ["т", "t"],
  ["у", "u"],
  ["ф", "f"],
  ["ө", "q"],
  ["ү", "w"],
  ["ы", "y"],
  ["ь", "ь"],
  ["ъ", "'"],
]);

export const normalizeSearchText = (value: string) =>
  value
    .normalize("NFKC")
    .toLocaleLowerCase("mn")
    .replaceAll(/[\p{White_Space}\p{P}\p{S}]+/gu, " ")
    .trim()
    .replaceAll(/\s+/g, " ");

const transliterate = (value: string) =>
  [...normalizeSearchText(value)]
    .map((character) => cyrillicToLatin.get(character) ?? character)
    .join("");

const matchExpression = (value: string, columns: readonly string[]) =>
  value
    .split(" ")
    .filter(Boolean)
    .map((token) => {
      const term = `"${token.replaceAll('"', '""')}"*`;
      return `(${columns.map((column) => `${column} : ${term}`).join(" OR ")})`;
    })
    .join(" AND ");

const SearchRowSchema = v.strictObject({
  item_id: v.string(),
  kind: v.picklist(["product", "bundle"]),
  slug: v.string(),
  title: v.string(),
  description: v.string(),
  facets: v.string(),
  price_mnt: v.number(),
  rank: v.number(),
});
type SearchRow = v.InferOutput<typeof SearchRowSchema>;

const searchRows = async (
  match: string,
  category: string | undefined,
  collection: string | undefined,
  limit: number,
  offset: number,
) => {
  const filters = ["catalog_search MATCH ?", "item.state = 'published'"];
  const bindings: (string | number)[] = [match];
  if (category) {
    filters.push(
      "EXISTS (SELECT 1 FROM catalog_item_categories membership JOIN categories category ON category.id = membership.category_id WHERE membership.catalog_item_id = item.id AND category.state = 'active' AND category.slug = ?)",
    );
    bindings.push(category);
  }
  if (collection) {
    filters.push(
      "EXISTS (SELECT 1 FROM catalog_item_collections membership JOIN collections collection ON collection.id = membership.collection_id WHERE membership.catalog_item_id = item.id AND collection.state = 'active' AND collection.slug = ?)",
    );
    bindings.push(collection);
  }
  bindings.push(limit, offset);
  const result = await env.DB.prepare(`
    SELECT catalog_search.item_id, catalog_search.kind, item.slug, item.name AS title,
      item.description, catalog_search.facets, item.price_mnt, bm25(catalog_search, 0, 0, 1, 4, 1.5, 2, 1) AS rank
    FROM catalog_search
    JOIN catalog_items item ON item.id = catalog_search.item_id
    WHERE ${filters.join(" AND ")}
    ORDER BY rank ASC, item.name COLLATE NOCASE ASC, item.id ASC
    LIMIT ? OFFSET ?
  `)
    .bind(...bindings)
    .all();
  return result.results.map((row) => v.parse(SearchRowSchema, row));
};

const exactSku = async (query: string, category?: string, collection?: string) => {
  const db = database();
  const rows = await db
    .select({
      itemId: catalogItems.id,
      kind: catalogItems.kind,
      slug: catalogItems.slug,
      name: catalogItems.name,
      description: catalogItems.description,
      priceMnt: catalogItems.priceMnt,
    })
    .from(skus)
    .leftJoin(variants, eq(variants.id, skus.variantId))
    .innerJoin(
      catalogItems,
      or(eq(catalogItems.id, variants.productId), eq(catalogItems.id, skus.bundleId)),
    )
    .where(and(eq(skus.skuCompact, compactSku(query)), eq(catalogItems.state, "published")))
    .limit(1);
  const row = rows.at(0);
  if (!row) return undefined;
  if (category) {
    const membership = await db
      .select({ id: catalogItemCategories.catalogItemId })
      .from(catalogItemCategories)
      .innerJoin(categories, eq(categories.id, catalogItemCategories.categoryId))
      .where(
        and(
          eq(catalogItemCategories.catalogItemId, row.itemId),
          eq(categories.slug, category),
          eq(categories.state, "active"),
        ),
      )
      .limit(1);
    if (membership.length === 0) return undefined;
  }
  if (collection) {
    const membership = await db
      .select({ id: catalogItemCollections.catalogItemId })
      .from(catalogItemCollections)
      .innerJoin(collections, eq(collections.id, catalogItemCollections.collectionId))
      .where(
        and(
          eq(catalogItemCollections.catalogItemId, row.itemId),
          eq(collections.slug, collection),
          eq(collections.state, "active"),
        ),
      )
      .limit(1);
    if (membership.length === 0) return undefined;
  }
  return row;
};

const imagesByItem = async (ids: readonly string[]) => {
  const parsedIds = ids.map((id) => v.parse(CatalogItemIdSchema, id));
  const images = await catalogMediaQueries.listForCatalogItems(parsedIds);
  return new Map(
    parsedIds.map((id) => [
      id,
      images.filter((entry) => entry.catalogItemId === id).map(({ image }) => image),
    ]),
  );
};

const fieldFor = (
  row: SearchRow,
  normalized: string,
  source: "native" | "krilleer_transliteration",
) => {
  const first = normalized.split(" ")[0] ?? normalized;
  const comparable = (value: string) =>
    source === "native" ? normalizeSearchText(value) : transliterate(value);
  if (comparable(row.slug).includes(first)) return "slug" as const;
  if (comparable(row.title).includes(first)) return "title" as const;
  if (comparable(row.facets).includes(first)) return "category_tags" as const;
  return "description" as const;
};

const projectRows = async (
  rows: readonly SearchRow[],
  source: "native" | "krilleer_transliteration",
  normalized: string,
  ambiguous: boolean,
) => {
  const images = await imagesByItem(rows.map(({ item_id }) => item_id));
  return rows.map((row) =>
    v.parse(CatalogItemSearchResultSchema, {
      kind: row.kind,
      id:
        row.kind === "product"
          ? v.parse(ProductIdSchema, row.item_id)
          : v.parse(BundleIdSchema, row.item_id),
      slug: row.slug,
      name: row.title,
      description: row.description,
      priceMnt: row.price_mnt,
      images: images.get(v.parse(CatalogItemIdSchema, row.item_id)) ?? [],
      matchedSource: source,
      matchedField: fieldFor(row, normalized, source),
      confidence: source === "native" ? "high" : ambiguous ? "low" : "medium",
    }),
  );
};

const shortcutLists = async (query: string) => {
  const [categoryRows, collectionRows] = await Promise.all([
    database()
      .select({ id: categories.id, slug: categories.slug, name: categories.name })
      .from(categories)
      .where(eq(categories.state, "active"))
      .orderBy(asc(categories.name), asc(categories.id)),
    database()
      .select({ id: collections.id, slug: collections.slug, name: collections.name })
      .from(collections)
      .where(eq(collections.state, "active"))
      .orderBy(asc(collections.name), asc(collections.id)),
  ]);
  const native = normalizeSearchText(query);
  const latin = transliterate(query);
  const matches = ({ name }: { readonly name: string }) => {
    const normalizedName = normalizeSearchText(name);
    return normalizedName.includes(native) || transliterate(normalizedName).includes(latin);
  };
  return {
    categories: categoryRows
      .filter(matches)
      .slice(0, 3)
      .map((row) => ({
        kind: "category" as const,
        id: row.id,
        label: row.name,
        slug: row.slug,
        url: `/categories/${row.slug}`,
      })),
    collections: collectionRows
      .filter(matches)
      .slice(0, 3)
      .map((row) => ({
        kind: "collection" as const,
        id: row.id,
        label: row.name,
        slug: row.slug,
        url: `/collections/${row.slug}`,
      })),
  };
};

export type CatalogSearchInput = {
  readonly query: string;
  readonly category?: string;
  readonly collection?: string;
  readonly page: number;
  readonly limit: number;
};

export const catalogSearchQueries = {
  async search(input: CatalogSearchInput): Promise<CatalogSearchResponse> {
    const normalized = normalizeSearchText(input.query);
    const offset = (input.page - 1) * input.limit;
    const sku = await exactSku(input.query, input.category, input.collection);
    let items: CatalogItemSearchResult[] = [];
    let hasNext = false;
    let ambiguity: CatalogSearchResponse["ambiguity"] = null;
    if (sku && input.page === 1) {
      const images = await imagesByItem([sku.itemId]);
      items = [
        v.parse(CatalogItemSearchResultSchema, {
          kind: sku.kind,
          id: sku.itemId,
          slug: sku.slug,
          name: sku.name,
          description: sku.description,
          priceMnt: sku.priceMnt,
          images: images.get(v.parse(CatalogItemIdSchema, sku.itemId)) ?? [],
          matchedSource: "sku_exact",
          matchedField: "sku",
          confidence: "exact",
        }),
      ];
    } else if (!sku) {
      const nativeMatch = matchExpression(normalized, ["slug", "title", "description", "facets"]);
      let rows = await searchRows(
        nativeMatch,
        input.category,
        input.collection,
        input.limit + 1,
        offset,
      );
      const nativeExists =
        rows.length > 0 ||
        (input.page > 1 &&
          (await searchRows(nativeMatch, input.category, input.collection, 1, 0)).length > 0);
      let source: "native" | "krilleer_transliteration" = "native";
      let matched = normalized;
      if (!nativeExists) {
        source = "krilleer_transliteration";
        matched = transliterate(normalized);
        rows = await searchRows(
          matchExpression(matched, ["latin"]),
          input.category,
          input.collection,
          input.limit + 1,
          offset,
        );
      }
      hasNext = rows.length > input.limit;
      const pageRows = rows.slice(0, input.limit);
      const ambiguityRows =
        source === "krilleer_transliteration" && input.page > 1
          ? await searchRows(
              matchExpression(matched, ["latin"]),
              input.category,
              input.collection,
              8,
              0,
            )
          : rows.slice(0, 8);
      const ambiguous = source === "krilleer_transliteration" && ambiguityRows.length > 1;
      items = await projectRows(pageRows, source, matched, ambiguous);
      ambiguity = ambiguous
        ? {
            confidence: "low",
            candidateIds: ambiguityRows.map(({ item_id }) => v.parse(CatalogItemIdSchema, item_id)),
          }
        : null;
    }
    return {
      query: input.query,
      normalizationVersion,
      results: { items, page: input.page, pageSize: input.limit, hasNext },
      ambiguity,
      shortcuts: await shortcutLists(input.query),
    };
  },

  async diagnostics() {
    const result = await env.DB.prepare(
      "SELECT canonical_count, projection_count, missing_count, orphan_count, duplicate_count FROM catalog_search_diagnostics",
    ).first();
    return v.parse(
      v.strictObject({
        canonical_count: v.number(),
        projection_count: v.number(),
        missing_count: v.number(),
        orphan_count: v.number(),
        duplicate_count: v.number(),
      }),
      result,
    );
  },

  async repair() {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM catalog_search"),
      env.DB.prepare(
        "INSERT INTO catalog_search(item_id, kind, slug, title, description, facets, latin) SELECT item_id, kind, slug, title, description, facets, latin FROM catalog_search_documents",
      ),
    ]);
    return this.diagnostics();
  },
};
