import { type Accessor, createEffect, createSignal, onCleanup, onMount } from "solid-js";
import * as v from "valibot";
import {
  type DraftEnvelope,
  type DraftIdentity,
  type DraftLoad,
  draftStorageKey,
  loadDraft,
  removeDraft,
  saveDraft,
} from "./draft-store";
import type { RecordSnapshot } from "./model";

export type DraftStatus =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "saved"; savedAt: string }
  | { kind: "error"; message: string };

type DraftControllerConfig<TValues> = {
  identity: DraftIdentity;
  schemaVersion: string;
  schema: v.GenericSchema<TValues, TValues>;
  values: Accessor<TValues>;
  baseRecord: Accessor<RecordSnapshot<TValues>>;
  hasChanges: Accessor<boolean>;
  canWrite: Accessor<boolean>;
};

export const createMerchantDraftController = <TValues>(config: DraftControllerConfig<TValues>) => {
  const [loaded, setLoaded] = createSignal<DraftLoad<TValues> | null>(null);
  const [status, setStatus] = createSignal<DraftStatus>({ kind: "idle" });
  const [ready, setReady] = createSignal(false);
  let timer: number | undefined;
  let suppressFlush = false;

  const envelope = (): DraftEnvelope<TValues> => ({
    identity: config.identity,
    schemaVersion: config.schemaVersion,
    baseRevision: config.baseRecord().revision,
    baseValues: config.baseRecord().values,
    draftValues: config.values(),
    savedAt: new Date().toISOString(),
  });

  const flush = () => {
    if (suppressFlush || !ready() || loaded() || !config.hasChanges() || !config.canWrite()) {
      return;
    }
    const result = saveDraft(window.localStorage, envelope());
    setStatus(
      result.ok
        ? { kind: "saved", savedAt: new Date().toISOString() }
        : { kind: "error", message: result.message },
    );
  };

  const clear = () => {
    const result = removeDraft(window.localStorage, config.identity);
    setLoaded(null);
    setStatus(result.ok ? { kind: "idle" } : { kind: "error", message: result.message });
  };

  const seedAndReload = (schemaVersion: string, draftValues: unknown) => {
    suppressFlush = true;
    if (timer !== undefined) window.clearTimeout(timer);
    const seeded = {
      ...envelope(),
      schemaVersion,
      draftValues,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(draftStorageKey(config.identity), JSON.stringify(seeded));
    window.location.reload();
  };

  onMount(() => {
    const result = loadDraft(
      window.localStorage,
      config.identity,
      config.schemaVersion,
      config.schema,
    );
    if (result.kind === "storage-error") {
      setStatus({ kind: "error", message: result.message });
    } else if (result.kind !== "missing") {
      setLoaded(result);
    }
    setReady(true);
    window.addEventListener("pagehide", flush);
  });

  createEffect(() => {
    config.values();
    if (timer !== undefined) window.clearTimeout(timer);
    if (!ready() || loaded() || !config.hasChanges() || !config.canWrite()) return;
    setStatus({ kind: "pending" });
    timer = window.setTimeout(flush, 750);
  });

  onCleanup(() => {
    if (timer !== undefined) window.clearTimeout(timer);
    window.removeEventListener("pagehide", flush);
  });

  return {
    loaded,
    setLoaded,
    status,
    clear,
    seedIncompatible: () => seedAndReload("legacy-v0", config.values()),
    seedInvalid: () => seedAndReload(config.schemaVersion, { malformed: true }),
  };
};
