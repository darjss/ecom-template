import * as v from "valibot";

export const StoreSlugSchema = v.pipe(v.string(), v.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/));
export const StoreNameSchema = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80));
export const CommitIdentitySchema = v.pipe(v.string(), v.regex(/^[0-9a-f]{40}$/));
export const ManifestDigestSchema = v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/));
export const D1DatabaseNameSchema = v.pipe(v.string(), v.regex(/^[a-z0-9-]+-db$/));
export const D1DatabaseIdSchema = v.pipe(
  v.string(),
  v.regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
);
export const DeliveryStaffIdSchema = v.pipe(
  v.string(),
  v.regex(/^staff_[0-7][0-9abcdefghjkmnpqrstvwxyz]{25}$/),
);
export const DeliveryAuditEventIdSchema = v.pipe(
  v.string(),
  v.regex(/^audit_[0-7][0-9abcdefghjkmnpqrstvwxyz]{25}$/),
);

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
  schemaVersion: v.literal(2),
  target: v.string(),
  app: v.string(),
  commit: CommitIdentitySchema,
  manifestDigest: ManifestDigestSchema,
  origin: v.pipe(v.string(), v.url()),
  resources: v.strictObject({
    d1: v.strictObject({
      name: D1DatabaseNameSchema,
      databaseId: D1DatabaseIdSchema,
    }),
  }),
  completedSteps: v.array(v.picklist(["local-migrations", "remote-deploy"])),
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
