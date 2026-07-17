import {
  CatalogApiErrorSchema,
  CatalogClientErrorSchema,
  CatalogListResponseSchema,
  CatalogProductResponseSchema,
  type CatalogClientError,
  type CreateProductInput,
  type InventoryAdjustmentInput,
  type ProductId,
  type UpdateProductInput,
} from "@ecom/contracts";
import * as v from "valibot";
import { createApiClient } from "../eden";

const clientError = (error: CatalogClientError) => v.parse(CatalogClientErrorSchema, error);
const parseFailure = (source: unknown) => {
  const parsed = v.safeParse(CatalogApiErrorSchema, source);
  return parsed.success
    ? clientError({ kind: "api", error: parsed.output.error })
    : clientError({ kind: "contract", message: "Invalid Catalog API error response" });
};

export const requestCatalog = async () => {
  const response = await createApiClient().api.catalog.products.get();
  if (response.error) {
    throw parseFailure(response.error.value);
  }
  const parsed = v.safeParse(CatalogListResponseSchema, response.data);
  if (!parsed.success) {
    throw clientError({ kind: "contract", message: "Invalid Catalog response" });
  }
  return parsed.output;
};

export type CatalogMutation =
  | ({ readonly kind: "create" } & CreateProductInput)
  | ({ readonly kind: "update"; readonly id: ProductId } & UpdateProductInput)
  | { readonly kind: "publish"; readonly id: ProductId }
  | { readonly kind: "archive"; readonly id: ProductId }
  | { readonly kind: "reactivate"; readonly id: ProductId }
  | ({ readonly kind: "adjust"; readonly id: ProductId } & InventoryAdjustmentInput);

const requestInventoryAdjustment = (
  client: ReturnType<typeof createApiClient>,
  id: ProductId,
  input: InventoryAdjustmentInput,
) => client.api.catalog.products({ id })["inventory-adjustments"].post(input);

export const requestCatalogMutation = async (mutation: CatalogMutation) => {
  const client = createApiClient();
  const response =
    mutation.kind === "create"
      ? await client.api.catalog.products.post({
          name: mutation.name,
          slug: mutation.slug,
          description: mutation.description,
          priceMnt: mutation.priceMnt,
          sku: mutation.sku,
          openingQuantity: mutation.openingQuantity,
          inventoryReason: mutation.inventoryReason,
        })
      : mutation.kind === "update"
        ? await client.api.catalog.products({ id: mutation.id }).patch({
            name: mutation.name,
            slug: mutation.slug,
            description: mutation.description,
            priceMnt: mutation.priceMnt,
            sku: mutation.sku,
          })
        : mutation.kind === "publish"
          ? await client.api.catalog.products({ id: mutation.id }).publish.post()
          : mutation.kind === "archive"
            ? await client.api.catalog.products({ id: mutation.id }).archive.post()
            : mutation.kind === "reactivate"
              ? await client.api.catalog.products({ id: mutation.id }).reactivate.post()
              : await requestInventoryAdjustment(client, mutation.id, {
                  delta: mutation.delta,
                  reason: mutation.reason,
                });
  if (response.error) {
    throw parseFailure(response.error.value);
  }
  const parsed = v.safeParse(CatalogProductResponseSchema, response.data);
  if (!parsed.success) {
    throw clientError({ kind: "contract", message: "Invalid Catalog mutation response" });
  }
  return parsed.output;
};
