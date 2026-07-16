import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { database } from "./database";
import { systemMetadata } from "./schema";

export type InfrastructureHealth = {
  readonly database: "connected";
  readonly ephemeralKv: "connected";
  readonly media: "connected";
};

export const readInfrastructureHealth = async (): Promise<InfrastructureHealth> => {
  const records = await database()
    .select({ value: systemMetadata.value })
    .from(systemMetadata)
    .where(eq(systemMetadata.key, "schema"))
    .limit(1);
  const schemaRecord = records.at(0);
  if (schemaRecord?.value !== "bootstrap-1") {
    throw new Error("D1 bootstrap migration is not applied");
  }

  await env.EPHEMERAL_KV.get("health:probe");
  await env.MEDIA.head("health/probe");

  return {
    database: "connected",
    ephemeralKv: "connected",
    media: "connected",
  };
};
