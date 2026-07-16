import type { StorefrontSummary } from "@ecom/contracts";
import { readDatabaseHealth } from "../db/health";

export type StorefrontReader = {
  readonly readSummary: () => Promise<StorefrontSummary>;
};

export const createStorefrontReader = (summary: StorefrontSummary): StorefrontReader => ({
  readSummary: async () => {
    const health = await readDatabaseHealth();
    if (health.isErr()) {
      throw new Error("Store infrastructure is unavailable");
    }
    return summary;
  },
});
