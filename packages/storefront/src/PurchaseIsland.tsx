import {
  availabilityQueryOptions,
  CartProvider,
  createStoreQueryClient,
  useCart,
} from "@ecom/client";
import type {
  AvailabilityFact,
  CartLine,
  PersonalizationAnswer,
  PersonalizationDefinition,
  PublicBundleDetail,
  PublicProductDetail,
} from "@ecom/contracts";
import { Button } from "@ecom/ui";
import { QueryClientProvider, createQuery } from "@tanstack/solid-query";
import { createMemo, createSignal, For, Match, Show, Switch } from "solid-js";

const money = new Intl.NumberFormat("mn-MN");

type ProductPurchaseProps = {
  readonly kind: "product";
  readonly product: PublicProductDetail;
  readonly personalizations: readonly PersonalizationDefinition[];
  readonly storageKey: string;
};

type BundlePurchaseProps = {
  readonly kind: "bundle";
  readonly bundle: PublicBundleDetail;
  readonly storageKey: string;
};

export type PurchaseIslandProps = ProductPurchaseProps | BundlePurchaseProps;

const overlapWithCurrent = (
  candidate: PublicProductDetail["variants"][number],
  current: PublicProductDetail["variants"][number] | undefined,
) =>
  current?.optionValues.filter((selection) =>
    candidate.optionValues.some(
      (candidateValue) =>
        candidateValue.groupId === selection.groupId &&
        candidateValue.valueId === selection.valueId,
    ),
  ).length ?? 0;

const CartSummary = () => {
  const cart = useCart();
  const [announcement, setAnnouncement] = createSignal("");
  return (
    <section class="mt-6 border-t border-black/15 pt-5" aria-labelledby="cart-summary-title">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 id="cart-summary-title" class="m-0 text-lg font-bold">
          Сагс · {cart.itemCount()}
        </h2>
        <Show when={cart.lines().length > 0}>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              cart.clear();
              setAnnouncement("Сагс цэвэрлэгдлээ");
            }}
          >
            Бүгдийг арилгах
          </Button>
        </Show>
      </div>
      <Show when={cart.recovery()} keyed>
        {(recovery) => (
          <div class="mt-3 rounded-lg border border-(--tomato) bg-white p-4" role="alert">
            <p class="m-0">{recovery.message}</p>
            <Button type="button" class="mt-3" onClick={cart.reset}>
              Сагсыг шинэчлэх
            </Button>
          </div>
        )}
      </Show>
      <ul class="mt-3 grid list-none gap-3 p-0">
        <For each={cart.lines()}>
          {(line) => (
            <li class="flex flex-wrap items-center gap-3 border-b border-black/10 pb-3">
              <span class="min-w-0 flex-1 break-all text-sm">
                {line.kind === "variant" ? "Бүтээгдэхүүн" : "Bundle"} ·{" "}
                {line.kind === "variant" ? line.variantId : line.bundleId}
              </span>
              <label class="grid gap-1 text-sm font-bold">
                Тоо
                <input
                  class="h-11 w-20 rounded-lg border border-black/30 bg-white px-3 tabular-nums focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-(--focus)"
                  type="number"
                  min="1"
                  max="999"
                  value={line.quantity}
                  onChange={(event) => {
                    if (cart.updateQuantity(line, event.currentTarget.valueAsNumber)) {
                      setAnnouncement("Сагсны тоо шинэчлэгдлээ");
                    }
                  }}
                />
              </label>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  cart.removeLine(line);
                  setAnnouncement("Сагснаас арилгалаа");
                }}
              >
                Арилгах
              </Button>
            </li>
          )}
        </For>
      </ul>
      <p class="sr-only" aria-live="polite" aria-atomic="true">
        {announcement()}
      </p>
    </section>
  );
};

