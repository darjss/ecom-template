import {
  GuestTrackingRequestSchema,
  createGuestTrackingLinkId,
  type GuestTrackingOrder,
  type GuestTrackingRequest,
} from "@ecom/contracts";
import { Result } from "better-result";
import { env } from "cloudflare:workers";
import * as v from "valibot";
import { guestTrackingQueries } from "./persistence";

const capabilityLifetimeMs = 90 * 24 * 60 * 60 * 1_000;
const failureWindowMs = 15 * 60 * 1_000;
const failureLimit = 30;
const FailureCounterSchema = v.pipe(
  v.string(),
  v.transform(Number),
  v.number(),
  v.integer(),
  v.minValue(0),
);

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

const failureWindow = (now: number) => {
  const startedAt = Math.floor(now / failureWindowMs) * failureWindowMs;
  return { startedAt, expiresAt: startedAt + failureWindowMs };
};

const failureCounterKey = async (ipAddress: string, windowStartedAt: number) =>
  `guest-tracking:failures:${windowStartedAt}:${await sha256(ipAddress)}`;

export const readGuestTrackingFailureLimit = async (ipAddress: string, now = Date.now()) => {
  try {
    const window = failureWindow(now);
    const source = await env.EPHEMERAL_KV.get(await failureCounterKey(ipAddress, window.startedAt));
    const count = source === null ? 0 : v.parse(FailureCounterSchema, source);
    return Result.ok(
      count >= failureLimit
        ? {
            limited: true as const,
            retryAfterSeconds: Math.max(1, Math.ceil((window.expiresAt - now) / 1_000)),
          }
        : { limited: false as const },
    );
  } catch {
    return Result.err({ code: "infrastructure_unavailable" as const });
  }
};

export const recordGuestTrackingFailure = async (ipAddress: string, now = Date.now()) => {
  try {
    const window = failureWindow(now);
    const key = await failureCounterKey(ipAddress, window.startedAt);
    const source = await env.EPHEMERAL_KV.get(key);
    const count = source === null ? 0 : v.parse(FailureCounterSchema, source);
    await env.EPHEMERAL_KV.put(key, String(count + 1), {
      expirationTtl: Math.max(60, Math.ceil((window.expiresAt - now) / 1_000)),
    });
    return Result.ok(undefined);
  } catch {
    return Result.err({ code: "infrastructure_unavailable" as const });
  }
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
