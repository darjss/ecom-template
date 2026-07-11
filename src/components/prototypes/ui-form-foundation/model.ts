export type RecordSnapshot<TValues> = {
  revision: number;
  values: TValues;
};

export type SaveOutcome<TValues> =
  | { status: "saved"; record: RecordSnapshot<TValues> }
  | { status: "conflict"; currentRecord: RecordSnapshot<TValues> };

export type ReconciliationDescriptor<TValues> = {
  id: string;
  label: string;
  equals: (left: TValues, right: TValues) => boolean;
  format: (values: TValues) => string;
  copy: (target: TValues, source: TValues) => TValues;
};

export type FieldConflict<TValues> = {
  descriptor: ReconciliationDescriptor<TValues>;
  serverValue: string;
  draftValue: string;
};

export type Reconciliation<TValues> = {
  mergedValues: TValues;
  conflicts: FieldConflict<TValues>[];
};

export const reconcileValues = <TValues>(
  baseValues: TValues,
  serverValues: TValues,
  draftValues: TValues,
  descriptors: ReconciliationDescriptor<TValues>[],
): Reconciliation<TValues> => {
  let mergedValues = serverValues;
  const conflicts: FieldConflict<TValues>[] = [];

  for (const descriptor of descriptors) {
    const serverChanged = !descriptor.equals(baseValues, serverValues);
    const draftChanged = !descriptor.equals(baseValues, draftValues);
    const converged = descriptor.equals(serverValues, draftValues);

    if (draftChanged && !serverChanged) {
      mergedValues = descriptor.copy(mergedValues, draftValues);
      continue;
    }
    if (draftChanged && serverChanged && !converged) {
      conflicts.push({
        descriptor,
        serverValue: descriptor.format(serverValues),
        draftValue: descriptor.format(draftValues),
      });
    }
  }

  return { mergedValues, conflicts };
};

export const applyConflictChoice = <TValues>(
  values: TValues,
  conflict: FieldConflict<TValues>,
  sourceValues: TValues,
) => conflict.descriptor.copy(values, sourceValues);
