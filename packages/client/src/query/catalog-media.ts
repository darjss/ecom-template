import { mutationOptions, type QueryClient } from "@tanstack/solid-query";
import type { InferErr, InferOk } from "better-result";
import { requestCatalogImageUpload, type CatalogImageUpload } from "../catalog/media-request";
import { unwrapRequestResult } from "../request";
import { refreshCatalogItemOwner } from "./bundle";

type CatalogImageResult = Awaited<ReturnType<typeof requestCatalogImageUpload>>;

export const catalogImageMutationOptions = (queryClient: QueryClient) =>
  mutationOptions<InferOk<CatalogImageResult>, InferErr<CatalogImageResult>, CatalogImageUpload>({
    mutationFn: async (upload) => unwrapRequestResult(await requestCatalogImageUpload(upload)),
    onSuccess: async (_data, upload) => {
      await refreshCatalogItemOwner(queryClient, upload.catalogItemId);
    },
  });
