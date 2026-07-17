import { createStoreBackend } from "@ecom/api";
import { deliverSms } from "@ecom/integrations";
import { storeDefinition } from "./profile/definition";

const store = createStoreBackend({
  profile: storeDefinition.profile,
  providers: storeDefinition.providers,
  smsGateway: deliverSms,
});

export const api = store.api;
export const storefront = store.storefront;
