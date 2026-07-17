import {
  PublicProductDetailSchema,
  PublicProductSummarySchema,
  type PublicProductDetail,
  type PublicProductSummary,
  type StorefrontSummary,
} from "@ecom/contracts";
import * as v from "valibot";
import { catalogQueries } from "../catalog/persistence";
import { readDatabaseHealth } from "../db/health";

export type StorefrontReader = {
  readonly readSummary: () => Promise<StorefrontSummary>;
  readonly listPublishedProducts: () => Promise<readonly PublicProductSummary[]>;
  readonly readPublishedProduct: (slug: string) => Promise<PublicProductDetail | undefined>;
};

export const createStorefrontReader = (summary: StorefrontSummary): StorefrontReader => ({
  readSummary: async () => {
    const health = await readDatabaseHealth();
    if (health.isErr()) {
      throw new Error("Store infrastructure is unavailable");
    }
    return summary;
  },
  listPublishedProducts: async () => {
    const rows = await catalogQueries.listPublished();
    return rows.map((row) => v.parse(PublicProductSummarySchema, row));
  },
  readPublishedProduct: async (slug) => {
    const row = await catalogQueries.findPublishedBySlug(slug);
    return row ? v.parse(PublicProductDetailSchema, row) : undefined;
  },
});
