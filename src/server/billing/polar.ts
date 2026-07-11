import { polar, portal, webhooks } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";
import { env } from "@/env";
import { NotFoundError } from "@/server/api/errors";
import type { PaymentProvider } from "./provider";

const client = new Polar({
  accessToken: env.POLAR_ACCESS_TOKEN,
  server: env.POLAR_SERVER,
});

const productIdBySlug: Record<string, string | undefined> = {
  pro: env.POLAR_PRODUCT_ID_PRO,
};

const productIdFor = (planSlug: string) => {
  const productId = productIdBySlug[planSlug];
  if (!productId) throw new NotFoundError(`No Polar product configured for plan "${planSlug}"`);
  return productId;
};

export const polarProvider: PaymentProvider = {
  name: "polar",

  createCheckout: async ({ userId, planSlug, successUrl }) => {
    const session = await client.checkouts.create({
      products: [productIdFor(planSlug)],
      externalCustomerId: userId,
      successUrl,
    });
    return { url: session.url };
  },

  getCustomerState: async (userId) => {
    try {
      const state = await client.customers.getStateExternal({ externalId: userId });
      const active = state.activeSubscriptions[0];
      const slug = Object.entries(productIdBySlug).find(
        ([, productId]) => productId === active?.productId,
      )?.[0];
      return {
        activePlanSlug: slug ?? null,
        subscriptionStatus: active ? "active" : "none",
        portalConfigured: true,
      };
    } catch (error) {
      console.warn(`[polar] failed to load customer state for ${userId}`, error);
      return { activePlanSlug: null, subscriptionStatus: "none", portalConfigured: false };
    }
  },

  authPlugin: polar({
    client,
    createCustomerOnSignUp: true,
    use: [
      portal(),
      webhooks({
        secret: env.POLAR_WEBHOOK_SECRET,
        // TODO: react to billing events (grant/revoke entitlements) here
        onCustomerStateChanged: async (payload) => {
          console.log(`[polar] customer state changed: ${payload.data.id}`);
        },
      }),
    ],
  }),
};
