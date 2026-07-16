import { Result } from "better-result";
import { eq } from "drizzle-orm";
import { database } from "./database";
import { systemMetadata } from "./schema";

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
    const records = await database()
      .select({ value: systemMetadata.value })
      .from(systemMetadata)
      .where(eq(systemMetadata.key, "schema"))
      .limit(1);
    const schemaRecord = records.at(0);
    if (schemaRecord?.value !== "bootstrap-1") {
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
