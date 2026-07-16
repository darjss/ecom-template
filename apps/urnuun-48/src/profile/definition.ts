import { selectIntegrations } from "@ecom/integrations";

export const storeDefinition = {
  backend: {
    profile: {
      slug: "urnuun-48",
      name: "Өрнүүн 48",
      location: "Улаанбаатар, 48-р дэлгүүр",
      origin: process.env.PUBLIC_STORE_ORIGIN,
      currency: "MNT",
      locale: "mn-MN",
    },
    providers: selectIntegrations({
      payment: "byl",
      notifications: ["sms_gateway", "telegram"],
    }),
  },
  presentation: {
    featuredItem: {
      id: "urnuun-canvas-market-bag",
      title: "Өрнүүн даавуун цүнх",
      unitPriceMnt: 38_000,
    },
  },
  cartStorageKey: "cart:v1",
};
