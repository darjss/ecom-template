import {
  createCategoryId,
  createCollectionId,
  createTagId,
  type CategoryId,
  type CategoryInput,
  type CollectionId,
  type CollectionInput,
  type CatalogItemId,
  type GroupingState,
  type TagId,
  type TagInput,
} from "@ecom/contracts";
import {
  and,
  asc,
  eq,
  exists,
  inArray,
  isNull,
  ne,
  notExists,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import {
  catalogItemCategories,
  catalogItemCollections,
  catalogItems,
  catalogItemTags,
  categories,
  collections,
  discountRules,
  tags,
} from "../db/schema";
import { database } from "../db/database";
import { groupingQuerySet } from "./query-set";

const timestamp = (value: Date | null) => value?.toISOString() ?? null;
type GroupingRow = {
  id: string;
  state: GroupingState;
  createdAt: Date;
  updatedAt: Date;
  activatedAt: Date | null;
  archivedAt: Date | null;
};
const groupingDto = (row: GroupingRow, catalogItemIds: string[]) => ({
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

type BatchStatement = Parameters<ReturnType<typeof database>["batch"]>[0][number];
const replaceRows = (remove: BatchStatement, insert?: BatchStatement) =>
  insert ? database().batch([remove, insert]) : database().batch([remove]);

const categoryQuerySet = groupingQuerySet<CategoryId, CategoryInput>(validateCatalogItemIds)({
  rows: (id: CategoryId) =>
    database().select().from(categories).where(eq(categories.id, id)).limit(1),
  membershipRows: (id) =>
    database()
      .select({ id: catalogItemCategories.catalogItemId })
      .from(catalogItemCategories)
      .where(eq(catalogItemCategories.categoryId, id))
      .orderBy(asc(catalogItemCategories.catalogItemId)),
  identityRows: (slug, excludedId) =>
    database()
      .select({ id: categories.id })
      .from(categories)
      .where(
        excludedId
          ? and(eq(categories.slug, slug), ne(categories.id, excludedId))
          : eq(categories.slug, slug),
      )
      .limit(1),
  identity: (input: CategoryInput) => input.slug,
  duplicateKind: "duplicate_slug",
  createId: createCategoryId,
  insert: (id, input, now) =>
    database().batch([
      database()
        .insert(categories)
        .values({ id, ...input, state: "draft", createdAt: now, updatedAt: now }),
    ]),
  dto: categoryDto,
  replace: (id, input) =>
    replaceRows(
      database().delete(catalogItemCategories).where(eq(catalogItemCategories.categoryId, id)),
      input.catalogItemIds.length === 0
        ? undefined
        : database()
            .insert(catalogItemCategories)
            .values(
              input.catalogItemIds.map((catalogItemId) => ({ categoryId: id, catalogItemId })),
            ),
    ),
});

const collectionQuerySet = groupingQuerySet<CollectionId, CollectionInput>(validateCatalogItemIds)({
  rows: (id: CollectionId) =>
    database().select().from(collections).where(eq(collections.id, id)).limit(1),
  membershipRows: (id) =>
    database()
      .select({ id: catalogItemCollections.catalogItemId })
      .from(catalogItemCollections)
      .where(eq(catalogItemCollections.collectionId, id))
      .orderBy(asc(catalogItemCollections.position)),
  identityRows: (slug, excludedId) =>
    database()
      .select({ id: collections.id })
      .from(collections)
      .where(
        excludedId
          ? and(eq(collections.slug, slug), ne(collections.id, excludedId))
          : eq(collections.slug, slug),
      )
      .limit(1),
  identity: (input: CollectionInput) => input.slug,
  duplicateKind: "duplicate_slug",
  createId: createCollectionId,
  insert: (id, input, now) =>
    database().batch([
      database()
        .insert(collections)
        .values({ id, ...input, state: "draft", createdAt: now, updatedAt: now }),
    ]),
  dto: collectionDto,
  replace: (id, input) =>
    replaceRows(
      database().delete(catalogItemCollections).where(eq(catalogItemCollections.collectionId, id)),
      input.catalogItemIds.length === 0
        ? undefined
        : database()
            .insert(catalogItemCollections)
            .values(
              input.catalogItemIds.map((catalogItemId, position) => ({
                collectionId: id,
                catalogItemId,
                position,
              })),
            ),
    ),
});

const normalizedTagLabel = (label: string) => label.trim().toLocaleLowerCase("mn");
const tagQuerySet = groupingQuerySet<TagId, TagInput>(validateCatalogItemIds)({
  rows: (id: TagId) => database().select().from(tags).where(eq(tags.id, id)).limit(1),
  membershipRows: (id) =>
    database()
      .select({ id: catalogItemTags.catalogItemId })
      .from(catalogItemTags)
      .where(eq(catalogItemTags.tagId, id))
      .orderBy(asc(catalogItemTags.catalogItemId)),
  identityRows: (normalizedLabel, excludedId) =>
    database()
      .select({ id: tags.id })
      .from(tags)
      .where(
        excludedId
          ? and(eq(tags.normalizedLabel, normalizedLabel), ne(tags.id, excludedId))
          : eq(tags.normalizedLabel, normalizedLabel),
      )
      .limit(1),
  identity: (input: TagInput) => normalizedTagLabel(input.label),
  duplicateKind: "duplicate_label",
  createId: createTagId,
  insert: (id, input, now) =>
    database().batch([
      database()
        .insert(tags)
        .values({
          id,
          label: input.label,
          normalizedLabel: normalizedTagLabel(input.label),
          state: "draft",
          createdAt: now,
          updatedAt: now,
        }),
    ]),
  dto: tagDto,
  replace: (id, input) =>
    replaceRows(
      database().delete(catalogItemTags).where(eq(catalogItemTags.tagId, id)),
      input.catalogItemIds.length === 0
        ? undefined
        : database()
            .insert(catalogItemTags)
            .values(input.catalogItemIds.map((catalogItemId) => ({ tagId: id, catalogItemId }))),
    ),
});

const findCategory = categoryQuerySet.find;
const findCollection = collectionQuerySet.find;
const findTag = tagQuerySet.find;
const categorySlugExists = categoryQuerySet.identityExists;
const collectionSlugExists = collectionQuerySet.identityExists;
const tagLabelExists = tagQuerySet.identityExists;
const discountDependencyPredicate = (
  kind: "category" | "collection",
  id: CategoryId | CollectionId,
) =>
  sql<boolean>`EXISTS (
    SELECT 1 FROM json_each(${discountRules.targetsJson}) AS target
    WHERE json_extract(target.value, '$.kind') = ${kind}
      AND json_extract(target.value, '$.id') = ${id}
  )`;
const activeDiscountDependency = async (
  kind: "category" | "collection",
  id: CategoryId | CollectionId,
) =>
  (
    await database()
      .select({ id: discountRules.id })
      .from(discountRules)
      .where(and(eq(discountRules.state, "active"), discountDependencyPredicate(kind, id)))
      .limit(1)
  ).length > 0;

const categoryHasActiveChild = async (id: CategoryId) =>
  (
    await database()
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.parentId, id), eq(categories.state, "active")))
      .limit(1)
  ).length > 0;

