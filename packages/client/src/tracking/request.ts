import {
  GuestTrackingApiErrorSchema,
  GuestTrackingResponseSchema,
  type GuestTrackingRequest,
} from "@ecom/contracts";
import { createApiClient } from "../eden";
import { requestResult } from "../request";

export const requestGuestTracking = (input: GuestTrackingRequest) =>
  requestResult(
    () => createApiClient().api.tracking.post(input),
    GuestTrackingResponseSchema,
    GuestTrackingApiErrorSchema,
    "Invalid Guest tracking response",
  );
