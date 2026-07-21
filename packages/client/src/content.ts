import {
  CmsApiErrorSchema,
  CmsCachePurgeResponseSchema,
  CmsDocumentListResponseSchema,
  CmsDocumentResponseSchema,
  CommerceSettingsMutationResponseSchema,
  CommerceSettingsResponseSchema,
  type CmsDocument,
  type CmsDocumentKind,
  type CommerceSettings,
} from "@ecom/contracts";
import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/solid-query";
import type { InferErr, InferOk } from "better-result";
import { createApiClient } from "./eden";
import { requestResult, unwrapRequestResult } from "./request";

const cmsQueryKey = ["cms", "documents"] as const;
const commerceSettingsQueryKey = ["commerce-settings"] as const;

type CmsMutation =
  | { readonly kind: "save-draft"; readonly document: CmsDocument }
  | { readonly kind: "publish"; readonly documentKind: CmsDocumentKind };

const requestCmsDocuments = () =>
  requestResult(
    () => createApiClient().api.cms.documents.get(),
    CmsDocumentListResponseSchema,
    CmsApiErrorSchema,
    "Invalid CMS response",
  );

const requestCmsMutation = (mutation: CmsMutation) => {
  const client = createApiClient();
  const request = () =>
    mutation.kind === "save-draft"
      ? client.api.cms.documents({ kind: mutation.document.kind }).draft.put(mutation.document)
      : client.api.cms.documents({ kind: mutation.documentKind }).publish.post();
  return requestResult(
    request,
    CmsDocumentResponseSchema,
    CmsApiErrorSchema,
    "Invalid CMS mutation response",
  );
};

const requestCmsCachePurge = () =>
  requestResult(
    () => createApiClient().api.cms["cache-purge"].retry.post(),
    CmsCachePurgeResponseSchema,
    CmsApiErrorSchema,
    "Invalid CMS cache-purge response",
  );

const requestCommerceSettings = () =>
  requestResult(
    () => createApiClient().api["commerce-settings"].get(),
    CommerceSettingsResponseSchema,
    CmsApiErrorSchema,
    "Invalid commerce settings response",
  );

const requestCommerceSettingsMutation = (settings: CommerceSettings) =>
  requestResult(
    () => createApiClient().api["commerce-settings"].put(settings),
    CommerceSettingsMutationResponseSchema,
    CmsApiErrorSchema,
    "Invalid commerce settings mutation response",
  );

type CmsResult = Awaited<ReturnType<typeof requestCmsDocuments>>;
type CmsMutationResult = Awaited<ReturnType<typeof requestCmsMutation>>;
type CmsCachePurgeResult = Awaited<ReturnType<typeof requestCmsCachePurge>>;
type SettingsResult = Awaited<ReturnType<typeof requestCommerceSettings>>;
type SettingsMutationResult = Awaited<ReturnType<typeof requestCommerceSettingsMutation>>;

export const cmsQueryOptions = () =>
  queryOptions<InferOk<CmsResult>, InferErr<CmsResult>>({
    queryKey: cmsQueryKey,
    queryFn: async () => unwrapRequestResult(await requestCmsDocuments()),
  });

export const cmsMutationOptions = (queryClient: QueryClient) =>
  mutationOptions<InferOk<CmsMutationResult>, InferErr<CmsMutationResult>, CmsMutation>({
    mutationFn: async (mutation) => unwrapRequestResult(await requestCmsMutation(mutation)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: cmsQueryKey, refetchType: "none" });
      await queryClient.refetchQueries({ queryKey: cmsQueryKey, type: "active" });
    },
  });

export const cmsCachePurgeMutationOptions = () =>
  mutationOptions<InferOk<CmsCachePurgeResult>, InferErr<CmsCachePurgeResult>, void>({
    mutationFn: async () => unwrapRequestResult(await requestCmsCachePurge()),
  });

export const commerceSettingsQueryOptions = () =>
  queryOptions<InferOk<SettingsResult>, InferErr<SettingsResult>>({
    queryKey: commerceSettingsQueryKey,
    queryFn: async () => unwrapRequestResult(await requestCommerceSettings()),
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
