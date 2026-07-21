import {
  CatalogApiErrorSchema,
  CatalogItemListResponseSchema,
  CatalogListResponseSchema,
  CatalogProductResponseSchema,
  type CreateProductInput,
  type InventoryAdjustmentInput,
  type ProductId,
  type SaveProductOptionsInput,
  type UpdateProductInput,
  type UpdateVariantPresentationInput,
  type VariantId,
} from "@ecom/contracts";
import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/solid-query";
import type { InferErr, InferOk } from "better-result";
import { createApiClient } from "./eden";
import { requestResult, unwrapRequestResult } from "./request";

export const catalogQueryKey = ["catalog", "products"] as const;
export const catalogItemsQueryKey = ["catalog", "items"] as const;

type CatalogMutation =
  | ({ readonly kind: "create" } & CreateProductInput)
  | ({ readonly kind: "update"; readonly id: ProductId } & UpdateProductInput)
  | { readonly kind: "publish"; readonly id: ProductId }
  | { readonly kind: "archive"; readonly id: ProductId }
  | { readonly kind: "reactivate"; readonly id: ProductId }
  | ({ readonly kind: "save-options"; readonly id: ProductId } & SaveProductOptionsInput)
  | ({
      readonly kind: "update-variant";
      readonly id: ProductId;
      readonly variantId: VariantId;
    } & UpdateVariantPresentationInput)
  | { readonly kind: "archive-variant"; readonly id: ProductId; readonly variantId: VariantId }
  | { readonly kind: "reactivate-variant"; readonly id: ProductId; readonly variantId: VariantId }
  | ({ readonly kind: "adjust"; readonly id: ProductId } & InventoryAdjustmentInput);

const requestCatalog = () =>
  requestResult(
    () => createApiClient().api.catalog.products.get(),
    CatalogListResponseSchema,
    CatalogApiErrorSchema,
    "Invalid Catalog response",
  );

const requestCatalogItems = () =>
  requestResult(
    () => createApiClient().api.catalog.items.get(),
    CatalogItemListResponseSchema,
    CatalogApiErrorSchema,
    "Invalid Catalog Item response",
  );

const requestInventoryAdjustment = (
  client: ReturnType<typeof createApiClient>,
  id: ProductId,
  input: InventoryAdjustmentInput,
) => client.api.catalog.products({ id })["inventory-adjustments"].post(input);

const requestCatalogMutation = (mutation: CatalogMutation) => {
  const client = createApiClient();
  const request = () =>
    mutation.kind === "create"
      ? client.api.catalog.products.post({
          name: mutation.name,
          slug: mutation.slug,
          description: mutation.description,
          priceMnt: mutation.priceMnt,
          openingQuantity: mutation.openingQuantity,
          inventoryReason: mutation.inventoryReason,
        })
      : mutation.kind === "update"
        ? client.api.catalog.products({ id: mutation.id }).patch({
            name: mutation.name,
            slug: mutation.slug,
            description: mutation.description,
            priceMnt: mutation.priceMnt,
          })
        : mutation.kind === "publish"
          ? client.api.catalog.products({ id: mutation.id }).publish.post()
          : mutation.kind === "archive"
            ? client.api.catalog.products({ id: mutation.id }).archive.post()
            : mutation.kind === "reactivate"
              ? client.api.catalog.products({ id: mutation.id }).reactivate.post()
              : mutation.kind === "save-options"
                ? client.api.catalog.products({ id: mutation.id }).options.put({
                    groups: mutation.groups,
                    variants: mutation.variants,
                  })
                : mutation.kind === "update-variant"
                  ? client.api.catalog
                      .products({ id: mutation.id })
                      .variants({
                        variantId: mutation.variantId,
                      })
                      .patch({
                        priceOverrideMnt: mutation.priceOverrideMnt,
                        imageMediaAssetId: mutation.imageMediaAssetId,
                      })
                  : mutation.kind === "archive-variant" || mutation.kind === "reactivate-variant"
                    ? client.api.catalog
                        .products({ id: mutation.id })
                        .variants({ variantId: mutation.variantId })({
                          action: mutation.kind === "archive-variant" ? "archive" : "reactivate",
                        })
                        .post()
                    : requestInventoryAdjustment(client, mutation.id, {
                        delta: mutation.delta,
                        reason: mutation.reason,
                      });
  return requestResult(
    request,
    CatalogProductResponseSchema,
    CatalogApiErrorSchema,
    "Invalid Catalog mutation response",
  );
};

type CatalogResult = Awaited<ReturnType<typeof requestCatalog>>;
type CatalogItemsResult = Awaited<ReturnType<typeof requestCatalogItems>>;
type CatalogMutationResult = Awaited<ReturnType<typeof requestCatalogMutation>>;

export const catalogQueryOptions = () =>
  queryOptions<InferOk<CatalogResult>, InferErr<CatalogResult>>({
    queryKey: catalogQueryKey,
    queryFn: async () => unwrapRequestResult(await requestCatalog()),
  });

export const catalogItemsQueryOptions = () =>
  queryOptions<InferOk<CatalogItemsResult>, InferErr<CatalogItemsResult>>({
    queryKey: catalogItemsQueryKey,
    queryFn: async () => unwrapRequestResult(await requestCatalogItems()),
  });

export const catalogMutationOptions = (queryClient: QueryClient) =>
  mutationOptions<InferOk<CatalogMutationResult>, InferErr<CatalogMutationResult>, CatalogMutation>(
    {
      mutationFn: async (mutation) => unwrapRequestResult(await requestCatalogMutation(mutation)),
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: catalogQueryKey, refetchType: "none" }),
          queryClient.invalidateQueries({ queryKey: catalogItemsQueryKey, refetchType: "none" }),
        ]);
        await Promise.all([
          queryClient.refetchQueries({ queryKey: catalogQueryKey, type: "active" }),
          queryClient.refetchQueries({ queryKey: catalogItemsQueryKey, type: "active" }),
        ]);
      },
    },
  );
