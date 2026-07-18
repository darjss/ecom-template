import { discountMutationOptions, discountQueryOptions } from "@ecom/client";
import { DiscountRuleInputSchema, type DiscountClientError } from "@ecom/contracts";
import { Button } from "@ecom/ui";
import { createForm } from "@tanstack/solid-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query";
import { createSignal, For, Show } from "solid-js";
import * as v from "valibot";

const fieldClass =
  "min-h-11 rounded-lg border border-black/25 bg-(--paper) px-3 font-normal text-(--ink) focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-(--focus)";
const labelClass = "grid gap-1.5 text-xs font-bold text-(--muted)";
const message = (error: DiscountClientError) => {
  if (error.kind === "network") {
    return "Сүлжээний холболтыг шалгаад дахин оролдоно уу.";
  }
  if (error.kind === "api" && error.error.reason === "duplicate_code") {
    return "Энэ код аль хэдийн ашиглагдаж байна.";
  }
  if (error.kind === "api" && error.error.reason === "revision_conflict") {
    return "Rule өөрчлөгдсөн байна. Мэдээллийг шинэчлээд дахин оролдоно уу.";
  }
  if (error.kind === "api" && error.error.reason === "invalid_target") {
    return "Сонгосон target олдсонгүй.";
  }
  return "Discount Rule-г хадгалж чадсангүй.";
};

const DiscountCreateForm = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation(() => discountMutationOptions(queryClient));
  const [invalid, setInvalid] = createSignal(false);
  const form = createForm(() => ({
    defaultValues: {
      name: "",
      mode: "automatic",
      code: "",
      calculation: "percentage",
      value: 10,
      targetKind: "all",
      targetId: "",
      startsAt: "",
      endsAt: "",
      minimumSubtotalMnt: 0,
      globalLimit: "",
    },
    onSubmit: async ({ value }) => {
      const target =
        value.targetKind === "all"
          ? { kind: "all" }
          : { kind: value.targetKind, id: value.targetId };
      const parsed = v.safeParse(DiscountRuleInputSchema, {
        name: value.name,
        mode: value.mode,
        code: value.mode === "code" ? value.code : null,
        calculation: value.calculation,
        value: Number(value.value),
        targets: [target],
        startsAt: value.startsAt ? new Date(value.startsAt).toISOString() : null,
        endsAt: value.endsAt ? new Date(value.endsAt).toISOString() : null,
        minimumSubtotalMnt: Number(value.minimumSubtotalMnt),
        globalLimit: value.globalLimit === "" ? null : Number(value.globalLimit),
      });
      if (!parsed.success) {
        setInvalid(true);
        return;
      }
      setInvalid(false);
      await mutation.mutateAsync({ kind: "create", rule: parsed.output });
      form.reset();
    },
  }));
  return (
    <form
      class="grid gap-4 border-b border-black/15 pb-8 md:grid-cols-2 xl:grid-cols-4"
      onSubmit={async (event) => {
        event.preventDefault();
        await form.handleSubmit();
      }}
    >
      <form.Field name="name">
        {(field) => (
          <label class={labelClass}>
            Нэр
            <input
              class={fieldClass}
              required
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.value)}
            />
          </label>
        )}
      </form.Field>
      <form.Field name="mode">
        {(field) => (
          <label class={labelClass}>
            Горим
            <select
              class={fieldClass}
              value={field().state.value}
              onChange={(event) => field().handleChange(event.currentTarget.value)}
            >
              <option value="automatic">Automatic</option>
              <option value="code">Code</option>
            </select>
          </label>
        )}
      </form.Field>
      <form.Field name="code">
        {(field) => (
          <label class={labelClass}>
            Код
            <input
              class={fieldClass}
              placeholder="SUMMER-10"
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.value)}
            />
          </label>
        )}
      </form.Field>
      <form.Field name="calculation">
        {(field) => (
          <label class={labelClass}>
            Тооцоолол
            <select
              class={fieldClass}
              value={field().state.value}
              onChange={(event) => field().handleChange(event.currentTarget.value)}
            >
              <option value="percentage">Хувь</option>
              <option value="fixed_mnt">Тогтмол MNT</option>
            </select>
          </label>
        )}
      </form.Field>
      <form.Field name="value">
        {(field) => (
          <label class={labelClass}>
            Утга
            <input
              class={fieldClass}
              type="number"
              min="1"
              required
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.valueAsNumber)}
            />
          </label>
        )}
      </form.Field>
      <form.Field name="targetKind">
        {(field) => (
          <label class={labelClass}>
            Target
            <select
              class={fieldClass}
              value={field().state.value}
              onChange={(event) => field().handleChange(event.currentTarget.value)}
            >
              <option value="all">Бүх catalog</option>
              <option value="product">Product</option>
              <option value="variant">Variant</option>
              <option value="category">Category</option>
              <option value="collection">Collection</option>
            </select>
          </label>
        )}
      </form.Field>
      <form.Field name="targetId">
        {(field) => (
          <label class={labelClass}>
            Target ID
            <input
              class={fieldClass}
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.value)}
            />
          </label>
        )}
      </form.Field>
      <form.Field name="minimumSubtotalMnt">
        {(field) => (
          <label class={labelClass}>
            Доод дүн (MNT)
            <input
              class={fieldClass}
              type="number"
              min="0"
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.valueAsNumber)}
            />
          </label>
        )}
      </form.Field>
      <form.Field name="globalLimit">
        {(field) => (
          <label class={labelClass}>
            Нийт ашиглалтын хязгаар
            <input
              class={fieldClass}
              type="number"
              min="1"
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.value)}
            />
          </label>
        )}
      </form.Field>
      <form.Field name="startsAt">
        {(field) => (
          <label class={labelClass}>
            Эхлэх
            <input
              class={fieldClass}
              type="datetime-local"
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.value)}
            />
          </label>
        )}
      </form.Field>
      <form.Field name="endsAt">
        {(field) => (
          <label class={labelClass}>
            Дуусах
            <input
              class={fieldClass}
              type="datetime-local"
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.value)}
            />
          </label>
        )}
      </form.Field>
      <div class="flex items-end">
        <Button class="w-full" type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Хадгалж байна…" : "Draft Rule үүсгэх"}
        </Button>
      </div>
      <Show when={invalid()}>
        <p class="col-span-full m-0 text-sm text-red-800" role="alert">
          Оруулсан Rule-ийн утга, code, window, target-ийг шалгана уу.
        </p>
      </Show>
      <Show when={mutation.error} keyed>
        {(error) => (
          <p class="col-span-full m-0 text-sm text-red-800" role="alert">
            {message(error)}
          </p>
        )}
      </Show>
    </form>
  );
};

