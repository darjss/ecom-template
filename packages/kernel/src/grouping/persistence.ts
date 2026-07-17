import {
  createCategoryId,
  createCollectionId,
  createTagId,
  type CategoryId,
  type CategoryInput,
  type CollectionId,
  type CollectionInput,
  type CatalogItemId,
  type GroupingMembershipInput,
  type GroupingState,
  type TagId,
  type TagInput,
} from "@ecom/contracts";
import { and, asc, eq, exists, inArray, isNull, ne, notExists, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import {
  catalogItemCategories,
  catalogItemCollections,
  catalogItems,
  catalogItemTags,
  catalogListingCachePurgeDebt,
  categories,
  collections,
  tags,
} from "../db/schema";
import { database } from "../db/database";

const timestamp = (value: Date | null) => value?.toISOString() ?? null;
const catalogDebtStatement = (now: Date) => {
  const revision = crypto.randomUUID();
  return database()
    .insert(catalogListingCachePurgeDebt)
    .values({
      key: "catalog",
      revision,
      attemptCount: 0,
      requestId: null,
      commandCommittedAt: now,
      lastAttemptedAt: null,
    })
    .onConflictDoUpdate({
      target: catalogListingCachePurgeDebt.key,
      set: {
        revision,
        attemptCount: 0,
        requestId: null,
        commandCommittedAt: now,
        lastAttemptedAt: null,
      },
    });
};
const categoryDto = (row: typeof categories.$inferSelect, catalogItemIds: string[]) => ({
  kind: "category" as const,
  id: row.id,
  slug: row.slug,
  name: row.name,
  parentId: row.parentId,
  position: row.position,
  state: row.state,
  catalogItemIds,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  activatedAt: timestamp(row.activatedAt),
  archivedAt: timestamp(row.archivedAt),
});
const collectionDto = (row: typeof collections.$inferSelect, catalogItemIds: string[]) => ({
  kind: "collection" as const,
  id: row.id,
  slug: row.slug,
  name: row.name,
  description: row.description,
  state: row.state,
  catalogItemIds,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  activatedAt: timestamp(row.activatedAt),
  archivedAt: timestamp(row.archivedAt),
});
const tagDto = (row: typeof tags.$inferSelect, catalogItemIds: string[]) => ({
  kind: "tag" as const,
  id: row.id,
  label: row.label,
  state: row.state,
  catalogItemIds,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  activatedAt: timestamp(row.activatedAt),
  archivedAt: timestamp(row.archivedAt),
});

const categoryCatalogItemIds = async (id: string) =>
  database()
    .select({ id: catalogItemCategories.catalogItemId })
    .from(catalogItemCategories)
    .where(eq(catalogItemCategories.categoryId, id))
    .orderBy(asc(catalogItemCategories.catalogItemId))
    .then((rows) => rows.map((row) => row.id));
const collectionCatalogItemIds = async (id: string) =>
  database()
    .select({ id: catalogItemCollections.catalogItemId })
    .from(catalogItemCollections)
    .where(eq(catalogItemCollections.collectionId, id))
    .orderBy(asc(catalogItemCollections.position))
    .then((rows) => rows.map((row) => row.id));
const tagCatalogItemIds = async (id: string) =>
  database()
    .select({ id: catalogItemTags.catalogItemId })
    .from(catalogItemTags)
    .where(eq(catalogItemTags.tagId, id))
    .orderBy(asc(catalogItemTags.catalogItemId))
    .then((rows) => rows.map((row) => row.id));

const findCategory = async (id: CategoryId) => {
  const [row] = await database().select().from(categories).where(eq(categories.id, id)).limit(1);
  return row ? categoryDto(row, await categoryCatalogItemIds(row.id)) : undefined;
};
const findCollection = async (id: CollectionId) => {
  const [row] = await database().select().from(collections).where(eq(collections.id, id)).limit(1);
  return row ? collectionDto(row, await collectionCatalogItemIds(row.id)) : undefined;
};
const findTag = async (id: TagId) => {
  const [row] = await database().select().from(tags).where(eq(tags.id, id)).limit(1);
  return row ? tagDto(row, await tagCatalogItemIds(row.id)) : undefined;
};
const categoryHasActiveChild = async (id: CategoryId) =>
  (
    await database()
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.parentId, id), eq(categories.state, "active")))
      .limit(1)
  ).length > 0;

