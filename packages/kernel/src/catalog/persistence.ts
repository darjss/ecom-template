import {
  createProductId,
  createStockItemId,
  createVariantId,
  type CreateProductInput,
  type ProductId,
  type UpdateProductInput,
} from "@ecom/contracts";
import { and, count, eq, exists, gt, ne, notExists, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import {
  bundleComponents,
  catalogItems,
  cmsDocuments,
  optionGroups,
  optionValues,
  stockItems,
  variantOptionValues,
  variants,
} from "../db/schema";
import { database } from "../db/database";
import { catalogReaderQueries, findCatalogProductById } from "../catalog-reader/persistence";
import { catalogSku, compactSku } from "./sku";

const existsById = async (id: ProductId) => {
  const rows = await database()
    .select({ id: catalogItems.id })
    .from(catalogItems)
    .where(eq(catalogItems.id, id))
    .limit(1);
  return rows.length === 1;
};

const hasDuplicateSlug = async (slug: string, excludedId?: ProductId) => {
  const rows = await database()
    .select({ id: catalogItems.id })
    .from(catalogItems)
    .where(
      excludedId
        ? and(eq(catalogItems.slug, slug), ne(catalogItems.id, excludedId))
        : eq(catalogItems.slug, slug),
    )
    .limit(1);
  return rows.length === 1;
};

export const catalogQueries = {
  ...catalogReaderQueries,

  async create(input: CreateProductInput) {
    const id = createProductId();
    const variantId = createVariantId();
    const sku = catalogSku(input.slug, "variant", variantId);
    const stockItemId = createStockItemId();
    const now = new Date();
    const db = database();

    try {
      await db.batch([
        db.insert(catalogItems).values({
          id,
          kind: "product",
          slug: input.slug,
          state: "draft",
          name: input.name,
          description: input.description,
          priceMnt: input.priceMnt,
          createdAt: now,
          updatedAt: now,
        }),
        db.insert(variants).values({
          id: variantId,
          productId: id,
          isDefault: true,
          combinationKey: "__default__",
          sku,
          skuCompact: compactSku(sku),
          priceOverrideMnt: null,
          imageMediaAssetId: null,
          state: "active",
          createdAt: now,
          updatedAt: now,
        }),
        db.insert(stockItems).values({
          id: stockItemId,
          variantId,
          onHandQuantity: input.openingQuantity,
          reservedQuantity: 0,
          updatedAt: now,
        }),
      ]);
    } catch {
      return {
        kind: (await hasDuplicateSlug(input.slug))
          ? ("duplicate_slug" as const)
          : ("infrastructure" as const),
      };
    }

    const product = await findCatalogProductById(id);
    return product ? { kind: "changed" as const, product } : { kind: "infrastructure" as const };
  },

  async update(id: ProductId, input: UpdateProductInput) {
    const debtRevision = crypto.randomUUID();
    const now = new Date();
    const db = database();
    const productPredicate = eq(catalogItems.id, id);

    try {
      const results = await db.batch([
        db
          .update(catalogItems)
          .set({
            slug: input.slug,
            name: input.name,
            description: input.description,
            priceMnt: input.priceMnt,
            updatedAt: now,
          })
          .where(productPredicate)
          .returning({ state: catalogItems.state }),
      ] as const);
      const changed = results[0].at(0);
      if (changed) {
        const product = await findCatalogProductById(id);
        return product
          ? { kind: "changed" as const, product }
          : { kind: "infrastructure" as const };
      }
    } catch {
      return {
        kind: (await hasDuplicateSlug(input.slug, id))
          ? ("duplicate_slug" as const)
          : ("infrastructure" as const),
      };
    }

    return { kind: "not_found" as const };
  },

  async transition(id: ProductId, transition: "publish" | "archive" | "reactivate") {
    const current = await findCatalogProductById(id);
    if (!current) {
      const kind = (await existsById(id))
        ? ("invalid_publication" as const)
        : ("not_found" as const);
      return { kind };
    }

    const expected =
      transition === "publish" ? "draft" : transition === "archive" ? "published" : "archived";
    const next = transition === "archive" ? "archived" : "published";
    if (current.state === next) {
      return { kind: "changed" as const, product: current };
    }
    if (current.state !== expected) {
      return { kind: "invalid_lifecycle" as const };
    }

    const db = database();
    const publicationVariant = alias(variants, "publication_variant");
    const dependencyBundle = alias(catalogItems, "dependency_bundle");
    const publicationGroup = alias(optionGroups, "publication_group");
    const publicationMembership = alias(variantOptionValues, "publication_variant_option_value");
    const publicationValue = alias(optionValues, "publication_value");
    const duplicateMembership = alias(
      variantOptionValues,
      "duplicate_publication_variant_option_value",
    );
    const duplicateValue = alias(optionValues, "duplicate_publication_value");
    const duplicateVariant = alias(variants, "duplicate_publication_variant");
    const activeGroups = db
      .select({ id: publicationGroup.id })
      .from(publicationGroup)
      .where(
        and(eq(publicationGroup.productId, catalogItems.id), eq(publicationGroup.state, "active")),
      );
    const missingGroup = db
      .select({ id: publicationGroup.id })
      .from(publicationGroup)
      .where(
        and(
          eq(publicationGroup.productId, catalogItems.id),
          eq(publicationGroup.state, "active"),
          notExists(
            db
              .select({ id: publicationMembership.optionValueId })
              .from(publicationMembership)
              .innerJoin(
                publicationValue,
                eq(publicationValue.id, publicationMembership.optionValueId),
              )
              .where(
                and(
                  eq(publicationMembership.variantId, publicationVariant.id),
                  eq(publicationValue.optionGroupId, publicationGroup.id),
                  eq(publicationValue.state, "active"),
                ),
              ),
          ),
        ),
      );
    const invalidMembership = db
      .select({ id: publicationMembership.optionValueId })
      .from(publicationMembership)
      .innerJoin(publicationValue, eq(publicationValue.id, publicationMembership.optionValueId))
      .innerJoin(publicationGroup, eq(publicationGroup.id, publicationValue.optionGroupId))
      .where(
        and(
          eq(publicationMembership.variantId, publicationVariant.id),
          or(
            ne(publicationGroup.productId, catalogItems.id),
            ne(publicationGroup.state, "active"),
            ne(publicationValue.state, "active"),
          ),
        ),
      );
    const repeatedGroup = db
      .select({ optionGroupId: duplicateValue.optionGroupId })
      .from(duplicateMembership)
      .innerJoin(duplicateValue, eq(duplicateValue.id, duplicateMembership.optionValueId))
      .where(eq(duplicateMembership.variantId, publicationVariant.id))
      .groupBy(duplicateValue.optionGroupId)
      .having(gt(count(), 1));
    const invalidActiveVariant = db
      .select({ id: publicationVariant.id })
      .from(publicationVariant)
      .where(
        and(
          eq(publicationVariant.productId, catalogItems.id),
          eq(publicationVariant.state, "active"),
          or(
            sql`coalesce(${publicationVariant.priceOverrideMnt}, ${catalogItems.priceMnt}) <= 0`,
            sql`length(trim(${publicationVariant.sku})) = 0`,
            and(eq(publicationVariant.isDefault, true), exists(activeGroups)),
            and(eq(publicationVariant.isDefault, false), notExists(activeGroups)),
            and(
              eq(publicationVariant.isDefault, false),
              or(exists(missingGroup), exists(invalidMembership), exists(repeatedGroup)),
            ),
          ),
        ),
      );
    const activeDefaultVariant = db
      .select({ id: publicationVariant.id })
      .from(publicationVariant)
      .where(
        and(
          eq(publicationVariant.productId, catalogItems.id),
          eq(publicationVariant.isDefault, true),
          eq(publicationVariant.state, "active"),
          sql`length(trim(${publicationVariant.sku})) > 0`,
        ),
      );
    const activeExplicitVariant = db
      .select({ id: publicationVariant.id })
      .from(publicationVariant)
      .where(
        and(
          eq(publicationVariant.productId, catalogItems.id),
          eq(publicationVariant.isDefault, false),
          eq(publicationVariant.state, "active"),
          sql`length(trim(${publicationVariant.sku})) > 0`,
        ),
      );
    const duplicateCombination = db
      .select({ id: duplicateVariant.id })
      .from(duplicateVariant)
      .innerJoin(
        publicationVariant,
        and(
          eq(publicationVariant.productId, duplicateVariant.productId),
          eq(publicationVariant.combinationKey, duplicateVariant.combinationKey),
          sql`${publicationVariant.id} < ${duplicateVariant.id}`,
        ),
      )
      .where(
        and(
          eq(duplicateVariant.productId, catalogItems.id),
          eq(duplicateVariant.state, "active"),
          eq(publicationVariant.state, "active"),
        ),
      );
    const publishedBundleDependency = db
      .select({ id: bundleComponents.bundleId })
      .from(bundleComponents)
      .innerJoin(variants, eq(variants.id, bundleComponents.variantId))
      .innerJoin(dependencyBundle, eq(dependencyBundle.id, bundleComponents.bundleId))
      .where(
        and(
          eq(variants.productId, catalogItems.id),
          eq(dependencyBundle.kind, "bundle"),
          eq(dependencyBundle.state, "published"),
        ),
      );
    const publishedHomepageDependency = db
      .select({ kind: cmsDocuments.kind })
      .from(cmsDocuments)
      .where(
        and(
          eq(cmsDocuments.kind, "homepage"),
          eq(cmsDocuments.status, "published"),
          sql`EXISTS (SELECT 1 FROM json_each(${cmsDocuments.contentJson}, '$.featuredCatalogItemIds') WHERE value = ${id})`,
        ),
      );
    const publicationIsValid = and(
      sql`${catalogItems.priceMnt} > 0`,
      notExists(invalidActiveVariant),
      notExists(duplicateCombination),
      or(
        and(notExists(activeGroups), exists(activeDefaultVariant)),
        and(exists(activeGroups), exists(activeExplicitVariant)),
      ),
    );
    const transitionPredicate =
      transition === "archive"
        ? and(
            eq(catalogItems.id, id),
            eq(catalogItems.state, expected),
            notExists(publishedBundleDependency),
            notExists(publishedHomepageDependency),
          )
        : and(eq(catalogItems.id, id), eq(catalogItems.state, expected), publicationIsValid);
    const now = new Date();
    const transitionStatement = db
      .update(catalogItems)
      .set({
        state: next,
        updatedAt: now,
        publishedAt:
          next === "published"
            ? sql`coalesce(${catalogItems.publishedAt}, ${now.getTime()})`
            : undefined,
        archivedAt: next === "archived" ? now : null,
      })
      .where(transitionPredicate)
      .returning({ id: catalogItems.id });

    const transitioned = await transitionStatement;
    if (transitioned.length === 1) {
      const product = await findCatalogProductById(id);
      return product ? { kind: "changed" as const, product } : { kind: "infrastructure" as const };
    }

    const resolved = await findCatalogProductById(id);
    if (resolved?.state === next) {
      return { kind: "changed" as const, product: resolved };
    }
    const dependency =
      transition === "archive"
        ? await db
            .select({ id: bundleComponents.bundleId })
            .from(bundleComponents)
            .innerJoin(variants, eq(variants.id, bundleComponents.variantId))
            .innerJoin(dependencyBundle, eq(dependencyBundle.id, bundleComponents.bundleId))
            .where(
              and(
                eq(variants.productId, id),
                eq(dependencyBundle.kind, "bundle"),
                eq(dependencyBundle.state, "published"),
              ),
            )
            .limit(1)
        : [];
    const homepageDependency =
      transition === "archive"
        ? await db
            .select({ kind: cmsDocuments.kind })
            .from(cmsDocuments)
            .where(
              and(
                eq(cmsDocuments.kind, "homepage"),
                eq(cmsDocuments.status, "published"),
                sql`EXISTS (SELECT 1 FROM json_each(${cmsDocuments.contentJson}, '$.featuredCatalogItemIds') WHERE value = ${id})`,
              ),
            )
            .limit(1)
        : [];
    const kind =
      dependency.length > 0
        ? "published_bundle_dependency"
        : homepageDependency.length > 0
          ? "published_cms_dependency"
          : resolved && resolved.state !== expected
            ? "invalid_lifecycle"
            : "invalid_publication";
    return { kind } as const;
  },
};
