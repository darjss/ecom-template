import type { StoreElysiaApp } from "@ecom/api";
import { treaty } from "@elysiajs/eden";

export const api = treaty<StoreElysiaApp>(
  typeof window === "undefined" ? "http://localhost" : window.location.origin,
);
