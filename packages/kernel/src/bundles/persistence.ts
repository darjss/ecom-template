import {
  BundleIdSchema,
  BundleSchema,
  PersonalizationDefinitionsSchema,
  VariantIdSchema,
  createBundleId,
  createPersonalizationId,
  createPersonalizationValueId,
  type BundleId,
  type CatalogItemId,
  type CreateBundleInput,
  type SaveBundleComponentsInput,
  type SavePersonalizationsInput,
  type UpdateBundleInput,
} from "@ecom/contracts";
import { and, asc, desc, eq, exists, inArray, ne, notExists, or, sql } from "drizzle-orm";
import { uniq } from "es-toolkit";
import * as v from "valibot";
import { catalogMediaQueries } from "../catalog-media/persistence";
import { catalogSku, compactSku } from "../catalog/sku";
import { database } from "../db/database";
import {
  bundleComponents,
  catalogCachePurgeDebts,
  catalogItems,
  cmsDocuments,
  personalizationDefinitions,
  personalizationValues,
  variants,
} from "../db/schema";

export const readPersonalizations = async (catalogItemIds: readonly CatalogItemId[]) => {
  if (catalogItemIds.length === 0) {
    return [];
  }
  const db = database();
  const [items, definitions, values] = await Promise.all([
    db
      .select({ id: catalogItems.id })
      .from(catalogItems)
      .where(inArray(catalogItems.id, catalogItemIds)),
    db
      .select()
      .from(personalizationDefinitions)
      .where(inArray(personalizationDefinitions.catalogItemId, catalogItemIds))
      .orderBy(asc(personalizationDefinitions.position)),
    db
      .select({
        catalogItemId: personalizationDefinitions.catalogItemId,
        id: personalizationValues.id,
        personalizationId: personalizationValues.personalizationId,
        key: personalizationValues.key,
        label: personalizationValues.label,
        position: personalizationValues.position,
        state: personalizationValues.state,
      })
      .from(personalizationValues)
      .innerJoin(
        personalizationDefinitions,
        eq(personalizationDefinitions.id, personalizationValues.personalizationId),
      )
      .where(inArray(personalizationDefinitions.catalogItemId, catalogItemIds))
      .orderBy(asc(personalizationValues.position)),
  ]);
  return catalogItemIds
    .filter((catalogItemId) => items.some((item) => item.id === catalogItemId))
    .map((catalogItemId) => ({
      catalogItemId,
      definitions: v.parse(
        PersonalizationDefinitionsSchema,
        definitions
          .filter((definition) => definition.catalogItemId === catalogItemId)
          .map(
            ({
              catalogItemId: _catalogItemId,
              createdAt: _createdAt,
              updatedAt: _updatedAt,
              ...definition
            }) => ({
              ...definition,
              values: values
                .filter((value) => value.personalizationId === definition.id)
                .map(
                  ({
                    catalogItemId: _valueCatalogItemId,
                    personalizationId: _personalizationId,
                    ...value
                  }) => value,
                ),
            }),
          ),
      ),
    }));
};

