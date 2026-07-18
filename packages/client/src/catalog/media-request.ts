import {
  CatalogApiErrorSchema,
  MediaUploadResponseSchema,
  type CatalogItemId,
  type MediaUploadFields,
} from "@ecom/contracts";
import * as v from "valibot";
import { createApiClient } from "../eden";
import { requestResult } from "../request";

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

export const requestCatalogImageUpload = (upload: CatalogImageUpload) =>
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
