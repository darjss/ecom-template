import { mutationOptions, type QueryClient } from "@tanstack/solid-query";
import type { InferErr, InferOk } from "better-result";
import { requestCatalogImageUpload, type CatalogImageUpload } from "../catalog/media-request";
import { unwrapRequestResult } from "../request";
import { catalogQueryKey } from "./catalog";

type CatalogImageResult = Awaited<ReturnType<typeof requestCatalogImageUpload>>;

export const catalogImageMutationOptions = (queryClient: QueryClient) =>
  mutationOptions<InferOk<CatalogImageResult>, InferErr<CatalogImageResult>, CatalogImageUpload>({
    mutationFn: async (upload) => unwrapRequestResult(await requestCatalogImageUpload(upload)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: catalogQueryKey, refetchType: "none" });
      await queryClient.refetchQueries({ queryKey: catalogQueryKey, type: "active" });
    },
  });
