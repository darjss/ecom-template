import {
  BundleIdSchema,
  CatalogItemIdSchema,
  CatalogItemSearchResultSchema,
  ProductIdSchema,
  type CatalogItemSearchResult,
  type CatalogSearchResponse,
} from "@ecom/contracts";
import { env } from "cloudflare:workers";
import { and, asc, eq } from "drizzle-orm";
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
  variants,
} from "../db/schema";
import {
  catalogSearchDocumentVersion,
  normalizeSearchText,
  searchTokens,
  transliterateSearchText,
} from "./document";

const nativePlans = [
  { column: "title", field: "title", priority: 0 },
  { column: "slug", field: "slug", priority: 1 },
  { column: "facets", field: "category_tags", priority: 2 },
  { column: "description", field: "description", priority: 3 },
] as const;
const transliterationPlans = [
  { column: "latin_title", field: "title", priority: 0 },
  { column: "latin_slug", field: "slug", priority: 1 },
  { column: "latin_facets", field: "category_tags", priority: 2 },
  { column: "latin_description", field: "description", priority: 3 },
] as const;
type SearchPlan = (typeof nativePlans)[number] | (typeof transliterationPlans)[number];

const matchExpression = (tokens: readonly string[], columns: readonly SearchPlan["column"][]) => {
  const scope = columns.length === 1 ? columns[0] : `{${columns.join(" ")}}`;
  return tokens.map((token) => `${scope} : "${token.replaceAll('"', '""')}"*`).join(" AND ");
};

const SearchRowSchema = v.strictObject({
  item_id: v.string(),
  kind: v.picklist(["product", "bundle"]),
  slug: v.string(),
  title: v.string(),
  description: v.string(),
  price_mnt: v.number(),
  matched_field: v.picklist(["slug", "title", "category_tags", "description", "mixed"]),
  rank: v.number(),
});
type SearchRow = v.InferOutput<typeof SearchRowSchema>;

