import {
  checkoutOptionsQueryOptions,
  checkoutQuoteMutationOptions,
  orderPlacementMutationOptions,
  useCart,
} from "@ecom/client";
import {
  CheckoutClientErrorSchema,
  CheckoutQuoteInputSchema,
  PlaceOrderInputSchema,
  type CheckoutClientError,
  type CheckoutQuote as CheckoutQuoteData,
  type CheckoutQuoteInput,
} from "@ecom/contracts";
import { Button } from "@ecom/ui";
import { createForm } from "@tanstack/solid-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query";
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
  const options = useQuery(() => checkoutOptionsQueryOptions());
  const queryClient = useQueryClient();
  const mutation = useMutation(() => checkoutQuoteMutationOptions());
  const placement = useMutation(() => orderPlacementMutationOptions());
  const [invalid, setInvalid] = createSignal(false);
  const [placementInvalid, setPlacementInvalid] = createSignal(false);
  const [acceptedInput, setAcceptedInput] = createSignal<CheckoutQuoteInput>();
  const [placementKey, setPlacementKey] = createSignal(crypto.randomUUID());
  const [correctiveQuote, setCorrectiveQuote] = createSignal<CheckoutQuoteData>();
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
      try {
        await mutation.mutateAsync(parsed.output);
        setAcceptedInput(parsed.output);
        setPlacementKey(crypto.randomUUID());
        setCorrectiveQuote(undefined);
        placement.reset();
      } catch {
        setAcceptedInput(undefined);
      }
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
                <Show when={options.data?.data.deliveryEnabled}>
                  <option value="delivery">Delivery</option>
                </Show>
                <Show when={(options.data?.data.pickupLocations.length ?? 0) > 0}>
                  <option value="pickup">Pickup</option>
                </Show>
              </select>
            </label>
          )}
        </form.Field>
        <form.Field name="locationId">
          {(field) => (
            <label class="grid gap-1.5 text-sm font-bold">
              Pickup Location
              <select
                class="min-h-11 rounded-lg border border-black/30 bg-white px-3 font-normal focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-(--focus)"
                value={field().state.value}
                onChange={(event) => field().handleChange(event.currentTarget.value)}
              >
                <option value="">Байршил сонгох</option>
                <For each={options.data?.data.pickupLocations ?? []}>
                  {(location) => (
                    <option value={location.id}>
                      {location.name} · {location.address}
                    </option>
                  )}
                </For>
              </select>
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
            <form
              class="mt-6 grid gap-3 border-t border-black/15 pt-5 sm:grid-cols-2"
              onSubmit={async (event) => {
                event.preventDefault();
                const quoteInput = acceptedInput();
                const data = new FormData(event.currentTarget);
                const parsed = v.safeParse(PlaceOrderInputSchema, {
                  idempotencyKey: placementKey(),
                  acceptedCommercialFingerprint: quote.commercialFingerprint,
                  quoteInput,
                  contact: {
                    recipientName: data.get("recipientName"),
                    recipientPhone: data.get("recipientPhone"),
                    deliveryAddress:
                      quote.fulfillment.kind === "delivery" ? data.get("deliveryAddress") : null,
                  },
                  paymentMethod: "bank_transfer",
                });
                if (!parsed.success) {
                  setPlacementInvalid(true);
                  return;
                }
                setPlacementInvalid(false);
                try {
                  await placement.mutateAsync(parsed.output);
                  await queryClient.invalidateQueries({ queryKey: ["availability"] });
                } catch (error) {
                  const parsedError = v.safeParse(CheckoutClientErrorSchema, error);
                  if (parsedError.success && parsedError.output.kind === "api") {
                    setCorrectiveQuote(parsedError.output.error.currentQuote);
                  }
                }
              }}
            >
              <label class="grid gap-1.5 text-sm font-bold">
                Хүлээн авагчийн нэр
                <input
                  name="recipientName"
                  autocomplete="name"
                  required
                  class="min-h-11 rounded-lg border border-black/30 bg-white px-3 font-normal focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-(--focus)"
                />
              </label>
              <label class="grid gap-1.5 text-sm font-bold">
                Утас
                <input
                  name="recipientPhone"
                  autocomplete="tel"
                  inputmode="tel"
                  placeholder="+97699112233"
                  required
                  class="min-h-11 rounded-lg border border-black/30 bg-white px-3 font-normal focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-(--focus)"
                />
              </label>
              <Show when={quote.fulfillment.kind === "delivery"}>
                <label class="grid gap-1.5 text-sm font-bold sm:col-span-2">
                  Хүргэлтийн хаяг
                  <textarea
                    name="deliveryAddress"
                    autocomplete="street-address"
                    required
                    maxlength={500}
                    class="min-h-24 rounded-lg border border-black/30 bg-white px-3 py-2 font-normal focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-(--focus)"
                  />
                </label>
              </Show>
              <div class="sm:col-span-2">
                <Button
                  class="w-full"
                  type="submit"
                  disabled={
                    placement.isPending ||
                    placement.data !== undefined ||
                    correctiveQuote() !== undefined
                  }
                >
                  {placement.isPending ? "Захиалга үүсгэж байна…" : "Банкны шилжүүлгээр захиалах"}
                </Button>
              </div>
            </form>
            <Show when={placementInvalid()}>
              <p class="mt-3 text-sm text-red-800" role="alert">
                Нэр, +976 утас, хүргэлтийн хаягаа шалгана уу.
              </p>
            </Show>
            <Show when={placement.error} keyed>
              {(error) => (
                <p class="mt-3 text-sm text-red-800" role="alert">
                  {error.kind === "api" && error.error.reason === "commercial_changed"
                    ? "Үнэ эсвэл нөхцөл өөрчлөгдсөн. Доорх шинэ саналыг шалгаад дахин тооцоолно уу."
                    : error.kind === "api" && error.error.reason === "idempotency_conflict"
                      ? "Энэ оролдлогын түлхүүр өөр захиалгад ашиглагдсан байна."
                      : errorMessage(error)}
                </p>
              )}
            </Show>
            <Show when={correctiveQuote()} keyed>
              {(current) => (
                <div class="mt-4 border border-amber-700 bg-amber-50 p-4 text-sm text-amber-950">
                  Одоогийн шинэ нийт дүн: <strong>{money.format(current.totalMnt)} ₮</strong>. Дахин
                  тооцоолж зөвшөөрсний дараа захиална уу.
                </div>
              )}
            </Show>
            <Show when={placement.data?.data} keyed>
              {(order) => (
                <div
                  class="mt-5 border-y border-green-800/30 bg-green-50 px-4 py-5 text-green-950"
                  aria-live="polite"
                >
                  <h3 class="m-0 text-base font-bold">Захиалга №{order.orderNumber} үүслээ</h3>
                  <p class="mt-2 mb-0 text-sm">
                    {money.format(order.totalMnt)} ₮-ийн банкны шилжүүлэг баталгаажихыг хүлээж
                    байна. Шилжүүлгийн утгад захиалгын дугаараа бичнэ үү.
                  </p>
                </div>
              )}
            </Show>
          </div>
        )}
      </Show>
    </section>
  );
};
