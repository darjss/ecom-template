import {
  CatalogImageSchema,
  MediaAssetIdSchema,
  MediaContentTypeSchema,
  ProductIdSchema,
  PublicCatalogImageSchema,
  type CatalogImage,
  type MediaAssetId,
  type MediaContentType,
  type ProductId,
  type PublicCatalogImage,
} from "@ecom/contracts";
import { asc, eq, inArray } from "drizzle-orm";
import * as v from "valibot";
import { database } from "../db/database";
import { catalogItemImages, catalogItems, mediaAssets } from "../db/schema";

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
  async catalogItemExists(id: ProductId) {
    const rows = await database()
      .select({ id: catalogItems.id })
      .from(catalogItems)
      .where(eq(catalogItems.id, id))
      .limit(1);
    return rows.length === 1;
  },

  async attach(
    catalogItemId: ProductId,
    mediaAssetId: MediaAssetId,
    objectKey: string,
    declaredContentType: MediaContentType,
    position: number,
    altText: string,
    createdAt: Date,
  ) {
    const db = database();
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
    ]);
    return projectCatalogImage({
      mediaAssetId,
      declaredContentType,
      createdAt,
      position,
      altText,
    });
  },

  async listForCatalogItems(ids: readonly ProductId[]) {
    if (ids.length === 0) {
      return [];
    }
    const rows = await database()
      .select({ catalogItemId: catalogItemImages.catalogItemId, ...imageSelection })
      .from(catalogItemImages)
      .innerJoin(mediaAssets, eq(mediaAssets.id, catalogItemImages.mediaAssetId))
      .where(inArray(catalogItemImages.catalogItemId, ids))
      .orderBy(asc(catalogItemImages.position));
    return rows.map((row) => ({
      catalogItemId: v.parse(ProductIdSchema, row.catalogItemId),
      image: projectCatalogImage(row),
    }));
  },

  async listPublicForCatalogItems(ids: readonly ProductId[]) {
    const rows = await this.listForCatalogItems(ids);
    return rows.map(
      ({ catalogItemId, image }): { catalogItemId: ProductId; image: PublicCatalogImage } => ({
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
    const parsed = v.parse(StoredMediaSchema, row);
    return {
      id: v.parse(MediaAssetIdSchema, parsed.id),
      objectKey: parsed.objectKey,
      declaredContentType: v.parse(MediaContentTypeSchema, parsed.declaredContentType),
    };
  },
};
