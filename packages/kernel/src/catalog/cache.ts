import { cache, env } from "cloudflare:workers";
import ky from "ky";
import {
  parseCachePurgeEnvironment,
  parseCachePurgeRequestId,
  parseCachePurgeResponse,
} from "./cache-contract";

const purgeCacheTags = async (tags: readonly string[]) => {
  const configuration = parseCachePurgeEnvironment(env);
  if (!configuration.success) {
    globalThis.console.error("Cache purge failed", { tags, reason: "invalid_configuration" });
    return;
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
      globalThis.console.error("Cache purge failed", { tags, requestId, status: response.status });
      return;
    }
    const workerPurge = await cache.purge({ tags: [...tags] });
    if (!workerPurge.success) {
      globalThis.console.error("Cache purge failed", { tags, requestId, reason: "worker_cache" });
    }
  } catch (error) {
    globalThis.console.error("Cache purge failed", { tags, error });
  }
};

export const purgeCatalogListingCache = () => purgeCacheTags(["catalog"]);

export const purgeCatalogItemCache = (catalogItemId: string) =>
  purgeCacheTags(["catalog", `product:${catalogItemId}`]);

export const purgeCmsCache = () => purgeCacheTags(["store-shell", "homepage", "catalog"]);
