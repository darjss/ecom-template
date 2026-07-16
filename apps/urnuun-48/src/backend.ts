import { createStoreBackend } from "@ecom/api";
import { storeDefinition } from "./profile/definition";

export const backend = createStoreBackend(storeDefinition.backend);
