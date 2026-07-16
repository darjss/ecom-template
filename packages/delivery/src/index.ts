import * as v from "valibot";

export const StoreSlugSchema = v.pipe(v.string(), v.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/));
export const StoreNameSchema = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80));
export const CommitIdentitySchema = v.pipe(v.string(), v.regex(/^[0-9a-f]{40}$/));

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
  app: v.string(),
  commit: CommitIdentitySchema,
  origin: v.pipe(v.string(), v.url()),
  completedSteps: v.array(v.string()),
  updatedAt: v.pipe(v.string(), v.isoTimestamp()),
});

export const DevProcessRecordSchema = v.strictObject({
  app: v.string(),
  commit: CommitIdentitySchema,
  origin: v.pipe(v.string(), v.url()),
  checkoutRoot: v.string(),
  pid: v.pipe(v.number(), v.integer(), v.minValue(1)),
});

export const MigrationRecordSchema = v.strictObject({
  target: v.string(),
  migration: v.string(),
  appliedAt: v.string(),
});

export const ProofRecordSchema = v.strictObject({
  target: v.string(),
  app: v.string(),
  commit: CommitIdentitySchema,
  healthUrl: v.pipe(v.string(), v.url()),
  provedAt: v.pipe(v.string(), v.isoTimestamp()),
  passed: v.literal(true),
});

export type DeliveryManifest = v.InferOutput<typeof DeliveryManifestSchema>;
export type DevProcessRecord = v.InferOutput<typeof DevProcessRecordSchema>;
export type DeliveryJournal = v.InferOutput<typeof DeliveryJournalSchema>;
export type MigrationRecord = v.InferOutput<typeof MigrationRecordSchema>;
export type ProofRecord = v.InferOutput<typeof ProofRecordSchema>;
