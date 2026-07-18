import {
  CmsApiErrorSchema,
  CmsDocumentListResponseSchema,
  CmsDocumentResponseSchema,
  CommerceSettingsMutationResponseSchema,
  CommerceSettingsResponseSchema,
  type CmsDocument,
  type CmsDocumentKind,
  type CommerceSettings,
} from "@ecom/contracts";
import { createApiClient } from "../eden";
import { requestResult } from "../request";

export const requestCmsDocuments = () =>
  requestResult(
    () => createApiClient().api.cms.documents.get(),
    CmsDocumentListResponseSchema,
    CmsApiErrorSchema,
    "Invalid CMS response",
  );
export const requestCommerceSettings = () =>
  requestResult(
    () => createApiClient().api["commerce-settings"].get(),
    CommerceSettingsResponseSchema,
    CmsApiErrorSchema,
    "Invalid commerce settings response",
  );

export type CmsMutation =
  | { readonly kind: "save-draft"; readonly document: CmsDocument }
  | { readonly kind: "publish"; readonly documentKind: CmsDocumentKind }
  | { readonly kind: "retry-cache-purge" };

export const requestCmsMutation = (mutation: CmsMutation) => {
  const client = createApiClient();
  const request = () =>
    mutation.kind === "save-draft"
      ? client.api.cms.documents({ kind: mutation.document.kind }).draft.put(mutation.document)
      : mutation.kind === "publish"
        ? client.api.cms.documents({ kind: mutation.documentKind }).publish.post()
        : client.api.cms["cache-purge"].retry.post();
  return requestResult(
    request,
    CmsDocumentResponseSchema,
    CmsApiErrorSchema,
    "Invalid CMS mutation response",
  );
};

export const requestCommerceSettingsMutation = (settings: CommerceSettings) =>
  requestResult(
    () => createApiClient().api["commerce-settings"].put(settings),
    CommerceSettingsMutationResponseSchema,
    CmsApiErrorSchema,
    "Invalid commerce settings mutation response",
  );
