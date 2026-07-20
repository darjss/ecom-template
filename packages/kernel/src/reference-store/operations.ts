import { env } from "cloudflare:workers";
import { installReferenceStoreFixtureRows, proveReferenceStoreFixtureRows } from "./persistence";
import type { ReferenceStoreFixture } from "./schema";

const objectPrefix = "reference/wf29";

export const installReferenceStoreFixture = installReferenceStoreFixtureRows;

const sha256 = async (bytes: Uint8Array) =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes))),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");

export const synchronizeReferenceStoreMedia = async (
  fileName: string,
  expectedSha256: string,
  bytes: Uint8Array,
) => {
  if ((await sha256(bytes)) !== expectedSha256) {
    throw new Error(`${fileName} does not match the accepted media manifest`);
  }
  const objectKey = `${objectPrefix}/${fileName}`;
  const existing = await env.MEDIA.get(objectKey);
  if (existing) {
    if ((await sha256(new Uint8Array(await existing.arrayBuffer()))) !== expectedSha256) {
      throw new Error(`${objectKey} already exists with a different immutable payload`);
    }
    return { outcome: "retained" as const };
  }
  await env.MEDIA.put(objectKey, bytes, { httpMetadata: { contentType: "image/webp" } });
  return { outcome: "uploaded" as const };
};

export const proveReferenceStoreFixture = (fixture: ReferenceStoreFixture) =>
  proveReferenceStoreFixtureRows(fixture);
