import { useCart } from "@ecom/client";
import { Button } from "@ecom/ui";
import { createSignal, For, Show } from "solid-js";

export const CartPresentation = () => {
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
