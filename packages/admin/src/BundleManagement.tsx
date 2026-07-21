import { bundleMutationOptions, bundleQueryOptions, catalogQueryOptions } from "@ecom/client";
import {
  SaveBundleComponentsInputSchema,
  type Bundle,
  type BundleClientError,
} from "@ecom/contracts";
import { Button } from "@ecom/ui";
import { createForm } from "@tanstack/solid-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query";
import { createSignal, For, Match, Show, Switch } from "solid-js";
import * as v from "valibot";
import { submitBundleForm } from "./bundle-form";
import { CatalogImageForm } from "./CatalogImageForm";
import { PersonalizationEditor } from "./PersonalizationEditor";

const money = new Intl.NumberFormat("mn-MN");
const errorMessage = (error: BundleClientError) =>
  error.kind === "api" ? error.error.message : "Bundle хүсэлтийг гүйцэтгэж чадсангүй.";

const CreateBundleForm = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation(() => bundleMutationOptions(queryClient));
  const form = createForm(() => ({
    defaultValues: { name: "", slug: "", description: "", priceMnt: 1 },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync({
        kind: "create",
        name: value.name.trim(),
        slug: value.slug.trim(),
        description: value.description,
        priceMnt: value.priceMnt,
      });
      form.reset();
    },
  }));
  return (
    <form
      class="grid grid-cols-1 gap-3 pb-8 md:grid-cols-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submitBundleForm(event.currentTarget, form.handleSubmit);
      }}
    >
      <form.Field name="name">
        {(field) => (
          <label class="grid gap-1.5 text-xs font-bold text-(--muted)">
            <span>Bundle нэр</span>
            <input
              class="min-h-11 rounded-lg border border-black/25 bg-(--paper) px-3 text-(--ink)"
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
          <label class="grid gap-1.5 text-xs font-bold text-(--muted)">
            <span>URL slug</span>
            <input
              class="min-h-11 rounded-lg border border-black/25 bg-(--paper) px-3 text-(--ink)"
              required
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.value)}
            />
          </label>
        )}
      </form.Field>
      <form.Field name="priceMnt">
        {(field) => (
          <label class="grid gap-1.5 text-xs font-bold text-(--muted)">
            <span>Нэг үнэ (₮)</span>
            <input
              class="min-h-11 rounded-lg border border-black/25 bg-(--paper) px-3 text-(--ink)"
              type="number"
              min="1"
              required
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.valueAsNumber)}
            />
          </label>
        )}
      </form.Field>
      <form.Field name="description">
        {(field) => (
          <label class="grid gap-1.5 text-xs font-bold text-(--muted)">
            <span>Тайлбар</span>
            <input
              class="min-h-11 rounded-lg border border-black/25 bg-(--paper) px-3 text-(--ink)"
              maxlength={5000}
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.value)}
            />
          </label>
        )}
      </form.Field>
      <Button type="submit" disabled={mutation.isPending}>
        Bundle үүсгэх
      </Button>
      <Show when={mutation.error} keyed>
        {(error) => <p role="alert">{errorMessage(error)}</p>}
      </Show>
    </form>
  );
};

