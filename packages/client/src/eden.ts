import type { StoreElysiaApp } from "@ecom/api";
import type { ClientFailure } from "@ecom/contracts";
import { treaty } from "@elysiajs/eden";

const networkError = (): ClientFailure => ({
  kind: "network",
  message: "Network request failed",
});

export const createApiClient = () =>
  treaty<StoreElysiaApp>(window.location.origin, {
    parseDate: false,
    async fetcher(url, options) {
      try {
        return await fetch(url, options);
      } catch {
        throw networkError();
      }
    },
  });
