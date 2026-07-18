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
import { and, asc, eq, inArray, ne } from "drizzle-orm";
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

export const timestamp = (value: Date | null) => value?.toISOString() ?? null;
export const catalogDebtStatement = (now: Date) => {
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
export const categoryDto = (row: typeof categories.$inferSelect, catalogItemIds: string[]) => ({
  ...groupingDto(row, catalogItemIds),
  kind: "category" as const,
  slug: row.slug,
  name: row.name,
  parentId: row.parentId,
  position: row.position,
});
export const collectionDto = (row: typeof collections.$inferSelect, catalogItemIds: string[]) => ({
  ...groupingDto(row, catalogItemIds),
  kind: "collection" as const,
  slug: row.slug,
  name: row.name,
  description: row.description,
});
export const tagDto = (row: typeof tags.$inferSelect, catalogItemIds: string[]) => ({
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
const replaceRows = (remove: BatchStatement, insert?: BatchStatement) => {
  const debt = catalogDebtStatement(new Date());
  return insert ? database().batch([remove, insert, debt]) : database().batch([remove, debt]);
};

const replaceMembership = async <Dto>(
  find: () => Promise<Dto | undefined>,
  input: GroupingMembershipInput,
  replace: () => Promise<unknown>,
) => {
  if (!(await find())) {
    return { kind: "not_found" as const };
  }
  if (!(await validateCatalogItemIds(input.catalogItemIds))) {
    return { kind: "catalog_item_not_found" as const };
  }
  await replace();
  return { kind: "changed" as const, value: await find() };
};

const groupingQuerySet =
  <Id extends string, Input>() =>
  <Row extends { id: string }, Dto>(config: {
    rows: (id: Id) => PromiseLike<Row[]>;
    membershipRows: (id: Id) => PromiseLike<{ id: string }[]>;
    identityRows: (identity: string, excludedId?: Id) => PromiseLike<unknown[]>;
    identity: (input: Input) => string;
    duplicateKind: "duplicate_slug" | "duplicate_label";
    createId: () => Id;
    insert: (id: Id, input: Input, now: Date) => Promise<unknown>;
    dto: (row: Row, catalogItemIds: string[]) => Dto;
    replace: (id: Id, input: GroupingMembershipInput) => Promise<unknown>;
  }) => {
    const catalogItemIds = async (id: Id) =>
      (await config.membershipRows(id)).map(({ id: catalogItemId }) => catalogItemId);
    const find = async (id: Id) => {
      const [row] = await config.rows(id);
      return row ? config.dto(row, await catalogItemIds(id)) : undefined;
    };
    const identityExists = async (identity: string, excludedId?: Id) =>
      (await config.identityRows(identity, excludedId)).length > 0;
    return {
      find,
      catalogItemIds,
      identityExists,
      async create(input: Input) {
        const identity = config.identity(input);
        if (await identityExists(identity)) {
          return { kind: config.duplicateKind } as const;
        }
        const id = config.createId();
        try {
          await config.insert(id, input, new Date());
          return { kind: "changed" as const, value: await find(id) };
        } catch {
          return (await identityExists(identity))
            ? ({ kind: config.duplicateKind } as const)
            : ({ kind: "infrastructure" } as const);
        }
      },
      replaceMembership: (id: Id, input: GroupingMembershipInput) =>
        replaceMembership(
          () => find(id),
          input,
          () => config.replace(id, input),
        ),
    };
  };

export const categoryQuerySet = groupingQuerySet<CategoryId, CategoryInput>()({
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
      catalogDebtStatement(now),
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

export const collectionQuerySet = groupingQuerySet<CollectionId, CollectionInput>()({
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
      catalogDebtStatement(now),
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

export const normalizedTagLabel = (label: string) => label.trim().toLocaleLowerCase("mn");
export const tagQuerySet = groupingQuerySet<TagId, TagInput>()({
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
      catalogDebtStatement(now),
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
