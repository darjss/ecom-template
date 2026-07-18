import { checkoutQuoteMutationOptions, useCart } from "@ecom/client";
import { CheckoutQuoteInputSchema, type CheckoutClientError } from "@ecom/contracts";
import { Button } from "@ecom/ui";
import { createForm } from "@tanstack/solid-form";
import { useMutation } from "@tanstack/solid-query";
import { createSignal, For, Show } from "solid-js";
import * as v from "valibot";

const money = new Intl.NumberFormat("mn-MN");
const errorMessage = (error: CheckoutClientError) => {
  if (error.kind === "network") {
    return "Сүлжээний холболтыг шалгаад дахин оролдоно уу.";
  }
  if (error.kind === "api" && error.error.reason === "invalid_personalization") {
    return "Personalization хариулт өөрчлөгдсөн байна. Бүтээгдэхүүнээ дахин сонгоно уу.";
  }
  if (error.kind === "api" && error.error.reason === "insufficient_inventory") {
    return "Сагсны зарим барааны үлдэгдэл хүрэлцэхгүй байна.";
  }
  if (error.kind === "api" && error.error.reason === "catalog_unavailable") {
    return "Сагсны зарим бараа одоо худалдаалагдахгүй байна.";
  }
  if (error.kind === "api" && error.error.reason === "pickup_unavailable") {
    return "Сонгосон Pickup Location боломжгүй байна.";
  }
  if (error.kind === "api" && error.error.reason === "delivery_unavailable") {
    return "Delivery одоогоор боломжгүй байна.";
  }
  return "Одоогийн үнийн саналыг авч чадсангүй.";
};