type FlatGrouping = { state: GroupingState; activatedAt: string | null };
const transitionFlatGrouping = async <Dto extends FlatGrouping>(
  find: () => Promise<Dto | undefined>,
  target: GroupingState,
  commit: (current: Dto, now: Date) => Promise<number>,
) => {
  const current = await find();
  if (!current) {
    return { kind: "not_found" as const };
  }
  if (current.state === target) {
    return { kind: "changed" as const, value: current };
  }
  if (target === "draft" || (current.state === "draft" && target === "archived")) {
    return { kind: "invalid_lifecycle" as const };
  }
  if ((await commit(current, new Date())) === 1) {
    return { kind: "changed" as const, value: await find() };
  }
  const resolved = await find();
  return resolved?.state === target
    ? { kind: "changed" as const, value: resolved }
    : { kind: "invalid_lifecycle" as const };
};
const transitionDates = (current: FlatGrouping, target: GroupingState, now: Date) => ({
  state: target,
  updatedAt: now,
  activatedAt:
    target === "active" ? (current.activatedAt ? new Date(current.activatedAt) : now) : undefined,
  archivedAt: target === "archived" ? now : null,
});
const membershipIds = (
  groupingId: string,
  memberships: readonly { groupingId: string; catalogItemId: string }[],
) =>
  memberships
    .filter((membership) => membership.groupingId === groupingId)
    .map((membership) => membership.catalogItemId);

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

  createCategory: categoryQuerySet.create,

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
            .where(
              and(eq(categories.id, id), eq(categories.state, current.state), ...lineagePredicates),
            )
            .returning({ id: categories.id }),
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

  createCollection: collectionQuerySet.create,

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
      const changed = (
        await database().batch([
          database()
            .update(collections)
            .set({ ...input, updatedAt: now })
            .where(
              and(
                eq(collections.id, id),
                or(isNull(collections.activatedAt), eq(collections.slug, input.slug)),
              ),
            )
            .returning({ id: collections.id }),
        ])
      )[0];
      if (changed.length === 1) {
        return { kind: "changed" as const, value: await findCollection(id) };
      }
      const resolved = await findCollection(id);
      if (!resolved) {
        return { kind: "not_found" as const };
      }
      return {
        kind:
          resolved.activatedAt && resolved.slug !== input.slug
            ? ("slug_locked" as const)
            : ("infrastructure" as const),
      };
    } catch {
      return {
        kind: (await collectionSlugExists(input.slug, id))
          ? ("duplicate_slug" as const)
          : ("infrastructure" as const),
      };
    }
  },

  createTag: tagQuerySet.create,

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
    if (target === "archived" && (await activeDiscountDependency("category", id))) {
      return { kind: "active_discount_dependency" as const };
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
      current.parentId ? eq(categories.parentId, current.parentId) : isNull(categories.parentId),
      target === "archived"
        ? notExists(
            db
              .select({ id: activeChild.id })
              .from(activeChild)
              .where(and(eq(activeChild.parentId, id), eq(activeChild.state, "active"))),
          )
        : undefined,
      target === "archived"
        ? notExists(
            db
              .select({ id: discountRules.id })
              .from(discountRules)
              .where(
                and(eq(discountRules.state, "active"), discountDependencyPredicate("category", id)),
              ),
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
    if (target === "archived" && (await activeDiscountDependency("category", id))) {
      return { kind: "active_discount_dependency" as const };
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
    if (target === "archived" && (await activeDiscountDependency("collection", id))) {
      return { kind: "active_discount_dependency" as const };
    }
    const db = database();
    const now = new Date();
    const [changed] = await db.batch([
      db
        .update(collections)
        .set(transitionDates(current, target, now))
        .where(
          and(
            eq(collections.id, id),
            eq(collections.state, current.state),
            target === "archived"
              ? notExists(
                  db
                    .select({ id: discountRules.id })
                    .from(discountRules)
                    .where(
                      and(
                        eq(discountRules.state, "active"),
                        discountDependencyPredicate("collection", id),
                      ),
                    ),
                )
              : undefined,
          ),
        )
        .returning({ id: collections.id }),
    ]);
    if (changed.length === 1) {
      return { kind: "changed" as const, value: await findCollection(id) };
    }
    return target === "archived" && (await activeDiscountDependency("collection", id))
      ? { kind: "active_discount_dependency" as const }
      : { kind: "invalid_lifecycle" as const };
  },

  async transitionTag(id: TagId, target: GroupingState) {
    return transitionFlatGrouping(
      () => findTag(id),
      target,
      async (current, now) => {
        const [changed] = await database().batch([
          database()
            .update(tags)
            .set(transitionDates(current, target, now))
            .where(and(eq(tags.id, id), eq(tags.state, current.state)))
            .returning({ id: tags.id }),
        ]);
        return changed.length;
      },
    );
  },

  replaceCategoryMembership: categoryQuerySet.replaceMembership,
  replaceCollectionMembership: collectionQuerySet.replaceMembership,
  replaceTagMembership: tagQuerySet.replaceMembership,

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
          catalogItemIds: await categoryQuerySet.catalogItemIds(row.id),
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
          catalogItemIds: await collectionQuerySet.catalogItemIds(row.id),
        }
      : undefined;
  },
};
