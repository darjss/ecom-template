import {
  type CmsDocument,
  type CmsDocumentKind,
  type CommerceSettings,
  type StoreDefinition,
} from "@ecom/contracts";
import { Result } from "better-result";
import { hasStaffCapability, type StaffActor } from "../staff/operations";
import { purgeCacheTags } from "../catalog/cache";
import { cmsQueries } from "./persistence";

export type CmsOperationFailure = {
  readonly code:
    | "forbidden"
    | "not_found"
    | "invalid_reference"
    | "navigation_cycle"
    | "navigation_depth"
    | "duplicate_identity"
    | "capability_ceiling"
    | "infrastructure_unavailable";
};

export type CmsMutationResult = {
  readonly document: CmsDocument;
  readonly cache: "not_required" | "purged" | "committed_but_not_purged";
  readonly cachePurgeRequestId: string | null;
};

const authorize = (actor: StaffActor) => hasStaffCapability(actor.role, "catalog_cms");

const validateDocument = async (
  document: CmsDocument,
): Promise<CmsOperationFailure | undefined> => {
  const references = await cmsQueries.readReferenceState();
  if (document.kind === "storefront_identity") {
    const mediaIds = [
      document.content.logoMediaAssetId,
      document.content.faviconMediaAssetId,
    ].filter((id): id is string => id !== null);
    return mediaIds.every((id) => references.media.has(id))
      ? undefined
      : { code: "invalid_reference" };
  }
  if (document.kind === "homepage") {
    if (
      document.content.heroMediaAssetId !== null &&
      !references.media.has(document.content.heroMediaAssetId)
    ) {
      return { code: "invalid_reference" };
    }
    return document.content.featuredCatalogItemIds.every((id) => references.catalog.has(id))
      ? undefined
      : { code: "invalid_reference" };
  }
  if (document.kind === "locations") {
    const ids = document.content.locations.map(({ id }) => id);
    return new Set(ids).size === ids.length ? undefined : { code: "duplicate_identity" };
  }
  if (document.kind === "policies") {
    const ids = document.content.policies.map(({ id }) => id);
    const kinds = document.content.policies.map(({ kind }) => kind);
    return new Set(ids).size === ids.length && new Set(kinds).size === kinds.length
      ? undefined
      : { code: "duplicate_identity" };
  }
  if (document.kind !== "navigation") {
    return undefined;
  }
  const allItems = [
    ...document.content.primary,
    ...document.content.primary.flatMap(({ children }) => children),
    ...document.content.footer.flatMap(({ items }) => items),
  ];
  const allIds = [...document.content.footer.map(({ id }) => id), ...allItems.map(({ id }) => id)];
  if (new Set(allIds).size !== allIds.length) {
    return { code: "navigation_cycle" };
  }
  if (document.content.primary.some(({ children }) => children.length > 12)) {
    return { code: "navigation_depth" };
  }
  const [locations, policies] = await Promise.all([
    cmsQueries
      .read("locations", "draft")
      .then((value) => value ?? cmsQueries.read("locations", "published")),
    cmsQueries
      .read("policies", "draft")
      .then((value) => value ?? cmsQueries.read("policies", "published")),
  ]);
  const activeLocations = new Set(
    locations?.kind === "locations"
      ? locations.content.locations.filter(({ active }) => active).map(({ id }) => id)
      : [],
  );
  const policyIds = new Set(
    policies?.kind === "policies" ? policies.content.policies.map(({ id }) => id) : [],
  );
  const valid = allItems
    .filter(({ enabled }) => enabled)
    .every(({ destination }) => {
      switch (destination.kind) {
        case "home":
        case "external":
          return true;
        case "category":
          return references.categories.has(destination.id);
        case "collection":
          return references.collections.has(destination.id);
        case "catalog_item":
          return references.catalog.has(destination.id);
        case "location":
          return activeLocations.has(destination.id);
        case "policy":
          return policyIds.has(destination.id);
      }
      return false;
    });
  return valid ? undefined : { code: "invalid_reference" };
};

export const listCmsDocuments = async (actor: StaffActor) => {
  if (!authorize(actor)) {
    return Result.err<never, CmsOperationFailure>({ code: "forbidden" });
  }
  try {
    const [drafts, published] = await Promise.all([
      cmsQueries.list("draft"),
      cmsQueries.list("published"),
    ]);
    const draftsByKind = new Map(drafts.map((document) => [document.kind, document]));
    return Result.ok([...published.filter(({ kind }) => !draftsByKind.has(kind)), ...drafts]);
  } catch {
    return Result.err<never, CmsOperationFailure>({ code: "infrastructure_unavailable" });
  }
};