const categorySlugExists = async (slug: string, excludedId?: CategoryId) => {
  const where = excludedId
    ? and(eq(categories.slug, slug), ne(categories.id, excludedId))
    : eq(categories.slug, slug);
  return (
    (await database().select({ id: categories.id }).from(categories).where(where).limit(1)).length >
    0
  );
};
const collectionSlugExists = async (slug: string, excludedId?: CollectionId) => {
  const where = excludedId
    ? and(eq(collections.slug, slug), ne(collections.id, excludedId))
    : eq(collections.slug, slug);
  return (
    (await database().select({ id: collections.id }).from(collections).where(where).limit(1))
      .length > 0
  );
};
const normalizedTagLabel = (label: string) => label.trim().toLocaleLowerCase("mn");
const tagLabelExists = async (normalizedLabel: string, excludedId?: TagId) => {
  const where = excludedId
    ? and(eq(tags.normalizedLabel, normalizedLabel), ne(tags.id, excludedId))
    : eq(tags.normalizedLabel, normalizedLabel);
  return (await database().select({ id: tags.id }).from(tags).where(where).limit(1)).length > 0;
};

const validateCatalogItemIds = async (catalogItemIds: readonly CatalogItemId[]) => {
  if (catalogItemIds.length === 0) {
    return true;
  }
  const rows = await database()
    .select({ id: catalogItems.id })
    .from(catalogItems)
    .where(inArray(catalogItems.id, catalogItemIds));
  return rows.length === catalogItemIds.length;
};

