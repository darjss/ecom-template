import type { PersonalizationDefinition } from "@ecom/contracts";
import { For, Match, Show, Switch } from "solid-js";

export const PersonalizationControls = (props: {
  readonly definitions: readonly PersonalizationDefinition[];
}) => (
  <Show when={props.definitions.some(({ state }) => state === "active")}>
    <fieldset class="m-0 grid gap-4 border-0 p-0">
      <legend class="mb-3 text-lg font-bold">Таны сонголт</legend>
      <For each={props.definitions.filter(({ state }) => state === "active")}>
        {(definition) => (
          <Switch>
            <Match when={definition.kind === "text" && definition}>
              {(text) => (
                <label class="grid gap-1.5 font-bold">
                  <span>{text().label}</span>
                  <input
                    class="min-h-12 rounded-lg border border-black/30 bg-white px-3 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-(--focus)"
                    name={`personalization-${text().key}`}
                    maxlength={text().maxLength}
                    required={text().required}
                  />
                </label>
              )}
            </Match>
            <Match when={definition.kind === "single_select" && definition}>
              {(select) => (
                <label class="grid gap-1.5 font-bold">
                  <span>{select().label}</span>
                  <select
                    class="min-h-12 rounded-lg border border-black/30 bg-white px-3 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-(--focus)"
                    name={`personalization-${select().key}`}
                    required={select().required}
                  >
                    <option value="">Сонгоно уу</option>
                    <For each={select().values.filter(({ state }) => state === "active")}>
                      {(value) => <option value={value.id}>{value.label}</option>}
                    </For>
                  </select>
                </label>
              )}
            </Match>
            <Match when={definition.kind === "checkbox" && definition}>
              {(checkbox) => (
                <label class="flex min-h-12 items-center gap-3 rounded-lg border border-black/20 px-3 font-bold">
                  <input
                    class="size-5 accent-(--tomato)"
                    type="checkbox"
                    name={`personalization-${checkbox().key}`}
                    required={checkbox().required}
                  />
                  {checkbox().label}
                </label>
              )}
            </Match>
          </Switch>
        )}
      </For>
    </fieldset>
  </Show>
);
