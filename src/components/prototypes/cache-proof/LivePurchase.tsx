import { createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import { array, boolean, literal, nullable, number, object, parse, string, union } from "valibot";

interface VariantOption {
  id: string;
  label: string;
}

interface LivePurchaseProps {
  variants: VariantOption[];
}

const availabilitySchema = object({
  checkedAt: number(),
  variants: array(object({ id: string(), available: number(), price_mnt: number() })),
});

const checkoutSchema = object({
  accepted: boolean(),
  code: union([literal("CURRENT_TRUTH_CONFIRMED"), literal("OUT_OF_STOCK"), literal("PRICE_CHANGED")]),
  currentPriceMnt: nullable(number()),
});

const formatMnt = (value: number) => `${new Intl.NumberFormat("mn-MN").format(value)} ₮`;

export const LivePurchase = (props: LivePurchaseProps) => {
  const [selectedId, setSelectedId] = createSignal(props.variants[0]?.id ?? "");
  const [quantity, setQuantity] = createSignal(1);
  const [availability, setAvailability] = createSignal(new Map<string, { available: number; priceMnt: number }>());
  const [state, setState] = createSignal<"checking" | "ready" | "stale">("checking");
  const [checkoutMessage, setCheckoutMessage] = createSignal("");
  const selected = createMemo(() => availability().get(selectedId()));
  const canBuy = createMemo(() => state() === "ready" && (selected()?.available ?? 0) >= quantity());

  createEffect(() => {
    const id = selectedId();
    const controller = new AbortController();
    setState("checking");
    setCheckoutMessage("");

    void fetch(`/api/prototype/availability?ids=${encodeURIComponent(id)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("availability failed");
        const result = parse(availabilitySchema, await response.json());
        const next = new Map(availability());
        for (const variant of result.variants) {
          next.set(variant.id, { available: variant.available, priceMnt: variant.price_mnt });
        }
        setAvailability(next);
        setState("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState("stale");
      });

    onCleanup(() => controller.abort());
  });

  const checkOut = async () => {
    const current = selected();
    if (!current || !canBuy()) return;
    setCheckoutMessage("Шалгаж байна…");
    const response = await fetch("/api/prototype/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        variantId: selectedId(),
        quantity: quantity(),
        quotedPriceMnt: current.priceMnt,
      }),
    });
    const result = parse(checkoutSchema, await response.json());
    setCheckoutMessage(
      result.accepted
        ? "Checkout одоогийн үнэ, үлдэгдлийг дахин баталгаажууллаа."
        : result.code === "PRICE_CHANGED"
          ? "Үнэ өөрчлөгдсөн тул checkout зогслоо."
          : "Үлдэгдэл хүрэлцэхгүй тул checkout зогслоо.",
    );
    if (!result.accepted) setState("stale");
  };

  return (
    <section class="proof-purchase" aria-labelledby="purchase-title">
      <p class="proof-eyebrow">Solid live island</p>
      <h2 id="purchase-title">Худалдан авах төлөв</h2>
      <label for="variant">Хувилбар</label>
      <select id="variant" value={selectedId()} onChange={(event) => setSelectedId(event.currentTarget.value)}>
        <For each={props.variants}>{(variant) => <option value={variant.id}>{variant.label}</option>}</For>
      </select>
      <div class="proof-live" aria-live="polite">
        <Show when={state() === "checking"}>Шинэ үлдэгдлийг шалгаж байна…</Show>
        <Show when={state() === "ready" && selected()}>
          {(current) => (
            <span>
              {current().available > 0 ? `${current().available} ширхэг бэлэн` : "Дууссан"} · {formatMnt(current().priceMnt)}
            </span>
          )}
        </Show>
        <Show when={state() === "stale"}>Шинэ мэдээлэл авч чадсангүй. Худалдан авалт түр хаалттай.</Show>
      </div>
      <label for="quantity">Тоо ширхэг</label>
      <input
        id="quantity"
        type="number"
        min="1"
        max="20"
        value={quantity()}
        onInput={(event) => setQuantity(event.currentTarget.valueAsNumber || 1)}
      />
      <button type="button" disabled={!canBuy()} onClick={() => void checkOut()}>
        Checkout truth шалгах
      </button>
      <p class="proof-result" aria-live="polite">{checkoutMessage()}</p>
    </section>
  );
};
