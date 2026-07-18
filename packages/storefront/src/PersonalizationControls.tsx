import type { PersonalizationDefinition } from "@ecom/contracts";
import { For, Match, Show, Switch } from "solid-js";

export const PersonalizationControls = (props: {
  definitions: readonly PersonalizationDefinition[];
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
                  <span>
                    {text().label}
                    <Show when={!text().required}>
                      <small class="ml-1 font-normal">(заавал биш)</small>
                    </Show>
                  </span>
                  <input
                    class="min-h-12 rounded-lg border border-black/30 bg-(--paper) px-3 text-(--ink) focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-(--focus)"
                    name={`personalization-${text().key}`}
                    maxlength={text().maxLength}
                    required={text().required}
                  />
                  <small class="font-normal text-(--muted)">
                    {text().maxLength} тэмдэгт хүртэл
                  </small>
                </label>
              )}
            </Match>
            <Match when={definition.kind === "single_select" && definition}>
              {(select) => (
                <label class="grid gap-1.5 font-bold">
                  <span>
                    {select().label}
                    <Show when={!select().required}>
                      <small class="ml-1 font-normal">(заавал биш)</small>
                    </Show>
                  </span>
                  <select
                    class="min-h-12 rounded-lg border border-black/30 bg-(--paper) px-3 text-(--ink) focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-(--focus)"
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
                  <span>
                    {checkbox().label}
                    <Show when={!checkbox().required}>
                      <small class="ml-1 font-normal">(заавал биш)</small>
                    </Show>
                  </span>
                </label>
              )}
            </Match>
          </Switch>
        )}
      </For>
    </fieldset>
  </Show>
);
