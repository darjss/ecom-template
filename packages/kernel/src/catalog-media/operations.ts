import {
  MediaUploadMaxBytes,
  createMediaAssetId,
  type CatalogImage,
  type ProductId,
  type MediaAssetId,
  type MediaContentType,
  type MediaFormat,
  type MediaWidth,
} from "@ecom/contracts";
import { Result } from "better-result";
import { env } from "cloudflare:workers";
import { purgeCatalogItemCache } from "../catalog/cache";
import { hasStaffCapability, type StaffActor } from "../staff/operations";
import { catalogMediaQueries } from "./persistence";

type CatalogMediaFailureCode =
  | "forbidden"
  | "not_found"
  | "unsupported_media_type"
  | "invalid_media_bytes"
  | "media_too_large"
  | "infrastructure_unavailable";
export type CatalogMediaFailure = {
  [Code in CatalogMediaFailureCode]: { readonly code: Code };
}[CatalogMediaFailureCode];

type AttachCatalogImageInput = {
  readonly declaredContentType: string;
  readonly bytes: Uint8Array;
  readonly position: number;
  readonly altText: string;
};

type CatalogMediaMutationResult = {
  readonly image: CatalogImage;
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

const isDecodableImage = async (bytes: Uint8Array) => {
  try {
    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(Uint8Array.from(bytes));
        controller.close();
      },
    });
    const decoded = (await env.IMAGES.input(source).output({ format: "image/webp" })).response();
    if (!decoded.ok) {
      return false;
    }
    await decoded.arrayBuffer();
    return true;
  } catch {
    return false;
  }
};

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
    if (!(await catalogMediaQueries.findCatalogItemState(catalogItemId))) {
      return Result.err<never, CatalogMediaFailure>({ code: "not_found" });
    }
  } catch {
    return Result.err<never, CatalogMediaFailure>({ code: "infrastructure_unavailable" });
  }

  if (!(await isDecodableImage(input.bytes))) {
    return Result.err<never, CatalogMediaFailure>({ code: "invalid_media_bytes" });
  }

  const mediaAssetId = createMediaAssetId();
  const objectKey = `catalog/${crypto.randomUUID()}.${mediaExtension(detectedType)}`;
  try {
    const object = await env.MEDIA.put(objectKey, input.bytes, {
      httpMetadata: { contentType: detectedType },
      onlyIf: { etagDoesNotMatch: "*" },
    });
    if (!object) {
      return Result.err<never, CatalogMediaFailure>({ code: "infrastructure_unavailable" });
    }
  } catch {
    return Result.err<never, CatalogMediaFailure>({ code: "infrastructure_unavailable" });
  }

  const attachment = await (async () => {
    try {
      return await catalogMediaQueries.attach(
        catalogItemId,
        mediaAssetId,
        objectKey,
        detectedType,
        input.position,
        input.altText,
        new Date(),
      );
    } catch {
      try {
        await env.MEDIA.delete(objectKey);
      } catch {
        return undefined;
      }
      return undefined;
    }
  })();
  if (!attachment) {
    return Result.err<never, CatalogMediaFailure>({ code: "infrastructure_unavailable" });
  }

  await purgeCatalogItemCache(catalogItemId);
  return Result.ok<CatalogMediaMutationResult>({ image: attachment });
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
