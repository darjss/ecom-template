import type { StoreElysiaApp } from "@ecom/api";
import { treaty } from "@elysiajs/eden";

export const createApiClient = () =>
  treaty<StoreElysiaApp>(window.location.origin, { parseDate: false });