const PersonalizationFields = (props: {
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

const answersFromForm = (
  form: HTMLFormElement,
  definitions: readonly PersonalizationDefinition[],
): PersonalizationAnswer[] => {
  const data = new FormData(form);
  return definitions
    .filter(({ state }) => state === "active")
    .flatMap((definition): PersonalizationAnswer[] => {
      const value = data.get(`personalization-${definition.key}`);
      if (definition.kind === "text") {
        return typeof value === "string" && value.length > 0
          ? [{ key: definition.key, kind: "text", value }]
          : [];
      }
      if (definition.kind === "single_select") {
        return typeof value === "string" && value.length > 0
          ? [{ key: definition.key, kind: "single_select", valueId: value }]
          : [];
      }
      return [{ key: definition.key, kind: "checkbox", checked: value === "on" }];
    });
};

const PurchaseControls = (props: PurchaseIslandProps) => {
  const cart = useCart();
  const [quantity, setQuantity] = createSignal(1);
  const [selectedVariantId, setSelectedVariantId] = createSignal(
    props.kind === "product" ? (props.product.variants[0]?.id ?? "") : "",
  );
  const [announcement, setAnnouncement] = createSignal("");
  const selectedVariant = createMemo(() =>
    props.kind === "product"
      ? props.product.variants.find(({ id }) => id === selectedVariantId())
      : undefined,
  );
  const target = createMemo(() =>
    props.kind === "product"
      ? { kind: "variant" as const, id: selectedVariantId(), quantity: quantity() }
      : { kind: "bundle" as const, id: props.bundle.id, quantity: quantity() },
  );
  const availability = createQuery(() => availabilityQueryOptions([target()]));
  const fact = createMemo<AvailabilityFact | undefined>(() => {
    const current = target();
    return availability.data?.data.facts.find(
      (candidate) => candidate.kind === current.kind && candidate.id === current.id,
    );
  });
  const state = () =>
    availability.isFetching || availability.isPending
      ? "checking"
      : availability.isError
        ? "stale"
        : fact()?.sellable
          ? "ready"
          : "unavailable";
  const definitions = () =>
    props.kind === "product" ? props.personalizations : props.bundle.personalizations;
  const selectedValueId = (groupId: string) =>
    selectedVariant()?.optionValues.find(({ groupId: candidate }) => candidate === groupId)
      ?.valueId;
  const variantsContaining = (groupId: string, valueId: string) =>
    props.kind === "product"
      ? props.product.variants.filter((variant) =>
          variant.optionValues.some(
            (candidate) => candidate.groupId === groupId && candidate.valueId === valueId,
          ),
        )
      : [];
  const selectValue = (groupId: string, valueId: string) => {
    const current = selectedVariant();
    const matching = variantsContaining(groupId, valueId);
    const next = matching.reduce<(typeof matching)[number] | undefined>(
      (best, candidate) =>
        !best || overlapWithCurrent(candidate, current) > overlapWithCurrent(best, current)
          ? candidate
          : best,
      undefined,
    );
    if (next) setSelectedVariantId(next.id);
  };
  const statusText = () => {
    if (state() === "checking") return "Боломжийг шалгаж байна…";
    if (state() === "stale") return "Шинэ мэдээлэл авч чадсангүй. Худалдан авалт түр хаалттай.";
    if (state() === "unavailable") return "Одоогоор авах боломжгүй.";
    const current = fact();
    return current ? `${money.format(current.unitPriceMnt)} ₮ · Авах боломжтой` : "";
  };
  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    if (state() !== "ready") return;
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;
    const personalizations = answersFromForm(form, definitions());
    const current = target();
    const line: CartLine =
      current.kind === "variant"
        ? { kind: "variant", variantId: current.id, quantity: current.quantity, personalizations }
        : { kind: "bundle", bundleId: current.id, quantity: current.quantity, personalizations };
    const result = cart.addLine(line);
    setAnnouncement(
      result === "added"
        ? "Сагсанд нэмлээ"
        : result === "merged"
          ? "Сагсны тоог нэмлээ"
          : result === "quantity_exceeded"
            ? "Нэг мөрөнд 999-өөс ихийг нэмэх боломжгүй"
            : "Сагс дүүрсэн эсвэл шинэчлэх шаардлагатай",
    );
  };

  return (
    <form class="grid gap-5" onSubmit={submit} aria-label="Худалдан авах сонголт">
      <Show when={props.kind === "product" && props.product}>
        {(product) => (
          <For each={product().optionGroups}>
            {(group) => (
              <fieldset class="m-0 grid gap-2 border-0 p-0">
                <legend class="mb-1 text-sm font-bold">{group.label}</legend>
                <div class="flex flex-wrap gap-2">
                  <For each={group.values}>
                    {(value) => {
                      const selected = () => selectedValueId(group.id) === value.id;
                      return (
                        <button
                          type="button"
                          class="min-h-11 rounded-lg border px-4 py-2 text-sm font-bold transition-colors motion-reduce:transition-none"
                          classList={{
                            "border-(--tomato) bg-(--tomato) text-white": selected(),
                            "border-black/25 bg-white text-(--ink)": !selected(),
                          }}
                          aria-pressed={selected()}
                          onClick={() => selectValue(group.id, value.id)}
                        >
                          {value.label}
                        </button>
                      );
                    }}
                  </For>
                </div>
              </fieldset>
            )}
          </For>
        )}
      </Show>
      <PersonalizationFields definitions={definitions()} />
      <label class="grid max-w-28 gap-1 text-sm font-bold">
        Тоо ширхэг
        <input
          class="h-12 rounded-lg border border-black/30 bg-white px-3 tabular-nums focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-(--focus)"
          type="number"
          min="1"
          max="999"
          value={quantity()}
          onInput={(event) => {
            const value = event.currentTarget.valueAsNumber;
            if (Number.isInteger(value) && value >= 1 && value <= 999) setQuantity(value);
          }}
        />
      </label>
      <p class="m-0 min-h-6 font-bold" aria-live="polite" aria-atomic="true">
        {statusText()}
      </p>
      <Button type="submit" disabled={state() !== "ready" || cart.recovery() !== null}>
        {state() === "checking" ? "Шалгаж байна…" : "Сагсанд нэмэх"}
      </Button>
      <p class="sr-only" aria-live="polite" aria-atomic="true">
        {announcement()}
      </p>
      <CartSummary />
    </form>
  );
};

export const PurchaseIsland = (props: PurchaseIslandProps) => {
  const queryClient = createStoreQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <CartProvider storageKey={props.storageKey}>
        <PurchaseControls {...props} />
      </CartProvider>
    </QueryClientProvider>
  );
};
