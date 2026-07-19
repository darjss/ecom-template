import {
  GuestTrackingApiErrorSchema,
  GuestTrackingRequestSchema,
  GuestTrackingResponseSchema,
} from "@ecom/contracts";
import { readGuestTracking } from "@ecom/kernel";
import { Elysia } from "elysia";
import * as v from "valibot";

const privacyHeaders = {
  "cache-control": "private, no-store",
  "referrer-policy": "no-referrer",
  "x-robots-tag": "noindex, nofollow",
};

export const createTrackingRoutes = () =>
  new Elysia({ aot: false }).post("/tracking", async ({ body, set, status }) => {
    for (const [name, value] of Object.entries(privacyHeaders)) {
      set.headers[name] = value;
    }
    const input = v.safeParse(GuestTrackingRequestSchema, body);
    if (!input.success) {
      return status(
        404,
        v.parse(GuestTrackingApiErrorSchema, {
          error: { code: "not_found", message: "Guest tracking capability was not found" },
        }),
      );
    }
    const result = await readGuestTracking(input.output);
    if (result.isOk()) {
      return v.parse(GuestTrackingResponseSchema, { data: result.value });
    }
    return result.error.code === "not_found"
      ? status(
          404,
          v.parse(GuestTrackingApiErrorSchema, {
            error: { code: "not_found", message: "Guest tracking capability was not found" },
          }),
        )
      : status(
          503,
          v.parse(GuestTrackingApiErrorSchema, {
            error: { code: "unavailable", message: "Guest tracking is unavailable" },
          }),
        );
  });
