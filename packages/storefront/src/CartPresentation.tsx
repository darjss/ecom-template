import { availabilityFreshnessMs, availabilityQueryOptions, useCart } from "@ecom/client";
import type { CartLine } from "@ecom/contracts";
import { Button, Input } from "@ecom/ui";
import { useQueryClient } from "@tanstack/solid-query";
import { createSignal, For, Show } from "solid-js";
import { CheckoutQuote } from "./CheckoutQuote";
import { resolveCartEditDemand } from "./purchase-demand";

export const CartPresentation = () => {
  const cart = useCart();
  const queryClient = useQueryClient();
  const [announcement, setAnnouncement] = createSignal("");
  const [checking, setChecking] = createSignal(false);
  const updateQuantity = async (line: CartLine, input: HTMLInputElement) => {
    if (checking()) {
      return;
    }
    const quantity = input.valueAsNumber;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
      input.value = String(line.quantity);
      setAnnouncement("Тоо ширхэгийг шинэчлэх боломжгүй");
      return;
    }
    const before = JSON.stringify(cart.lines());
    const demand = resolveCartEditDemand(cart.lines(), line, quantity);
    if (!demand.withinBounds) {
      input.value = String(line.quantity);
      setAnnouncement("Нийт тоо 999-өөс их тул шинэчлэх боломжгүй");
      return;
    }
    setChecking(true);
    setAnnouncement("Боломжийг шалгаж байна");
    try {
      const target = { ...demand.identity, quantity: demand.quantity };
      const response = await queryClient.fetchQuery(availabilityQueryOptions([target]));
      const currentDemand = resolveCartEditDemand(cart.lines(), line, quantity);
      const unchanged =
        before === JSON.stringify(cart.lines()) &&
        currentDemand.withinBounds &&
        currentDemand.quantity === target.quantity;
      if (!unchanged) {
        input.value = String(line.quantity);
        setAnnouncement("Сагс өөрчлөгдсөн тул тоог шинэчилсэнгүй");
        return;
      }
      const fresh = Date.now() - Date.parse(response.data.checkedAt) < availabilityFreshnessMs;
      const fact = response.data.facts.find(
        (candidate) => candidate.kind === target.kind && candidate.id === target.id,
      );
      if (!fresh) {
        input.value = String(line.quantity);
        setAnnouncement("Шинэ мэдээлэл авч чадсангүй. Тоог шинэчилсэнгүй");
        return;
      }
      if (!fact?.sellable) {
        input.value = String(line.quantity);
        setAnnouncement("Энэ тоогоор авах боломжгүй. Хуучин тоог хадгаллаа");
        return;
      }
      if (!cart.updateQuantity(line, quantity)) {
        input.value = String(line.quantity);
        setAnnouncement("Сагс өөрчлөгдсөн тул тоог шинэчилсэнгүй");
        return;
      }
      setAnnouncement("Сагсны тоо шинэчлэгдлээ");
    } catch {
      input.value = String(line.quantity);
      setAnnouncement("Боломжийг шалгаж чадсангүй. Хуучин тоог хадгаллаа");
    } finally {
      setChecking(false);
    }
  };
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
                <Input
                  class="h-11 w-20 tabular-nums"
                  type="number"
                  min="1"
                  max="999"
                  value={line.quantity}
                  disabled={checking()}
                  onChange={(event) => void updateQuantity(line, event.currentTarget)}
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
      <CheckoutQuote />
    </section>
  );
};