export const DiscountManagement = () => {
  const queryClient = useQueryClient();
  const query = useQuery(() => discountQueryOptions());
  const mutation = useMutation(() => discountMutationOptions(queryClient));
  return (
    <section class="border-t border-black/15 py-8" aria-labelledby="discount-title">
      <h2 id="discount-title" class="m-0 text-xl font-bold tracking-tight">
        Discount Rules
      </h2>
      <p class="mt-2 mb-6 max-w-prose text-(--muted)">
        Automatic эсвэл code Rule үүсгэж, catalog merchandise-д нэг хөнгөлөлт хэрэглэнэ.
      </p>
      <DiscountCreateForm />
      <Show
        when={!query.isPending}
        fallback={<p class="py-6 text-(--muted)">Discount Rules ачаалж байна…</p>}
      >
        <Show
          when={!query.isError}
          fallback={
            <p class="py-6 text-red-800" role="alert">
              Discount Rules-г ачаалж чадсангүй.
            </p>
          }
        >
          <ul class="m-0 grid list-none p-0">
            <For each={query.data?.data ?? []}>
              {(rule) => (
                <li class="flex flex-wrap items-center gap-3 border-b border-black/10 py-4">
                  <div class="min-w-48 flex-1">
                    <strong>{rule.name}</strong>
                    <p class="m-0 mt-1 text-sm text-(--muted)">
                      {rule.mode === "code" ? rule.code : "Automatic"} ·{" "}
                      {rule.calculation === "percentage"
                        ? `${rule.value}%`
                        : `${rule.value.toLocaleString("mn-MN")} ₮`}{" "}
                      · rev {rule.revision}
                    </p>
                  </div>
                  <span class="rounded-full bg-(--surface) px-3 py-2 text-xs font-bold">
                    {rule.state}
                  </span>
                  <Show when={rule.state !== "active"}>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={mutation.isPending}
                      onClick={() =>
                        mutation.mutate({
                          kind: "state",
                          id: rule.id,
                          expectedRevision: rule.revision,
                          state: "active",
                        })
                      }
                    >
                      Идэвхжүүлэх
                    </Button>
                  </Show>
                  <Show when={rule.state === "active"}>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={mutation.isPending}
                      onClick={() =>
                        mutation.mutate({
                          kind: "state",
                          id: rule.id,
                          expectedRevision: rule.revision,
                          state: "inactive",
                        })
                      }
                    >
                      Идэвхгүй болгох
                    </Button>
                  </Show>
                </li>
              )}
            </For>
          </ul>
          <Show when={(query.data?.data.length ?? 0) === 0}>
            <p class="py-6 text-(--muted)">Rule байхгүй байна. Эхний Draft Rule-ээ үүсгэнэ үү.</p>
          </Show>
        </Show>
      </Show>
      <Show when={mutation.error} keyed>
        {(error) => (
          <p class="mt-4 text-sm text-red-800" role="alert">
            {message(error)}
          </p>
        )}
      </Show>
    </section>
  );
};
