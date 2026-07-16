import { env } from "cloudflare:workers";
import { Result } from "better-result";
import { eq } from "drizzle-orm";
import { database } from "./database";
import { systemMetadata } from "./schema";

export type InfrastructureHealth = {
  readonly database: "connected";
  readonly ephemeralKv: "connected";
  readonly media: "connected";
};

export type InfrastructureHealthFailure = {
  readonly code: "infrastructure_unavailable";
};

export const readInfrastructureHealth = async (): Promise<
  Result<InfrastructureHealth, InfrastructureHealthFailure>
> => {
  try {
    const records = await database()
      .select({ value: systemMetadata.value })
      .from(systemMetadata)
      .where(eq(systemMetadata.key, "schema"))
      .limit(1);
    const schemaRecord = records.at(0);
    if (schemaRecord?.value !== "bootstrap-1") {
      return Result.err<InfrastructureHealth, InfrastructureHealthFailure>({
        code: "infrastructure_unavailable",
      });
    }

    await env.EPHEMERAL_KV.get("health:probe");
    await env.MEDIA.head("health/probe");

    return Result.ok<InfrastructureHealth>({
      database: "connected",
      ephemeralKv: "connected",
      media: "connected",
    });
  } catch {
    return Result.err<InfrastructureHealth, InfrastructureHealthFailure>({
      code: "infrastructure_unavailable",
    });
  }
};