export const CheckoutQuote = () => {
  const cart = useCart();
  const mutation = useMutation(() => checkoutQuoteMutationOptions());
  const [invalid, setInvalid] = createSignal(false);
  const form = createForm(() => ({
    defaultValues: { code: "", fulfillment: "delivery", locationId: "" },
    onSubmit: async ({ value }) => {
      const parsed = v.safeParse(CheckoutQuoteInputSchema, {
        lines: cart.lines(),
        code: value.code.trim() === "" ? null : value.code,
        fulfillment:
          value.fulfillment === "pickup"
            ? { kind: "pickup", locationId: value.locationId }
            : { kind: "delivery" },
      });
      if (!parsed.success) {
        setInvalid(true);
        return;
      }
      setInvalid(false);
      await mutation.mutateAsync(parsed.output);
    },
  }));
  return (
    <section class="mt-8 border-t border-black/15 pt-6" aria-labelledby="quote-title">
      <h2 id="quote-title" class="m-0 text-lg font-bold">
        Checkout үнийн санал
      </h2>
      <p class="mt-2 mb-5 max-w-prose text-sm text-(--muted)">
        Одоогийн үнэ, Discount, хүргэлт, үлдэгдлийг серверээс дахин тооцоолно.
      </p>
      <form
        class="grid gap-3 sm:grid-cols-2"
        onSubmit={async (event) => {
          event.preventDefault();
          await form.handleSubmit();
        }}
      >
        <form.Field name="code">
          {(field) => (
            <label class="grid gap-1.5 text-sm font-bold">
              Discount code
              <input
                class="min-h-11 rounded-lg border border-black/30 bg-white px-3 font-normal uppercase focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-(--focus)"
                value={field().state.value}
                onInput={(event) => field().handleChange(event.currentTarget.value)}
                placeholder="SUMMER-10"
              />
            </label>
          )}
        </form.Field>
        <form.Field name="fulfillment">
          {(field) => (
            <label class="grid gap-1.5 text-sm font-bold">
              Хүлээн авах хэлбэр
              <select
                class="min-h-11 rounded-lg border border-black/30 bg-white px-3 font-normal focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-(--focus)"
                value={field().state.value}
                onChange={(event) => field().handleChange(event.currentTarget.value)}
              >
                <option value="delivery">Delivery</option>
                <option value="pickup">Pickup</option>
              </select>
            </label>
          )}
        </form.Field>
        <form.Field name="locationId">
          {(field) => (
            <label class="grid gap-1.5 text-sm font-bold">
              Pickup Location ID
              <input
                class="min-h-11 rounded-lg border border-black/30 bg-white px-3 font-normal focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-(--focus)"
                value={field().state.value}
                onInput={(event) => field().handleChange(event.currentTarget.value)}
                placeholder="location_…"
              />
            </label>
          )}
        </form.Field>
        <div class="flex items-end">
          <Button
            class="w-full"
            type="submit"
            disabled={mutation.isPending || cart.lines().length === 0}
          >
            {mutation.isPending ? "Тооцоолж байна…" : "Одоогийн дүнг тооцоолох"}
          </Button>
        </div>
      </form>
      <Show when={invalid()}>
        <p class="mt-3 text-sm text-red-800" role="alert">
          Сагс, code эсвэл Pickup Location-оо шалгана уу.
        </p>
      </Show>
      <Show when={mutation.error} keyed>
        {(error) => (
          <p class="mt-3 text-sm text-red-800" role="alert">
            {errorMessage(error)}
          </p>
        )}
      </Show>
      <Show when={mutation.data?.data} keyed>
        {(quote) => (
          <div class="mt-6 border-y border-black/15 py-5" aria-live="polite">
            <h3 class="m-0 text-base font-bold">Одоогийн санал</h3>
            <ul class="m-0 mt-3 grid list-none gap-3 p-0">
              <For each={quote.lines}>
                {(line) => (
                  <li class="grid grid-cols-[1fr_auto] gap-x-4 border-b border-black/10 pb-3 text-sm">
                    <div>
                      <strong>{line.name}</strong>
                      <p class="m-0 mt-1 text-(--muted)">
                        {line.sku} · {line.quantity} × {money.format(line.unitPriceMnt)} ₮
                      </p>
                      <For each={line.personalizations}>
                        {(personalization) => (
                          <p class="m-0 mt-1 text-xs text-(--muted)">{personalization.label}</p>
                        )}
                      </For>
                    </div>
                    <div class="text-right tabular-nums">
                      <span>{money.format(line.totalMnt)} ₮</span>
                      <Show when={line.discountMnt > 0}>
                        <p class="m-0 mt-1 text-xs text-green-800">
                          −{money.format(line.discountMnt)} ₮
                        </p>
                      </Show>
                    </div>
                  </li>
                )}
              </For>
            </ul>
            <dl class="mt-4 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
              <dt>Барааны дүн</dt>
              <dd class="m-0 tabular-nums">{money.format(quote.subtotalMnt)} ₮</dd>
              <dt>Discount</dt>
              <dd class="m-0 tabular-nums">
                −{money.format(quote.discount.kind === "applied" ? quote.discount.amountMnt : 0)} ₮
              </dd>
              <For each={quote.fees}>
                {(fee) => (
                  <>
                    <dt>{fee.label}</dt>
                    <dd class="m-0 tabular-nums">{money.format(fee.amountMnt)} ₮</dd>
                  </>
                )}
              </For>
              <dt class="border-t border-black/15 pt-3 font-bold">Нийт</dt>
              <dd class="m-0 border-t border-black/15 pt-3 font-bold tabular-nums">
                {money.format(quote.totalMnt)} ₮
              </dd>
            </dl>
            <Show when={quote.discount.submittedCode !== null && !quote.discount.codeAccepted}>
              <p class="mt-3 mb-0 text-sm text-(--muted)">
                Оруулсан code тохирохгүй тул боломжтой Automatic Discount-ийг тооцлоо.
              </p>
            </Show>
            <p class="mt-4 mb-0 break-all text-xs text-(--muted)">
              Fingerprint: {quote.commercialFingerprint}
            </p>
          </div>
        )}
      </Show>
    </section>
  );
};
