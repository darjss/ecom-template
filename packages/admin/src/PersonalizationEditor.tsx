import { personalizationMutationOptions, personalizationQueryOptions } from "@ecom/client";
import {
  PersonalizationDefinitionDraftSchema,
  PersonalizationKeySchema,
  PersonalizationLabelSchema,
  type CatalogItemId,
  type PersonalizationDefinition,
  type SavePersonalizationsInput,
} from "@ecom/contracts";
import { Button } from "@ecom/ui";
import { createForm } from "@tanstack/solid-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query";
import { createSignal, For, Match, Show, Switch } from "solid-js";
import * as v from "valibot";
import { submitBundleForm } from "./bundle-form";
import { PersonalizationDefinitionEditor } from "./PersonalizationDefinitionEditor";

const PersonalizationKindSchema = v.picklist(["text", "single_select", "checkbox"]);
const toDraft = (definition: PersonalizationDefinition) => ({ ...definition });

const selectValues = (input: string) => {
  const lines = input.split("\n").filter((line) => line.trim().length > 0);
  if (lines.length === 0 || lines.length > 12) {
    return null;
  }
  const values = lines.map((line, position) => {
    const parts = line.split("|");
    const key = v.safeParse(PersonalizationKeySchema, (parts.at(0) ?? "").trim());
    const label = v.safeParse(PersonalizationLabelSchema, (parts.at(1) ?? "").trim());
    return parts.length === 2 && key.success && label.success
      ? {
          key: key.output,
          label: label.output,
          position,
          state: "active" as const,
        }
      : null;
  });
  return values.some((value) => value === null) ? null : values;
};

