import {
  AvailabilityApiErrorSchema,
  AvailabilityResponseSchema,
  type AvailabilityRequest,
} from "@ecom/contracts";
import { createApiClient } from "../eden";
import { requestResult } from "../request";

export const requestAvailability = (input: AvailabilityRequest, signal?: AbortSignal) =>
  requestResult(
    () =>
      createApiClient().api.catalog.availability.post(
        input,
        signal ? { fetch: { signal } } : undefined,
      ),
    AvailabilityResponseSchema,
    AvailabilityApiErrorSchema,
    "Invalid availability response",
  );
