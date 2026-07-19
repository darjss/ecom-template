import type { GuestTrackingRequest } from "@ecom/contracts";
import { queryOptions } from "@tanstack/solid-query";
import type { InferErr, InferOk } from "better-result";
import { unwrapRequestResult } from "../request";
import { requestGuestTracking } from "../tracking/request";

type TrackingResult = Awaited<ReturnType<typeof requestGuestTracking>>;

export const guestTrackingQueryOptions = (input: GuestTrackingRequest) =>
  queryOptions<InferOk<TrackingResult>, InferErr<TrackingResult>>({
    queryKey: ["guest-tracking", input.orderId],
    queryFn: async () => unwrapRequestResult(await requestGuestTracking(input)),
    retry: false,
  });
