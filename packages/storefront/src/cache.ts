const PublicCacheTagSchema = /^[\x21-\x2b\x2d-\x7e]+$/;

export const isPublicCacheTagHeader = (value: string) => {
  const tags = value.split(",");
  return tags.length > 0 && tags.every((tag) => PublicCacheTagSchema.test(tag));
};

export const applyPublicHtmlCache = (headers: Headers, tags: readonly string[]) => {
  const serializedTags = tags.join(",");
  if (!isPublicCacheTagHeader(serializedTags)) {
    throw new Error("Public cache tags must be printable ASCII without spaces or commas");
  }
  headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  headers.set("Cloudflare-CDN-Cache-Control", "public, max-age=1209600");
  headers.set("Cache-Tag", serializedTags);
};
