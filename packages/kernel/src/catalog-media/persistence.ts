import {
  CatalogImageSchema,
  CatalogItemIdSchema,
  MediaAssetIdSchema,
  MediaContentTypeSchema,
  PublicCatalogImageSchema,
  type CatalogImage,
  type CatalogItemId,
  type MediaAssetId,
  type MediaContentType,
  type PublicCatalogImage,
} from "@ecom/contracts";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import * as v from "valibot";
import { database } from "../db/database";
import { catalogCachePurgeDebts, catalogItemImages, catalogItems, mediaAssets } from "../db/schema";

const MediaRowSchema = v.strictObject({
  mediaAssetId: v.string(),
  declaredContentType: v.string(),
  createdAt: v.date(),
  position: v.number(),
  altText: v.string(),
});

const StoredMediaSchema = v.strictObject({
  id: v.string(),
  objectKey: v.string(),
  declaredContentType: v.string(),
});

const projectStoredMedia = (source: unknown) => {
  const row = v.parse(StoredMediaSchema, source);
  return {
    id: v.parse(MediaAssetIdSchema, row.id),
    objectKey: row.objectKey,
    declaredContentType: v.parse(MediaContentTypeSchema, row.declaredContentType),
  };
};

const projectCatalogImage = (source: unknown): CatalogImage => {
  const row = v.parse(MediaRowSchema, source);
  return v.parse(CatalogImageSchema, {
    mediaAsset: {
      id: row.mediaAssetId,
      declaredContentType: row.declaredContentType,
      createdAt: row.createdAt.toISOString(),
    },
    position: row.position,
    altText: row.altText,
  });
};

const imageSelection = {
  mediaAssetId: mediaAssets.id,
  declaredContentType: mediaAssets.declaredContentType,
  createdAt: mediaAssets.createdAt,
  position: catalogItemImages.position,
  altText: catalogItemImages.altText,
};

export const catalogMediaQueries = {
  async catalogItemExists(id: CatalogItemId) {
    const rows = await database()
      .select({ id: catalogItems.id })
      .from(catalogItems)
      .where(eq(catalogItems.id, id))
      .limit(1);
    return rows.length === 1;
  },

  async attach(
    catalogItemId: CatalogItemId,
    mediaAssetId: MediaAssetId,
    objectKey: string,
    declaredContentType: MediaContentType,
    position: number,
    altText: string,
    createdAt: Date,
  ) {
    const db = database();
    const cacheRevision = crypto.randomUUID();
    await db.batch([
      db.insert(mediaAssets).values({
        id: mediaAssetId,
        objectKey,
        declaredContentType,
        createdAt,
      }),
      db
        .insert(catalogItemImages)
        .values({ catalogItemId, mediaAssetId, position, altText })
        .onConflictDoUpdate({
          target: [catalogItemImages.catalogItemId, catalogItemImages.position],
          set: { mediaAssetId, altText },
        }),
      db
        .insert(catalogCachePurgeDebts)
        .select(
          db
            .select({
              productId: sql<string>`${catalogItemId}`.as("product_id"),
              revision: sql<string>`${cacheRevision}`.as("revision"),
              attemptCount: sql<number>`0`.as("attempt_count"),
              requestId: sql<null>`NULL`.as("request_id"),
              commandCommittedAt: sql<Date>`${createdAt.getTime()}`.as("command_committed_at"),
              lastAttemptedAt: sql<null>`NULL`.as("last_attempted_at"),
            })
            .from(catalogItems)
            .where(and(eq(catalogItems.id, catalogItemId), ne(catalogItems.state, "draft"))),
        )
        .onConflictDoUpdate({
          target: catalogCachePurgeDebts.productId,
          set: {
            revision: cacheRevision,
            attemptCount: 0,
            requestId: null,
            commandCommittedAt: createdAt,
            lastAttemptedAt: null,
          },
        }),
    ]);
    return projectCatalogImage({
      mediaAssetId,
      declaredContentType,
      createdAt,
      position,
      altText,
    });
  },

  async listForCatalogItems(ids: readonly CatalogItemId[]) {
    if (ids.length === 0) {
      return [];
    }
    const rows = await database()
      .select({ catalogItemId: catalogItemImages.catalogItemId, ...imageSelection })
      .from(catalogItemImages)
      .innerJoin(mediaAssets, eq(mediaAssets.id, catalogItemImages.mediaAssetId))
      .where(inArray(catalogItemImages.catalogItemId, ids))
      .orderBy(asc(catalogItemImages.position));
    return rows.map(({ catalogItemId, ...image }) => ({
      catalogItemId: v.parse(CatalogItemIdSchema, catalogItemId),
      image: projectCatalogImage(image),
    }));
  },

  async listPublicForCatalogItems(ids: readonly CatalogItemId[]) {
    const rows = await this.listForCatalogItems(ids);
    return rows.map(
      ({ catalogItemId, image }): { catalogItemId: CatalogItemId; image: PublicCatalogImage } => ({
        catalogItemId,
        image: v.parse(PublicCatalogImageSchema, {
          mediaAssetId: image.mediaAsset.id,
          position: image.position,
          altText: image.altText,
        }),
      }),
    );
  },

  async findMediaAsset(id: MediaAssetId) {
    const rows = await database()
      .select({
        id: mediaAssets.id,
        objectKey: mediaAssets.objectKey,
        declaredContentType: mediaAssets.declaredContentType,
      })
      .from(mediaAssets)
      .where(eq(mediaAssets.id, id))
      .limit(1);
    const row = rows.at(0);
    if (!row) {
      return undefined;
    }
    return projectStoredMedia(row);
  },
};
