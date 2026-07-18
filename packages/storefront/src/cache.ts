import type { CatalogItemId, PolicyId } from "@ecom/contracts";

export type PublicCacheTag =
  | "store-shell"
  | "homepage"
  | "catalog"
  | `product:${CatalogItemId}`
  | `policy:${PolicyId}`;

const CatalogItemCacheTagSchema =
  /^product:(?:product|bundle)_[0-7][0123456789abcdefghjkmnpqrstvwxyz]{25}$/;
const PolicyCacheTagSchema = /^policy:policy_[0-7][0123456789abcdefghjkmnpqrstvwxyz]{25}$/;
export const productCacheTag = (id: CatalogItemId): PublicCacheTag => `product:${id}`;
export const policyCacheTag = (id: PolicyId): PublicCacheTag => `policy:${id}`;

const isPublicCacheTag = (tag: string): tag is PublicCacheTag =>
  tag === "store-shell" ||
  tag === "homepage" ||
  tag === "catalog" ||
  CatalogItemCacheTagSchema.test(tag) ||
  PolicyCacheTagSchema.test(tag);

export const isPublicCacheTagHeader = (value: string) => {
  const tags = value.split(",");
  return tags.length > 0 && tags.every(isPublicCacheTag);
};

export const applyPublicHtmlCache = (headers: Headers, tags: readonly PublicCacheTag[]) => {
  const serializedTags = tags.join(",");
  if (!isPublicCacheTagHeader(serializedTags)) {
    throw new Error("Public cache tags must use the closed semantic vocabulary");
  }
  headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  headers.set("Cloudflare-CDN-Cache-Control", "public, max-age=1209600");
  headers.set("Cache-Tag", serializedTags);
};
