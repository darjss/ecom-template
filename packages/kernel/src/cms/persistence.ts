import {
  CmsDocumentKindSchema,
  CommerceSettingsSchema,
  type CmsDocument,
  type CmsDocumentKind,
  type CommerceSettings,
} from "@ecom/contracts";
import { and, eq, sql } from "drizzle-orm";
import * as v from "valibot";
import { database } from "../db/database";
import {
  catalogItems,
  categories,
  cmsCachePurgeDebt,
  cmsDocuments,
  collections,
  commerceSettings,
  mediaAssets,
} from "../db/schema";
import { decodeCmsDocument, encodeCmsDocument } from "./codec";

const rowDocument = (row: typeof cmsDocuments.$inferSelect) =>
  decodeCmsDocument(v.parse(CmsDocumentKindSchema, row.kind), row.schemaVersion, row.contentJson);

const read = async (kind: CmsDocumentKind, status: "draft" | "published") => {
  const rows = await database()
    .select()
    .from(cmsDocuments)
    .where(and(eq(cmsDocuments.kind, kind), eq(cmsDocuments.status, status)))
    .limit(1);
  const row = rows.at(0);
  return row ? rowDocument(row) : undefined;
};

const list = async (status: "draft" | "published") => {
  const rows = await database().select().from(cmsDocuments).where(eq(cmsDocuments.status, status));
  return rows.map(rowDocument);
};

const saveDraft = async (document: CmsDocument) => {
  const now = new Date();
  const contentJson = encodeCmsDocument(document);
  await database()
    .insert(cmsDocuments)
    .values({
      kind: document.kind,
      status: "draft",
      schemaVersion: 1,
      contentJson,
      createdAt: now,
      updatedAt: now,
      publishedAt: null,
    })
    .onConflictDoUpdate({
      target: [cmsDocuments.kind, cmsDocuments.status],
      set: { schemaVersion: 1, contentJson, updatedAt: now },
    });
  return read(document.kind, "draft");
};

const publish = async (document: CmsDocument) => {
  const now = new Date();
  const contentJson = encodeCmsDocument(document);
  const revision = crypto.randomUUID();
  const db = database();
  await db.batch([
    db
      .insert(cmsDocuments)
      .values({
        kind: document.kind,
        status: "published",
        schemaVersion: 1,
        contentJson,
        createdAt: now,
        updatedAt: now,
        publishedAt: now,
      })
      .onConflictDoUpdate({
        target: [cmsDocuments.kind, cmsDocuments.status],
        set: { schemaVersion: 1, contentJson, updatedAt: now, publishedAt: now },
      }),
    db
      .delete(cmsDocuments)
      .where(and(eq(cmsDocuments.kind, document.kind), eq(cmsDocuments.status, "draft"))),
    db
      .insert(cmsCachePurgeDebt)
      .values({
        key: "storefront",
        revision,
        attemptCount: 0,
        requestId: null,
        commandCommittedAt: now,
        lastAttemptedAt: null,
      })
      .onConflictDoUpdate({
        target: cmsCachePurgeDebt.key,
        set: {
          revision,
          attemptCount: 0,
          requestId: null,
          commandCommittedAt: now,
          lastAttemptedAt: null,
        },
      }),
  ]);
  return read(document.kind, "published");
};

const readReferenceState = async () => {
  const [catalog, categoryRows, collectionRows, media] = await Promise.all([
    database()
      .select({ id: catalogItems.id })
      .from(catalogItems)
      .where(eq(catalogItems.state, "published")),
    database().select({ id: categories.id }).from(categories).where(eq(categories.state, "active")),
    database()
      .select({ id: collections.id })
      .from(collections)
      .where(eq(collections.state, "active")),
    database().select({ id: mediaAssets.id }).from(mediaAssets),
  ]);
  return {
    catalog: new Set(catalog.map(({ id }) => id)),
    categories: new Set(categoryRows.map(({ id }) => id)),
    collections: new Set(collectionRows.map(({ id }) => id)),
    media: new Set(media.map(({ id }) => id)),
  };
};

const readSettings = async () => {
  const rows = await database()
    .select({
      bankTransferEnabled: commerceSettings.bankTransferEnabled,
      cashOnDeliveryEnabled: commerceSettings.cashOnDeliveryEnabled,
      customerAccountsEnabled: commerceSettings.customerAccountsEnabled,
      telegramEnabled: commerceSettings.telegramEnabled,
      pickupEnabled: commerceSettings.pickupEnabled,
      deliveryEnabled: commerceSettings.deliveryEnabled,
      deliveryFeeMnt: commerceSettings.deliveryFeeMnt,
      freeDeliveryThresholdMnt: commerceSettings.freeDeliveryThresholdMnt,
    })
    .from(commerceSettings)
    .where(eq(commerceSettings.key, "commerce"))
    .limit(1);
  const row = rows.at(0);
  return row ? v.parse(CommerceSettingsSchema, row) : undefined;
};

const saveSettings = async (settings: CommerceSettings) => {
  const parsed = v.parse(CommerceSettingsSchema, settings);
  const now = new Date();
  const revision = crypto.randomUUID();
  const db = database();
  await db.batch([
    db
      .insert(commerceSettings)
      .values({ key: "commerce", ...parsed, updatedAt: now })
      .onConflictDoUpdate({ target: commerceSettings.key, set: { ...parsed, updatedAt: now } }),
    db
      .insert(cmsCachePurgeDebt)
      .values({
        key: "storefront",
        revision,
        attemptCount: 0,
        requestId: null,
        commandCommittedAt: now,
        lastAttemptedAt: null,
      })
      .onConflictDoUpdate({
        target: cmsCachePurgeDebt.key,
        set: {
          revision,
          attemptCount: 0,
          requestId: null,
          commandCommittedAt: now,
          lastAttemptedAt: null,
        },
      }),
  ]);
  return readSettings();
};

const readDebt = async () => {
  const rows = await database()
    .select()
    .from(cmsCachePurgeDebt)
    .where(eq(cmsCachePurgeDebt.key, "storefront"))
    .limit(1);
  return rows.at(0);
};

const recordPurge = async (revision: string, requestId: string | null, purged: boolean) => {
  const now = new Date();
  if (purged) {
    const result = await database()
      .delete(cmsCachePurgeDebt)
      .where(and(eq(cmsCachePurgeDebt.key, "storefront"), eq(cmsCachePurgeDebt.revision, revision)))
      .returning({ key: cmsCachePurgeDebt.key });
    return result.length === 1;
  }
  const result = await database()
    .update(cmsCachePurgeDebt)
    .set({
      attemptCount: sql`${cmsCachePurgeDebt.attemptCount} + 1`,
      requestId,
      lastAttemptedAt: now,
    })
    .where(and(eq(cmsCachePurgeDebt.key, "storefront"), eq(cmsCachePurgeDebt.revision, revision)))
    .returning({ key: cmsCachePurgeDebt.key });
  return result.length === 1;
};

export const cmsQueries = {
  read,
  list,
  saveDraft,
  publish,
  readReferenceState,
  readSettings,
  saveSettings,
  readDebt,
  recordPurge,
};
