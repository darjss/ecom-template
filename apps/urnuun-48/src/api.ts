import { createStoreBackend } from "@ecom/api";
import { storeDefinition } from "./profile/definition";

const store = createStoreBackend({
  profile: storeDefinition.profile,
  providers: storeDefinition.providers,
});

export const api = store.api;
export const storefront = store.storefront;
export const background = store.background;
