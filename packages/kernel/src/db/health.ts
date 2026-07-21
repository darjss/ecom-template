import { Result } from "better-result";
import { env } from "cloudflare:workers";

export type DatabaseHealth = {
  readonly database: "connected";
};

export type DatabaseHealthFailure = {
  readonly code: "infrastructure_unavailable";
};

export const readDatabaseHealth = async (): Promise<
  Result<DatabaseHealth, DatabaseHealthFailure>
> => {
  try {
    const record = await env.DB.prepare("SELECT 1 AS connected").first<{ connected: number }>();
    if (record?.connected !== 1) {
      return Result.err<DatabaseHealth, DatabaseHealthFailure>({
        code: "infrastructure_unavailable",
      });
    }

    return Result.ok<DatabaseHealth>({ database: "connected" });
  } catch {
    return Result.err<DatabaseHealth, DatabaseHealthFailure>({
      code: "infrastructure_unavailable",
    });
  }
};
