import * as v from "valibot";

export const StoreSlugSchema = v.pipe(v.string(), v.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/));

export const DeploymentTargetSchema = v.strictObject({
  kind: v.picklist(["local", "prospect-demo", "canary", "production"]),
  app: v.pipe(v.string(), v.regex(/^@shops\/[a-z0-9]+(?:-[a-z0-9]+)*$/)),
  resourcePrefix: v.pipe(v.string(), v.regex(/^[a-z0-9-]+$/)),
  workerName: v.pipe(v.string(), v.regex(/^[a-z0-9-]+$/)),
  routes: v.array(v.string()),
});

export const DeliveryManifestSchema = v.strictObject({
  schemaVersion: v.literal(1),
  targets: v.record(v.string(), DeploymentTargetSchema),
});

export const DeliveryJournalSchema = v.strictObject({
  schemaVersion: v.literal(1),
  target: v.string(),
  completedSteps: v.array(v.string()),
  updatedAt: v.string(),
});

export const MigrationRecordSchema = v.strictObject({
  target: v.string(),
  migration: v.string(),
  appliedAt: v.string(),
});

export const ProofRecordSchema = v.strictObject({
  target: v.string(),
  healthUrl: v.pipe(v.string(), v.url()),
  provedAt: v.string(),
  passed: v.boolean(),
});

export type DeliveryManifest = v.InferOutput<typeof DeliveryManifestSchema>;
export type DeliveryJournal = v.InferOutput<typeof DeliveryJournalSchema>;
export type MigrationRecord = v.InferOutput<typeof MigrationRecordSchema>;
export type ProofRecord = v.InferOutput<typeof ProofRecordSchema>;
