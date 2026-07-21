import {
  createCategoryId,
  createCollectionId,
  createTagId,
  type CatalogItemId,
  type CategoryId,
  type CategoryInput,
  type CollectionId,
  type CollectionInput,
  type Grouping,
  type GroupingMembershipInput,
  type GroupingState,
  type TagId,
  type TagInput,
} from "@ecom/contracts";
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import {
  catalogItemCategories,
  catalogItemCollections,
  catalogItems,
  catalogItemTags,
  categories,
  collections,
  tags,
} from "../db/schema";
import { database } from "../db/database";

export type GroupingPersistenceMutation =
  | { readonly kind: "changed"; readonly value: Grouping }
  | {
      readonly kind:
        | "not_found"
        | "catalog_item_not_found"
        | "duplicate_slug"
        | "duplicate_label"
        | "slug_locked"
        | "parent_not_found"
        | "category_cycle"
        | "infrastructure";
    };

const timestamp = (value: Date | null) => value?.toISOString() ?? null;
const groupingDto = (
  row: {
    id: string;
    state: GroupingState;
    createdAt: Date;
    updatedAt: Date;
    activatedAt: Date | null;
    archivedAt: Date | null;
  },
  catalogItemIds: string[],
) => ({
  id: row.id,
  state: row.state,
  catalogItemIds,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  activatedAt: timestamp(row.activatedAt),
  archivedAt: timestamp(row.archivedAt),
});
const categoryDto = (row: typeof categories.$inferSelect, catalogItemIds: string[]) => ({
  ...groupingDto(row, catalogItemIds),
  kind: "category" as const,
  slug: row.slug,
  name: row.name,
  parentId: row.parentId,
  position: row.position,
});
const collectionDto = (row: typeof collections.$inferSelect, catalogItemIds: string[]) => ({
  ...groupingDto(row, catalogItemIds),
  kind: "collection" as const,
  slug: row.slug,
  name: row.name,
  description: row.description,
});
const tagDto = (row: typeof tags.$inferSelect, catalogItemIds: string[]) => ({
  ...groupingDto(row, catalogItemIds),
  kind: "tag" as const,
  label: row.label,
});
const normalizedTagLabel = (label: string) => label.trim().toLocaleLowerCase("mn");
const membershipIds = (
  groupingId: string,
  memberships: readonly { groupingId: string; catalogItemId: string }[],
) =>
  memberships
    .filter((membership) => membership.groupingId === groupingId)
    .map((membership) => membership.catalogItemId);

const categoryCatalogItemIds = async (id: CategoryId) =>
  (
    await database()
      .select({ id: catalogItemCategories.catalogItemId })
      .from(catalogItemCategories)
      .where(eq(catalogItemCategories.categoryId, id))
      .orderBy(asc(catalogItemCategories.catalogItemId))
  ).map(({ id: catalogItemId }) => catalogItemId);
const collectionCatalogItemIds = async (id: CollectionId) =>
  (
    await database()
      .select({ id: catalogItemCollections.catalogItemId })
      .from(catalogItemCollections)
      .where(eq(catalogItemCollections.collectionId, id))
      .orderBy(asc(catalogItemCollections.position))
  ).map(({ id: catalogItemId }) => catalogItemId);
const tagCatalogItemIds = async (id: TagId) =>
  (
    await database()
      .select({ id: catalogItemTags.catalogItemId })
      .from(catalogItemTags)
      .where(eq(catalogItemTags.tagId, id))
      .orderBy(asc(catalogItemTags.catalogItemId))
  ).map(({ id: catalogItemId }) => catalogItemId);

const findCategory = async (id: CategoryId) => {
  const [row] = await database().select().from(categories).where(eq(categories.id, id)).limit(1);
  return row ? categoryDto(row, await categoryCatalogItemIds(id)) : undefined;
};
const findCollection = async (id: CollectionId) => {
  const [row] = await database().select().from(collections).where(eq(collections.id, id)).limit(1);
  return row ? collectionDto(row, await collectionCatalogItemIds(id)) : undefined;
};
const findTag = async (id: TagId) => {
  const [row] = await database().select().from(tags).where(eq(tags.id, id)).limit(1);
  return row ? tagDto(row, await tagCatalogItemIds(id)) : undefined;
};

const categorySlugExists = async (slug: string, excludedId?: CategoryId) =>
  (
    await database()
      .select({ id: categories.id })
      .from(categories)
      .where(
        excludedId
          ? and(eq(categories.slug, slug), ne(categories.id, excludedId))
          : eq(categories.slug, slug),
      )
      .limit(1)
  ).length > 0;
