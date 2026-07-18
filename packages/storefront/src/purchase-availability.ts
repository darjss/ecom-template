import { availabilityFreshnessMs, availabilityQueryOptions } from "@ecom/client";
import type { AvailabilityFact, AvailabilityTarget } from "@ecom/contracts";
import { createQuery } from "@tanstack/solid-query";
import { createMemo, createSignal, onCleanup } from "solid-js";
import { isServer } from "solid-js/web";

export type PurchaseAvailabilityState = "checking" | "ready" | "unavailable" | "stale";

export const createPurchaseAvailability = (target: () => AvailabilityTarget) => {
  const query = createQuery(() => availabilityQueryOptions([target()], !isServer));
  const [now, setNow] = createSignal(Date.now());
  if (!isServer) {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    onCleanup(() => window.clearInterval(timer));
  }
  const fact = createMemo<AvailabilityFact | undefined>(() => {
    const current = target();
    return query.data?.data.facts.find(
      (candidate) => candidate.kind === current.kind && candidate.id === current.id,
    );
  });
  const fresh = () => {
    const checkedAt = query.data?.data.checkedAt;
    return checkedAt !== undefined && now() - Date.parse(checkedAt) < availabilityFreshnessMs;
  };
  const state = (): PurchaseAvailabilityState => {
    if (!query.data) {
      return query.isError || query.fetchStatus === "paused" ? "stale" : "checking";
    }
    if (query.isError || query.fetchStatus === "paused" || !fresh()) {
      return "stale";
    }
    return fact()?.sellable ? "ready" : "unavailable";
  };
  return { fact, state };
};
