import {
  CmsApiErrorSchema,
  CmsCachePurgeResponseSchema,
  CmsDocumentKindSchema,
  CmsDocumentListResponseSchema,
  CmsDocumentResponseSchema,
  CmsDocumentSchema,
  CommerceSettingsMutationResponseSchema,
  CommerceSettingsResponseSchema,
  type StoreDefinition,
} from "@ecom/contracts";
import {
  listCmsDocuments,
  publishCmsDocument,
  readCommerceSettings,
  retryCmsCachePurge,
  saveCmsDraft,
  saveCommerceSettings,
  type CmsOperationFailure,
  type StaffActor,
} from "@ecom/kernel";
import { Elysia } from "elysia";
import * as v from "valibot";

type Status = (code: number, body: unknown) => unknown;
type Authorize = (
  request: Request,
  status: Status,
) => Promise<
  | { readonly authorized: true; readonly actor: StaffActor }
  | { readonly authorized: false; readonly response: unknown }
>;
const exposedKinds = new Set(["storefront_identity", "navigation", "locations", "policies"]);

const error = (failure: CmsOperationFailure, status: Status) => {
  const httpStatus =
    failure.code === "forbidden"
      ? 403
      : failure.code === "not_found"
        ? 404
        : failure.code === "infrastructure_unavailable"
          ? 503
          : 409;
  const messages: Record<CmsOperationFailure["code"], string> = {
    forbidden: "CMS authority is required",
    not_found: "CMS Draft was not found",
    invalid_reference: "Every active reference must target current Store content",
    navigation_cycle: "Navigation item identities must be unique and acyclic",
    navigation_depth: "Navigation supports at most two levels",
    duplicate_identity: "Document identities and fixed kinds must be unique",
    capability_ceiling: "A setting exceeds this Store build's capability ceiling",
    infrastructure_unavailable: "CMS infrastructure is unavailable",
  };
  return status(
    httpStatus,
    v.parse(CmsApiErrorSchema, {
      error: {
        code:
          httpStatus === 403
            ? "forbidden"
            : httpStatus === 404
              ? "not_found"
              : httpStatus === 503
                ? "unavailable"
                : "conflict",
        message: messages[failure.code],
        reason:
          failure.code === "forbidden" || failure.code === "not_found" ? undefined : failure.code,
      },
    }),
  );
};
const validation = (status: Status, message: string) =>
  status(422, v.parse(CmsApiErrorSchema, { error: { code: "validation", message } }));

export const createCmsRoutes = (definition: StoreDefinition, authorize: Authorize) =>
  new Elysia({ aot: false })
    .get("/cms/documents", async ({ request, status }) => {
      const authorization = await authorize(request, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      const result = await listCmsDocuments(authorization.actor);
      return result.isErr()
        ? error(result.error, status)
        : v.parse(CmsDocumentListResponseSchema, {
            data: result.value.filter(({ kind }) => exposedKinds.has(kind)),
          });
    })
    .put("/cms/documents/:kind/draft", async ({ body, params, request, status }) => {
      const authorization = await authorize(request, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      const kind = v.safeParse(CmsDocumentKindSchema, params.kind);
      const document = v.safeParse(CmsDocumentSchema, body);
      if (
        !kind.success ||
        !document.success ||
        kind.output !== document.output.kind ||
        !exposedKinds.has(kind.output)
      ) {
        return validation(status, "A strict supported version 1 CMS document is required");
      }
      const result = await saveCmsDraft(authorization.actor, document.output);
      return result.isErr()
        ? error(result.error, status)
        : v.parse(CmsDocumentResponseSchema, { data: result.value });
    })
    .post("/cms/documents/:kind/publish", async ({ params, request, status }) => {
      const authorization = await authorize(request, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      const kind = v.safeParse(CmsDocumentKindSchema, params.kind);
      if (!kind.success || !exposedKinds.has(kind.output)) {
        return validation(status, "A supported CMS document kind is required");
      }
      const result = await publishCmsDocument(authorization.actor, kind.output);
      return result.isErr()
        ? error(result.error, status)
        : v.parse(CmsDocumentResponseSchema, { data: result.value });
    })
    .post("/cms/cache-purge/retry", async ({ request, status }) => {
      const authorization = await authorize(request, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      const result = await retryCmsCachePurge(authorization.actor);
      return result.isErr()
        ? error(result.error, status)
        : v.parse(CmsCachePurgeResponseSchema, { data: result.value });
    })
    .get("/commerce-settings", async ({ request, status }) => {
      const authorization = await authorize(request, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      const result = await readCommerceSettings(authorization.actor);
      return result.isErr()
        ? error(result.error, status)
        : v.parse(CommerceSettingsResponseSchema, {
            data:
              result.value ??
              v.parse(CommerceSettingsResponseSchema.entries.data, {
                bankTransferEnabled: false,
                cashOnDeliveryEnabled: false,
                customerAccountsEnabled: false,
                telegramEnabled: false,
                pickupEnabled: false,
                deliveryEnabled: false,
                deliveryFeeMnt: 0,
                freeDeliveryThresholdMnt: null,
              }),
          });
    })
    .put("/commerce-settings", async ({ body, request, status }) => {
      const authorization = await authorize(request, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      const settings = v.safeParse(CommerceSettingsResponseSchema.entries.data, body);
      if (!settings.success) {
        return validation(status, "Strict public-safe commerce settings are required");
      }
      const result = await saveCommerceSettings(
        authorization.actor,
        definition.profile.capabilities,
        settings.output,
      );
      return result.isErr()
        ? error(result.error, status)
        : v.parse(CommerceSettingsMutationResponseSchema, { data: result.value });
    });