const searchRows = async (
  tokens: readonly string[],
  plans: readonly SearchPlan[],
  category: string | undefined,
  collection: string | undefined,
  limit: number,
  offset: number,
) => {
  const fieldMatches = [
    ...plans.map(
      ({ field, priority }) => `
        SELECT item_id, kind, bm25(catalog_search, 0, 0, 0, 0, 3, 6, 1, 2, 3, 6, 1, 2) AS rank,
          '${field}' AS matched_field, ${priority} AS field_priority, 0 AS scope_priority
        FROM catalog_search
        WHERE catalog_search MATCH ?`,
    ),
    `
        SELECT item_id, kind, bm25(catalog_search, 0, 0, 0, 0, 3, 6, 1, 2, 3, 6, 1, 2) AS rank,
          'mixed' AS matched_field, ${plans.length} AS field_priority, 1 AS scope_priority
        FROM catalog_search
        WHERE catalog_search MATCH ?`,
  ].join(" UNION ALL ");
  const filters = ["best.field_rank = 1", "item.state = 'published'"];
  const bindings: (string | number)[] = [
    ...plans.map(({ column }) => matchExpression(tokens, [column])),
    matchExpression(
      tokens,
      plans.map(({ column }) => column),
    ),
  ];
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
    WITH field_matches AS (${fieldMatches}),
    best AS (
      SELECT *, row_number() OVER (
        PARTITION BY item_id ORDER BY scope_priority ASC, rank ASC, field_priority ASC
      ) AS field_rank
      FROM field_matches
    )
    SELECT best.item_id, best.kind, item.slug, item.name AS title, item.description,
      item.price_mnt, best.matched_field, best.rank
    FROM best
    JOIN catalog_items item ON item.id = best.item_id
    WHERE ${filters.join(" AND ")}
    ORDER BY best.rank ASC, best.field_priority ASC, item.name COLLATE NOCASE ASC, item.id ASC
    LIMIT ? OFFSET ?
  `)
    .bind(...bindings)
    .all();
  return result.results.map((row) => v.parse(SearchRowSchema, row));
};

const exactSku = async (query: string, category?: string, collection?: string) => {
  const db = database();
  const selection = {
    itemId: catalogItems.id,
    kind: catalogItems.kind,
    slug: catalogItems.slug,
    name: catalogItems.name,
    description: catalogItems.description,
    priceMnt: catalogItems.priceMnt,
  };
  const skuCompact = compactSku(query);
  const [bundleRows, variantRows] = await db.batch([
    db
      .select(selection)
      .from(catalogItems)
      .where(
        and(
          eq(catalogItems.kind, "bundle"),
          eq(catalogItems.skuCompact, skuCompact),
          eq(catalogItems.state, "published"),
        ),
      )
      .limit(1),
    db
      .select(selection)
      .from(variants)
      .innerJoin(catalogItems, eq(catalogItems.id, variants.productId))
      .where(
        and(
          eq(variants.skuCompact, skuCompact),
          eq(variants.state, "active"),
          eq(catalogItems.state, "published"),
        ),
      )
      .limit(1),
  ] as const);
  const row = variantRows.at(0) ?? bundleRows.at(0);
  if (!row) {
    return undefined;
  }
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
    if (membership.length === 0) {
      return undefined;
    }
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
    if (membership.length === 0) {
      return undefined;
    }
  }
  return row;
};

const imagesByItem = async (ids: readonly string[]) => {
  const parsedIds = ids.map((id) => v.parse(CatalogItemIdSchema, id));
  const images = await catalogMediaQueries.listPublicForCatalogItems(parsedIds);
  return new Map(
    parsedIds.map((id) => [
      id,
      images.filter((entry) => entry.catalogItemId === id).map(({ image }) => image),
    ]),
  );
};

const searchRowId = (row: SearchRow) =>
  row.kind === "product"
    ? v.parse(ProductIdSchema, row.item_id)
    : v.parse(BundleIdSchema, row.item_id);

const projectRows = async (
  rows: readonly SearchRow[],
  source: "native" | "krilleer_transliteration",
  ambiguous: boolean,
) => {
  const images = await imagesByItem(rows.map(({ item_id }) => item_id));
  return rows.map((row) =>
    v.parse(CatalogItemSearchResultSchema, {
      kind: row.kind,
      id: searchRowId(row),
      slug: row.slug,
      name: row.title,
      description: row.description,
      priceMnt: row.price_mnt,
      images: images.get(v.parse(CatalogItemIdSchema, row.item_id)) ?? [],
      matchedSource: source,
      matchedField: row.matched_field,
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
  const nativeTokens = searchTokens(query);
  const latinTokens = searchTokens(transliterateSearchText(query));
  const matches = ({ name }: { readonly name: string }) => {
    const nativeName = normalizeSearchText(name).toLowerCase();
    const latinName = transliterateSearchText(name);
    return (
      nativeTokens.every((token) => nativeName.includes(token)) ||
      (latinTokens.length > 0 && latinTokens.every((token) => latinName.includes(token)))
    );
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

const diagnostics = async () => {
  const result = await env.DB.prepare(
    "SELECT canonical_count, projection_count, missing_count, orphan_count, duplicate_count, mismatched_count FROM catalog_search_diagnostics",
  ).first();
  return v.parse(
    v.strictObject({
      canonical_count: v.number(),
      projection_count: v.number(),
      missing_count: v.number(),
      orphan_count: v.number(),
      duplicate_count: v.number(),
      mismatched_count: v.number(),
    }),
    result,
  );
};

export const catalogSearchQueries = {
  async search(input: CatalogSearchInput): Promise<CatalogSearchResponse> {
    const nativeTokens = searchTokens(input.query);
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
      let rows = await searchRows(
        nativeTokens,
        nativePlans,
        input.category,
        input.collection,
        input.limit + 1,
        offset,
      );
      const nativeExists =
        rows.length > 0 ||
        (input.page > 1 &&
          (await searchRows(nativeTokens, nativePlans, input.category, input.collection, 1, 0))
            .length > 0);
      let source: "native" | "krilleer_transliteration" = "native";
      let ambiguous = false;
      if (!nativeExists) {
        source = "krilleer_transliteration";
        const transliterationTokens = searchTokens(transliterateSearchText(input.query));
        if (transliterationTokens.length > 0) {
          rows = await searchRows(
            transliterationTokens,
            transliterationPlans,
            input.category,
            input.collection,
            input.limit + 1,
            offset,
          );
          const ambiguityLimit = Math.max(2, input.limit);
          const candidates =
            input.page === 1
              ? rows.slice(0, ambiguityLimit)
              : await searchRows(
                  transliterationTokens,
                  transliterationPlans,
                  input.category,
                  input.collection,
                  ambiguityLimit,
                  0,
                );
          ambiguous = candidates.length > 1;
          if (ambiguous) {
            ambiguity = { confidence: "low", candidateIds: candidates.map(searchRowId) };
          }
        }
      }
      hasNext = rows.length > input.limit;
      items = await projectRows(rows.slice(0, input.limit), source, ambiguous);
    }
    return {
      query: input.query,
      normalizationVersion: catalogSearchDocumentVersion,
      results: { items, page: input.page, pageSize: input.limit, hasNext },
      ambiguity,
      shortcuts: await shortcutLists(input.query),
    };
  },

  diagnostics,

  async repair() {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM catalog_search"),
      env.DB.prepare(
        "INSERT INTO catalog_search(item_id, kind, document_version, fingerprint, slug, title, description, facets, latin_slug, latin_title, latin_description, latin_facets) SELECT item_id, kind, document_version, fingerprint, slug, title, description, facets, latin_slug, latin_title, latin_description, latin_facets FROM catalog_search_documents",
      ),
    ]);
    return diagnostics();
  },
};
