import { defineMiddleware } from "astro:middleware";
import { cacheRuleFor } from "@/lib/cache-config";

export const edgeCache = defineMiddleware(async (context, next) => {
  const response = await next();
  if (context.request.method !== "GET" && context.request.method !== "HEAD") return response;

  const rule = cacheRuleFor(context.url.pathname);
  const isHtml = (response.headers.get("content-type") ?? "").includes("text/html");

  if (rule && response.ok && isHtml && !response.headers.has("set-cookie")) {
    response.headers.set("cache-control", "public, max-age=0, must-revalidate");
    response.headers.set(
      "cloudflare-cdn-cache-control",
      `public, max-age=${rule.sMaxAge}, stale-while-revalidate=${rule.staleWhileRevalidate}`,
    );
    if (rule.cacheTag) response.headers.set("cache-tag", rule.cacheTag);
  } else if (!response.headers.has("cache-control")) {
    response.headers.set("cache-control", "private, no-store");
  }

  return response;
});
