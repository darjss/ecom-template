import { Result } from "better-result";
import { catalogSearchQueries, type CatalogSearchInput } from "./persistence";

export type { CatalogSearchInput } from "./persistence";
export type CatalogSearchFailure = { readonly code: "infrastructure_unavailable" };

export const searchCatalog = async (input: CatalogSearchInput) =>
  (await Result.tryPromise(() => catalogSearchQueries.search(input))).mapError(
    (): CatalogSearchFailure => ({ code: "infrastructure_unavailable" }),
  );

export const readCatalogSearchDiagnostics = () => catalogSearchQueries.diagnostics();
export const repairCatalogSearchProjection = () => catalogSearchQueries.repair();