const collectionSlugExists = async (slug: string, excludedId?: CollectionId) =>
  (
    await database()
      .select({ id: collections.id })
      .from(collections)
      .where(
        excludedId
          ? and(eq(collections.slug, slug), ne(collections.id, excludedId))
          : eq(collections.slug, slug),
      )
      .limit(1)
  ).length > 0;
const tagLabelExists = async (label: string, excludedId?: TagId) =>
  (
    await database()
      .select({ id: tags.id })
      .from(tags)
      .where(
        excludedId
          ? and(eq(tags.normalizedLabel, label), ne(tags.id, excludedId))
          : eq(tags.normalizedLabel, label),
      )
      .limit(1)
  ).length > 0;

const validateCategoryParent = async (id: CategoryId | undefined, parentId: CategoryId | null) => {
  const seen = new Set<string>(id ? [id] : []);
  let current = parentId;
  while (current) {
    if (seen.has(current)) {
      return "category_cycle" as const;
    }
    seen.add(current);
    const [row] = await database()
      .select({ parentId: categories.parentId })
      .from(categories)
      .where(eq(categories.id, current))
      .limit(1);
    if (!row) {
      return "parent_not_found" as const;
    }
    current = row.parentId;
  }
  return undefined;
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
const changed = (value: Grouping | undefined): GroupingPersistenceMutation =>
  value ? { kind: "changed", value } : { kind: "infrastructure" };
const stateDates = (
  current: { activatedAt: string | null },
  state: "active" | "archived",
  now: Date,
) => ({
  state,
  updatedAt: now,
  activatedAt:
    state === "active" ? (current.activatedAt ? new Date(current.activatedAt) : now) : undefined,
  archivedAt: state === "archived" ? now : null,
});

export const groupingQueries = {
  async listAll() {
    const [
      categoryRows,
      collectionRows,
      tagRows,
      catalogItemRows,
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
        categoryDto(row, membershipIds(row.id, categoryMemberships)),
      ),
      collections: collectionRows.map((row) =>
        collectionDto(row, membershipIds(row.id, collectionMemberships)),
      ),
      tags: tagRows.map((row) => tagDto(row, membershipIds(row.id, tagMemberships))),
      catalogItems: catalogItemRows,
    };
  },

  async createCategory(input: CategoryInput): Promise<GroupingPersistenceMutation> {
    const parentFailure = await validateCategoryParent(undefined, input.parentId);
    if (parentFailure) {
      return { kind: parentFailure };
    }
    if (await categorySlugExists(input.slug)) {
      return { kind: "duplicate_slug" };
    }
    const id = createCategoryId();
    const now = new Date();
    await database().batch([
      database()
        .insert(categories)
        .values({ id, ...input, state: "draft", createdAt: now, updatedAt: now }),
    ]);
    return changed(await findCategory(id));
  },

  async createCollection(input: CollectionInput): Promise<GroupingPersistenceMutation> {
    if (await collectionSlugExists(input.slug)) {
      return { kind: "duplicate_slug" };
    }
    const id = createCollectionId();
    const now = new Date();
    await database().batch([
      database()
        .insert(collections)
        .values({ id, ...input, state: "draft", createdAt: now, updatedAt: now }),
    ]);
    return changed(await findCollection(id));
  },

  async createTag(input: TagInput): Promise<GroupingPersistenceMutation> {
    const normalizedLabel = normalizedTagLabel(input.label);
    if (await tagLabelExists(normalizedLabel)) {
      return { kind: "duplicate_label" };
    }
    const id = createTagId();
    const now = new Date();
    await database().batch([
      database().insert(tags).values({
        id,
        label: input.label,
        normalizedLabel,
        state: "draft",
        createdAt: now,
        updatedAt: now,
      }),
    ]);
    return changed(await findTag(id));
  },

  async updateCategory(id: CategoryId, input: CategoryInput): Promise<GroupingPersistenceMutation> {
    const current = await findCategory(id);
    if (!current) {
      return { kind: "not_found" };
    }
    if (current.activatedAt && current.slug !== input.slug) {
      return { kind: "slug_locked" };
    }
    const parentFailure = await validateCategoryParent(id, input.parentId);
    if (parentFailure) {
      return { kind: parentFailure };
    }
    if (await categorySlugExists(input.slug, id)) {
      return { kind: "duplicate_slug" };
    }
    await database().batch([
      database()
        .update(categories)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(categories.id, id)),
    ]);
    return changed(await findCategory(id));
  },

  async updateCollection(
    id: CollectionId,
    input: CollectionInput,
  ): Promise<GroupingPersistenceMutation> {
    const current = await findCollection(id);
    if (!current) {
      return { kind: "not_found" };
    }
    if (current.activatedAt && current.slug !== input.slug) {
      return { kind: "slug_locked" };
    }
    if (await collectionSlugExists(input.slug, id)) {
      return { kind: "duplicate_slug" };
    }
    await database().batch([
      database()
        .update(collections)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(collections.id, id)),
    ]);
    return changed(await findCollection(id));
  },

  async updateTag(id: TagId, input: TagInput): Promise<GroupingPersistenceMutation> {
    if (!(await findTag(id))) {
      return { kind: "not_found" };
    }
    const normalizedLabel = normalizedTagLabel(input.label);
    if (await tagLabelExists(normalizedLabel, id)) {
      return { kind: "duplicate_label" };
    }
    await database().batch([
      database()
        .update(tags)
        .set({ label: input.label, normalizedLabel, updatedAt: new Date() })
        .where(eq(tags.id, id)),
    ]);
    return changed(await findTag(id));
  },

  async setCategoryState(
    id: CategoryId,
    state: "active" | "archived",
  ): Promise<GroupingPersistenceMutation> {
    const current = await findCategory(id);
    if (!current) {
      return { kind: "not_found" };
    }
    await database().batch([
      database()
        .update(categories)
        .set(stateDates(current, state, new Date()))
        .where(eq(categories.id, id)),
    ]);
    return changed(await findCategory(id));
  },

  async setCollectionState(
    id: CollectionId,
    state: "active" | "archived",
  ): Promise<GroupingPersistenceMutation> {
    const current = await findCollection(id);
    if (!current) {
      return { kind: "not_found" };
    }
    await database().batch([
      database()
        .update(collections)
        .set(stateDates(current, state, new Date()))
        .where(eq(collections.id, id)),
    ]);
    return changed(await findCollection(id));
  },

  async setTagState(id: TagId, state: "active" | "archived"): Promise<GroupingPersistenceMutation> {
    const current = await findTag(id);
    if (!current) {
      return { kind: "not_found" };
    }
    await database().batch([
      database()
        .update(tags)
        .set(stateDates(current, state, new Date()))
        .where(eq(tags.id, id)),
    ]);
    return changed(await findTag(id));
  },

  async replaceCategoryMembership(
    id: CategoryId,
    input: GroupingMembershipInput,
  ): Promise<GroupingPersistenceMutation> {
    if (!(await findCategory(id))) {
      return { kind: "not_found" };
    }
    if (!(await validateCatalogItemIds(input.catalogItemIds))) {
      return { kind: "catalog_item_not_found" };
    }
    const remove = database()
      .delete(catalogItemCategories)
      .where(eq(catalogItemCategories.categoryId, id));
    await database().batch(
      input.catalogItemIds.length === 0
        ? [remove]
        : [
            remove,
            database()
              .insert(catalogItemCategories)
              .values(
                input.catalogItemIds.map((catalogItemId) => ({ categoryId: id, catalogItemId })),
              ),
          ],
    );
    return changed(await findCategory(id));
  },

  async replaceCollectionMembership(
    id: CollectionId,
    input: GroupingMembershipInput,
  ): Promise<GroupingPersistenceMutation> {
    if (!(await findCollection(id))) {
      return { kind: "not_found" };
    }
    if (!(await validateCatalogItemIds(input.catalogItemIds))) {
      return { kind: "catalog_item_not_found" };
    }
    const remove = database()
      .delete(catalogItemCollections)
      .where(eq(catalogItemCollections.collectionId, id));
    await database().batch(
      input.catalogItemIds.length === 0
        ? [remove]
        : [
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
          ],
    );
    return changed(await findCollection(id));
  },

  async replaceTagMembership(
    id: TagId,
    input: GroupingMembershipInput,
  ): Promise<GroupingPersistenceMutation> {
    if (!(await findTag(id))) {
      return { kind: "not_found" };
    }
    if (!(await validateCatalogItemIds(input.catalogItemIds))) {
      return { kind: "catalog_item_not_found" };
    }
    const remove = database().delete(catalogItemTags).where(eq(catalogItemTags.tagId, id));
    await database().batch(
      input.catalogItemIds.length === 0
        ? [remove]
        : [
            remove,
            database()
              .insert(catalogItemTags)
              .values(input.catalogItemIds.map((catalogItemId) => ({ tagId: id, catalogItemId }))),
          ],
    );
    return changed(await findTag(id));
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
        catalogItemIds: membershipIds(row.id, categoryMemberships),
      })),
      collections: collectionRows.map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        description: row.description,
        catalogItemIds: membershipIds(row.id, collectionMemberships),
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