export const groupingQueries = {
  findCategory,
  findCollection,
  findTag,

  async listAll() {
    const [
      categoryRows,
      collectionRows,
      tagRows,
      catalogItemRows,
      cacheDebtRows,
      categoryMemberships,
      collectionMemberships,
      tagMemberships,
    ] = await Promise.all([
      database()
        .select()
        .from(categories)
        .orderBy(asc(categories.position), asc(categories.name), asc(categories.id)),
      database().select().from(collections).orderBy(asc(collections.name), asc(collections.id)),
      database().select().from(tags).orderBy(asc(tags.normalizedLabel), asc(tags.id)),
      database()
        .select({
          id: catalogItems.id,
          kind: catalogItems.kind,
          name: catalogItems.name,
          state: catalogItems.state,
        })
        .from(catalogItems)
        .orderBy(asc(catalogItems.name), asc(catalogItems.id)),
      database().select().from(catalogListingCachePurgeDebt).limit(1),
      database()
        .select({
          groupingId: catalogItemCategories.categoryId,
          catalogItemId: catalogItemCategories.catalogItemId,
        })
        .from(catalogItemCategories)
        .orderBy(asc(catalogItemCategories.catalogItemId)),
      database()
        .select({
          groupingId: catalogItemCollections.collectionId,
          catalogItemId: catalogItemCollections.catalogItemId,
        })
        .from(catalogItemCollections)
        .orderBy(asc(catalogItemCollections.position)),
      database()
        .select({ groupingId: catalogItemTags.tagId, catalogItemId: catalogItemTags.catalogItemId })
        .from(catalogItemTags)
        .orderBy(asc(catalogItemTags.catalogItemId)),
    ]);
    return {
      categories: categoryRows.map((row) =>
        categoryDto(
          row,
          categoryMemberships
            .filter((membership) => membership.groupingId === row.id)
            .map((membership) => membership.catalogItemId),
        ),
      ),
      collections: collectionRows.map((row) =>
        collectionDto(
          row,
          collectionMemberships
            .filter((membership) => membership.groupingId === row.id)
            .map((membership) => membership.catalogItemId),
        ),
      ),
      tags: tagRows.map((row) =>
        tagDto(
          row,
          tagMemberships
            .filter((membership) => membership.groupingId === row.id)
            .map((membership) => membership.catalogItemId),
        ),
      ),
      catalogItems: catalogItemRows,
      cachePurgeDebt: cacheDebtRows[0]
        ? {
            attemptCount: cacheDebtRows[0].attemptCount,
            requestId: cacheDebtRows[0].requestId,
            lastAttemptedAt: timestamp(cacheDebtRows[0].lastAttemptedAt),
          }
        : null,
    };
  },

  async validateCategoryParent(id: CategoryId | undefined, parentId: CategoryId | null) {
    if (!parentId) {
      return { kind: "valid" as const, lineage: [] };
    }
    const lineage: { id: string; parentId: string | null; state: GroupingState }[] = [];
    let current: string | null = parentId;
    for (let depth = 0; depth < 100; depth += 1) {
      if (current === id) {
        return { kind: "cycle" as const };
      }
      const [row] = await database()
        .select({ id: categories.id, parentId: categories.parentId, state: categories.state })
        .from(categories)
        .where(eq(categories.id, current))
        .limit(1);
      if (!row) {
        return { kind: "not_found" as const };
      }
      lineage.push(row);
      current = row.parentId;
      if (!current) {
        return { kind: "valid" as const, lineage };
      }
    }
    return { kind: "cycle" as const };
  },

  async createCategory(input: CategoryInput) {
    if (await categorySlugExists(input.slug)) {
      return { kind: "duplicate_slug" as const };
    }
    const id = createCategoryId();
    const now = new Date();
    try {
      await database().batch([
        database()
          .insert(categories)
          .values({ id, ...input, state: "draft", createdAt: now, updatedAt: now }),
        catalogDebtStatement(now),
      ]);
      return { kind: "changed" as const, value: await findCategory(id) };
    } catch {
      return {
        kind: (await categorySlugExists(input.slug))
          ? ("duplicate_slug" as const)
          : ("infrastructure" as const),
      };
    }
  },

  async updateCategory(
    id: CategoryId,
    input: CategoryInput,
    lineage: readonly { id: string; parentId: string | null; state: GroupingState }[],
  ) {
    const current = await findCategory(id);
    if (!current) {
      return { kind: "not_found" as const };
    }
    if (current.activatedAt && current.slug !== input.slug) {
      return { kind: "slug_locked" as const };
    }
    if (await categorySlugExists(input.slug, id)) {
      return { kind: "duplicate_slug" as const };
    }
    if (current.state === "active" && lineage.some((ancestor) => ancestor.state !== "active")) {
      return { kind: "inactive_ancestor" as const };
    }
    const db = database();
    const lineagePredicates: SQL[] = lineage.map((ancestor, index) => {
      const categoryAncestor = alias(categories, `category_update_ancestor_${index}`);
      return exists(
        db
          .select({ id: categoryAncestor.id })
          .from(categoryAncestor)
          .where(
            and(
              eq(categoryAncestor.id, ancestor.id),
              ancestor.parentId
                ? eq(categoryAncestor.parentId, ancestor.parentId)
                : isNull(categoryAncestor.parentId),
              current.state === "active" ? eq(categoryAncestor.state, "active") : undefined,
            ),
          ),
      );
    });
    const now = new Date();
    try {
      const changed = (
        await db.batch([
          db
            .update(categories)
            .set({ ...input, updatedAt: now })
            .where(and(eq(categories.id, id), ...lineagePredicates))
            .returning({ id: categories.id }),
          catalogDebtStatement(now),
        ])
      )[0];
      return changed.length === 1
        ? { kind: "changed" as const, value: await findCategory(id) }
        : { kind: "concurrent_parent_change" as const };
    } catch {
      return {
        kind: (await categorySlugExists(input.slug, id))
          ? ("duplicate_slug" as const)
          : ("infrastructure" as const),
      };
    }
  },

  async createCollection(input: CollectionInput) {
    if (await collectionSlugExists(input.slug)) {
      return { kind: "duplicate_slug" as const };
    }
    const id = createCollectionId();
    const now = new Date();
    try {
      await database().batch([
        database()
          .insert(collections)
          .values({ id, ...input, state: "draft", createdAt: now, updatedAt: now }),
        catalogDebtStatement(now),
      ]);
      return { kind: "changed" as const, value: await findCollection(id) };
    } catch {
      return {
        kind: (await collectionSlugExists(input.slug))
          ? ("duplicate_slug" as const)
          : ("infrastructure" as const),
      };
    }
  },

  async updateCollection(id: CollectionId, input: CollectionInput) {
    const current = await findCollection(id);
    if (!current) {
      return { kind: "not_found" as const };
    }
    if (current.activatedAt && current.slug !== input.slug) {
      return { kind: "slug_locked" as const };
    }
    if (await collectionSlugExists(input.slug, id)) {
      return { kind: "duplicate_slug" as const };
    }
    const now = new Date();
    try {
      await database().batch([
        database()
          .update(collections)
          .set({ ...input, updatedAt: now })
          .where(eq(collections.id, id)),
        catalogDebtStatement(now),
      ]);
      return { kind: "changed" as const, value: await findCollection(id) };
    } catch {
      return {
        kind: (await collectionSlugExists(input.slug, id))
          ? ("duplicate_slug" as const)
          : ("infrastructure" as const),
      };
    }
  },

  async createTag(input: TagInput) {
    const normalizedLabel = normalizedTagLabel(input.label);
    if (await tagLabelExists(normalizedLabel)) {
      return { kind: "duplicate_label" as const };
    }
    const id = createTagId();
    const now = new Date();
    try {
      await database().batch([
        database().insert(tags).values({
          id,
          label: input.label,
          normalizedLabel,
          state: "draft",
          createdAt: now,
          updatedAt: now,
        }),
        catalogDebtStatement(now),
      ]);
      return { kind: "changed" as const, value: await findTag(id) };
    } catch {
      return {
        kind: (await tagLabelExists(normalizedLabel))
          ? ("duplicate_label" as const)
          : ("infrastructure" as const),
      };
    }
  },

  async updateTag(id: TagId, input: TagInput) {
    if (!(await findTag(id))) {
      return { kind: "not_found" as const };
    }
    const normalizedLabel = normalizedTagLabel(input.label);
    if (await tagLabelExists(normalizedLabel, id)) {
      return { kind: "duplicate_label" as const };
    }
    const now = new Date();
    try {
      await database().batch([
        database()
          .update(tags)
          .set({ label: input.label, normalizedLabel, updatedAt: now })
          .where(eq(tags.id, id)),
        catalogDebtStatement(now),
      ]);
      return { kind: "changed" as const, value: await findTag(id) };
    } catch {
      return {
        kind: (await tagLabelExists(normalizedLabel, id))
          ? ("duplicate_label" as const)
          : ("infrastructure" as const),
      };
    }
  },

  async transitionCategory(
    id: CategoryId,
    target: GroupingState,
    lineage: readonly { id: string; parentId: string | null; state: GroupingState }[] = [],
  ) {
    const current = await findCategory(id);
    if (!current) {
      return { kind: "not_found" as const };
    }
    if (current.state === target) {
      return { kind: "changed" as const, value: current };
    }
    if (target === "draft" || (current.state === "draft" && target === "archived")) {
      return { kind: "invalid_lifecycle" as const };
    }
    if (target === "archived" && (await categoryHasActiveChild(id))) {
      return { kind: "active_child" as const };
    }
    const db = database();
    const activeChild = alias(categories, "category_active_child");
    const lineagePredicates: SQL[] = lineage.map((ancestor, index) => {
      const categoryAncestor = alias(categories, `category_active_ancestor_${index}`);
      return exists(
        db
          .select({ id: categoryAncestor.id })
          .from(categoryAncestor)
          .where(
            and(
              eq(categoryAncestor.id, ancestor.id),
              ancestor.parentId
                ? eq(categoryAncestor.parentId, ancestor.parentId)
                : isNull(categoryAncestor.parentId),
              eq(categoryAncestor.state, "active"),
            ),
          ),
      );
    });
    const transitionPredicate = and(
      eq(categories.id, id),
      eq(categories.state, current.state),
      target === "archived"
        ? notExists(
            db
              .select({ id: activeChild.id })
              .from(activeChild)
              .where(and(eq(activeChild.parentId, id), eq(activeChild.state, "active"))),
          )
        : undefined,
      ...lineagePredicates,
    );
    const now = new Date();
    const changed = (
      await db.batch([
        db
          .update(categories)
          .set({
            state: target,
            updatedAt: now,
            activatedAt:
              target === "active"
                ? current.activatedAt
                  ? new Date(current.activatedAt)
                  : now
                : undefined,
            archivedAt: target === "archived" ? now : null,
          })
          .where(transitionPredicate)
          .returning({ id: categories.id }),
        catalogDebtStatement(now),
      ])
    )[0];
    if (changed.length === 1) {
      return { kind: "changed" as const, value: await findCategory(id) };
    }
    const resolved = await findCategory(id);
    if (!resolved) {
      return { kind: "not_found" as const };
    }
    if (resolved.state === target) {
      return { kind: "changed" as const, value: resolved };
    }
    if (target === "archived" && (await categoryHasActiveChild(id))) {
      return { kind: "active_child" as const };
    }
    const resolvedParent = await groupingQueries.validateCategoryParent(
      resolved.id,
      resolved.parentId,
    );
    if (resolvedParent.kind !== "valid") {
      return {
        kind:
          resolvedParent.kind === "cycle"
            ? ("category_cycle" as const)
            : ("parent_not_found" as const),
      };
    }
    if (
      target === "active" &&
      resolvedParent.lineage.some((ancestor) => ancestor.state !== "active")
    ) {
      return { kind: "inactive_ancestor" as const };
    }
    return { kind: "concurrent_parent_change" as const };
  },

  async transitionCollection(id: CollectionId, target: GroupingState) {
    const current = await findCollection(id);
    if (!current) {
      return { kind: "not_found" as const };
    }
    if (current.state === target) {
      return { kind: "changed" as const, value: current };
    }
    if (target === "draft" || (current.state === "draft" && target === "archived")) {
      return { kind: "invalid_lifecycle" as const };
    }
    const now = new Date();
    const changed = (
      await database().batch([
        database()
          .update(collections)
          .set({
            state: target,
            updatedAt: now,
            activatedAt:
              target === "active"
                ? current.activatedAt
                  ? new Date(current.activatedAt)
                  : now
                : undefined,
            archivedAt: target === "archived" ? now : null,
          })
          .where(and(eq(collections.id, id), eq(collections.state, current.state)))
          .returning({ id: collections.id }),
        catalogDebtStatement(now),
      ])
    )[0];
    if (changed.length === 0) {
      const resolved = await findCollection(id);
      return resolved?.state === target
        ? { kind: "changed" as const, value: resolved }
        : { kind: "invalid_lifecycle" as const };
    }
    return { kind: "changed" as const, value: await findCollection(id) };
  },

  async transitionTag(id: TagId, target: GroupingState) {
    const current = await findTag(id);
    if (!current) {
      return { kind: "not_found" as const };
    }
    if (current.state === target) {
      return { kind: "changed" as const, value: current };
    }
    if (target === "draft" || (current.state === "draft" && target === "archived")) {
      return { kind: "invalid_lifecycle" as const };
    }
    const now = new Date();
    const changed = (
      await database().batch([
        database()
          .update(tags)
          .set({
            state: target,
            updatedAt: now,
            activatedAt:
              target === "active"
                ? current.activatedAt
                  ? new Date(current.activatedAt)
                  : now
                : undefined,
            archivedAt: target === "archived" ? now : null,
          })
          .where(and(eq(tags.id, id), eq(tags.state, current.state)))
          .returning({ id: tags.id }),
        catalogDebtStatement(now),
      ])
    )[0];
    if (changed.length === 0) {
      const resolved = await findTag(id);
      return resolved?.state === target
        ? { kind: "changed" as const, value: resolved }
        : { kind: "invalid_lifecycle" as const };
    }
    return { kind: "changed" as const, value: await findTag(id) };
  },

  async replaceCategoryMembership(id: CategoryId, input: GroupingMembershipInput) {
    if (!(await findCategory(id))) {
      return { kind: "not_found" as const };
    }
    if (!(await validateCatalogItemIds(input.catalogItemIds))) {
      return { kind: "catalog_item_not_found" as const };
    }
    const remove = database()
      .delete(catalogItemCategories)
      .where(eq(catalogItemCategories.categoryId, id));
    const debt = catalogDebtStatement(new Date());
    if (input.catalogItemIds.length === 0) {
      await database().batch([remove, debt]);
    } else {
      await database().batch([
        remove,
        database()
          .insert(catalogItemCategories)
          .values(input.catalogItemIds.map((catalogItemId) => ({ categoryId: id, catalogItemId }))),
        debt,
      ]);
    }
    return { kind: "changed" as const, value: await findCategory(id) };
  },

  async replaceCollectionMembership(id: CollectionId, input: GroupingMembershipInput) {
    if (!(await findCollection(id))) {
      return { kind: "not_found" as const };
    }
    if (!(await validateCatalogItemIds(input.catalogItemIds))) {
      return { kind: "catalog_item_not_found" as const };
    }
    const remove = database()
      .delete(catalogItemCollections)
      .where(eq(catalogItemCollections.collectionId, id));
    const debt = catalogDebtStatement(new Date());
    if (input.catalogItemIds.length === 0) {
      await database().batch([remove, debt]);
    } else {
      await database().batch([
        remove,
        database()
          .insert(catalogItemCollections)
          .values(
            input.catalogItemIds.map((catalogItemId, position) => ({
              collectionId: id,
              catalogItemId,
              position,
            })),
          ),
        debt,
      ]);
    }
    return { kind: "changed" as const, value: await findCollection(id) };
  },

  async replaceTagMembership(id: TagId, input: GroupingMembershipInput) {
    if (!(await findTag(id))) {
      return { kind: "not_found" as const };
    }
    if (!(await validateCatalogItemIds(input.catalogItemIds))) {
      return { kind: "catalog_item_not_found" as const };
    }
    const remove = database().delete(catalogItemTags).where(eq(catalogItemTags.tagId, id));
    const debt = catalogDebtStatement(new Date());
    if (input.catalogItemIds.length === 0) {
      await database().batch([remove, debt]);
    } else {
      await database().batch([
        remove,
        database()
          .insert(catalogItemTags)
          .values(input.catalogItemIds.map((catalogItemId) => ({ tagId: id, catalogItemId }))),
        debt,
      ]);
    }
    return { kind: "changed" as const, value: await findTag(id) };
  },

  async findCatalogCachePurgeDebt() {
    const [row] = await database()
      .select({ revision: catalogListingCachePurgeDebt.revision })
      .from(catalogListingCachePurgeDebt)
      .where(eq(catalogListingCachePurgeDebt.key, "catalog"))
      .limit(1);
    return row;
  },

  async recordCatalogCachePurgeOutcome(
    revision: string,
    outcome: "purged" | "failed",
    requestId: string | null,
  ) {
    if (outcome === "purged") {
      const rows = await database()
        .delete(catalogListingCachePurgeDebt)
        .where(
          and(
            eq(catalogListingCachePurgeDebt.key, "catalog"),
            eq(catalogListingCachePurgeDebt.revision, revision),
          ),
        )
        .returning({ key: catalogListingCachePurgeDebt.key });
      return rows.length === 1;
    }
    const rows = await database()
      .update(catalogListingCachePurgeDebt)
      .set({
        attemptCount: sql`${catalogListingCachePurgeDebt.attemptCount} + 1`,
        requestId,
        lastAttemptedAt: new Date(),
      })
      .where(
        and(
          eq(catalogListingCachePurgeDebt.key, "catalog"),
          eq(catalogListingCachePurgeDebt.revision, revision),
          sql`${catalogListingCachePurgeDebt.attemptCount} < 1000000`,
        ),
      )
      .returning({ key: catalogListingCachePurgeDebt.key });
    return rows.length === 1;
  },

  async listPublicGroupings() {
    const [categoryRows, collectionRows, categoryMemberships, collectionMemberships] =
      await Promise.all([
        database()
          .select()
          .from(categories)
          .where(eq(categories.state, "active"))
          .orderBy(asc(categories.position), asc(categories.name), asc(categories.id)),
        database()
          .select()
          .from(collections)
          .where(eq(collections.state, "active"))
          .orderBy(asc(collections.name), asc(collections.id)),
        database()
          .select({
            groupingId: catalogItemCategories.categoryId,
            catalogItemId: catalogItemCategories.catalogItemId,
          })
          .from(catalogItemCategories)
          .orderBy(asc(catalogItemCategories.catalogItemId)),
        database()
          .select({
            groupingId: catalogItemCollections.collectionId,
            catalogItemId: catalogItemCollections.catalogItemId,
          })
          .from(catalogItemCollections)
          .orderBy(asc(catalogItemCollections.position)),
      ]);
    return {
      categories: categoryRows.map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        description: "",
        catalogItemIds: categoryMemberships
          .filter((membership) => membership.groupingId === row.id)
          .map((membership) => membership.catalogItemId),
      })),
      collections: collectionRows.map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        description: row.description,
        catalogItemIds: collectionMemberships
          .filter((membership) => membership.groupingId === row.id)
          .map((membership) => membership.catalogItemId),
      })),
    };
  },

  async findPublicCategory(slug: string) {
    const [row] = await database()
      .select()
      .from(categories)
      .where(and(eq(categories.slug, slug), eq(categories.state, "active")))
      .limit(1);
    return row
      ? {
          id: row.id,
          slug: row.slug,
          name: row.name,
          description: "",
          catalogItemIds: await categoryCatalogItemIds(row.id),
        }
      : undefined;
  },

  async findPublicCollection(slug: string) {
    const [row] = await database()
      .select()
      .from(collections)
      .where(and(eq(collections.slug, slug), eq(collections.state, "active")))
      .limit(1);
    return row
      ? {
          id: row.id,
          slug: row.slug,
          name: row.name,
          description: row.description,
          catalogItemIds: await collectionCatalogItemIds(row.id),
        }
      : undefined;
  },
};
