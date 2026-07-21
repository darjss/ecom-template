import {
  CatalogApiErrorSchema,
  MediaUploadResponseSchema,
  type MediaUploadFields,
  type ProductId,
} from "@ecom/contracts";
import { mutationOptions, type QueryClient } from "@tanstack/solid-query";
import type { InferErr, InferOk } from "better-result";
import * as v from "valibot";
import { catalogItemsQueryKey, catalogQueryKey } from "./catalog";
import { createApiClient } from "./eden";
import { requestResult, unwrapRequestResult } from "./request";

const MediaApiErrorSchema = v.union([
  CatalogApiErrorSchema,
  v.pipe(
    v.object({ type: v.literal("validation"), on: v.string() }),
    v.transform(
      (): { readonly error: { readonly code: "validation"; readonly message: string } } => ({
        error: {
          code: "validation",
          message: "A valid multipart image upload is required",
        },
      }),
    ),
  ),
]);

type CatalogImageUpload = MediaUploadFields & {
  readonly catalogItemId: ProductId;
  readonly file: File;
};

const requestCatalogImageUpload = (upload: CatalogImageUpload) =>
  requestResult(
    () =>
      createApiClient().api.catalog.items({ id: upload.catalogItemId }).images.post({
        file: upload.file,
        position: upload.position,
        altText: upload.altText,
      }),
    MediaUploadResponseSchema,
    MediaApiErrorSchema,
    "Invalid Catalog image response",
  );

type CatalogImageResult = Awaited<ReturnType<typeof requestCatalogImageUpload>>;

export const catalogImageMutationOptions = (queryClient: QueryClient) =>
  mutationOptions<InferOk<CatalogImageResult>, InferErr<CatalogImageResult>, CatalogImageUpload>({
    mutationFn: async (upload) => unwrapRequestResult(await requestCatalogImageUpload(upload)),
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
  });
