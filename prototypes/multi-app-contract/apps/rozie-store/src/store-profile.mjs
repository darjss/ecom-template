export const storeProfile = {
  slug: "rozie-store",
  identity: {
    name: "Rozie Store",
    locale: "mn-MN",
    currency: "MNT",
  },
  storefront: {
    entrypoint: "./src/storefront",
    theme: "merchant-owned",
  },
  cache: {
    catalogVersionKey: "catalog:version",
    cmsVersionKey: "cms:version",
  },
  provisioning: {
    region: "apac",
    disposablePrefix: "wf5-prototype",
  },
};
