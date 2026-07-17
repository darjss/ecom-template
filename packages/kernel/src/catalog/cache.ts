import { env } from "cloudflare:workers";
import * as v from "valibot";

const CachePurgeEnvironmentSchema = v.strictObject({
  CLOUDFLARE_ZONE_ID: v.pipe(v.string(), v.minLength(1)),
  CLOUDFLARE_CACHE_PURGE_TOKEN: v.pipe(v.string(), v.minLength(1)),
});
const CachePurgeResponseSchema = v.strictObject({
  success: v.boolean(),
  result: v.optional(v.unknown()),
  errors: v.optional(v.array(v.unknown())),
});

export const purgeCatalogCache = async (productId: string) => {
  const configuration = v.safeParse(CachePurgeEnvironmentSchema, env);
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
    const body = v.safeParse(CachePurgeResponseSchema, await response.json());
    const requestId = response.headers.get("cf-ray") ?? response.headers.get("cf-request-id");
    return response.ok && body.success && body.output.success
      ? { kind: "purged" as const, requestId }
      : { kind: "failed" as const, requestId };
  } catch {
    return { kind: "failed" as const };
  }
};
