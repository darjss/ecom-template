import {
  groupingMutationOptions,
  requestReplaceCategoryMembership,
  requestReplaceCollectionMembership,
  requestReplaceTagMembership,
} from "@ecom/client";
import type { CatalogItemId, Grouping, GroupingClientError } from "@ecom/contracts";
import { AltArrowDown, AltArrowUp, Button } from "@ecom/ui";
import { createForm } from "@tanstack/solid-form";
import { useMutation, useQueryClient } from "@tanstack/solid-query";
import { createSignal, For, Show, untrack } from "solid-js";

const errorMessage = (error: GroupingClientError) =>
  error.kind === "api" ? error.error.message : "Өөрчлөлтийг хадгалж чадсангүй.";
const submitAndFocusExpectedError = async (
  form: HTMLFormElement,
  submit: () => Promise<void>,
  representedError: () => GroupingClientError | null,
) => {
  try {
    await submit();
  } catch (error) {
    if (error !== representedError()) {
      throw error;
    }
    form.querySelector<HTMLElement>("input:not(:disabled), button:not(:disabled)")?.focus();
  }
};

export type GroupingCatalogItem = {
  readonly id: CatalogItemId;
  readonly kind: "product" | "bundle";
  readonly name: string;
  readonly state: "draft" | "published" | "archived";
};

export const GroupingMembershipEditor = (props: {
  grouping: Grouping;
  catalogItems: readonly GroupingCatalogItem[];
}) => {
  const queryClient = useQueryClient();
  const grouping = untrack(() => props.grouping);
  const mutation = useMutation(() =>
    groupingMutationOptions(queryClient, (input: { catalogItemIds: CatalogItemId[] }) => {
      if (grouping.kind === "category") {
        return requestReplaceCategoryMembership(grouping.id, input);
      }
      if (grouping.kind === "collection") {
        return requestReplaceCollectionMembership(grouping.id, input);
      }
      return requestReplaceTagMembership(grouping.id, input);
    }),
  );
  const [open, setOpen] = createSignal(false);
  const form = createForm(() => ({
    defaultValues: { catalogItemIds: [...props.grouping.catalogItemIds] },
    onSubmit: async ({ value }) => mutation.mutateAsync({ catalogItemIds: value.catalogItemIds }),
  }));
  return (
    <div class="mt-4 border-t border-black/10 pt-4">
      <Button
        type="button"
        variant="secondary"
        aria-expanded={open()}
        onClick={() => setOpen((value) => !value)}
      >
        Каталогийн гишүүнчлэл {open() ? "хаах" : "удирдах"}
      </Button>
      <Show when={open()}>
        <form
          class="mt-4"
          onSubmit={async (event) => {
            event.preventDefault();
            await submitAndFocusExpectedError(
              event.currentTarget,
              () => form.handleSubmit(),
              () => mutation.error,
            );
          }}
        >
          <form.Field name="catalogItemIds">
            {(field) => {
              const toggle = (id: CatalogItemId, selected: boolean) =>
                field().handleChange(
                  selected
                    ? [...field().state.value, id]
                    : field().state.value.filter((catalogItemId) => catalogItemId !== id),
                );
              const move = (index: number, offset: -1 | 1) => {
                const target = index + offset;
                const current = field().state.value;
                if (target < 0 || target >= current.length) {
                  return;
                }
                const next = [...current];
                const first = next[index];
                const second = next[target];
                if (!first || !second) {
                  return;
                }
                next[index] = second;
                next[target] = first;
                field().handleChange(next);
              };
              return (
                <>
                  <div class="flex flex-wrap gap-x-5 gap-y-3">
                    <For each={props.catalogItems}>
                      {(catalogItem) => (
                        <label class="flex min-h-11 items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={field().state.value.includes(catalogItem.id)}
                            onChange={(event) =>
                              toggle(catalogItem.id, event.currentTarget.checked)
                            }
                          />
                          <span>
                            {catalogItem.name}{" "}
                            <small class="text-(--muted)">
                              ({catalogItem.kind} · {catalogItem.state})
                            </small>
                          </span>
                        </label>
                      )}
                    </For>
                  </div>
                  <Show
                    when={props.grouping.kind === "collection" && field().state.value.length > 0}
                  >
                    <ol class="my-3 grid gap-2 pl-6">
                      <For each={field().state.value}>
                        {(id, index) => {
                          const catalogItem = () =>
                            props.catalogItems.find((candidate) => candidate.id === id);
                          return (
                            <li>
                              <span>{catalogItem()?.name ?? id}</span>{" "}
                              <button
                                class="min-h-11 px-2"
                                type="button"
                                disabled={index() === 0}
                                onClick={() => move(index(), -1)}
                                aria-label={`${catalogItem()?.name ?? "Каталогийн зүйл"} дээш`}
                              >
                                <AltArrowUp aria-hidden="true" size={20} />
                              </button>
                              <button
                                class="min-h-11 px-2"
                                type="button"
                                disabled={index() === field().state.value.length - 1}
                                onClick={() => move(index(), 1)}
                                aria-label={`${catalogItem()?.name ?? "Каталогийн зүйл"} доош`}
                              >
                                <AltArrowDown aria-hidden="true" size={20} />
                              </button>
                            </li>
                          );
                        }}
                      </For>
                    </ol>
                  </Show>
                </>
              );
            }}
          </form.Field>
          <Button type="submit" variant="secondary" disabled={mutation.isPending}>
            Гишүүнчлэл хадгалах
          </Button>
          <Show when={mutation.error} keyed>
            {(error) => <p role="alert">{errorMessage(error)}</p>}
          </Show>
        </form>
      </Show>
    </div>
  );
};
