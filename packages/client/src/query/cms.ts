import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/solid-query";
import type { InferErr, InferOk } from "better-result";
import {
  requestCmsDocuments,
  requestCmsMutation,
  requestCommerceSettings,
  requestCommerceSettingsMutation,
  type CmsMutation,
} from "../cms/request";
import { unwrapRequestResult } from "../request";
import type { CommerceSettings } from "@ecom/contracts";

const cmsQueryKey = ["cms", "documents"] as const;
const commerceSettingsQueryKey = ["commerce-settings"] as const;
type CmsResult = Awaited<ReturnType<typeof requestCmsDocuments>>;
type CmsMutationResult = Awaited<ReturnType<typeof requestCmsMutation>>;
type SettingsResult = Awaited<ReturnType<typeof requestCommerceSettings>>;
type SettingsMutationResult = Awaited<ReturnType<typeof requestCommerceSettingsMutation>>;

export const cmsQueryOptions = () =>
  queryOptions<InferOk<CmsResult>, InferErr<CmsResult>>({
    queryKey: cmsQueryKey,
    queryFn: async () => unwrapRequestResult(await requestCmsDocuments()),
  });
export const commerceSettingsQueryOptions = () =>
  queryOptions<InferOk<SettingsResult>, InferErr<SettingsResult>>({
    queryKey: commerceSettingsQueryKey,
    queryFn: async () => unwrapRequestResult(await requestCommerceSettings()),
  });

export const cmsMutationOptions = (queryClient: QueryClient) =>
  mutationOptions<InferOk<CmsMutationResult>, InferErr<CmsMutationResult>, CmsMutation>({
    mutationFn: async (mutation) => unwrapRequestResult(await requestCmsMutation(mutation)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: cmsQueryKey, refetchType: "none" });
      await queryClient.refetchQueries({ queryKey: cmsQueryKey, type: "active" });
    },
  });
export const commerceSettingsMutationOptions = (queryClient: QueryClient) =>
  mutationOptions<
    InferOk<SettingsMutationResult>,
    InferErr<SettingsMutationResult>,
    CommerceSettings
  >({
    mutationFn: async (settings) =>
      unwrapRequestResult(await requestCommerceSettingsMutation(settings)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: commerceSettingsQueryKey,
        refetchType: "none",
      });
      await queryClient.refetchQueries({ queryKey: commerceSettingsQueryKey, type: "active" });
    },
  });
