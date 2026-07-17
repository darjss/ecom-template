import {
  createCategoryId,
  createCollectionId,
  createTagId,
  type CategoryId,
  type CategoryInput,
  type CollectionId,
  type CollectionInput,
  type GroupingMembershipInput,
  type GroupingState,
  type ProductId,
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

const timestamp = (value: Date | null) => value?.toISOString() ?? null;
const categoryDto = (row: typeof categories.$inferSelect, productIds: readonly string[]) => ({
  kind: "category" as const,
  id: row.id,
  slug: row.slug,
  name: row.name,
  parentId: row.parentId,
  position: row.position,
  state: row.state,
  productIds,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  activatedAt: timestamp(row.activatedAt),
  archivedAt: timestamp(row.archivedAt),
});
const collectionDto = (row: typeof collections.$inferSelect, productIds: readonly string[]) => ({
  kind: "collection" as const,
  id: row.id,
  slug: row.slug,
  name: row.name,
  description: row.description,
  state: row.state,
  productIds,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  activatedAt: timestamp(row.activatedAt),
  archivedAt: timestamp(row.archivedAt),
});
const tagDto = (row: typeof tags.$inferSelect, productIds: readonly string[]) => ({
  kind: "tag" as const,
  id: row.id,
  label: row.label,
  state: row.state,
  productIds,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  activatedAt: timestamp(row.activatedAt),
  archivedAt: timestamp(row.archivedAt),
});

const categoryProductIds = async (id: string) =>
  database()
    .select({ id: catalogItemCategories.catalogItemId })
    .from(catalogItemCategories)
    .where(eq(catalogItemCategories.categoryId, id))
    .orderBy(asc(catalogItemCategories.catalogItemId))
    .then((rows) => rows.map((row) => row.id));
const collectionProductIds = async (id: string) =>
  database()
    .select({ id: catalogItemCollections.catalogItemId })
    .from(catalogItemCollections)
    .where(eq(catalogItemCollections.collectionId, id))
    .orderBy(asc(catalogItemCollections.position))
    .then((rows) => rows.map((row) => row.id));
const tagProductIds = async (id: string) =>
  database()
    .select({ id: catalogItemTags.catalogItemId })
    .from(catalogItemTags)
    .where(eq(catalogItemTags.tagId, id))
    .orderBy(asc(catalogItemTags.catalogItemId))
    .then((rows) => rows.map((row) => row.id));

const findCategory = async (id: CategoryId) => {
  const [row] = await database().select().from(categories).where(eq(categories.id, id)).limit(1);
  return row ? categoryDto(row, await categoryProductIds(row.id)) : undefined;
};
const findCollection = async (id: CollectionId) => {
  const [row] = await database().select().from(collections).where(eq(collections.id, id)).limit(1);
  return row ? collectionDto(row, await collectionProductIds(row.id)) : undefined;
};
const findTag = async (id: TagId) => {
  const [row] = await database().select().from(tags).where(eq(tags.id, id)).limit(1);
  return row ? tagDto(row, await tagProductIds(row.id)) : undefined;
};

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

const validateProductIds = async (productIds: readonly ProductId[]) => {
  if (productIds.length === 0) {
    return true;
  }
  const rows = await database()
    .select({ id: catalogItems.id })
    .from(catalogItems)
    .where(inArray(catalogItems.id, productIds));
  return rows.length === productIds.length;
};

export const groupingQueries = {
  findCategory,
  findCollection,
  findTag,

  async listAll() {
    const [categoryRows, collectionRows, tagRows, products] = await Promise.all([
      database()
        .select()
        .from(categories)
        .orderBy(asc(categories.position), asc(categories.name), asc(categories.id)),
      database().select().from(collections).orderBy(asc(collections.name), asc(collections.id)),
      database().select().from(tags).orderBy(asc(tags.normalizedLabel), asc(tags.id)),
      database()
        .select({ id: catalogItems.id, name: catalogItems.name, state: catalogItems.state })
        .from(catalogItems)
        .where(eq(catalogItems.kind, "product"))
        .orderBy(asc(catalogItems.name), asc(catalogItems.id)),
    ]);
    return {
      categories: await Promise.all(
        categoryRows.map(async (row) => categoryDto(row, await categoryProductIds(row.id))),
      ),
      collections: await Promise.all(
        collectionRows.map(async (row) => collectionDto(row, await collectionProductIds(row.id))),
      ),
      tags: await Promise.all(tagRows.map(async (row) => tagDto(row, await tagProductIds(row.id)))),
      products,
    };
  },

  async validateCategoryParent(id: CategoryId | undefined, parentId: CategoryId | null) {
    if (!parentId) {
      return "valid" as const;
    }
    let current: string | null = parentId;
    for (let depth = 0; depth < 100; depth += 1) {
      if (current === id) {
        return "cycle" as const;
      }
      const [row] = await database()
        .select({ parentId: categories.parentId })
        .from(categories)
        .where(eq(categories.id, current))
        .limit(1);
      if (!row) {
        return "not_found" as const;
      }
      current = row.parentId;
      if (!current) {
        return "valid" as const;
      }
    }
    return "cycle" as const;
  },

  async createCategory(input: CategoryInput) {
    if (await categorySlugExists(input.slug)) {
      return { kind: "duplicate_slug" as const };
    }
    const id = createCategoryId();
    const now = new Date();
    await database()
      .insert(categories)
      .values({ id, ...input, state: "draft", createdAt: now, updatedAt: now });
    return { kind: "changed" as const, value: await findCategory(id) };
  },

  async updateCategory(id: CategoryId, input: CategoryInput) {
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
    await database()
      .update(categories)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(categories.id, id));
    return { kind: "changed" as const, value: await findCategory(id) };
  },

  async createCollection(input: CollectionInput) {
    if (await collectionSlugExists(input.slug)) {
      return { kind: "duplicate_slug" as const };
    }
    const id = createCollectionId();
    const now = new Date();
    await database()
      .insert(collections)
      .values({ id, ...input, state: "draft", createdAt: now, updatedAt: now });
    return { kind: "changed" as const, value: await findCollection(id) };
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
    await database()
      .update(collections)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(collections.id, id));
    return { kind: "changed" as const, value: await findCollection(id) };
  },

  async createTag(input: TagInput) {
    const normalizedLabel = normalizedTagLabel(input.label);
    if (await tagLabelExists(normalizedLabel)) {
      return { kind: "duplicate_label" as const };
    }
    const id = createTagId();
    const now = new Date();
    await database().insert(tags).values({
      id,
      label: input.label,
      normalizedLabel,
      state: "draft",
      createdAt: now,
      updatedAt: now,
    });
    return { kind: "changed" as const, value: await findTag(id) };
  },

  async updateTag(id: TagId, input: TagInput) {
    if (!(await findTag(id))) {
      return { kind: "not_found" as const };
    }
    const normalizedLabel = normalizedTagLabel(input.label);
    if (await tagLabelExists(normalizedLabel, id)) {
      return { kind: "duplicate_label" as const };
    }
    await database()
      .update(tags)
      .set({ label: input.label, normalizedLabel, updatedAt: new Date() })
      .where(eq(tags.id, id));
    return { kind: "changed" as const, value: await findTag(id) };
  },

  async transitionCategory(id: CategoryId, target: GroupingState) {
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
    if (target === "archived") {
      const activeChild = await database()
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.parentId, id), eq(categories.state, "active")))
        .limit(1);
      if (activeChild.length > 0) {
        return { kind: "active_child" as const };
      }
    }
    const now = new Date();
    await database()
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
      .where(eq(categories.id, id));
    return { kind: "changed" as const, value: await findCategory(id) };
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
    await database()
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
      .where(eq(collections.id, id));
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
    await database()
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
      .where(eq(tags.id, id));
    return { kind: "changed" as const, value: await findTag(id) };
  },

  async replaceCategoryMembership(id: CategoryId, input: GroupingMembershipInput) {
    if (!(await findCategory(id))) {
      return { kind: "not_found" as const };
    }
    if (!(await validateProductIds(input.productIds))) {
      return { kind: "product_not_found" as const };
    }
    const remove = database()
      .delete(catalogItemCategories)
      .where(eq(catalogItemCategories.categoryId, id));
    if (input.productIds.length === 0) {
      await database().batch([remove]);
    } else {
      await database().batch([
        remove,
        database()
          .insert(catalogItemCategories)
          .values(input.productIds.map((catalogItemId) => ({ categoryId: id, catalogItemId }))),
      ]);
    }
    return { kind: "changed" as const, value: await findCategory(id) };
  },

  async replaceCollectionMembership(id: CollectionId, input: GroupingMembershipInput) {
    if (!(await findCollection(id))) {
      return { kind: "not_found" as const };
    }
    if (!(await validateProductIds(input.productIds))) {
      return { kind: "product_not_found" as const };
    }
    const remove = database()
      .delete(catalogItemCollections)
      .where(eq(catalogItemCollections.collectionId, id));
    if (input.productIds.length === 0) {
      await database().batch([remove]);
    } else {
      await database().batch([
        remove,
        database()
          .insert(catalogItemCollections)
          .values(
            input.productIds.map((catalogItemId, position) => ({
              collectionId: id,
              catalogItemId,
              position,
            })),
          ),
      ]);
    }
    return { kind: "changed" as const, value: await findCollection(id) };
  },

  async replaceTagMembership(id: TagId, input: GroupingMembershipInput) {
    if (!(await findTag(id))) {
      return { kind: "not_found" as const };
    }
    if (!(await validateProductIds(input.productIds))) {
      return { kind: "product_not_found" as const };
    }
    const remove = database().delete(catalogItemTags).where(eq(catalogItemTags.tagId, id));
    if (input.productIds.length === 0) {
      await database().batch([remove]);
    } else {
      await database().batch([
        remove,
        database()
          .insert(catalogItemTags)
          .values(input.productIds.map((catalogItemId) => ({ tagId: id, catalogItemId }))),
      ]);
    }
    return { kind: "changed" as const, value: await findTag(id) };
  },

  async listPublicGroupings() {
    const [categoryRows, collectionRows] = await Promise.all([
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
    ]);
    return {
      categories: await Promise.all(
        categoryRows.map(async (row) => ({
          id: row.id,
          slug: row.slug,
          name: row.name,
          description: "",
          productIds: await categoryProductIds(row.id),
        })),
      ),
      collections: await Promise.all(
        collectionRows.map(async (row) => ({
          id: row.id,
          slug: row.slug,
          name: row.name,
          description: row.description,
          productIds: await collectionProductIds(row.id),
        })),
      ),
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
          productIds: await categoryProductIds(row.id),
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
          productIds: await collectionProductIds(row.id),
        }
      : undefined;
  },
};
