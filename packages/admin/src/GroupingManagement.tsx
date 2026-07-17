import { groupingMutationOptions, groupingQueryOptions } from "@ecom/client";
import type {
  Category,
  Grouping,
  GroupingClientError,
  GroupingState,
  ProductId,
} from "@ecom/contracts";
import { Button } from "@ecom/ui";
import { createForm } from "@tanstack/solid-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query";
import { For, Show } from "solid-js";

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

const CreateCategoryForm = (props: { categories: readonly Category[] }) => {
  const queryClient = useQueryClient();
  const mutation = useMutation(() => groupingMutationOptions(queryClient));
  const form = createForm(() => ({
    defaultValues: { name: "", slug: "", parentId: "", position: 0 },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync({
        kind: "create-category",
        input: {
          name: value.name.trim(),
          slug: value.slug.trim(),
          parentId: value.parentId === "" ? null : value.parentId,
          position: value.position,
        },
      });
      form.reset();
    },
  }));
  return (
    <form
      class="grid gap-3 border-t border-black/10 py-5 md:grid-cols-4"
      onSubmit={async (event) => {
        event.preventDefault();
        await submitAndFocusExpectedError(
          event.currentTarget,
          () => form.handleSubmit(),
          () => mutation.error,
        );
      }}
    >
      <form.Field name="name">
        {(field) => (
          <label class={labelClass}>
            <span>Ангиллын нэр</span>
            <input
              class={inputClass}
              required
              maxlength={120}
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.value)}
            />
          </label>
        )}
      </form.Field>
      <form.Field name="slug">
        {(field) => (
          <label class={labelClass}>
            <span>URL slug</span>
            <input
              class={inputClass}
              required
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.value)}
            />
          </label>
        )}
      </form.Field>
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
              <For each={props.categories}>
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
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Үүсгэж байна…" : "Ангилал үүсгэх"}
      </Button>
      <Show when={mutation.error} keyed>
        {(error) => <p role="alert">{errorMessage(error)}</p>}
      </Show>
    </form>
  );
};

const CreateCollectionForm = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation(() => groupingMutationOptions(queryClient));
  const form = createForm(() => ({
    defaultValues: { name: "", slug: "", description: "" },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync({
        kind: "create-collection",
        input: { name: value.name.trim(), slug: value.slug.trim(), description: value.description },
      });
      form.reset();
    },
  }));
  return (
    <form
      class="grid gap-3 border-t border-black/10 py-5 md:grid-cols-3"
      onSubmit={async (event) => {
        event.preventDefault();
        await submitAndFocusExpectedError(
          event.currentTarget,
          () => form.handleSubmit(),
          () => mutation.error,
        );
      }}
    >
      <form.Field name="name">
        {(field) => (
          <label class={labelClass}>
            <span>Collection нэр</span>
            <input
              class={inputClass}
              required
              maxlength={120}
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.value)}
            />
          </label>
        )}
      </form.Field>
      <form.Field name="slug">
        {(field) => (
          <label class={labelClass}>
            <span>URL slug</span>
            <input
              class={inputClass}
              required
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.value)}
            />
          </label>
        )}
      </form.Field>
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
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Үүсгэж байна…" : "Collection үүсгэх"}
      </Button>
      <Show when={mutation.error} keyed>
        {(error) => <p role="alert">{errorMessage(error)}</p>}
      </Show>
    </form>
  );
};

const CreateTagForm = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation(() => groupingMutationOptions(queryClient));
  const form = createForm(() => ({
    defaultValues: { label: "" },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync({ kind: "create-tag", input: { label: value.label.trim() } });
      form.reset();
    },
  }));
  return (
    <form
      class="flex flex-wrap items-end gap-3 border-t border-black/10 py-5"
      onSubmit={async (event) => {
        event.preventDefault();
        await submitAndFocusExpectedError(
          event.currentTarget,
          () => form.handleSubmit(),
          () => mutation.error,
        );
      }}
    >
      <form.Field name="label">
        {(field) => (
          <label class={labelClass}>
            <span>Tag шошго</span>
            <input
              class={inputClass}
              required
              maxlength={80}
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.value)}
            />
          </label>
        )}
      </form.Field>
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Үүсгэж байна…" : "Tag үүсгэх"}
      </Button>
      <Show when={mutation.error} keyed>
        {(error) => <p role="alert">{errorMessage(error)}</p>}
      </Show>
    </form>
  );
};

const nextState = (state: GroupingState) => (state === "active" ? "archived" : "active");
const lifecycleLabel = (state: GroupingState) => (state === "active" ? "Архивлах" : "Идэвхжүүлэх");