const BundleEditForm = (props: { bundle: Bundle }) => {
  const queryClient = useQueryClient();
  const mutation = useMutation(() => bundleMutationOptions(queryClient));
  const form = createForm(() => ({
    defaultValues: {
      name: props.bundle.name,
      slug: props.bundle.slug,
      description: props.bundle.description,
      priceMnt: props.bundle.priceMnt,
    },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync({
        kind: "update",
        id: props.bundle.id,
        name: value.name.trim(),
        slug: value.slug.trim(),
        description: value.description,
        priceMnt: value.priceMnt,
      });
    },
  }));
  return (
    <form
      class="grid grid-cols-1 items-end gap-3 md:grid-cols-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submitBundleForm(event.currentTarget, form.handleSubmit);
      }}
    >
      <form.Field name="name">
        {(field) => (
          <label class="grid gap-1.5 text-xs font-bold text-(--muted)">
            <span>Bundle нэр</span>
            <input
              class="min-h-11 rounded-lg border border-black/25 bg-(--paper) px-3 text-(--ink)"
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
          <label class="grid gap-1.5 text-xs font-bold text-(--muted)">
            <span>URL slug</span>
            <input
              class="min-h-11 rounded-lg border border-black/25 bg-(--paper) px-3 text-(--ink)"
              required
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.value)}
            />
          </label>
        )}
      </form.Field>
      <form.Field name="priceMnt">
        {(field) => (
          <label class="grid gap-1.5 text-xs font-bold text-(--muted)">
            <span>Нэг үнэ (₮)</span>
            <input
              class="min-h-11 rounded-lg border border-black/25 bg-(--paper) px-3 text-(--ink)"
              type="number"
              min="1"
              step="1"
              required
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.valueAsNumber)}
            />
          </label>
        )}
      </form.Field>
      <form.Field name="description">
        {(field) => (
          <label class="grid gap-1.5 text-xs font-bold text-(--muted)">
            <span>Тайлбар</span>
            <textarea
              class="min-h-11 rounded-lg border border-black/25 bg-(--paper) px-3 py-2 text-(--ink)"
              maxlength={5000}
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.value)}
            />
          </label>
        )}
      </form.Field>
      <Button type="submit" variant="secondary" disabled={mutation.isPending}>
        Bundle мэдээлэл хадгалах
      </Button>
      <Show when={mutation.error} keyed>
        {(error) => (
          <p role="alert" tabindex="-1" class="md:col-span-4">
            {errorMessage(error)}
          </p>
        )}
      </Show>
    </form>
  );
};

const BundleRow = (props: { bundle: Bundle }) => {
  const queryClient = useQueryClient();
  const mutation = useMutation(() => bundleMutationOptions(queryClient));
  const catalog = useQuery(() => catalogQueryOptions());
  const [componentInputError, setComponentInputError] = createSignal(false);
  const componentForm = createForm(() => ({
    defaultValues: {
      components: props.bundle.components
        .map(({ variantId, quantity }) => `${variantId}|${quantity}`)
        .join("\n"),
    },
    onSubmit: async ({ value }) => {
      const input = v.safeParse(SaveBundleComponentsInputSchema, {
        components: value.components
          .split("\n")
          .filter((line) => line.trim().length > 0)
          .map((line) => {
            const parts = line.split("|");
            return {
              variantId: (parts.at(0) ?? "").trim(),
              quantity: parts.length === 2 ? Number(parts[1]) : Number.NaN,
            };
          }),
      });
      if (!input.success) {
        setComponentInputError(true);
        return;
      }
      setComponentInputError(false);
      await mutation.mutateAsync({
        kind: "save-components",
        id: props.bundle.id,
        components: input.output.components,
      });
    },
  }));
  const nextAction = () =>
    props.bundle.state === "draft"
      ? "publish"
      : props.bundle.state === "published"
        ? "archive"
        : "reactivate";
  return (
    <li class="grid gap-4 border-t border-black/10 py-5">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="grid gap-1 text-sm text-(--muted)">
          <strong class="text-base text-(--ink)">{props.bundle.name}</strong>
          <span>
            {props.bundle.sku} · {money.format(props.bundle.priceMnt)} ₮ · {props.bundle.state}
          </span>
          <span>{props.bundle.components.length} тогтмол бүрэлдэхүүн</span>
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={mutation.isPending}
          onClick={(event) => {
            const root = event.currentTarget.closest("li") ?? event.currentTarget;
            const action = nextAction();
            const id = props.bundle.id;
            void submitBundleForm(root, () => mutation.mutateAsync({ kind: action, id }));
          }}
        >
          {props.bundle.state === "draft"
            ? "Нийтлэх"
            : props.bundle.state === "published"
              ? "Архивлах"
              : "Дахин идэвхжүүлэх"}
        </Button>
      </div>
      <BundleEditForm bundle={props.bundle} />
      <Show when={props.bundle.state === "draft"}>
        <form
          class="grid gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void submitBundleForm(event.currentTarget, componentForm.handleSubmit);
          }}
        >
          <componentForm.Field name="components">
            {(field) => (
              <label class="grid gap-1.5 text-xs font-bold text-(--muted)">
                <span>Variant ID|тоо (мөр тус бүр, 24 хүртэл)</span>
                <textarea
                  class="min-h-24 rounded-lg border border-black/25 bg-(--paper) px-3 py-2 font-mono text-xs text-(--ink)"
                  required
                  value={field().state.value}
                  onInput={(event) => field().handleChange(event.currentTarget.value)}
                />
              </label>
            )}
          </componentForm.Field>
          <Button type="submit" variant="secondary" disabled={mutation.isPending}>
            Бүрэлдэхүүн хадгалах
          </Button>
          <Show when={componentInputError()}>
            <p role="alert" tabindex="-1">
              Хоосон бус мөр бүр хүчинтэй Variant ID|тоо хэлбэртэй байх ёстой.
            </p>
          </Show>
          <details class="text-sm text-(--muted)">
            <summary class="cursor-pointer">Сонгох боломжтой Variant ID</summary>
            <ul>
              <For
                each={
                  catalog.data?.data.flatMap((product) =>
                    product.optionConfiguration.variants.map((variant) => ({
                      id: variant.id,
                      label: `${product.name} · ${variant.sku}`,
                    })),
                  ) ?? []
                }
              >
                {(variant) => (
                  <li>
                    <code>{variant.id}</code> — {variant.label}
                  </li>
                )}
              </For>
            </ul>
          </details>
        </form>
      </Show>
      <ul class="m-0 list-disc pl-5 text-sm">
        <For each={props.bundle.components}>
          {(component) => (
            <li>
              {component.productName} · {component.variantLabel} × {component.quantity}
            </li>
          )}
        </For>
      </ul>
      <CatalogImageForm item={props.bundle} />
      <PersonalizationEditor catalogItemId={props.bundle.id} />
      <Show when={props.bundle.cachePurgeDebt} keyed>
        {(debt) => (
          <div role="alert" tabindex="-1">
            <p>
              Өөрчлөлт хадгалагдсан ч public cache цэвэрлэгдсэнгүй. Оролдлого: {debt.attemptCount}
            </p>
            <Show when={debt.requestId} keyed>
              {(requestId) => <p>Cloudflare хүсэлтийн ID: {requestId}</p>}
            </Show>
            <Button
              type="button"
              variant="secondary"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate({ kind: "retry-cache-purge", id: props.bundle.id })}
            >
              Cache цэвэрлэгээг дахин оролдох
            </Button>
          </div>
        )}
      </Show>
      <Show when={mutation.error} keyed>
        {(error) => <p role="alert">{errorMessage(error)}</p>}
      </Show>
    </li>
  );
};