const readBundles = async (id?: BundleId, publishedSlug?: string) => {
  const db = database();
  const conditions = [eq(catalogItems.kind, "bundle")];
  if (id) {
    conditions.push(eq(catalogItems.id, id));
  }
  if (publishedSlug) {
    conditions.push(eq(catalogItems.slug, publishedSlug), eq(catalogItems.state, "published"));
  }
  const rows = await db
    .select({
      id: catalogItems.id,
      slug: catalogItems.slug,
      state: catalogItems.state,
      name: catalogItems.name,
      description: catalogItems.description,
      priceMnt: catalogItems.priceMnt,
      sku: catalogItems.sku,
      cachePurgeAttemptCount: catalogCachePurgeDebts.attemptCount,
      cachePurgeRequestId: catalogCachePurgeDebts.requestId,
      cachePurgeLastAttemptedAt: catalogCachePurgeDebts.lastAttemptedAt,
      createdAt: catalogItems.createdAt,
      updatedAt: catalogItems.updatedAt,
    })
    .from(catalogItems)
    .leftJoin(catalogCachePurgeDebts, eq(catalogCachePurgeDebts.productId, catalogItems.id))
    .where(and(...conditions))
    .orderBy(desc(catalogItems.createdAt));
  const ids = rows.map((row) => v.parse(BundleIdSchema, row.id));
  if (ids.length === 0) {
    return [];
  }
  const [componentRows, personalizationRows, images] = await Promise.all([
    db
      .select({
        bundleId: bundleComponents.bundleId,
        variantId: bundleComponents.variantId,
        quantity: bundleComponents.quantity,
        productName: catalogItems.name,
        variantLabel: variants.sku,
      })
      .from(bundleComponents)
      .innerJoin(variants, eq(variants.id, bundleComponents.variantId))
      .innerJoin(catalogItems, eq(catalogItems.id, variants.productId))
      .where(inArray(bundleComponents.bundleId, ids))
      .orderBy(asc(bundleComponents.variantId)),
    readPersonalizations(ids),
    catalogMediaQueries.listForCatalogItems(ids),
  ]);
  return rows.map((row) => {
    const bundleId = v.parse(BundleIdSchema, row.id);
    const { cachePurgeAttemptCount, cachePurgeRequestId, cachePurgeLastAttemptedAt, ...bundle } =
      row;
    return v.parse(BundleSchema, {
      ...bundle,
      id: bundleId,
      cachePurgeDebt:
        cachePurgeAttemptCount === null
          ? null
          : {
              attemptCount: cachePurgeAttemptCount,
              requestId: cachePurgeRequestId,
              lastAttemptedAt: cachePurgeLastAttemptedAt?.toISOString() ?? null,
            },
      components: componentRows
        .filter((component) => component.bundleId === bundleId)
        .map(({ bundleId: _bundleId, ...component }) => ({
          ...component,
          variantId: v.parse(VariantIdSchema, component.variantId),
        })),
      personalizations:
        personalizationRows.find((entry) => entry.catalogItemId === bundleId)?.definitions ?? [],
      images: images.filter((image) => image.catalogItemId === bundleId).map(({ image }) => image),
      createdAt: bundle.createdAt.toISOString(),
      updatedAt: bundle.updatedAt.toISOString(),
    });
  });
};

const cacheDebt = (catalogItemId: CatalogItemId, now: Date) => {
  const revision = crypto.randomUUID();
  return database()
    .insert(catalogCachePurgeDebts)
    .values({
      productId: catalogItemId,
      revision,
      attemptCount: 0,
      requestId: null,
      commandCommittedAt: now,
      lastAttemptedAt: null,
    })
    .onConflictDoUpdate({
      target: catalogCachePurgeDebts.productId,
      set: {
        revision,
        attemptCount: 0,
        requestId: null,
        commandCommittedAt: now,
        lastAttemptedAt: null,
      },
    });
};

