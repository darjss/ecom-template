import { fromString, typeidUnboxed } from "typeid-js";
import * as v from "valibot";
import type { ClientRequestError } from "./client-error";
import { CatalogItemIdSchema, MediaAssetIdSchema } from "./catalog";
import { CategoryIdSchema, CollectionIdSchema } from "./grouping";

const boundedText = (maximum: number) =>
  v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(maximum));
const optionalText = (maximum: number) => v.nullable(boundedText(maximum));
const typeId = (prefix: string, label: string) =>
  v.pipe(
    v.string(),
    v.check((value) => {
      try {
        fromString(value, prefix);
        return true;
      } catch {
        return false;
      }
    }, `Invalid ${label}`),
  );
const httpsUrl = v.pipe(v.string(), v.url(), v.startsWith("https://"));
const VersionSchema = v.literal(1);

export const CmsDocumentKindSchema = v.picklist([
  "storefront_identity",
  "homepage",
  "navigation",
  "locations",
  "policies",
  "announcement",
  "ordering_notices",
]);
export const CmsDocumentStatusSchema = v.picklist(["draft", "published"]);
export const LocationIdSchema = typeId("location", "Location ID");
export const PolicyIdSchema = typeId("policy", "Policy ID");
export const PolicyKindSchema = v.picklist([
  "terms",
  "privacy",
  "delivery",
  "returns_refunds",
  "payment",
]);

export const StorefrontIdentityDocumentSchema = v.strictObject({
  version: VersionSchema,
  displayName: boundedText(80),
  legalName: optionalText(120),
  tagline: optionalText(120),
  summary: boundedText(320),
  logoMediaAssetId: v.nullable(MediaAssetIdSchema),
  faviconMediaAssetId: v.nullable(MediaAssetIdSchema),
  publicPhone: optionalText(32),
  publicEmail: v.nullable(v.pipe(v.string(), v.email(), v.maxLength(254))),
  socialLinks: v.pipe(
    v.array(
      v.strictObject({
        platform: v.picklist(["facebook", "instagram", "tiktok"]),
        url: httpsUrl,
      }),
    ),
    v.maxLength(3),
  ),
});

export const NavigationDestinationSchema = v.variant("kind", [
  v.strictObject({ kind: v.literal("home") }),
  v.strictObject({ kind: v.literal("category"), id: CategoryIdSchema }),
  v.strictObject({ kind: v.literal("collection"), id: CollectionIdSchema }),
  v.strictObject({ kind: v.literal("catalog_item"), id: CatalogItemIdSchema }),
  v.strictObject({ kind: v.literal("location"), id: LocationIdSchema }),
  v.strictObject({ kind: v.literal("policy"), id: PolicyIdSchema }),
  v.strictObject({ kind: v.literal("external"), url: httpsUrl, openInNewTab: v.boolean() }),
]);
const NavigationItemSchema = v.strictObject({
  id: v.pipe(v.string(), v.uuid()),
  label: boundedText(60),
  enabled: v.boolean(),
  destination: NavigationDestinationSchema,
  children: v.pipe(
    v.array(
      v.strictObject({
        id: v.pipe(v.string(), v.uuid()),
        label: boundedText(60),
        enabled: v.boolean(),
        destination: NavigationDestinationSchema,
      }),
    ),
    v.maxLength(12),
  ),
});
export const NavigationDocumentSchema = v.strictObject({
  version: VersionSchema,
  primary: v.pipe(v.array(NavigationItemSchema), v.maxLength(12)),
  footer: v.pipe(
    v.array(
      v.strictObject({
        id: v.pipe(v.string(), v.uuid()),
        label: boundedText(60),
        items: v.pipe(v.array(v.omit(NavigationItemSchema, ["children"])), v.maxLength(12)),
      }),
    ),
    v.maxLength(6),
  ),
});

export const LocationsDocumentSchema = v.strictObject({
  version: VersionSchema,
  locations: v.pipe(
    v.array(
      v.strictObject({
        id: LocationIdSchema,
        name: boundedText(80),
        address: boundedText(240),
        phone: optionalText(32),
        openingHours: boundedText(240),
        directionsUrl: v.nullable(httpsUrl),
        active: v.boolean(),
        pickupEnabled: v.boolean(),
      }),
    ),
    v.maxLength(20),
  ),
});

