import {
  AnnouncementDocumentSchema,
  HomepageDocumentSchema,
  LocationsDocumentSchema,
  NavigationDocumentSchema,
  OrderingNoticesDocumentSchema,
  PoliciesDocumentSchema,
  StorefrontIdentityDocumentSchema,
  type CmsDocument,
  type CmsDocumentKind,
} from "@ecom/contracts";
import * as v from "valibot";

const parseContent = (kind: CmsDocumentKind, value: unknown): CmsDocument["content"] => {
  switch (kind) {
    case "storefront_identity":
      return v.parse(StorefrontIdentityDocumentSchema, value);
    case "homepage":
      return v.parse(HomepageDocumentSchema, value);
    case "navigation":
      return v.parse(NavigationDocumentSchema, value);
    case "locations":
      return v.parse(LocationsDocumentSchema, value);
    case "policies":
      return v.parse(PoliciesDocumentSchema, value);
    case "announcement":
      return v.parse(AnnouncementDocumentSchema, value);
    case "ordering_notices":
      return v.parse(OrderingNoticesDocumentSchema, value);
  }
};

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .toSorted(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
};

export const encodeCmsDocument = (document: CmsDocument) => {
  const content = parseContent(document.kind, document.content);
  return JSON.stringify(canonicalize(content));
};

export const decodeCmsDocument = (kind: CmsDocumentKind, schemaVersion: number, json: string) => {
  if (schemaVersion !== 1) {
    throw new Error("Unsupported CMS schema version");
  }
  const content = JSON.parse(json);
  switch (kind) {
    case "storefront_identity":
      return { kind, content: v.parse(StorefrontIdentityDocumentSchema, content) };
    case "homepage":
      return { kind, content: v.parse(HomepageDocumentSchema, content) };
    case "navigation":
      return { kind, content: v.parse(NavigationDocumentSchema, content) };
    case "locations":
      return { kind, content: v.parse(LocationsDocumentSchema, content) };
    case "policies":
      return { kind, content: v.parse(PoliciesDocumentSchema, content) };
    case "announcement":
      return { kind, content: v.parse(AnnouncementDocumentSchema, content) };
    case "ordering_notices":
      return { kind, content: v.parse(OrderingNoticesDocumentSchema, content) };
  }
};
