import { createStoreBackend } from "@ecom/api";
import { storeProfile } from "./profile/store";

export const backend = createStoreBackend({ storeName: storeProfile.name });
