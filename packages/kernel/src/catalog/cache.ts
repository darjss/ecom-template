import type { Product } from "@ecom/contracts";
import { env } from "cloudflare:workers";
import { createLogger } from "evlog";
import {
  parseCachePurgeEnvironment,
  parseCachePurgeRequestId,
  parseCachePurgeResponse,
} from "./cache-contract";
import { catalogQueries } from "./persistence";

const purgeCatalogCache = async (productId: string) => {
  const configuration = parseCachePurgeEnvironment(env);
  if (!configuration.success) {
    return { kind: "failed" as const, requestId: null };
  }
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${configuration.output.CLOUDFLARE_ZONE_ID}/purge_cache`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${configuration.output.CLOUDFLARE_CACHE_PURGE_TOKEN}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ tags: ["catalog", `product:${productId}`] }),
      },
    );
    const body = parseCachePurgeResponse(await response.json());
    const requestId = parseCachePurgeRequestId(
      response.headers.get("cf-ray") ?? response.headers.get("cf-request-id"),
    );
    return response.ok && body.success && body.output.success
      ? { kind: "purged" as const, requestId }
      : { kind: "failed" as const, requestId };
  } catch {
    return { kind: "failed" as const, requestId: null };
  }
};

export const resolvePendingCatalogCachePurge = async (product: Product) => {
  const debt = await catalogQueries.findCachePurgeDebt(product.id);
  if (!debt) {
    return { product, cache: "not_required" as const, cachePurgeRequestId: null };
  }

  const purge = await purgeCatalogCache(product.id);
  const log = createLogger({ action: "catalog.cache_purge", productId: product.id });
  let outcomeRecorded = false;
  try {
    outcomeRecorded = await catalogQueries.recordCachePurgeOutcome(
      product.id,
      debt.revision,
      purge.kind,
      purge.requestId,
    );
  } finally {
    log.set({
      cachePurge: {
        outcome: purge.kind,
        outcomeRecorded,
        requestId: purge.requestId,
      },
    });
    log.emit();
  }

  const refreshed = await catalogQueries.findById(product.id);
  if (!refreshed) {
    throw new Error("Committed Product cache-purge truth is unavailable");
  }
  return {
    product: refreshed,
    cache:
      purge.kind === "purged" && outcomeRecorded && refreshed.cachePurgeDebt === null
        ? ("purged" as const)
        : ("committed_but_not_purged" as const),
    cachePurgeRequestId: purge.requestId,
  };
};