export const PersonalizationEditor = (props: { catalogItemId: CatalogItemId }) => {
  const [open, setOpen] = createSignal(false);
  const [inputError, setInputError] = createSignal(false);
  const queryClient = useQueryClient();
  const query = useQuery(() => personalizationQueryOptions(props.catalogItemId, open()));
  const mutation = useMutation(() =>
    personalizationMutationOptions(queryClient, props.catalogItemId),
  );
  const saveDefinitions = async (definitions: SavePersonalizationsInput["definitions"]) =>
    mutation.mutateAsync({ definitions });
  const saveDefinition = async (
    id: PersonalizationDefinition["id"],
    definition: SavePersonalizationsInput["definitions"][number],
  ) => {
    const current = query.data?.data;
    if (!current) {
      return;
    }
    await saveDefinitions(
      current.map((candidate) => (candidate.id === id ? definition : toDraft(candidate))),
    );
  };
  const moveDefinition = (
    id: PersonalizationDefinition["id"],
    direction: -1 | 1,
    root: HTMLElement,
  ) => {
    const current = query.data?.data;
    if (!current) {
      return;
    }
    const index = current.findIndex((definition) => definition.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= current.length) {
      return;
    }
    const reordered = current.map(toDraft);
    const selected = reordered.at(index);
    const adjacent = reordered.at(target);
    if (!selected || !adjacent) {
      return;
    }
    reordered[index] = adjacent;
    reordered[target] = selected;
    void submitBundleForm(root, () =>
      saveDefinitions(reordered.map((definition, position) => ({ ...definition, position }))),
    );
  };
  const toggleState = (definition: PersonalizationDefinition, root: HTMLElement) => {
    const current = query.data?.data;
    if (!current) {
      return;
    }
    void submitBundleForm(root, () =>
      saveDefinitions(
        current.map((candidate) =>
          candidate.id === definition.id
            ? {
                ...toDraft(candidate),
                state: candidate.state === "active" ? "archived" : "active",
              }
            : toDraft(candidate),
        ),
      ),
    );
  };
  const form = createForm(() => ({
    defaultValues: {
      kind: v.parse(PersonalizationKindSchema, "text"),
      key: "",
      label: "",
      required: false,
      maxLength: 80,
      selectValues: "",
    },
    onSubmit: async ({ value }) => {
      const current = query.data?.data;
      if (!current) {
        return;
      }
      const values = value.kind === "single_select" ? selectValues(value.selectValues) : [];
      const candidate =
        value.kind === "text"
          ? {
              kind: "text" as const,
              key: value.key.trim(),
              label: value.label.trim(),
              position: current.length,
              required: value.required,
              state: "active" as const,
              maxLength: value.maxLength,
              values: [] as const,
            }
          : value.kind === "single_select"
            ? {
                kind: "single_select" as const,
                key: value.key.trim(),
                label: value.label.trim(),
                position: current.length,
                required: value.required,
                state: "active" as const,
                maxLength: null,
                values: values ?? [],
              }
            : {
                kind: "checkbox" as const,
                key: value.key.trim(),
                label: value.label.trim(),
                position: current.length,
                required: value.required,
                state: "active" as const,
                maxLength: null,
                values: [] as const,
              };
      const definition = v.safeParse(PersonalizationDefinitionDraftSchema, candidate);
      if (!definition.success || values === null) {
        setInputError(true);
        return;
      }
      setInputError(false);
      await saveDefinitions([...current.map(toDraft), definition.output]);
      form.reset();
    },
  }));

  return (
    <section class="col-span-full border-t border-black/10 pt-4">
      <Button type="button" variant="secondary" onClick={() => setOpen((value) => !value)}>
        Personalization {open() ? "хаах" : "тохируулах"}
      </Button>
      <Show when={open()}>
        <div class="mt-4 grid gap-4">
          <Switch>
            <Match when={query.isError}>
              <div role="alert" class="grid justify-items-start gap-2">
                <p>Personalization тохиргоог ачаалж чадсангүй.</p>
                <Button type="button" variant="secondary" onClick={() => void query.refetch()}>
                  Дахин оролдох
                </Button>
              </div>
            </Match>
            <Match when={query.data?.data}>
              {(definitions) => (
                <>
                  <ul class="m-0 grid list-none gap-2 p-0">
                    <For each={definitions()}>
                      {(definition, index) => (
                        <PersonalizationDefinitionEditor
                          definition={definition}
                          index={index()}
                          count={definitions().length}
                          pending={mutation.isPending}
                          onSave={(draft) => saveDefinition(definition.id, draft)}
                          onMove={(direction, root) =>
                            moveDefinition(definition.id, direction, root)
                          }
                          onToggle={(root) => toggleState(definition, root)}
                        />
                      )}
                    </For>
                  </ul>
                  <form
                    class="grid grid-cols-1 gap-3 md:grid-cols-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void submitBundleForm(event.currentTarget, form.handleSubmit);
                    }}
                  >
                    <form.Field name="kind">
                      {(field) => (
                        <label class="grid gap-1.5 text-xs font-bold text-(--muted)">
                          <span>Төрөл</span>
                          <select
                            class="min-h-11 rounded-lg border border-black/25 bg-(--paper) px-3 text-(--ink)"
                            value={field().state.value}
                            onChange={(event) => {
                              const kind = v.safeParse(
                                PersonalizationKindSchema,
                                event.currentTarget.value,
                              );
                              if (kind.success) {
                                field().handleChange(kind.output);
                              }
                            }}
                          >
                            <option value="text">Бичвэр</option>
                            <option value="single_select">Нэг сонголт</option>
                            <option value="checkbox">Checkbox</option>
                          </select>
                        </label>
                      )}
                    </form.Field>
                    <form.Field name="key">
                      {(field) => (
                        <label class="grid gap-1.5 text-xs font-bold text-(--muted)">
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
                        <label class="grid gap-1.5 text-xs font-bold text-(--muted)">
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
                    <form.Field name="maxLength">
                      {(field) => (
                        <label class="grid gap-1.5 text-xs font-bold text-(--muted)">
                          <span>Бичвэрийн дээд урт</span>
                          <input
                            class="min-h-11 rounded-lg border border-black/25 bg-(--paper) px-3 text-(--ink)"
                            type="number"
                            min="1"
                            max="240"
                            value={field().state.value}
                            onInput={(event) =>
                              field().handleChange(event.currentTarget.valueAsNumber)
                            }
                          />
                        </label>
                      )}
                    </form.Field>
                    <form.Field name="selectValues">
                      {(field) => (
                        <label class="grid gap-1.5 text-xs font-bold text-(--muted) md:col-span-2">
                          <span>Сонголтууд (key|Нэр, мөр тус бүр)</span>
                          <textarea
                            class="min-h-20 rounded-lg border border-black/25 bg-(--paper) px-3 py-2 text-(--ink)"
                            placeholder={"red|Улаан\nblue|Цэнхэр"}
                            value={field().state.value}
                            onInput={(event) => field().handleChange(event.currentTarget.value)}
                          />
                        </label>
                      )}
                    </form.Field>
                    <form.Field name="required">
                      {(field) => (
                        <label class="flex min-h-11 items-center gap-2 text-sm font-bold">
                          <input
                            type="checkbox"
                            checked={field().state.value}
                            onChange={(event) => field().handleChange(event.currentTarget.checked)}
                          />
                          Заавал бөглөх
                        </label>
                      )}
                    </form.Field>
                    <Button
                      type="submit"
                      disabled={mutation.isPending || definitions().length >= 12}
                    >
                      Талбар нэмэх
                    </Button>
                    <Show when={inputError()}>
                      <p role="alert" tabindex="-1">
                        Хоосон бус сонголтын мөр бүр хүчинтэй key|Нэр байх ёстой.
                      </p>
                    </Show>
                    <Show when={mutation.error}>
                      <p role="alert" tabindex="-1">
                        Тохиргоог хадгалж чадсангүй. Оруулсан утгуудаа шалгана уу.
                      </p>
                    </Show>
                  </form>
                </>
              )}
            </Match>
            <Match when={true}>
              <p role="status">Тохиргоо ачаалж байна…</p>
            </Match>
          </Switch>
        </div>
      </Show>
    </section>
  );
};
