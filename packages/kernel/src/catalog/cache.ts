import type { Product } from "@ecom/contracts";
import { cache, env } from "cloudflare:workers";
import ky from "ky";
import {
  parseCachePurgeEnvironment,
  parseCachePurgeRequestId,
  parseCachePurgeResponse,
} from "./cache-contract";

const logCachePurgeFailure = (message: string, details: unknown) => {
  // eslint-disable-next-line no-console
  console.error(message, details);
};

const purgeCacheTags = async (tags: readonly string[]) => {
  const configuration = parseCachePurgeEnvironment(env);
  if (!configuration.success) {
    logCachePurgeFailure("Cache purge configuration is unavailable", { tags });
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
      logCachePurgeFailure("Cloudflare cache purge failed", {
        tags,
        requestId,
        status: response.status,
      });
      return { kind: "failed" as const, requestId };
    }
    const workerPurge = await cache.purge({ tags: [...tags] });
    if (!workerPurge.success) {
      logCachePurgeFailure("Worker cache purge failed", { tags, requestId });
      return { kind: "failed" as const, requestId };
    }
    return { kind: "purged" as const, requestId };
  } catch (error) {
    logCachePurgeFailure("Cache purge failed", { tags, error });
    return { kind: "failed" as const, requestId: null };
  }
};

export const purgeCatalogListingCache = () => purgeCacheTags(["catalog"]);

export const purgeCatalogItemCache = (catalogItemId: string) =>
  purgeCacheTags(["catalog", `product:${catalogItemId}`]);

export const purgeCmsCache = () => purgeCacheTags(["store-shell", "homepage", "catalog"]);

export const resolveCatalogCachePurge = async (product: Product) => {
  if (product.state === "draft") {
    return { product, cache: "not_required" as const, cachePurgeRequestId: null };
  }
  const purge = await purgeCatalogItemCache(product.id);
  return {
    product,
    cache: purge.kind === "purged" ? ("purged" as const) : ("committed_but_not_purged" as const),
    cachePurgeRequestId: purge.requestId,
  };
};
