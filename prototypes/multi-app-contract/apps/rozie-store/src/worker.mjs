import { adminCapabilities } from "@prototype/commerce-kernel/admin";
import { createCommerceApi } from "@prototype/commerce-kernel/api";
import { commerceCachePolicy } from "@prototype/commerce-kernel/cache";
import { commerceSchema } from "@prototype/commerce-kernel/schema";
import { storeProfile } from "./store-profile.mjs";

const api = createCommerceApi({ storeProfile });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname !== "/api/health") {
      return new Response("Prototype merchant storefront", {
        headers: { "cache-control": `public, s-maxage=${commerceCachePolicy.publicHtmlSeconds}` },
      });
    }

    const product = await env.DB.prepare("SELECT id, name, price_mnt FROM products LIMIT 1").first();

    return Response.json({
      appOwns: ["storeProfile", "storefront", "wrangler"],
      sharedKernel: {
        api,
        adminCapabilities,
        commerceSchema,
        cachePolicy: commerceCachePolicy,
      },
      product,
      storeProfile,
    }, { headers: { "cache-control": "no-store" } });
  },
};