export const BundleManagement = () => {
  const bundles = useQuery(() => bundleQueryOptions());
  return (
    <section class="border-t border-black/15 py-8" aria-labelledby="bundle-title">
      <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="bundle-title" class="m-0 text-xl font-bold tracking-tight">
            Bundle ба Personalization
          </h2>
          <p class="mt-2 mb-0 max-w-prose text-(--muted)">
            Variant бүрэлдэхүүнтэй нэг үнэ болон арилжааны үнэнийг өөрчлөхгүй хэрэглэгчийн сонголтыг
            удирдана.
          </p>
        </div>
        <span class="rounded-full bg-(--surface) px-2.5 py-1.5 text-xs font-bold">
          {bundles.data?.data.length ?? 0} Bundle
        </span>
      </div>
      <CreateBundleForm />
      <Switch>
        <Match when={bundles.isError}>
          <div role="alert" class="grid justify-items-start gap-2">
            <p>Bundle жагсаалтыг ачаалж чадсангүй.</p>
            <Button type="button" variant="secondary" onClick={() => void bundles.refetch()}>
              Дахин оролдох
            </Button>
          </div>
        </Match>
        <Match when={bundles.data}>
          {(data) => (
            <ul class="m-0 list-none border-b border-black/15 p-0">
              <For each={data().data}>{(bundle) => <BundleRow bundle={bundle} />}</For>
            </ul>
          )}
        </Match>
        <Match when={true}>
          <p role="status">Bundle ачаалж байна…</p>
        </Match>
      </Switch>
    </section>
  );
};
