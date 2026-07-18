import type { AvailabilityFact } from "@ecom/contracts";
import type { PurchaseAvailabilityState } from "./purchase-availability";

export const resolvePurchasePrice = (
  catalogPriceMnt: number,
  state: PurchaseAvailabilityState,
  fact: AvailabilityFact | undefined,
) =>
  state === "ready" || state === "unavailable"
    ? { unitPriceMnt: fact?.unitPriceMnt ?? catalogPriceMnt, source: fact ? "current" : "catalog" }
    : { unitPriceMnt: catalogPriceMnt, source: "catalog" as const };
