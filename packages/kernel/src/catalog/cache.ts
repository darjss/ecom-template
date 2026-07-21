import type { Product } from "@ecom/contracts";
import { cache, env } from "cloudflare:workers";
import { createLogger } from "evlog";
import ky from "ky";
import {
  parseCachePurgeEnvironment,
  parseCachePurgeRequestId,
  parseCachePurgeResponse,
} from "./cache-contract";
import { catalogQueries } from "./persistence";

const purgeCacheTags = async (tags: readonly string[]) => {
  const configuration = parseCachePurgeEnvironment(env);
  if (!configuration.success) {
    return { kind: "failed" as const, requestId: null };
  }
  try {
    const response = await ky.post(
      `https://api.cloudflare.com/client/v4/zones/${configuration.output.CLOUDFLARE_ZONE_ID}/purge_cache`,
      {
        headers: {
          authorization: `Bearer ${configuration.output.CLOUDFLARE_CACHE_PURGE_TOKEN}`,
        },
        json: { tags },
        retry: 0,
        throwHttpErrors: false,
        timeout: 10_000,
      },
    );
    const body = parseCachePurgeResponse(await response.json());
    const requestId = parseCachePurgeRequestId(
      response.headers.get("cf-ray") ?? response.headers.get("cf-request-id"),
    );
    if (!response.ok || !body.success || !body.output.success) {
      return { kind: "failed" as const, requestId };
    }
    const workerPurge = await cache.purge({ tags: [...tags] });
    return workerPurge.success
      ? { kind: "purged" as const, requestId }
      : { kind: "failed" as const, requestId };
  } catch {
    return { kind: "failed" as const, requestId: null };
  }
};

export const purgeCatalogListingCache = () => purgeCacheTags(["catalog"]);

export const purgeCatalogItemCache = (catalogItemId: string) =>
  purgeCacheTags(["catalog", `product:${catalogItemId}`]);

export const purgeCmsCache = () => purgeCacheTags(["store-shell", "homepage", "catalog"]);

export const resolvePendingCatalogCachePurge = async (product: Product) => {
  const debt = await catalogQueries.findCachePurgeDebt(product.id);
  if (!debt) {
    return { product, cache: "not_required" as const, cachePurgeRequestId: null };
  }

  const purge = await purgeCatalogItemCache(product.id);
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
