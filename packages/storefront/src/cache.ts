export const applyPublicHtmlCache = (headers: Headers, tags: readonly string[]) => {
  headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  headers.set("Cloudflare-CDN-Cache-Control", "public, max-age=1209600");
  headers.set("Cache-Tag", tags.join(", "));
};
