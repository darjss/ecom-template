import {
  PersonalizationDefinitionDraftSchema,
  PersonalizationKeySchema,
  PersonalizationLabelSchema,
  type PersonalizationDefinition,
  type SavePersonalizationsInput,
} from "@ecom/contracts";
import { Button } from "@ecom/ui";
import { createForm } from "@tanstack/solid-form";
import { createSignal, Show } from "solid-js";
import * as v from "valibot";
import { submitBundleForm } from "./bundle-form";

type DefinitionDraft = SavePersonalizationsInput["definitions"][number];

const selectValues = (input: string, definition: PersonalizationDefinition) => {
  const lines = input.split("\n").filter((line) => line.trim().length > 0);
  if (lines.length === 0 || lines.length > 12) {
    return null;
  }
  const values = lines.map((line, position) => {
    const parts = line.split("|");
    const key = v.safeParse(PersonalizationKeySchema, (parts.at(0) ?? "").trim());
    const label = v.safeParse(PersonalizationLabelSchema, (parts.at(1) ?? "").trim());
    if (parts.length !== 2 || !key.success || !label.success) {
      return null;
    }
    const existing =
      definition.kind === "single_select"
        ? definition.values.find((value) => value.key === key.output)
        : undefined;
    return {
      id: existing?.id,
      key: key.output,
      label: label.output,
      position,
      state: existing?.state ?? ("active" as const),
    };
  });
  return values.some((value) => value === null) ? null : values;
};

export const PersonalizationDefinitionEditor = (props: {
  definition: PersonalizationDefinition;
  index: number;
  count: number;
  pending: boolean;
  onSave: (definition: DefinitionDraft) => Promise<unknown>;
  onMove: (direction: -1 | 1, root: HTMLElement) => void;
  onToggle: (root: HTMLElement) => void;
}) => {
  const [inputError, setInputError] = createSignal(false);
  const form = createForm(() => ({
    defaultValues: {
      key: props.definition.key,
      label: props.definition.label,
      required: props.definition.required,
      maxLength: props.definition.kind === "text" ? props.definition.maxLength : 80,
      selectValues:
        props.definition.kind === "single_select"
          ? props.definition.values.map((value) => `${value.key}|${value.label}`).join("\n")
          : "",
    },
    onSubmit: async ({ value }) => {
      const values =
        props.definition.kind === "single_select"
          ? selectValues(value.selectValues, props.definition)
          : [];
      const candidate =
        props.definition.kind === "text"
          ? {
              ...props.definition,
              key: value.key.trim(),
              label: value.label.trim(),
              required: value.required,
              maxLength: value.maxLength,
            }
          : props.definition.kind === "single_select"
            ? {
                ...props.definition,
                key: value.key.trim(),
                label: value.label.trim(),
                required: value.required,
                values: values ?? [],
              }
            : {
                ...props.definition,
                key: value.key.trim(),
                label: value.label.trim(),
                required: value.required,
              };
      const parsed = v.safeParse(PersonalizationDefinitionDraftSchema, candidate);
      if (!parsed.success || values === null) {
        setInputError(true);
        return;
      }
      setInputError(false);
      await props.onSave(parsed.output);
    },
  }));

  return (
    <li class="grid gap-3 border-b border-black/10 py-3 text-sm">
      <form
        class="grid grid-cols-1 gap-3 md:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submitBundleForm(event.currentTarget, form.handleSubmit);
        }}
      >
        <p class="m-0 font-bold md:col-span-4">
          {props.definition.kind} · {props.definition.state}
        </p>
        <form.Field name="key">
          {(field) => (
            <label class="grid gap-1 text-xs font-bold text-(--muted)">
              <span>Key</span>
              <input
                class="min-h-11 rounded-lg border border-black/25 bg-(--paper) px-3 text-(--ink)"
                required
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                maxlength={48}
                value={field().state.value}
                onInput={(event) => field().handleChange(event.currentTarget.value)}
              />
            </label>
          )}
        </form.Field>
        <form.Field name="label">
          {(field) => (
            <label class="grid gap-1 text-xs font-bold text-(--muted)">
              <span>Харагдах нэр</span>
              <input
                class="min-h-11 rounded-lg border border-black/25 bg-(--paper) px-3 text-(--ink)"
                required
                maxlength={80}
                value={field().state.value}
                onInput={(event) => field().handleChange(event.currentTarget.value)}
              />
            </label>
          )}
        </form.Field>
        <Show when={props.definition.kind === "text"}>
          <form.Field name="maxLength">
            {(field) => (
              <label class="grid gap-1 text-xs font-bold text-(--muted)">
                <span>Бичвэрийн дээд урт</span>
                <input
                  class="min-h-11 rounded-lg border border-black/25 bg-(--paper) px-3 text-(--ink)"
                  type="number"
                  min="1"
                  max="240"
                  value={field().state.value}
                  onInput={(event) => field().handleChange(event.currentTarget.valueAsNumber)}
                />
              </label>
            )}
          </form.Field>
        </Show>
        <form.Field name="required">
          {(field) => (
            <label class="flex min-h-11 items-center gap-2 font-bold">
              <input
                type="checkbox"
                checked={field().state.value}
                onChange={(event) => field().handleChange(event.currentTarget.checked)}
              />
              Заавал бөглөх
            </label>
          )}
        </form.Field>
        <Show when={props.definition.kind === "single_select"}>
          <form.Field name="selectValues">
            {(field) => (
              <label class="grid gap-1 text-xs font-bold text-(--muted) md:col-span-4">
                <span>Сонголтууд ба дараалал (key|Нэр, мөр тус бүр)</span>
                <textarea
                  class="min-h-24 rounded-lg border border-black/25 bg-(--paper) px-3 py-2 text-(--ink)"
                  required
                  value={field().state.value}
                  onInput={(event) => field().handleChange(event.currentTarget.value)}
                />
              </label>
            )}
          </form.Field>
        </Show>
        <div class="flex flex-wrap gap-2 md:col-span-4">
          <Button type="submit" variant="secondary" disabled={props.pending}>
            Өөрчлөлт хадгалах
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={props.pending || props.index === 0}
            onClick={(event) =>
              props.onMove(-1, event.currentTarget.closest("li") ?? event.currentTarget)
            }
          >
            Дээш
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={props.pending || props.index === props.count - 1}
            onClick={(event) =>
              props.onMove(1, event.currentTarget.closest("li") ?? event.currentTarget)
            }
          >
            Доош
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={props.pending}
            onClick={(event) =>
              props.onToggle(event.currentTarget.closest("li") ?? event.currentTarget)
            }
          >
            {props.definition.state === "active" ? "Архивлах" : "Идэвхжүүлэх"}
          </Button>
        </div>
        <Show when={inputError()}>
          <p role="alert" tabindex="-1" class="md:col-span-4">
            Key, харагдах нэр, бичвэрийн урт болон сонголтын мөрүүдийг шалгана уу.
          </p>
        </Show>
      </form>
    </li>
  );
};
