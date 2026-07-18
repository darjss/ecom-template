export const storeDefinition = {
  profile: {
    slug: "urnuun-48",
    name: "Өрнүүн 48",
    location: "Улаанбаатар, 48-р дэлгүүр",
    currency: "MNT",
    locale: "mn-MN",
    capabilities: {
      bankTransfer: true,
      cashOnDelivery: true,
      customerAccounts: true,
      telegram: true,
      pickup: true,
      delivery: true,
    },
  },
  providers: {
    payment: "byl",
    notifications: ["sms_gateway", "telegram"],
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
