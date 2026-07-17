import { personalizationMutationOptions, personalizationQueryOptions } from "@ecom/client";
import type {
  CatalogItemId,
  PersonalizationDefinition,
  SavePersonalizationsInput,
} from "@ecom/contracts";
import { Button } from "@ecom/ui";
import { createForm } from "@tanstack/solid-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query";
import { createSignal, For, Show } from "solid-js";
import * as v from "valibot";
import { submitBundleForm } from "./bundle-form";

const PersonalizationKindSchema = v.picklist(["text", "single_select", "checkbox"]);
const ActiveStateSchema = v.literal("active");
const toDraft = (definition: PersonalizationDefinition) => ({ ...definition });

export const PersonalizationEditor = (props: { catalogItemId: CatalogItemId }) => {
  const [open, setOpen] = createSignal(false);
  const queryClient = useQueryClient();
  const query = useQuery(() => personalizationQueryOptions(props.catalogItemId));
  const mutation = useMutation(() =>
    personalizationMutationOptions(queryClient, props.catalogItemId),
  );
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
      const current = query.data?.data ?? [];
      const position = current.length;
      const definition: SavePersonalizationsInput["definitions"][number] =
        value.kind === "text"
          ? {
              kind: "text",
              key: value.key.trim(),
              label: value.label.trim(),
              position,
              required: value.required,
              state: "active",
              maxLength: value.maxLength,
              values: [],
            }
          : value.kind === "single_select"
            ? {
                kind: "single_select",
                key: value.key.trim(),
                label: value.label.trim(),
                position,
                required: value.required,
                state: "active",
                maxLength: null,
                values: value.selectValues
                  .split("\n")
                  .map((line, valuePosition) => {
                    const [key = "", label = ""] = line.split("|");
                    return {
                      key: key.trim(),
                      label: label.trim(),
                      position: valuePosition,
                      state: v.parse(ActiveStateSchema, "active"),
                    };
                  })
                  .filter(({ key, label }) => key.length > 0 && label.length > 0),
              }
            : {
                kind: "checkbox",
                key: value.key.trim(),
                label: value.label.trim(),
                position,
                required: value.required,
                state: "active",
                maxLength: null,
                values: [],
              };
      await mutation.mutateAsync({ definitions: [...current.map(toDraft), definition] });
      form.reset();
    },
  }));

  const toggleState = (definition: PersonalizationDefinition, root: HTMLElement) => {
    const current = query.data?.data ?? [];
    void submitBundleForm(root, () =>
      mutation.mutateAsync({
        definitions: current.map((candidate) =>
          candidate.id === definition.id
            ? {
                ...toDraft(candidate),
                state: candidate.state === "active" ? "archived" : "active",
              }
            : toDraft(candidate),
        ),
      }),
    );
  };

  return (
    <section class="col-span-full border-t border-black/10 pt-4">
      <Button type="button" variant="secondary" onClick={() => setOpen((value) => !value)}>
        Personalization {open() ? "хаах" : "тохируулах"}
      </Button>
      <Show when={open()}>
        <div class="mt-4 grid gap-4">
          <Show when={query.data?.data} fallback={<p role="status">Тохиргоо ачаалж байна…</p>}>
            {(definitions) => (
              <ul class="m-0 grid list-none gap-2 p-0">
                <For each={definitions()}>
                  {(definition) => (
                    <li class="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 py-2 text-sm">
                      <span>
                        <strong>{definition.label}</strong> · {definition.kind} · {definition.key} ·{" "}
                        {definition.state}
                      </span>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={mutation.isPending}
                        onClick={(event) =>
                          toggleState(
                            definition,
                            event.currentTarget.closest("li") ?? event.currentTarget,
                          )
                        }
                      >
                        {definition.state === "active" ? "Архивлах" : "Идэвхжүүлэх"}
                      </Button>
                    </li>
                  )}
                </For>
              </ul>
            )}
          </Show>
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
                    onInput={(event) => field().handleChange(event.currentTarget.valueAsNumber)}
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
              disabled={mutation.isPending || (query.data?.data.length ?? 0) >= 12}
            >
              Талбар нэмэх
            </Button>
            <Show when={mutation.error}>
              <p role="alert">Тохиргоог хадгалж чадсангүй. Оруулсан утгуудаа шалгана уу.</p>
            </Show>
          </form>
        </div>
      </Show>
    </section>
  );
};
