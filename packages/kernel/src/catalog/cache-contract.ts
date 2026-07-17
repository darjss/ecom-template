import * as v from "valibot";

const CachePurgeEnvironmentSchema = v.object({
  CLOUDFLARE_ZONE_ID: v.pipe(v.string(), v.minLength(1)),
  CLOUDFLARE_CACHE_PURGE_TOKEN: v.pipe(v.string(), v.minLength(1)),
});
const CachePurgeRequestIdSchema = v.nullable(v.pipe(v.string(), v.minLength(1), v.maxLength(128)));
const CachePurgeResponseSchema = v.strictObject({
  success: v.boolean(),
  result: v.unknown(),
  errors: v.array(v.unknown()),
  messages: v.array(v.unknown()),
});

export const parseCachePurgeEnvironment = (source: unknown) =>
  v.safeParse(CachePurgeEnvironmentSchema, source);

export const parseCachePurgeResponse = (source: unknown) =>
  v.safeParse(CachePurgeResponseSchema, source);

export const parseCachePurgeRequestId = (source: unknown) =>
  v.parse(CachePurgeRequestIdSchema, source);
