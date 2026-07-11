import { createForm } from "@tanstack/solid-form";
import { createMemo, createSignal } from "solid-js";
import * as v from "valibot";
import type { DraftIdentity } from "./draft-store";
import { createMerchantDraftController } from "./merchant-draft-controller";
import {
  applyConflictChoice,
  type FieldConflict,
  reconcileValues,
  type ReconciliationDescriptor,
  type RecordSnapshot,
  type SaveOutcome,
} from "./model";

type MerchantFormConfig<TValues> = {
  identity: DraftIdentity;
  schemaVersion: string;
  schema: v.GenericSchema<TValues, TValues>;
  initialRecord: RecordSnapshot<TValues>;
  descriptors: ReconciliationDescriptor<TValues>[];
  save: (request: {
    values: TValues;
    expectedRevision: number;
  }) => Promise<SaveOutcome<TValues>>;
};

export type SaveStatus =
  | { kind: "idle" }
  | { kind: "saved"; revision: number }
  | { kind: "error"; message: string };

type ReconciliationState<TValues> = {
  serverRecord: RecordSnapshot<TValues>;
  draftValues: TValues;
  mergedValues: TValues;
  conflicts: FieldConflict<TValues>[];
};

const focusElement = (selector: string) => {
  window.queueMicrotask(() => document.querySelector<HTMLElement>(selector)?.focus());
};

const messageFromError = (error: unknown) =>
  error instanceof Error ? error.message : "Бүтээгдэхүүнийг хадгалж чадсангүй.";

export const createMerchantForm = <TValues>(config: MerchantFormConfig<TValues>) => {
  const [baseRecord, setBaseRecord] = createSignal(config.initialRecord);
  const [reconciliation, setReconciliation] =
    createSignal<ReconciliationState<TValues> | null>(null);
  const [choices, setChoices] = createSignal<Record<string, "server" | "draft">>({});
  const [saveStatus, setSaveStatus] = createSignal<SaveStatus>({ kind: "idle" });

  const form = createForm(() => ({
    defaultValues: config.initialRecord.values,
    validators: { onSubmit: config.schema },
    onSubmitInvalid: () => focusElement('[aria-invalid="true"]'),
    onSubmit: async ({ value }) => {
      setSaveStatus({ kind: "idle" });
      try {
        const result = await config.save({
          values: value,
          expectedRevision: baseRecord().revision,
        });
        if (result.status === "conflict") {
          beginReconciliation(baseRecord().values, value, result.currentRecord);
          return;
        }
        setBaseRecord(result.record);
        form.reset(result.record.values);
        draft.clear();
        setSaveStatus({ kind: "saved", revision: result.record.revision });
      } catch (error) {
        setSaveStatus({ kind: "error", message: messageFromError(error) });
        focusElement("[data-save-error]");
      }
    },
  }));

  const values = form.useSelector((state) => state.values);
  const hasChanges = createMemo(() =>
    config.descriptors.some((descriptor) => !descriptor.equals(baseRecord().values, values())),
  );
  const draft = createMerchantDraftController({
    identity: config.identity,
    schemaVersion: config.schemaVersion,
    schema: config.schema,
    values,
    baseRecord,
    hasChanges,
    canWrite: () => reconciliation() === null,
  });

  const beginReconciliation = (
    originalValues: TValues,
    draftValues: TValues,
    serverRecord: RecordSnapshot<TValues>,
  ) => {
    const result = reconcileValues(
      originalValues,
      serverRecord.values,
      draftValues,
      config.descriptors,
    );
    setBaseRecord(serverRecord);
    if (result.conflicts.length === 0) {
      form.reset(result.mergedValues, { keepDefaultValues: true });
      draft.setLoaded(null);
      return;
    }
    setChoices({});
    setReconciliation({
      serverRecord,
      draftValues,
      mergedValues: result.mergedValues,
      conflicts: result.conflicts,
    });
    draft.setLoaded(null);
  };

  const continueDraft = () => {
    const current = draft.loaded();
    if (!current || current.kind !== "ready") return;
    if (current.envelope.baseRevision === baseRecord().revision) {
      form.reset(current.envelope.draftValues, { keepDefaultValues: true });
      draft.setLoaded(null);
      return;
    }
    beginReconciliation(
      current.envelope.baseValues,
      current.envelope.draftValues,
      baseRecord(),
    );
  };

  const resolveConflict = (id: string, choice: "server" | "draft") => {
    setChoices((current) => ({ ...current, [id]: choice }));
  };

  const applyResolution = () => {
    const current = reconciliation();
    if (!current || current.conflicts.some((conflict) => !choices()[conflict.descriptor.id])) {
      return;
    }
    let merged = current.mergedValues;
    for (const conflict of current.conflicts) {
      const useDraft = choices()[conflict.descriptor.id] === "draft";
      merged = applyConflictChoice(
        merged,
        conflict,
        useDraft ? current.draftValues : current.serverRecord.values,
      );
    }
    form.reset(merged, { keepDefaultValues: true });
    setReconciliation(null);
  };

  return {
    form,
    values,
    baseRecord,
    hasChanges,
    recovery: draft.loaded,
    reconciliation,
    choices,
    draftStatus: draft.status,
    saveStatus,
    continueDraft,
    discardDraft: draft.clear,
    resolveConflict,
    applyResolution,
    noteEdit: () => setSaveStatus({ kind: "idle" }),
    seedIncompatibleDraft: draft.seedIncompatible,
    seedInvalidDraft: draft.seedInvalid,
  };
};
