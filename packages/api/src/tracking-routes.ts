import {
  GuestTrackingApiErrorSchema,
  GuestTrackingRequestSchema,
  GuestTrackingResponseSchema,
} from "@ecom/contracts";
import {
  readGuestTracking,
  readGuestTrackingFailureLimit,
  recordGuestTrackingFailure,
} from "@ecom/kernel";
import { Elysia } from "elysia";
import * as v from "valibot";

const privacyHeaders = {
  "cache-control": "private, no-store",
  "referrer-policy": "no-referrer",
  "x-robots-tag": "noindex, nofollow",
};
const IpAddressSchema = v.pipe(
  v.string(),
  v.trim(),
  v.toLowerCase(),
  v.maxLength(64),
  v.regex(/^[0-9a-f:.]+$/),
);

const requestIpAddress = (request: Request) => {
  const parsed = v.safeParse(IpAddressSchema, request.headers.get("cf-connecting-ip"));
  if (!parsed.success) {
    return "unknown";
  }
  try {
    const hostname = new URL(
      parsed.output.includes(":") ? `http://[${parsed.output}]/` : `http://${parsed.output}/`,
    ).hostname;
    return hostname.replace(/^\[|\]$/g, "");
  } catch {
    return "unknown";
  }
};

const trackingError = (code: "not_found" | "rate_limited" | "unavailable", message: string) =>
  v.parse(GuestTrackingApiErrorSchema, { error: { code, message } });

export const createTrackingRoutes = () =>
  new Elysia({ aot: false }).post("/tracking", async ({ body, request, set, status }) => {
    for (const [name, value] of Object.entries(privacyHeaders)) {
      set.headers[name] = value;
    }
    const ipAddress = requestIpAddress(request);
    const limit = await readGuestTrackingFailureLimit(ipAddress);
    if (limit.isErr()) {
      return status(503, trackingError("unavailable", "Guest tracking is unavailable"));
    }
    if (limit.value.limited) {
      set.headers["retry-after"] = String(limit.value.retryAfterSeconds);
      return status(
        429,
        trackingError("rate_limited", "Guest tracking is temporarily unavailable"),
      );
    }
    const input = v.safeParse(GuestTrackingRequestSchema, body);
    if (!input.success) {
      const recorded = await recordGuestTrackingFailure(ipAddress);
      return recorded.isErr()
        ? status(503, trackingError("unavailable", "Guest tracking is unavailable"))
        : status(404, trackingError("not_found", "Guest tracking capability was not found"));
    }
    const result = await readGuestTracking(input.output);
    if (result.isOk()) {
      return v.parse(GuestTrackingResponseSchema, { data: result.value });
    }
    if (result.error.code === "infrastructure_unavailable") {
      return status(503, trackingError("unavailable", "Guest tracking is unavailable"));
    }
    const recorded = await recordGuestTrackingFailure(ipAddress);
    return recorded.isErr()
      ? status(503, trackingError("unavailable", "Guest tracking is unavailable"))
      : status(404, trackingError("not_found", "Guest tracking capability was not found"));
  });