export const saveCmsDraft = async (actor: StaffActor, document: CmsDocument) => {
  if (!authorize(actor)) {
    return Result.err<never, CmsOperationFailure>({ code: "forbidden" });
  }
  try {
    const failure = await validateDocument(document);
    if (failure) {
      return Result.err<never, CmsOperationFailure>(failure);
    }
    const saved = await cmsQueries.saveDraft(document);
    return saved
      ? Result.ok<CmsMutationResult>({
          document: saved,
          cache: "not_required",
          cachePurgeRequestId: null,
        })
      : Result.err<never, CmsOperationFailure>({ code: "infrastructure_unavailable" });
  } catch {
    return Result.err<never, CmsOperationFailure>({ code: "infrastructure_unavailable" });
  }
};

const resolvePurge = async (document: CmsDocument) => {
  const debt = await cmsQueries.readDebt();
  if (!debt) {
    return { document, cache: "not_required" as const, cachePurgeRequestId: null };
  }
  const purge = await purgeCacheTags(["store-shell", "homepage", "catalog", "policies"]);
  const recorded = await cmsQueries.recordPurge(
    debt.revision,
    purge.requestId,
    purge.kind === "purged",
  );
  return {
    document,
    cache:
      purge.kind === "purged" && recorded
        ? ("purged" as const)
        : ("committed_but_not_purged" as const),
    cachePurgeRequestId: purge.requestId,
  };
};

export const publishCmsDocument = async (actor: StaffActor, kind: CmsDocumentKind) => {
  if (!authorize(actor)) {
    return Result.err<never, CmsOperationFailure>({ code: "forbidden" });
  }
  try {
    const draft = await cmsQueries.read(kind, "draft");
    if (!draft) {
      return Result.err<never, CmsOperationFailure>({ code: "not_found" });
    }
    const failure = await validateDocument(draft);
    if (failure) {
      return Result.err<never, CmsOperationFailure>(failure);
    }
    const published = await cmsQueries.publish(draft);
    return published
      ? Result.ok<CmsMutationResult>(await resolvePurge(published))
      : Result.err<never, CmsOperationFailure>({ code: "infrastructure_unavailable" });
  } catch {
    return Result.err<never, CmsOperationFailure>({ code: "infrastructure_unavailable" });
  }
};

export const retryCmsCachePurge = async (actor: StaffActor) => {
  if (!authorize(actor)) {
    return Result.err<never, CmsOperationFailure>({ code: "forbidden" });
  }
  try {
    const identity = await cmsQueries.read("storefront_identity", "published");
    return identity
      ? Result.ok<CmsMutationResult>(await resolvePurge(identity))
      : Result.err<never, CmsOperationFailure>({ code: "not_found" });
  } catch {
    return Result.err<never, CmsOperationFailure>({ code: "infrastructure_unavailable" });
  }
};

export const readCommerceSettings = async (actor?: StaffActor) => {
  if (actor && !authorize(actor)) {
    return Result.err<never, CmsOperationFailure>({ code: "forbidden" });
  }
  try {
    return Result.ok(await cmsQueries.readSettings());
  } catch {
    return Result.err<never, CmsOperationFailure>({ code: "infrastructure_unavailable" });
  }
};

export const saveCommerceSettings = async (
  actor: StaffActor,
  capabilities: StoreDefinition["profile"]["capabilities"],
  settings: CommerceSettings,
) => {
  if (!authorize(actor)) {
    return Result.err<never, CmsOperationFailure>({ code: "forbidden" });
  }
  const requested = [
    [settings.bankTransferEnabled, capabilities.bankTransfer],
    [settings.cashOnDeliveryEnabled, capabilities.cashOnDelivery],
    [settings.customerAccountsEnabled, capabilities.customerAccounts],
    [settings.telegramEnabled, capabilities.telegram],
    [settings.pickupEnabled, capabilities.pickup],
    [settings.deliveryEnabled, capabilities.delivery],
  ];
  if (requested.some(([enabled, supported]) => enabled && !supported)) {
    return Result.err<never, CmsOperationFailure>({ code: "capability_ceiling" });
  }
  try {
    const saved = await cmsQueries.saveSettings(settings);
    if (!saved) {
      return Result.err<never, CmsOperationFailure>({ code: "infrastructure_unavailable" });
    }
    const debt = await cmsQueries.readDebt();
    if (!debt) {
      return Result.err<never, CmsOperationFailure>({ code: "infrastructure_unavailable" });
    }
    const purge = await purgeCacheTags(["store-shell"]);
    const recorded = await cmsQueries.recordPurge(
      debt.revision,
      purge.requestId,
      purge.kind === "purged",
    );
    return Result.ok({
      settings: saved,
      cache:
        purge.kind === "purged" && recorded
          ? ("purged" as const)
          : ("committed_but_not_purged" as const),
      cachePurgeRequestId: purge.requestId,
    });
  } catch {
    return Result.err<never, CmsOperationFailure>({ code: "infrastructure_unavailable" });
  }
};
