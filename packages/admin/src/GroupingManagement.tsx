import {
  groupingMutationOptions,
  groupingQueryOptions,
  requestGroupingCachePurgeRetry,
  requestSetCategoryState,
  requestSetCollectionState,
  requestSetTagState,
  requestUpdateCategory,
  requestUpdateCollection,
  requestUpdateTag,
} from "@ecom/client";
import type { Category, Grouping, GroupingClientError, GroupingState } from "@ecom/contracts";
import { Button } from "@ecom/ui";
import { createForm } from "@tanstack/solid-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query";
import { For, Show, untrack } from "solid-js";
import { CreateCategoryForm, CreateCollectionForm, CreateTagForm } from "./GroupingCreateForms";
import { GroupingMembershipEditor, type GroupingCatalogItem } from "./GroupingMembershipEditor";

const inputClass =
  "min-h-11 rounded-lg border border-black/25 bg-(--paper) px-3 py-2 font-normal text-(--ink)";
const labelClass = "grid gap-1.5 text-xs font-bold text-(--muted)";
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
    form
      .querySelector<HTMLElement>(
        "input:not(:disabled), select:not(:disabled), button:not(:disabled)",
      )
      ?.focus();
  }
};

const nextState = (state: GroupingState) => (state === "active" ? "archived" : "active");
const lifecycleLabel = (state: GroupingState) => (state === "active" ? "Архивлах" : "Идэвхжүүлэх");

const GroupingEditor = (props: { grouping: Grouping; categories: readonly Category[] }) => {
  const queryClient = useQueryClient();
  const grouping = untrack(() => props.grouping);
  const updateMutation = useMutation(() =>
    groupingMutationOptions(
      queryClient,
      async (value: {
        name: string;
        slug: string;
        description: string;
        parentId: string;
        position: number;
      }) => {
        if (grouping.kind === "category") {
          return requestUpdateCategory(grouping.id, {
            name: value.name.trim(),
            slug: value.slug.trim(),
            parentId: value.parentId === "" ? null : value.parentId,
            position: value.position,
          });
        }
        if (grouping.kind === "collection") {
          return requestUpdateCollection(grouping.id, {
            name: value.name.trim(),
            slug: value.slug.trim(),
            description: value.description,
          });
        }
        return requestUpdateTag(grouping.id, { label: value.name.trim() });
      },
    ),
  );
  const lifecycleMutation = useMutation(() =>
    groupingMutationOptions(queryClient, (state: "active" | "archived") => {
      if (grouping.kind === "category") {
        return requestSetCategoryState(grouping.id, state);
      }
      if (grouping.kind === "collection") {
        return requestSetCollectionState(grouping.id, state);
      }
      return requestSetTagState(grouping.id, state);
    }),
  );
  const form = createForm(() => ({
    defaultValues: {
      name: props.grouping.kind === "tag" ? props.grouping.label : props.grouping.name,
      slug: props.grouping.kind === "tag" ? "" : props.grouping.slug,
      description: props.grouping.kind === "collection" ? props.grouping.description : "",
      parentId: props.grouping.kind === "category" ? (props.grouping.parentId ?? "") : "",
      position: props.grouping.kind === "category" ? props.grouping.position : 0,
    },
    onSubmit: async ({ value }) => updateMutation.mutateAsync(value),
  }));
  const changeState = () => lifecycleMutation.mutate(nextState(props.grouping.state));
  return (
    <form
      class="grid gap-3 md:grid-cols-[minmax(10rem,1fr)_minmax(10rem,1fr)_auto_auto]"
      onSubmit={async (event) => {
        event.preventDefault();
        await submitAndFocusExpectedError(
          event.currentTarget,
          () => form.handleSubmit(),
          () => updateMutation.error,
        );
      }}
    >
      <form.Field name="name">
        {(field) => (
          <label class={labelClass}>
            <span>{props.grouping.kind === "tag" ? "Шошго" : "Нэр"}</span>
            <input
              class={inputClass}
              required
              maxlength={props.grouping.kind === "tag" ? 80 : 120}
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.value)}
            />
          </label>
        )}
      </form.Field>
      <Show when={props.grouping.kind !== "tag"}>
        <form.Field name="slug">
          {(field) => (
            <label class={labelClass}>
              <span>URL slug</span>
              <input
                class={inputClass}
                required
                disabled={props.grouping.activatedAt !== null}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                value={field().state.value}
                onInput={(event) => field().handleChange(event.currentTarget.value)}
              />
            </label>
          )}
        </form.Field>
      </Show>
      <Show when={props.grouping.kind === "category"}>
        <form.Field name="parentId">
          {(field) => (
            <label class={labelClass}>
              <span>Дээд ангилал</span>
              <select
                class={inputClass}
                value={field().state.value}
                onChange={(event) => field().handleChange(event.currentTarget.value)}
              >
                <option value="">Дээд ангилалгүй</option>
                <For
                  each={props.categories.filter(
                    (category) =>
                      category.id !== props.grouping.id && category.state !== "archived",
                  )}
                >
                  {(category) => <option value={category.id}>{category.name}</option>}
                </For>
              </select>
            </label>
          )}
        </form.Field>
        <form.Field name="position">
          {(field) => (
            <label class={labelClass}>
              <span>Дараалал</span>
              <input
                class={inputClass}
                type="number"
                min="0"
                max="10000"
                value={field().state.value}
                onInput={(event) => field().handleChange(event.currentTarget.valueAsNumber)}
              />
            </label>
          )}
        </form.Field>
      </Show>
      <Show when={props.grouping.kind === "collection"}>
        <form.Field name="description">
          {(field) => (
            <label class={labelClass}>
              <span>Тайлбар</span>
              <input
                class={inputClass}
                maxlength={5000}
                value={field().state.value}
                onInput={(event) => field().handleChange(event.currentTarget.value)}
              />
            </label>
          )}
        </form.Field>
      </Show>
      <Button type="submit" variant="secondary" disabled={updateMutation.isPending}>
        Хадгалах
      </Button>
      <Button
        type="button"
        variant="secondary"
        disabled={lifecycleMutation.isPending}
        onClick={changeState}
      >
        {lifecycleLabel(props.grouping.state)}
      </Button>
      <Show when={updateMutation.error ?? lifecycleMutation.error} keyed>
        {(error) => (
          <p class="md:col-span-full" role="alert">
            {errorMessage(error)}
          </p>
        )}
      </Show>
    </form>
  );
};