export const bundleQueries = {
  async listAll() {
    return readBundles();
  },
  async findById(id: BundleId) {
    return (await readBundles(id)).at(0);
  },
  async findPublishedBySlug(slug: string) {
    return (await readBundles(undefined, slug)).at(0);
  },
  async create(input: CreateBundleInput) {
    const db = database();
    const id = createBundleId();
    const sku = catalogSku(input.slug, "bundle", id);
    const now = new Date();
    try {
      await db.batch([
        db.insert(catalogItems).values({
          id,
          kind: "bundle",
          slug: input.slug,
          sku,
          skuCompact: compactSku(sku),
          state: "draft",
          name: input.name,
          description: input.description,
          priceMnt: input.priceMnt,
          createdAt: now,
          updatedAt: now,
        }),
      ] as const);
      return { kind: "changed" as const, bundle: await this.findById(id) };
    } catch (error) {
      return {
        kind:
          error instanceof Error && error.message.includes("catalog_items.slug")
            ? ("duplicate_slug" as const)
            : ("infrastructure" as const),
      };
    }
  },
  async update(id: BundleId, input: UpdateBundleInput) {
    const db = database();
    const now = new Date();
    const revision = crypto.randomUUID();
    const updatedNow = and(
      eq(catalogItems.id, id),
      eq(catalogItems.kind, "bundle"),
      eq(catalogItems.updatedAt, now),
      ne(catalogItems.state, "draft"),
    );
    try {
      const results = await db.batch([
        db
          .update(catalogItems)
          .set({ ...input, updatedAt: now })
          .where(
            and(
              eq(catalogItems.id, id),
              eq(catalogItems.kind, "bundle"),
              or(sql`${catalogItems.publishedAt} IS NULL`, eq(catalogItems.slug, input.slug)),
            ),
          )
          .returning({ id: catalogItems.id }),
        db
          .insert(catalogCachePurgeDebts)
          .select(
            db
              .select({
                productId: sql<string>`${id}`.as("product_id"),
                revision: sql<string>`${revision}`.as("revision"),
                attemptCount: sql<number>`0`.as("attempt_count"),
                requestId: sql<null>`NULL`.as("request_id"),
                commandCommittedAt: sql<Date>`${now.getTime()}`.as("command_committed_at"),
                lastAttemptedAt: sql<null>`NULL`.as("last_attempted_at"),
              })
              .from(catalogItems)
              .where(updatedNow),
          )
          .onConflictDoUpdate({
            target: catalogCachePurgeDebts.productId,
            set: {
              revision,
              attemptCount: 0,
              requestId: null,
              commandCommittedAt: now,
              lastAttemptedAt: null,
            },
          }),
      ] as const);
      if (results[0].length) {
        return { kind: "changed" as const };
      }
    } catch (error) {
      return {
        kind:
          error instanceof Error && error.message.includes("catalog_items.slug")
            ? ("duplicate_slug" as const)
            : ("infrastructure" as const),
      };
    }
    const rows = await db
      .select({ slug: catalogItems.slug, publishedAt: catalogItems.publishedAt })
      .from(catalogItems)
      .where(and(eq(catalogItems.id, id), eq(catalogItems.kind, "bundle")))
      .limit(1);
    const current = rows.at(0);
    return !current
      ? { kind: "not_found" as const }
      : current.publishedAt && current.slug !== input.slug
        ? { kind: "slug_locked" as const }
        : { kind: "infrastructure" as const };
  },
  async saveComponents(id: BundleId, input: SaveBundleComponentsInput) {
    if (
      uniq(input.components.map(({ variantId }) => variantId)).length !== input.components.length
    ) {
      return { kind: "duplicate_component" as const };
    }
    if (
      input.components.length < 1 ||
      input.components.length > 24 ||
      input.components.some(
        ({ quantity }) => !Number.isInteger(quantity) || quantity < 1 || quantity > 999,
      )
    ) {
      return { kind: "invalid_component" as const };
    }
    const db = database();
    const componentVariants = await db
      .select({ id: variants.id })
      .from(variants)
      .where(
        inArray(
          variants.id,
          input.components.map(({ variantId }) => variantId),
        ),
      );
    if (componentVariants.length !== input.components.length) {
      return { kind: "invalid_component" as const };
    }
    const now = new Date();
    const draft = db
      .select({ id: catalogItems.id })
      .from(catalogItems)
      .where(
        and(
          eq(catalogItems.id, id),
          eq(catalogItems.kind, "bundle"),
          eq(catalogItems.state, "draft"),
          sql`${catalogItems.publishedAt} IS NULL`,
        ),
      );
    const guard = db
      .update(catalogItems)
      .set({ updatedAt: now })
      .where(
        and(
          eq(catalogItems.id, id),
          eq(catalogItems.kind, "bundle"),
          eq(catalogItems.state, "draft"),
          sql`${catalogItems.publishedAt} IS NULL`,
        ),
      )
      .returning({ id: catalogItems.id });
    const clear = db
      .delete(bundleComponents)
      .where(and(eq(bundleComponents.bundleId, id), exists(draft)));
    const inserts = input.components.map((component) =>
      db.insert(bundleComponents).select(
        db
          .select({
            bundleId: sql<string>`${id}`.as("bundle_id"),
            variantId: sql<string>`${component.variantId}`.as("variant_id"),
            quantity: sql<number>`${component.quantity}`.as("quantity"),
          })
          .from(catalogItems)
          .where(
            and(
              eq(catalogItems.id, id),
              eq(catalogItems.kind, "bundle"),
              eq(catalogItems.state, "draft"),
            ),
          ),
      ),
    );
    const results = await db.batch([guard, clear, ...inserts] as const);
    if (results[0].length) {
      return { kind: "changed" as const };
    }
    const rows = await db
      .select({ id: catalogItems.id })
      .from(catalogItems)
      .where(and(eq(catalogItems.id, id), eq(catalogItems.kind, "bundle")))
      .limit(1);
    return rows.length ? { kind: "immutable_components" as const } : { kind: "not_found" as const };
  },
  async savePersonalizations(id: CatalogItemId, input: SavePersonalizationsInput) {
    const definitions = input.definitions.map((definition) => ({
      ...definition,
      id: definition.id ?? createPersonalizationId(),
    }));
    const values = definitions.flatMap((definition) =>
      definition.values.map((value) => ({
        ...value,
        id: value.id ?? createPersonalizationValueId(),
        personalizationId: definition.id,
      })),
    );
    if (
      uniq(definitions.map(({ id: definitionId }) => definitionId)).length !== definitions.length ||
      uniq(definitions.map(({ key }) => key)).length !== definitions.length ||
      uniq(definitions.map(({ position }) => position)).length !== definitions.length ||
      definitions.some(
        (definition) =>
          uniq(definition.values.map(({ key }) => key)).length !== definition.values.length ||
          uniq(definition.values.map(({ position }) => position)).length !==
            definition.values.length,
      )
    ) {
      return { kind: "invalid_personalization" as const };
    }
    const db = database();
    const existsItem = await db
      .select({ id: catalogItems.id, state: catalogItems.state })
      .from(catalogItems)
      .where(eq(catalogItems.id, id))
      .limit(1);
    const item = existsItem.at(0);
    if (!item) {
      return { kind: "not_found" as const };
    }
    const current = await db
      .select({ id: personalizationDefinitions.id })
      .from(personalizationDefinitions)
      .where(eq(personalizationDefinitions.catalogItemId, id));
    const now = new Date();
    const deleteValues = db
      .delete(personalizationValues)
      .where(
        inArray(
          personalizationValues.personalizationId,
          current.length ? current.map(({ id: definitionId }) => definitionId) : ["missing"],
        ),
      );
    const deleteDefinitions = db
      .delete(personalizationDefinitions)
      .where(eq(personalizationDefinitions.catalogItemId, id));
    const insertDefinitions = definitions.map((definition) =>
      db.insert(personalizationDefinitions).values({
        id: definition.id,
        catalogItemId: id,
        kind: definition.kind,
        key: definition.key,
        label: definition.label,
        position: definition.position,
        required: definition.required,
        state: definition.state,
        maxLength: definition.maxLength,
        createdAt: now,
        updatedAt: now,
      }),
    );
    const insertValues = values.map((value) =>
      db.insert(personalizationValues).values({ ...value, createdAt: now, updatedAt: now }),
    );
    try {
      await db.batch([
        deleteValues,
        deleteDefinitions,
        ...insertDefinitions,
        ...insertValues,
        ...(item.state === "draft" ? [] : [cacheDebt(id, now)]),
      ] as const);
      return { kind: "changed" as const };
    } catch {
      return { kind: "invalid_personalization" as const };
    }
  },
  async transition(id: BundleId, action: "publish" | "archive" | "reactivate") {
    const db = database();
    const target = action === "archive" ? "archived" : "published";
    const currentState = await db
      .select({ state: catalogItems.state })
      .from(catalogItems)
      .where(and(eq(catalogItems.id, id), eq(catalogItems.kind, "bundle")))
      .limit(1);
    if (currentState.at(0)?.state === target) {
      return { kind: "changed" as const };
    }
    const now = new Date();
    const revision = crypto.randomUUID();
    if (action === "publish" || action === "reactivate") {
      const invalidComponent = db
        .select({ id: bundleComponents.variantId })
        .from(bundleComponents)
        .innerJoin(variants, eq(variants.id, bundleComponents.variantId))
        .innerJoin(catalogItems, eq(catalogItems.id, variants.productId))
        .where(
          and(
            eq(bundleComponents.bundleId, id),
            sql`(${variants.state} <> 'active' OR ${catalogItems.kind} <> 'product' OR ${catalogItems.state} <> 'published')`,
          ),
        );
      const valid = and(
        eq(catalogItems.id, id),
        eq(catalogItems.kind, "bundle"),
        eq(catalogItems.state, action === "publish" ? "draft" : "archived"),
        exists(
          db
            .select({ id: bundleComponents.variantId })
            .from(bundleComponents)
            .where(eq(bundleComponents.bundleId, id)),
        ),
        notExists(invalidComponent),
      );
      const results = await db.batch([
        db
          .update(catalogItems)
          .set({
            state: "published",
            publishedAt: action === "publish" ? now : undefined,
            archivedAt: null,
            updatedAt: now,
          })
          .where(valid)
          .returning({ id: catalogItems.id }),
        db
          .insert(catalogCachePurgeDebts)
          .select(
            db
              .select({
                productId: sql<string>`${id}`.as("product_id"),
                revision: sql<string>`${revision}`.as("revision"),
                attemptCount: sql<number>`0`.as("attempt_count"),
                requestId: sql<null>`NULL`.as("request_id"),
                commandCommittedAt: sql<Date>`${now.getTime()}`.as("command_committed_at"),
                lastAttemptedAt: sql<null>`NULL`.as("last_attempted_at"),
              })
              .from(catalogItems)
              .where(
                and(
                  eq(catalogItems.id, id),
                  eq(catalogItems.state, "published"),
                  eq(catalogItems.updatedAt, now),
                ),
              ),
          )
          .onConflictDoUpdate({
            target: catalogCachePurgeDebts.productId,
            set: {
              revision,
              attemptCount: 0,
              requestId: null,
              commandCommittedAt: now,
              lastAttemptedAt: null,
            },
          }),
      ] as const);
      if (results[0].length) {
        return { kind: "changed" as const };
      }
      const rows = await db
        .select({ state: catalogItems.state })
        .from(catalogItems)
        .where(and(eq(catalogItems.id, id), eq(catalogItems.kind, "bundle")))
        .limit(1);
      const current = rows.at(0);
      if (!current) {
        return { kind: "not_found" as const };
      }
      const kind =
        current.state !== (action === "publish" ? "draft" : "archived")
          ? ("invalid_lifecycle" as const)
          : ("invalid_publication" as const);
      return { kind };
    }
    const from = "published";
    const to = "archived";
    const changedNow = and(
      eq(catalogItems.id, id),
      eq(catalogItems.kind, "bundle"),
      eq(catalogItems.state, to),
      eq(catalogItems.updatedAt, now),
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
    const archivePredicate = and(
      eq(catalogItems.id, id),
      eq(catalogItems.kind, "bundle"),
      eq(catalogItems.state, from),
      notExists(publishedHomepageDependency),
    );
    const results = await db.batch([
      db
        .update(catalogItems)
        .set({ state: to, archivedAt: now, updatedAt: now })
        .where(archivePredicate)
        .returning({ id: catalogItems.id }),
      db
        .insert(catalogCachePurgeDebts)
        .select(
          db
            .select({
              productId: sql<string>`${id}`.as("product_id"),
              revision: sql<string>`${revision}`.as("revision"),
              attemptCount: sql<number>`0`.as("attempt_count"),
              requestId: sql<null>`NULL`.as("request_id"),
              commandCommittedAt: sql<Date>`${now.getTime()}`.as("command_committed_at"),
              lastAttemptedAt: sql<null>`NULL`.as("last_attempted_at"),
            })
            .from(catalogItems)
            .where(changedNow),
        )
        .onConflictDoUpdate({
          target: catalogCachePurgeDebts.productId,
          set: {
            revision,
            attemptCount: 0,
            requestId: null,
            commandCommittedAt: now,
            lastAttemptedAt: null,
          },
        }),
    ] as const);
    if (results[0].length) {
      return { kind: "changed" as const };
    }
    const rows = await db
      .select({ id: catalogItems.id })
      .from(catalogItems)
      .where(and(eq(catalogItems.id, id), eq(catalogItems.kind, "bundle")))
      .limit(1);
    if (!rows.length) {
      return { kind: "not_found" as const };
    }
    const homepageDependency = await db
      .select({ kind: cmsDocuments.kind })
      .from(cmsDocuments)
      .where(
        and(
          eq(cmsDocuments.kind, "homepage"),
          eq(cmsDocuments.status, "published"),
          sql`EXISTS (SELECT 1 FROM json_each(${cmsDocuments.contentJson}, '$.featuredCatalogItemIds') WHERE value = ${id})`,
        ),
      )
      .limit(1);
    return homepageDependency.length > 0
      ? { kind: "published_cms_dependency" as const }
      : { kind: "invalid_lifecycle" as const };
  },
  async findCachePurgeDebt(id: CatalogItemId) {
    const rows = await database()
      .select({ revision: catalogCachePurgeDebts.revision })
      .from(catalogCachePurgeDebts)
      .where(eq(catalogCachePurgeDebts.productId, id))
      .limit(1);
    return rows.at(0);
  },
  async recordCachePurgeOutcome(
    id: CatalogItemId,
    revision: string,
    outcome: "purged" | "failed",
    requestId: string | null,
  ) {
    const predicate = and(
      eq(catalogCachePurgeDebts.productId, id),
      eq(catalogCachePurgeDebts.revision, revision),
    );
    if (outcome === "purged") {
      const result = await database().delete(catalogCachePurgeDebts).where(predicate).returning();
      return result.length === 1;
    }
    const result = await database()
      .update(catalogCachePurgeDebts)
      .set({
        attemptCount: sql`${catalogCachePurgeDebts.attemptCount} + 1`,
        requestId,
        lastAttemptedAt: new Date(),
      })
      .where(predicate)
      .returning();
    return result.length === 1;
  },
  async expandDemand(id: BundleId, quantity: number) {
    const rows = await database()
      .select({
        variantId: bundleComponents.variantId,
        componentQuantity: bundleComponents.quantity,
      })
      .from(bundleComponents)
      .innerJoin(catalogItems, eq(catalogItems.id, bundleComponents.bundleId))
      .where(and(eq(bundleComponents.bundleId, id), eq(catalogItems.kind, "bundle")));
    return rows.map((row) => ({
      variantId: v.parse(VariantIdSchema, row.variantId),
      quantity: row.componentQuantity * quantity,
    }));
  },
};
