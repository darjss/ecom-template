import {
  GuestTrackingRequestSchema,
  createGuestTrackingLinkId,
  type GuestTrackingOrder,
  type GuestTrackingRequest,
} from "@ecom/contracts";
import { Result } from "better-result";
import * as v from "valibot";
import { guestTrackingQueries } from "./persistence";

const capabilityLifetimeMs = 90 * 24 * 60 * 60 * 1_000;

const sha256 = async (value: string) => {
  const bytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const randomToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
};

export const mintGuestTrackingCapability = async (now = new Date()) => {
  const token = randomToken();
  return {
    id: createGuestTrackingLinkId(),
    token,
    tokenHash: await sha256(token),
    createdAt: now,
    expiresAt: new Date(now.getTime() + capabilityLifetimeMs),
  };
};

type GuestTrackingFailure = { readonly code: "not_found" | "infrastructure_unavailable" };

export const readGuestTracking = async (
  input: GuestTrackingRequest,
): Promise<Result<GuestTrackingOrder, GuestTrackingFailure>> => {
  try {
    const parsed = v.parse(GuestTrackingRequestSchema, input);
    const projection = await guestTrackingQueries.read(
      parsed.orderId,
      await sha256(parsed.token),
      new Date(),
    );
    return projection ? Result.ok(projection) : Result.err({ code: "not_found" as const });
  } catch {
    return Result.err({ code: "infrastructure_unavailable" });
  }
};

export const rotateGuestTracking = async (orderId: string) => {
  try {
    const capability = await mintGuestTrackingCapability();
    const rotated = await guestTrackingQueries.rotate(
      orderId,
      capability.tokenHash,
      capability.expiresAt,
      capability.createdAt,
    );
    return rotated
      ? Result.ok({ token: capability.token, expiresAt: capability.expiresAt })
      : Result.err({ code: "not_found" as const });
  } catch {
    return Result.err({ code: "infrastructure_unavailable" as const });
  }
};