const GroupingList = (props: {
  title: string;
  groups: readonly Grouping[];
  categories: readonly Category[];
  catalogItems: readonly GroupingCatalogItem[];
}) => (
  <section class="py-5" aria-label={props.title}>
    <h3 class="text-base">{props.title}</h3>
    <Show
      when={props.groups.length > 0}
      fallback={<p class="text-sm text-(--muted)">Одоогоор бүртгэл алга.</p>}
    >
      <ul class="m-0 list-none p-0">
        <For each={props.groups}>
          {(grouping) => (
            <li class="border-t border-black/10 py-5">
              <div class="mb-3 flex items-center justify-between gap-3">
                <strong>{grouping.kind === "tag" ? grouping.label : grouping.name}</strong>
                <span class="rounded-full bg-(--surface) px-2.5 py-1 text-xs font-bold">
                  {grouping.state}
                </span>
              </div>
              <GroupingEditor grouping={grouping} categories={props.categories} />
              <GroupingMembershipEditor grouping={grouping} catalogItems={props.catalogItems} />
            </li>
          )}
        </For>
      </ul>
    </Show>
  </section>
);

const CatalogCachePurgeWarning = (props: { attemptCount: number; requestId: string | null }) => {
  const queryClient = useQueryClient();
  const mutation = useMutation(() =>
    groupingMutationOptions(queryClient, (_input: undefined) => requestGroupingCachePurgeRetry()),
  );
  return (
    <div class="my-5 border border-amber-700 bg-amber-50 p-4 text-amber-950" role="alert">
      <p class="mt-0">
        Өөрчлөлт хадгалагдсан боловч public catalog cache шинэчлэгдээгүй. Оролдлого:{" "}
        {props.attemptCount}
      </p>
      <Show when={props.requestId} keyed>
        {(requestId) => <p>Cloudflare хүсэлтийн ID: {requestId}</p>}
      </Show>
      <Button
        type="button"
        variant="secondary"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate(undefined)}
      >
        Public cache шинэчлэлтийг дахин оролдох
      </Button>
    </div>
  );
};

export const GroupingManagement = () => {
  const query = useQuery(() => groupingQueryOptions());
  return (
    <section class="border-t border-black/15 py-8" aria-labelledby="grouping-title">
      <div class="flex flex-col items-start justify-between gap-3 md:flex-row">
        <div>
          <h2 id="grouping-title" class="m-0 text-xl font-bold tracking-tight">
            Ангилал ба цуглуулга
          </h2>
          <p class="mt-2 max-w-prose text-(--muted)">
            Ациклик ангилал, гараар эрэмбэлсэн Collection, хавтгай Tag-аар нийтлэгдсэн
            бүтээгдэхүүнийг бүлэглэнэ.
          </p>
        </div>
        <span class="rounded-full bg-(--surface) px-2.5 py-1.5 text-xs font-bold">
          Навигаци ба merchandising
        </span>
      </div>
      <Show
        when={!query.isError}
        fallback={
          <div role="alert">
            <p>Бүлгүүдийг ачаалж чадсангүй.</p>
            <Button type="button" variant="secondary" onClick={() => void query.refetch()}>
              Дахин ачаалах
            </Button>
          </div>
        }
      >
        <Show when={query.data} keyed fallback={<p role="status">Бүлгүүдийг ачаалж байна…</p>}>
          {(data) => (
            <>
              <Show when={data.data.cachePurgeDebt} keyed>
                {(debt) => (
                  <CatalogCachePurgeWarning
                    attemptCount={debt.attemptCount}
                    requestId={debt.requestId}
                  />
                )}
              </Show>
              <CreateCategoryForm categories={data.data.categories} />
              <CreateCollectionForm />
              <CreateTagForm />
              <GroupingList
                title="Ангилал"
                groups={data.data.categories}
                categories={data.data.categories}
                catalogItems={data.data.catalogItems}
              />
              <GroupingList
                title="Цуглуулга"
                groups={data.data.collections}
                categories={data.data.categories}
                catalogItems={data.data.catalogItems}
              />
              <GroupingList
                title="Tag"
                groups={data.data.tags}
                categories={data.data.categories}
                catalogItems={data.data.catalogItems}
              />
            </>
          )}
        </Show>
      </Show>
    </section>
  );
};
