import {
  BundleApiErrorSchema,
  BundleListResponseSchema,
  BundleMutationResponseSchema,
  PersonalizationListResponseSchema,
  PersonalizationMutationResponseSchema,
  type BundleId,
  type CatalogItemId,
  type CreateBundleInput,
  type SaveBundleComponentsInput,
  type SavePersonalizationsInput,
  type UpdateBundleInput,
} from "@ecom/contracts";
import { createApiClient } from "../eden";
import { requestResult } from "../request";

export const requestBundles = () =>
  requestResult(
    () => createApiClient().api.catalog.bundles.get(),
    BundleListResponseSchema,
    BundleApiErrorSchema,
    "Invalid Bundle response",
  );

export type BundleMutation =
  | ({ readonly kind: "create" } & CreateBundleInput)
  | ({ readonly kind: "update"; readonly id: BundleId } & UpdateBundleInput)
  | ({ readonly kind: "save-components"; readonly id: BundleId } & SaveBundleComponentsInput)
  | { readonly kind: "retry-cache-purge"; readonly id: BundleId }
  | { readonly kind: "publish" | "archive" | "reactivate"; readonly id: BundleId };

export const requestBundleMutation = (mutation: BundleMutation) => {
  const client = createApiClient();
  const request = () =>
    mutation.kind === "create"
      ? client.api.catalog.bundles.post({
          name: mutation.name,
          slug: mutation.slug,
          description: mutation.description,
          priceMnt: mutation.priceMnt,
        })
      : mutation.kind === "update"
        ? client.api.catalog.bundles({ id: mutation.id }).patch({
            name: mutation.name,
            slug: mutation.slug,
            description: mutation.description,
            priceMnt: mutation.priceMnt,
          })
        : mutation.kind === "save-components"
          ? client.api.catalog.bundles({ id: mutation.id }).components.put({
              components: mutation.components,
            })
          : mutation.kind === "retry-cache-purge"
            ? client.api.catalog.bundles({ id: mutation.id })["cache-purge"].retry.post()
            : client.api.catalog.bundles({ id: mutation.id })({ action: mutation.kind }).post();
  return requestResult(
    request,
    BundleMutationResponseSchema,
    BundleApiErrorSchema,
    "Invalid Bundle mutation response",
  );
};

export const requestPersonalizations = (id: CatalogItemId) =>
  requestResult(
    () => createApiClient().api.catalog.items({ id }).personalizations.get(),
    PersonalizationListResponseSchema,
    BundleApiErrorSchema,
    "Invalid Personalization response",
  );

export const requestPersonalizationMutation = (
  id: CatalogItemId,
  input: SavePersonalizationsInput,
) =>
  requestResult(
    () => createApiClient().api.catalog.items({ id }).personalizations.put(input),
    PersonalizationMutationResponseSchema,
    BundleApiErrorSchema,
    "Invalid Personalization mutation response",
  );
