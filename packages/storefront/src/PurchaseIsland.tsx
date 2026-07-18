import { CartProvider, createStoreQueryClient, useCart } from "@ecom/client";
import type {
  CartLine,
  PersonalizationAnswer,
  PersonalizationDefinition,
  PublicBundleDetail,
  PublicProductDetail,
} from "@ecom/contracts";
import { Button } from "@ecom/ui";
import { CartPresentation } from "./CartPresentation";
import { PersonalizationControls } from "./PersonalizationControls";
import { ProductVariantSelector } from "./ProductVariantSelector";
import { QueryClientProvider } from "@tanstack/solid-query";
import { createMemo, createSignal, onMount, Show, untrack } from "solid-js";
import { createPurchaseAvailability } from "./purchase-availability";
import { resolvePurchasePrice } from "./purchase-price";

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
    untrack(() => (props.kind === "product" ? (props.product.variants[0]?.id ?? "") : "")),
  );
  const [announcement, setAnnouncement] = createSignal("");
  const target = createMemo(() =>
    props.kind === "product"
      ? { kind: "variant" as const, id: selectedVariantId(), quantity: quantity() }
      : { kind: "bundle" as const, id: props.bundle.id, quantity: quantity() },
  );
  const availability = createPurchaseAvailability(() => target());
  const definitions = () =>
    props.kind === "product" ? props.personalizations : props.bundle.personalizations;
  const catalogPriceMnt = () =>
    props.kind === "bundle"
      ? props.bundle.priceMnt
      : (props.product.variants.find(({ id }) => id === selectedVariantId())?.priceMnt ??
        props.product.priceMnt);
  const price = () =>
    resolvePurchasePrice(catalogPriceMnt(), availability.state(), availability.fact());
  const statusText = () => {
    if (availability.state() === "checking") {
      return "Боломжийг шалгаж байна…";
    }
    if (availability.state() === "stale") {
      return "Шинэ мэдээлэл авч чадсангүй. Худалдан авалт түр хаалттай.";
    }
    if (availability.state() === "unavailable") {
      return "Одоогоор авах боломжгүй.";
    }
    return "Авах боломжтой";
  };
  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    if (availability.state() !== "ready") {
      return;
    }
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) {
      return;
    }
    const quantityValue = Number(new FormData(form).get("quantity"));
    if (!Number.isInteger(quantityValue) || quantityValue < 1 || quantityValue > 999) {
      return;
    }
    const personalizations = answersFromForm(form, definitions());
    const current = { ...target(), quantity: quantityValue };
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
            : result === "recovery_required"
              ? "Сагсыг шинэчилж дахин оролдоно уу"
              : "Сагс 100 мөрийн хязгаарт хүрсэн",
    );
  };

  return (
    <>
      <form class="grid gap-5" onSubmit={submit} aria-label="Худалдан авах сонголт">
        <Show when={props.kind === "product" && props.product}>
          {(product) => (
            <ProductVariantSelector
              product={product()}
              selectedVariantId={selectedVariantId}
              onSelect={setSelectedVariantId}
            />
          )}
        </Show>
        <PersonalizationControls definitions={definitions()} />
        <label class="grid max-w-28 gap-1 text-sm font-bold">
          Тоо ширхэг
          <input
            class="h-12 rounded-lg border border-black/30 bg-white px-3 tabular-nums focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-(--focus)"
            type="number"
            name="quantity"
            required
            min="1"
            max="999"
            value={quantity()}
            onInput={(event) => {
              const value = event.currentTarget.valueAsNumber;
              if (Number.isInteger(value) && value >= 1 && value <= 999) {
                setQuantity(value);
              }
            }}
          />
        </label>
        <div>
          <strong class="block text-2xl tabular-nums">
            {money.format(price().unitPriceMnt)} ₮
          </strong>
          <span class="text-sm text-(--muted)">
            {price().source === "current" ? "Шинэчилсэн үнэ" : "Каталогийн үнэ · танилцуулга"}
          </span>
        </div>
        <p class="m-0 min-h-6 font-bold" aria-live="polite" aria-atomic="true">
          {statusText()}
        </p>
        <Button
          type="submit"
          disabled={availability.state() !== "ready" || cart.recovery() !== null}
        >
          {availability.state() === "checking" ? "Шалгаж байна…" : "Сагсанд нэмэх"}
        </Button>
        <p class="sr-only" aria-live="polite" aria-atomic="true">
          {announcement()}
        </p>
      </form>
      <CartPresentation />
    </>
  );
};

export const PurchaseIsland = (props: PurchaseIslandProps) => {
  const queryClient = createStoreQueryClient();
  let root: HTMLDivElement | undefined;
  onMount(() => {
    root
      ?.closest("astro-island")
      ?.parentElement?.querySelector(":scope > [data-purchase-fallback]")
      ?.remove();
  });
  return (
    <div ref={(element) => (root = element)}>
      <QueryClientProvider client={queryClient}>
        <CartProvider storageKey={props.storageKey}>
          <PurchaseControls {...props} />
        </CartProvider>
      </QueryClientProvider>
    </div>
  );
};
