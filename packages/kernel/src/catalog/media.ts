import {
  MediaUploadMaxBytes,
  createMediaAssetId,
  type CatalogImage,
  type MediaAssetId,
  type MediaContentType,
  type MediaFormat,
  type MediaWidth,
  type ProductId,
} from "@ecom/contracts";
import { Result } from "better-result";
import { env } from "cloudflare:workers";
import { hasStaffCapability, type StaffActor } from "../staff/operations";
import { resolvePendingCatalogCachePurge } from "./cache";
import { catalogMediaQueries } from "./media-persistence";
import { catalogQueries } from "./persistence";

export type CatalogMediaFailure = {
  readonly code:
    | "forbidden"
    | "not_found"
    | "unsupported_media_type"
    | "invalid_media_bytes"
    | "media_too_large"
    | "infrastructure_unavailable";
};

type AttachCatalogImageInput = {
  readonly declaredContentType: string;
  readonly bytes: Uint8Array;
  readonly position: number;
  readonly altText: string;
};

const matches = (bytes: Uint8Array, offset: number, signature: readonly number[]) =>
  signature.every((byte, index) => bytes[offset + index] === byte);

const detectedContentType = (bytes: Uint8Array): MediaContentType | undefined => {
  if (bytes.length >= 3 && matches(bytes, 0, [255, 216, 255])) {
    return "image/jpeg";
  }
  if (bytes.length >= 8 && matches(bytes, 0, [137, 80, 78, 71, 13, 10, 26, 10])) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    matches(bytes, 0, [82, 73, 70, 70]) &&
    matches(bytes, 8, [87, 69, 66, 80])
  ) {
    return "image/webp";
  }
  return undefined;
};

const mediaExtension = (contentType: MediaContentType) =>
  contentType === "image/jpeg" ? "jpg" : contentType === "image/png" ? "png" : "webp";

export const attachCatalogImage = async (
  actor: StaffActor,
  catalogItemId: ProductId,
  input: AttachCatalogImageInput,
) => {
  if (!hasStaffCapability(actor.role, "catalog_cms")) {
    return Result.err<never, CatalogMediaFailure>({ code: "forbidden" });
  }
  if (input.bytes.byteLength > MediaUploadMaxBytes) {
    return Result.err<never, CatalogMediaFailure>({ code: "media_too_large" });
  }
  const detectedType = detectedContentType(input.bytes);
  if (!detectedType) {
    return Result.err<never, CatalogMediaFailure>({ code: "invalid_media_bytes" });
  }
  if (detectedType !== input.declaredContentType) {
    return Result.err<never, CatalogMediaFailure>({ code: "unsupported_media_type" });
  }
  try {
    if (!(await catalogMediaQueries.catalogItemExists(catalogItemId))) {
      return Result.err<never, CatalogMediaFailure>({ code: "not_found" });
    }
    const mediaAssetId = createMediaAssetId();
    const objectKey = `catalog/${crypto.randomUUID()}.${mediaExtension(detectedType)}`;
    const object = await env.MEDIA.put(objectKey, input.bytes, {
      httpMetadata: { contentType: detectedType },
      onlyIf: { etagDoesNotMatch: "*" },
    });
    if (!object) {
      return Result.err<never, CatalogMediaFailure>({ code: "infrastructure_unavailable" });
    }
    const image = await catalogMediaQueries.attach(
      catalogItemId,
      mediaAssetId,
      objectKey,
      detectedType,
      input.position,
      input.altText,
      new Date(),
    );
    const product = await catalogQueries.findById(catalogItemId);
    if (product?.cachePurgeDebt) {
      await resolvePendingCatalogCachePurge(product);
    }
    return Result.ok<CatalogImage, never>(image);
  } catch {
    return Result.err<never, CatalogMediaFailure>({ code: "infrastructure_unavailable" });
  }
};

export const readCatalogMedia = async (
  mediaAssetId: MediaAssetId,
  width: MediaWidth,
  format: MediaFormat,
) => {
  try {
    const asset = await catalogMediaQueries.findMediaAsset(mediaAssetId);
    if (!asset) {
      return Result.err<never, CatalogMediaFailure>({ code: "not_found" });
    }
    const object = await env.MEDIA.get(asset.objectKey);
    if (!object) {
      return Result.err<never, CatalogMediaFailure>({ code: "infrastructure_unavailable" });
    }
    const transformed = (
      await env.IMAGES.input(object.body)
        .transform({ width })
        .output({ format: format === "avif" ? "image/avif" : "image/webp" })
    ).response();
    return Result.ok<Response, never>(transformed);
  } catch {
    return Result.err<never, CatalogMediaFailure>({ code: "infrastructure_unavailable" });
  }
};
