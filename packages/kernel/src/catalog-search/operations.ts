import { Result } from "better-result";
import { catalogSearchQueries } from "./persistence";

export type CatalogSearchInput = {
  readonly query: string;
  readonly category?: string;
  readonly collection?: string;
  readonly page: number;
  readonly limit: number;
};
export type CatalogSearchFailure = { readonly code: "infrastructure_unavailable" };

export const searchCatalog = async (input: CatalogSearchInput) =>
  (await Result.tryPromise(() => catalogSearchQueries.search(input))).mapError(
    (): CatalogSearchFailure => ({ code: "infrastructure_unavailable" }),
  );

export const readCatalogSearchDiagnostics = () => catalogSearchQueries.diagnostics();
export const repairCatalogSearchProjection = () => catalogSearchQueries.repair();
