import * as v from "valibot";

export type DraftIdentity = {
  storeId: string;
  formId: string;
  entityId: string;
};

export type DraftEnvelope<TValues> = {
  identity: DraftIdentity;
  schemaVersion: string;
  baseRevision: number;
  baseValues: TValues;
  draftValues: TValues;
  savedAt: string;
};

export type DraftLoad<TValues> =
  | { kind: "missing" }
  | { kind: "ready"; envelope: DraftEnvelope<TValues> }
  | { kind: "incompatible"; savedAt: string; storedVersion: string }
  | { kind: "invalid"; message: string }
  | { kind: "storage-error"; message: string };

const metadataSchema = v.object({
  identity: v.object({
    storeId: v.string(),
    formId: v.string(),
    entityId: v.string(),
  }),
  schemaVersion: v.string(),
  baseRevision: v.pipe(v.number(), v.integer()),
  baseValues: v.unknown(),
  draftValues: v.unknown(),
  savedAt: v.string(),
});

const sameIdentity = (left: DraftIdentity, right: DraftIdentity) =>
  left.storeId === right.storeId &&
  left.formId === right.formId &&
  left.entityId === right.entityId;

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Draft storage is unavailable.";

export const draftStorageKey = (identity: DraftIdentity) =>
  ["ecom-template", "merchant-form", identity.storeId, identity.formId, identity.entityId]
    .map(encodeURIComponent)
    .join(":");

export const loadDraft = <TValues>(
  storage: Storage,
  identity: DraftIdentity,
  schemaVersion: string,
  schema: v.GenericSchema<unknown, TValues>,
): DraftLoad<TValues> => {
  let raw: string | null;
  try {
    raw = storage.getItem(draftStorageKey(identity));
  } catch (error) {
    return { kind: "storage-error", message: errorMessage(error) };
  }
  if (raw === null) return { kind: "missing" };

  try {
    const parsed: unknown = JSON.parse(raw);
    const metadata = v.safeParse(metadataSchema, parsed);
    if (!metadata.success || !sameIdentity(metadata.output.identity, identity)) {
      return { kind: "invalid", message: "This saved draft could not be read safely." };
    }
    if (metadata.output.schemaVersion !== schemaVersion) {
      return {
        kind: "incompatible",
        savedAt: metadata.output.savedAt,
        storedVersion: metadata.output.schemaVersion,
      };
    }
    const base = v.safeParse(schema, metadata.output.baseValues);
    const draft = v.safeParse(schema, metadata.output.draftValues);
    if (!base.success || !draft.success) {
      return { kind: "invalid", message: "This draft no longer matches the product form." };
    }
    return {
      kind: "ready",
      envelope: {
        identity: metadata.output.identity,
        schemaVersion: metadata.output.schemaVersion,
        baseRevision: metadata.output.baseRevision,
        baseValues: base.output,
        draftValues: draft.output,
        savedAt: metadata.output.savedAt,
      },
    };
  } catch (error) {
    return { kind: "invalid", message: errorMessage(error) };
  }
};

type StorageResult = { ok: true } | { ok: false; message: string };

export const saveDraft = <TValues>(
  storage: Storage,
  envelope: DraftEnvelope<TValues>,
): StorageResult => {
  try {
    storage.setItem(draftStorageKey(envelope.identity), JSON.stringify(envelope));
    return { ok: true };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
};

export const removeDraft = (storage: Storage, identity: DraftIdentity): StorageResult => {
  try {
    storage.removeItem(draftStorageKey(identity));
    return { ok: true };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
};
