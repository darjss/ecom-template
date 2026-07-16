import { StoreDefinitionSchema } from "@ecom/contracts";
import * as v from "valibot";

export const selectIntegrations = (input: unknown) =>
  v.parse(StoreDefinitionSchema.entries.providers, input);
