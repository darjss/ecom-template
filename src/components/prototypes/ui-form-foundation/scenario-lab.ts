import { createSignal } from "solid-js";
import * as v from "valibot";
import type { RecordSnapshot, SaveOutcome } from "./model";
import { initialProductRecord, productSchema, type ProductValues } from "./product-model";

const scenarioKey = "ecom-template:prototype:ui-form-foundation:server";

const recordSchema = v.object({
  revision: v.pipe(v.number(), v.integer()),
  values: productSchema,
});

const loadRecord = (): RecordSnapshot<ProductValues> => {
  const raw = window.sessionStorage.getItem(scenarioKey);
  if (raw === null) return initialProductRecord;
  try {
    const parsed: unknown = JSON.parse(raw);
    const result = v.safeParse(recordSchema, parsed);
    return result.success ? result.output : initialProductRecord;
  } catch {
    return initialProductRecord;
  }
};

const persistRecord = (record: RecordSnapshot<ProductValues>) => {
  window.sessionStorage.setItem(scenarioKey, JSON.stringify(record));
};

export const createScenarioLab = () => {
  const [serverRecord, setServerRecord] = createSignal(loadRecord());
  const [failNextSave, setFailNextSave] = createSignal(false);

  const save = async (request: {
    values: ProductValues;
    expectedRevision: number;
  }): Promise<SaveOutcome<ProductValues>> => {
    await new Promise((resolve) => window.setTimeout(resolve, 450));
    if (failNextSave()) {
      setFailNextSave(false);
      throw new Error("Сервертэй холбогдож чадсангүй. Холболтоо шалгаад дахин оролдоно уу.");
    }
    const current = serverRecord();
    if (request.expectedRevision !== current.revision) {
      return { status: "conflict", currentRecord: current };
    }
    const record = { revision: current.revision + 1, values: request.values };
    persistRecord(record);
    setServerRecord(record);
    return { status: "saved", record };
  };

  const simulateExternalChange = () => {
    const current = serverRecord();
    const record = {
      revision: current.revision + 1,
      values: {
        ...current.values,
        name: "Хангайн ноолууран кардиган",
        price: current.values.price + 20_000,
      },
    };
    persistRecord(record);
    setServerRecord(record);
  };

  const reset = () => {
    window.sessionStorage.removeItem(scenarioKey);
    setServerRecord(initialProductRecord);
    setFailNextSave(false);
  };

  return {
    serverRecord,
    save,
    simulateExternalChange,
    failNextSave: () => setFailNextSave(true),
    reset,
  };
};
