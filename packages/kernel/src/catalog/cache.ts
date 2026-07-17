import { env } from "cloudflare:workers";
import { parseCachePurgeEnvironment, parseCachePurgeResponse } from "./cache-contract";

export const purgeCatalogCache = async (productId: string) => {
  const configuration = parseCachePurgeEnvironment({
    CLOUDFLARE_ZONE_ID: env.CLOUDFLARE_ZONE_ID,
    CLOUDFLARE_CACHE_PURGE_TOKEN: env.CLOUDFLARE_CACHE_PURGE_TOKEN,
  });
  if (!configuration.success) {
    return { kind: "failed" as const };
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
    const requestId = response.headers.get("cf-ray") ?? response.headers.get("cf-request-id");
    return response.ok && body.success && body.output.success
      ? { kind: "purged" as const, requestId }
      : { kind: "failed" as const, requestId };
  } catch {
    return { kind: "failed" as const };
  }
};
