import * as v from "valibot";

export const DeploymentTargetSchema = v.strictObject({
  kind: v.picklist(["local", "prospect-demo", "canary", "production"]),
  app: v.literal("@shops/urnuun-48"),
  resourcePrefix: v.pipe(v.string(), v.regex(/^[a-z0-9-]+$/)),
  workerName: v.pipe(v.string(), v.regex(/^[a-z0-9-]+$/)),
  routes: v.array(v.string()),
});

export const DeliveryManifestSchema = v.strictObject({
  schemaVersion: v.literal(1),
  targets: v.record(v.string(), DeploymentTargetSchema),
});

export type DeliveryManifest = v.InferOutput<typeof DeliveryManifestSchema>;
