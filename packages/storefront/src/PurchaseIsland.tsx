import { CartProvider, createStoreQueryClient, useCart } from "@ecom/client";
import type {
  CartLine,
  CartPersonalizationAnswer,
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
import { resolvePurchaseDemand } from "./purchase-demand";
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

type PurchaseIslandProps = ProductPurchaseProps | BundlePurchaseProps;

const answersFromForm = (
  form: HTMLFormElement,
  definitions: readonly PersonalizationDefinition[],
): CartPersonalizationAnswer[] => {
  const data = new FormData(form);
  return definitions
    .filter(({ state }) => state === "active")
    .flatMap((definition): CartPersonalizationAnswer[] => {
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
  const identity = createMemo(() =>
    props.kind === "product"
      ? { kind: "variant" as const, id: selectedVariantId() }
      : { kind: "bundle" as const, id: props.bundle.id },
  );
  const demand = createMemo(() => resolvePurchaseDemand(cart.lines(), identity(), quantity()));
  const target = createMemo(() => ({ ...identity(), quantity: demand().quantity }));
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
    if (!demand().withinBounds) {
      return "Сагсанд энэ бараанаас нийт 999-өөс ихийг хадгалах боломжгүй.";
    }
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
    if (availability.state() !== "ready" || !demand().withinBounds) {
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
    const submittedDemand = resolvePurchaseDemand(cart.lines(), identity(), quantityValue);
    if (!submittedDemand.withinBounds || submittedDemand.quantity !== target().quantity) {
      return;
    }
    const personalizations = answersFromForm(form, definitions());
    const current = identity();
    const line: CartLine =
      current.kind === "variant"
        ? { kind: "variant", variantId: current.id, quantity: quantityValue, personalizations }
        : { kind: "bundle", bundleId: current.id, quantity: quantityValue, personalizations };
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
        <div role="status" aria-live="polite" aria-atomic="true">
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
          disabled={
            availability.state() !== "ready" || !demand().withinBounds || cart.recovery() !== null
          }
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
