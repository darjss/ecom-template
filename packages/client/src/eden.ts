import type { StoreElysiaApp } from "@ecom/api";
import { ClientErrorSchema } from "@ecom/contracts";
import { treaty } from "@elysiajs/eden";
import * as v from "valibot";

const networkError = () =>
  v.parse(ClientErrorSchema, { kind: "network", message: "Network request failed" });

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
