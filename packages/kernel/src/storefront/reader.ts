import type { StorefrontSummary } from "@ecom/contracts";
import { readInfrastructureHealth } from "../db/health";

export type StorefrontReader = {
  readonly readSummary: () => Promise<StorefrontSummary>;
};

export const createStorefrontReader = (storeName: string): StorefrontReader => ({
  readSummary: async () => {
    await readInfrastructureHealth();
    return {
      storeName,
      location: "Улаанбаатар, 48-р дэлгүүр",
      status: "open",
    };
  },
});
