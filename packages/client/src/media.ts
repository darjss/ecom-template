import {
  BundleIdSchema,
  CatalogApiErrorSchema,
  MediaUploadResponseSchema,
  type CatalogItemId,
  type MediaUploadFields,
} from "@ecom/contracts";
import { mutationOptions, type QueryClient } from "@tanstack/solid-query";
import type { InferErr, InferOk } from "better-result";
import * as v from "valibot";
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

export type CatalogImageUpload = MediaUploadFields & {
  readonly catalogItemId: CatalogItemId;
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
    onSuccess: async (_data, upload) => {
      const bundleId = v.safeParse(BundleIdSchema, upload.catalogItemId);
      const queryKey = bundleId.success
        ? (["catalog", "bundles"] as const)
        : (["catalog"] as const);
      await queryClient.invalidateQueries({ queryKey, refetchType: "none" });
      await queryClient.refetchQueries({ queryKey, type: "active" });
    },
  });