const acceptedInlineMarkdown = (source: string) => {
  if (source.includes("![")) {
    return false;
  }
  let remainder = source;
  remainder = remainder.replaceAll(/\[([^\n]+?)\]\((https:\/\/[^\s)]+)\)/g, "$1");
  remainder = remainder.replaceAll(/\*\*([^*\n]+)\*\*/g, "$1");
  remainder = remainder.replaceAll(/\*([^*\n]+)\*/g, "$1");
  return !/(?:\[|\]|\(|\)|\*|_|`|<|>|\||\\)/.test(remainder);
};

const acceptedPolicyMarkdown = (value: string) =>
  value.split("\n").every((line) => {
    if (line === "") {
      return true;
    }
    if (/^###?\s/.test(line)) {
      return acceptedInlineMarkdown(line.replace(/^###?\s/, ""));
    }
    if (/^-\s/.test(line)) {
      return acceptedInlineMarkdown(line.slice(2));
    }
    if (/^(?:#|>|\+\s|\*\s|\d+[.)]\s|\s{4}|-{3,}|_{3,}|\*{3,})/.test(line)) {
      return false;
    }
    return acceptedInlineMarkdown(line);
  });

const markdown = v.pipe(
  boundedText(20_000),
  v.check(acceptedPolicyMarkdown, "Policy content contains unsupported Markdown"),
);
export const PoliciesDocumentSchema = v.strictObject({
  version: VersionSchema,
  policies: v.pipe(
    v.array(
      v.strictObject({
        id: PolicyIdSchema,
        kind: PolicyKindSchema,
        title: boundedText(100),
        contentMarkdown: markdown,
      }),
    ),
    v.maxLength(5),
  ),
});

export const HomepageDocumentSchema = v.strictObject({
  version: VersionSchema,
  headline: boundedText(120),
  summary: boundedText(320),
  heroMediaAssetId: v.nullable(MediaAssetIdSchema),
  featuredCatalogItemIds: v.pipe(v.array(CatalogItemIdSchema), v.maxLength(12)),
});
export const AnnouncementDocumentSchema = v.strictObject({
  version: VersionSchema,
  enabled: v.boolean(),
  message: boundedText(160),
});
export const OrderingNoticesDocumentSchema = v.strictObject({
  version: VersionSchema,
  notices: v.pipe(
    v.array(v.strictObject({ id: v.pipe(v.string(), v.uuid()), text: boundedText(320) })),
    v.maxLength(20),
  ),
});

export const CmsDocumentSchemas = {
  storefront_identity: StorefrontIdentityDocumentSchema,
  homepage: HomepageDocumentSchema,
  navigation: NavigationDocumentSchema,
  locations: LocationsDocumentSchema,
  policies: PoliciesDocumentSchema,
  announcement: AnnouncementDocumentSchema,
  ordering_notices: OrderingNoticesDocumentSchema,
} as const;

export const CmsDocumentSchema = v.variant("kind", [
  v.strictObject({
    kind: v.literal("storefront_identity"),
    content: StorefrontIdentityDocumentSchema,
  }),
  v.strictObject({ kind: v.literal("homepage"), content: HomepageDocumentSchema }),
  v.strictObject({ kind: v.literal("navigation"), content: NavigationDocumentSchema }),
  v.strictObject({ kind: v.literal("locations"), content: LocationsDocumentSchema }),
  v.strictObject({ kind: v.literal("policies"), content: PoliciesDocumentSchema }),
  v.strictObject({ kind: v.literal("announcement"), content: AnnouncementDocumentSchema }),
  v.strictObject({ kind: v.literal("ordering_notices"), content: OrderingNoticesDocumentSchema }),
]);

export const CmsDocumentRecordSchema = v.strictObject({
  kind: CmsDocumentKindSchema,
  status: CmsDocumentStatusSchema,
  schemaVersion: v.literal(1),
  content: v.unknown(),
  createdAt: v.pipe(v.string(), v.isoTimestamp()),
  updatedAt: v.pipe(v.string(), v.isoTimestamp()),
  publishedAt: v.nullable(v.pipe(v.string(), v.isoTimestamp())),
});
export const CmsDocumentListResponseSchema = v.strictObject({ data: v.array(CmsDocumentSchema) });
const CmsCacheOutcomeSchema = v.picklist(["not_required", "purged", "committed_but_not_purged"]);
export const CmsDocumentResponseSchema = v.strictObject({
  data: v.strictObject({
    document: CmsDocumentSchema,
    cache: CmsCacheOutcomeSchema,
    cachePurgeRequestId: v.nullable(v.string()),
  }),
});
export const CmsCachePurgeResponseSchema = v.strictObject({
  data: v.strictObject({
    cache: CmsCacheOutcomeSchema,
    cachePurgeRequestId: v.nullable(v.string()),
  }),
});
export const CmsApiErrorSchema = v.strictObject({
  error: v.strictObject({
    code: v.picklist([
      "unauthorized",
      "forbidden",
      "validation",
      "not_found",
      "conflict",
      "unavailable",
    ]),
    message: v.string(),
    reason: v.optional(
      v.picklist([
        "invalid_reference",
        "navigation_cycle",
        "navigation_depth",
        "duplicate_identity",
        "capability_ceiling",
        "secret_field",
        "infrastructure_unavailable",
      ]),
    ),
  }),
});

export const CommerceSettingsSchema = v.strictObject({
  bankTransferEnabled: v.boolean(),
  cashOnDeliveryEnabled: v.boolean(),
  customerAccountsEnabled: v.boolean(),
  telegramEnabled: v.boolean(),
  pickupEnabled: v.boolean(),
  deliveryEnabled: v.boolean(),
  deliveryFeeMnt: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(10_000_000)),
  freeDeliveryThresholdMnt: v.nullable(
    v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(1_000_000_000)),
  ),
});
export const CommerceSettingsResponseSchema = v.strictObject({ data: CommerceSettingsSchema });
export const CommerceSettingsMutationResponseSchema = v.strictObject({
  data: v.strictObject({
    settings: CommerceSettingsSchema,
    cache: v.picklist(["purged", "committed_but_not_purged"]),
    cachePurgeRequestId: v.nullable(v.string()),
  }),
});

export type CmsDocumentKind = v.InferOutput<typeof CmsDocumentKindSchema>;
export type CmsDocument = v.InferOutput<typeof CmsDocumentSchema>;
export type StorefrontIdentityDocument = v.InferOutput<typeof StorefrontIdentityDocumentSchema>;
export type NavigationDocument = v.InferOutput<typeof NavigationDocumentSchema>;
export type LocationsDocument = v.InferOutput<typeof LocationsDocumentSchema>;
export type PoliciesDocument = v.InferOutput<typeof PoliciesDocumentSchema>;
export type CommerceSettings = v.InferOutput<typeof CommerceSettingsSchema>;
export type CmsClientError = ClientRequestError<v.InferOutput<typeof CmsApiErrorSchema>["error"]>;
export const createLocationId = () => typeidUnboxed("location");
export const createPolicyId = () => typeidUnboxed("policy");