const GroupingEditor = (props: { grouping: Grouping; categories: readonly Category[] }) => {
  const queryClient = useQueryClient();
  const mutation = useMutation(() => groupingMutationOptions(queryClient));
  const form = createForm(() => ({
    defaultValues: {
      name: props.grouping.kind === "tag" ? props.grouping.label : props.grouping.name,
      slug: props.grouping.kind === "tag" ? "" : props.grouping.slug,
      description: props.grouping.kind === "collection" ? props.grouping.description : "",
      parentId: props.grouping.kind === "category" ? (props.grouping.parentId ?? "") : "",
      position: props.grouping.kind === "category" ? props.grouping.position : 0,
    },
    onSubmit: async ({ value }) => {
      if (props.grouping.kind === "category") {
        await mutation.mutateAsync({
          kind: "update-category",
          id: props.grouping.id,
          input: {
            name: value.name.trim(),
            slug: value.slug.trim(),
            parentId: value.parentId === "" ? null : value.parentId,
            position: value.position,
          },
        });
      } else if (props.grouping.kind === "collection") {
        await mutation.mutateAsync({
          kind: "update-collection",
          id: props.grouping.id,
          input: {
            name: value.name.trim(),
            slug: value.slug.trim(),
            description: value.description,
          },
        });
      } else {
        await mutation.mutateAsync({
          kind: "update-tag",
          id: props.grouping.id,
          input: { label: value.name.trim() },
        });
      }
    },
  }));
  const changeState = () => {
    const state = nextState(props.grouping.state);
    if (props.grouping.kind === "category") {
      mutation.mutate({ kind: "state-category", id: props.grouping.id, state });
    } else if (props.grouping.kind === "collection") {
      mutation.mutate({ kind: "state-collection", id: props.grouping.id, state });
    } else {
      mutation.mutate({ kind: "state-tag", id: props.grouping.id, state });
    }
  };
  return (
    <form
      class="grid gap-3 md:grid-cols-[minmax(10rem,1fr)_minmax(10rem,1fr)_auto_auto]"
      onSubmit={async (event) => {
        event.preventDefault();
        await submitAndFocusExpectedError(
          event.currentTarget,
          () => form.handleSubmit(),
          () => mutation.error,
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
                  each={props.categories.filter((category) => category.id !== props.grouping.id)}
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
      <Button type="submit" variant="secondary" disabled={mutation.isPending}>
        Хадгалах
      </Button>
      <Button type="button" variant="secondary" disabled={mutation.isPending} onClick={changeState}>
        {lifecycleLabel(props.grouping.state)}
      </Button>
      <Show when={mutation.error} keyed>
        {(error) => (
          <p class="md:col-span-full" role="alert">
            {errorMessage(error)}
          </p>
        )}
      </Show>
    </form>
  );
};

const MembershipEditor = (props: {
  grouping: Grouping;
  products: readonly { id: ProductId; name: string; state: "draft" | "published" | "archived" }[];
}) => {
  const queryClient = useQueryClient();
  const mutation = useMutation(() => groupingMutationOptions(queryClient));
  const form = createForm(() => ({
    defaultValues: { productIds: [...props.grouping.productIds] },
    onSubmit: async ({ value }) => {
      const input = { productIds: value.productIds };
      if (props.grouping.kind === "category") {
        await mutation.mutateAsync({ kind: "members-category", id: props.grouping.id, input });
      } else if (props.grouping.kind === "collection") {
        await mutation.mutateAsync({ kind: "members-collection", id: props.grouping.id, input });
      } else {
        await mutation.mutateAsync({ kind: "members-tag", id: props.grouping.id, input });
      }
    },
  }));
  return (
    <form
      class="mt-4 border-t border-black/10 pt-4"
      onSubmit={async (event) => {
        event.preventDefault();
        await submitAndFocusExpectedError(
          event.currentTarget,
          () => form.handleSubmit(),
          () => mutation.error,
        );
      }}
    >
      <p class="mt-0 mb-3 text-xs font-bold text-(--muted)">Бүтээгдэхүүний гишүүнчлэл</p>
      <form.Field name="productIds">
        {(field) => {
          const toggle = (id: ProductId, selected: boolean) =>
            field().handleChange(
              selected
                ? [...field().state.value, id]
                : field().state.value.filter((productId) => productId !== id),
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
                <For each={props.products}>
                  {(product) => (
                    <label class="flex min-h-11 items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={field().state.value.includes(product.id)}
                        onChange={(event) => toggle(product.id, event.currentTarget.checked)}
                      />
                      <span>
                        {product.name} <small class="text-(--muted)">({product.state})</small>
                      </span>
                    </label>
                  )}
                </For>
              </div>
              <Show when={props.grouping.kind === "collection" && field().state.value.length > 0}>
                <ol class="my-3 grid gap-2 pl-6">
                  <For each={field().state.value}>
                    {(id, index) => {
                      const product = () => props.products.find((candidate) => candidate.id === id);
                      return (
                        <li>
                          <span>{product()?.name ?? id}</span>{" "}
                          <button
                            class="min-h-11 px-2"
                            type="button"
                            disabled={index() === 0}
                            onClick={() => move(index(), -1)}
                            aria-label={`${product()?.name ?? "Бүтээгдэхүүн"} дээш`}
                          >
                            ↑
                          </button>
                          <button
                            class="min-h-11 px-2"
                            type="button"
                            disabled={index() === field().state.value.length - 1}
                            onClick={() => move(index(), 1)}
                            aria-label={`${product()?.name ?? "Бүтээгдэхүүн"} доош`}
                          >
                            ↓
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
  );
};

const GroupingList = (props: {
  title: string;
  groups: readonly Grouping[];
  categories: readonly Category[];
  products: readonly { id: ProductId; name: string; state: "draft" | "published" | "archived" }[];
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
              <MembershipEditor grouping={grouping} products={props.products} />
            </li>
          )}
        </For>
      </ul>
    </Show>
  </section>
);

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
              <CreateCategoryForm categories={data.data.categories} />
              <CreateCollectionForm />
              <CreateTagForm />
              <GroupingList
                title="Ангилал"
                groups={data.data.categories}
                categories={data.data.categories}
                products={data.data.products}
              />
              <GroupingList
                title="Collection"
                groups={data.data.collections}
                categories={data.data.categories}
                products={data.data.products}
              />
              <GroupingList
                title="Tag"
                groups={data.data.tags}
                categories={data.data.categories}
                products={data.data.products}
              />
            </>
          )}
        </Show>
      </Show>
    </section>
  );
};
