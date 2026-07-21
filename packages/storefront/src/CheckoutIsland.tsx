import {
  CartProvider,
  checkoutQuoteMutationOptions,
  createStoreQueryClient,
  orderPlacementMutationOptions,
  useCart,
} from "@ecom/client";
import {
  CheckoutClientErrorSchema,
  CheckoutQuoteInputSchema,
  PlaceOrderInputSchema,
  type CheckoutClientError,
  type CheckoutQuote,
  type CheckoutQuoteInput,
  type PlaceOrderInput,
} from "@ecom/contracts";
import { Button, Input, Textarea } from "@ecom/ui";
import { createForm } from "@tanstack/solid-form";
import { QueryClientProvider, useMutation, useQueryClient } from "@tanstack/solid-query";
import { createSignal, For, onMount, Show } from "solid-js";
import * as v from "valibot";

const money = new Intl.NumberFormat("mn-MN");

const normalizePhone = (value: string) => {
  const compact = value.replaceAll(/[\s()-]/g, "");
  return /^\d{8}$/.test(compact) ? `+976${compact}` : compact;
};

const checkoutErrorMessage = (error: CheckoutClientError) => {
  if (error.kind === "network") {
    return "Холболт тасарсан байж магадгүй. Ижил захиалгыг дахин илгээхэд давхар үүсэхгүй.";
  }
  if (error.kind === "contract") {
    return "Үйлчилгээний хариуг баталгаажуулж чадсангүй. Ижил захиалгыг дахин илгээнэ үү.";
  }
  if (error.error.reason === "commercial_changed") {
    return "Үнэ эсвэл хүргэлтийн дүн өөрчлөгдлөө. Шинэ дүнг шалгаад дахин баталгаажуулна уу.";
  }
  if (error.error.reason === "idempotency_conflict") {
    return "Энэ захиалгын түлхүүр өөр мэдээлэлтэй ашиглагдсан байна. Шинэ оролдлого эхлүүллээ.";
  }
  if (error.error.reason === "insufficient_inventory") {
    return "Сагсны зарим барааны үлдэгдэл хүрэлцэхгүй байна.";
  }
  if (error.error.reason === "catalog_unavailable") {
    return "Сагсны зарим бараа одоо худалдаалагдахгүй байна.";
  }
  if (error.error.reason === "invalid_personalization") {
    return "Бүтээгдэхүүний сонголт өөрчлөгдсөн байна. Сагсаа шинэчилнэ үү.";
  }
  if (error.error.reason === "quantity_exceeded") {
    return "Сагсан дахь тоо зөвшөөрөгдөх хэмжээнээс их байна.";
  }
  if (error.error.reason === "delivery_unavailable") {
    return "Хүргэлт одоогоор боломжгүй байна.";
  }
  if (error.error.reason === "bank_transfer_unavailable") {
    return "Банкны шилжүүлгээр захиалах боломж түр хаалттай байна.";
  }
  return "Захиалгыг баталгаажуулж чадсангүй. Дахин оролдоно уу.";
};

const quoteErrorMessage = (error: CheckoutClientError) => {
  if (error.kind === "network") {
    return "Одоогийн дүнг авч чадсангүй. Холболтоо шалгаад дахин оролдоно уу.";
  }
  if (error.kind === "api" && error.error.reason === "insufficient_inventory") {
    return "Сагсны зарим барааны үлдэгдэл хүрэлцэхгүй байна.";
  }
  if (error.kind === "api" && error.error.reason === "catalog_unavailable") {
    return "Сагсны зарим бараа одоо худалдаалагдахгүй байна.";
  }
  if (error.kind === "api" && error.error.reason === "delivery_unavailable") {
    return "Хүргэлт одоогоор боломжгүй байна.";
  }
  return "Захиалгын одоогийн дүнг тооцоолж чадсангүй.";
};

const CheckoutForm = () => {
  const cart = useCart();
  const queryClient = useQueryClient();
  const quoteMutation = useMutation(() => checkoutQuoteMutationOptions());
  const placement = useMutation(() => orderPlacementMutationOptions());
  const [acceptedInput, setAcceptedInput] = createSignal<CheckoutQuoteInput>();
  const [acceptedQuote, setAcceptedQuote] = createSignal<CheckoutQuote>();
  const [placementKey, setPlacementKey] = createSignal(crypto.randomUUID());
  const [pendingIntent, setPendingIntent] = createSignal<PlaceOrderInput>();
  const [message, setMessage] = createSignal("");

  const quoteInput = () =>
    v.safeParse(CheckoutQuoteInputSchema, {
      lines: cart.lines(),
      code: null,
      fulfillment: { kind: "delivery" },
    });

  const refreshQuote = async () => {
    if (pendingIntent() !== undefined || placement.data !== undefined) {
      return;
    }
    const parsed = quoteInput();
    if (!parsed.success) {
      setAcceptedInput(undefined);
      setAcceptedQuote(undefined);
      setMessage("Сагс хоосон эсвэл шинэчлэх шаардлагатай байна.");
      return;
    }
    setMessage("");
    quoteMutation.reset();
    try {
      const response = await quoteMutation.mutateAsync(parsed.output);
      setAcceptedInput(parsed.output);
      setAcceptedQuote(response.data);
      setPlacementKey(crypto.randomUUID());
      setPendingIntent(undefined);
      placement.reset();
    } catch {
      setAcceptedInput(undefined);
      setAcceptedQuote(undefined);
    }
  };

  onMount(() => {
    if (cart.lines().length > 0) {
      void refreshQuote();
    }
  });

  const form = createForm(() => ({
    defaultValues: { recipientName: "", recipientPhone: "", deliveryAddress: "" },
    onSubmit: async ({ value }) => {
      const quote = acceptedQuote();
      const input = acceptedInput();
      if (!quote || !input) {
        setMessage("Эхлээд одоогийн дүнг шинэчилнэ үү.");
        return;
      }
      let intent = pendingIntent();
      if (!intent) {
        const parsed = v.safeParse(PlaceOrderInputSchema, {
          idempotencyKey: placementKey(),
          acceptedCommercialFingerprint: quote.commercialFingerprint,
          quoteInput: input,
          contact: {
            recipientName: value.recipientName,
            recipientPhone: normalizePhone(value.recipientPhone),
            deliveryAddress: value.deliveryAddress,
          },
          paymentMethod: "bank_transfer",
        });
        if (!parsed.success) {
          setMessage("Нэр, утас, хүргэлтийн хаягаа бүрэн зөв оруулна уу.");
          return;
        }
        intent = parsed.output;
      }
      setMessage("");
      setPendingIntent(intent);
      try {
        await placement.mutateAsync(intent);
        cart.clear();
        await queryClient.invalidateQueries({ queryKey: ["availability"] });
      } catch (error) {
        const clientError = v.safeParse(CheckoutClientErrorSchema, error);
        if (!clientError.success) {
          setMessage("Хариу тодорхойгүй байна. Ижил захиалгыг дахин илгээнэ үү.");
          return;
        }
        const typedError = clientError.output;
        setMessage(checkoutErrorMessage(typedError));
        if (typedError.kind !== "api" || typedError.error.code === "unavailable") {
          return;
        }
        const currentQuote = typedError.error.currentQuote;
        setPendingIntent(undefined);
        setPlacementKey(crypto.randomUUID());
        if (typedError.error.reason === "commercial_changed" && currentQuote) {
          setAcceptedQuote(currentQuote);
          return;
        }
        setAcceptedInput(undefined);
        setAcceptedQuote(undefined);
      }
    },
  }));

  const frozen = () => pendingIntent() !== undefined || placement.data !== undefined;

  return (
    <Show
      when={placement.data?.data}
      keyed
      fallback={
        <Show
          when={cart.lines().length > 0}
          fallback={
            <section class="border-y border-[var(--line)] bg-white px-5 py-12 text-center sm:px-10">
              <h2 class="m-0 text-2xl font-extrabold tracking-[-0.025em]">Сагс хоосон байна</h2>
              <p class="mx-auto mt-3 mb-0 max-w-md text-[var(--muted)]">
                Бүтээгдэхүүнээ сонгосны дараа энд хүргэлтийн мэдээллээ оруулж захиална.
              </p>
              <a
                class="ui-button ui-button--primary mt-6 inline-flex items-center justify-center no-underline"
                href="/"
              >
                Дэлгүүр рүү буцах
              </a>
            </section>
          }
        >
          <div class="grid overflow-hidden border-y border-[var(--line)] bg-white lg:grid-cols-[minmax(0,0.92fr)_minmax(28rem,1.08fr)]">
            <section
              class="bg-[var(--navy)] px-5 py-8 text-white sm:px-8 lg:px-10 lg:py-12"
              aria-labelledby="checkout-summary-title"
            >
              <div class="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p class="m-0 text-sm font-bold text-[var(--yellow)]">Таны захиалга</p>
                  <h2
                    id="checkout-summary-title"
                    class="mt-2 mb-0 text-2xl font-extrabold tracking-[-0.025em]"
                  >
                    Одоогийн дүн
                  </h2>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={quoteMutation.isPending || frozen()}
                  onClick={() => void refreshQuote()}
                >
                  {quoteMutation.isPending ? "Тооцолж байна…" : "Дүн шинэчлэх"}
                </Button>
              </div>

              <Show when={acceptedQuote()} keyed>
                {(quote) => (
                  <div aria-live="polite">
                    <ul class="m-0 mt-8 grid list-none gap-4 p-0">
                      <For each={quote.lines}>
                        {(line) => (
                          <li class="grid grid-cols-[1fr_auto] gap-4 border-b border-white/20 pb-4">
                            <div class="min-w-0">
                              <strong class="block text-base">{line.name}</strong>
                              <p class="mt-1 mb-0 text-sm text-white/75">
                                {line.quantity} × {money.format(line.unitPriceMnt)} ₮
                              </p>
                              <For each={line.personalizations}>
                                {(personalization) => (
                                  <p class="mt-1 mb-0 text-xs text-white/70">
                                    {personalization.label}
                                  </p>
                                )}
                              </For>
                            </div>
                            <strong class="whitespace-nowrap tabular-nums">
                              {money.format(line.totalMnt)} ₮
                            </strong>
                          </li>
                        )}
                      </For>
                    </ul>
                    <dl class="mt-6 grid grid-cols-[1fr_auto] gap-x-5 gap-y-3 text-sm">
                      <dt>Барааны дүн</dt>
                      <dd class="m-0 tabular-nums">{money.format(quote.subtotalMnt)} ₮</dd>
                      <dt>Хүргэлт</dt>
                      <dd class="m-0 tabular-nums">{money.format(quote.deliveryFeeMnt)} ₮</dd>
                      <dt class="border-t border-white/30 pt-4 text-base font-extrabold">
                        Нийт төлөх
                      </dt>
                      <dd class="m-0 border-t border-white/30 pt-4 text-xl font-extrabold tabular-nums text-[var(--yellow)]">
                        {money.format(quote.totalMnt)} ₮
                      </dd>
                    </dl>
                  </div>
                )}
              </Show>

              <Show when={quoteMutation.error} keyed>
                {(error) => (
                  <p class="mt-6 mb-0 border border-white/35 bg-white/10 p-4 text-sm" role="alert">
                    {quoteErrorMessage(error)}
                  </p>
                )}
              </Show>
            </section>

            <section
              class="px-5 py-8 sm:px-8 lg:px-10 lg:py-12"
              aria-labelledby="checkout-contact-title"
            >
              <p class="m-0 text-sm font-bold text-[var(--accent)]">Банкны шилжүүлэг</p>
              <h2
                id="checkout-contact-title"
                class="mt-2 mb-0 text-2xl font-extrabold tracking-[-0.025em]"
              >
                Хүргэлтийн мэдээлэл
              </h2>
              <p class="mt-3 mb-0 max-w-xl text-sm leading-6 text-[var(--muted)]">
                Захиалга үүссэний дараа дугаарыг шилжүүлгийн утгад бичнэ. Төлбөрийг дэлгүүр
                баталгаажуулсны дараа хүргэлт эхэлнэ.
              </p>

              <form
                class="mt-8 grid gap-5"
                onSubmit={async (event) => {
                  event.preventDefault();
                  await form.handleSubmit();
                }}
              >
                <form.Field name="recipientName">
                  {(field) => (
                    <label class="grid gap-2 text-sm font-bold" for="checkout-recipient-name">
                      Хүлээн авагчийн нэр
                      <Input
                        id="checkout-recipient-name"
                        name={field().name}
                        autocomplete="name"
                        required
                        maxlength={120}
                        disabled={frozen()}
                        value={field().state.value}
                        onBlur={field().handleBlur}
                        onInput={(event) => field().handleChange(event.currentTarget.value)}
                        class="min-h-12 rounded-lg border border-[var(--line)] bg-white px-4 text-base font-normal placeholder:text-[var(--muted)] focus-visible:border-[var(--focus)] focus-visible:ring-3 focus-visible:ring-[color:var(--focus)]/20"
                        placeholder="Нэрээ оруулна уу"
                      />
                    </label>
                  )}
                </form.Field>

                <form.Field name="recipientPhone">
                  {(field) => (
                    <label class="grid gap-2 text-sm font-bold" for="checkout-recipient-phone">
                      Утасны дугаар
                      <Input
                        id="checkout-recipient-phone"
                        name={field().name}
                        type="tel"
                        inputmode="tel"
                        autocomplete="tel"
                        required
                        maxlength={20}
                        disabled={frozen()}
                        value={field().state.value}
                        onBlur={field().handleBlur}
                        onInput={(event) => field().handleChange(event.currentTarget.value)}
                        class="min-h-12 rounded-lg border border-[var(--line)] bg-white px-4 text-base font-normal placeholder:text-[var(--muted)] focus-visible:border-[var(--focus)] focus-visible:ring-3 focus-visible:ring-[color:var(--focus)]/20"
                        placeholder="9911 2233"
                      />
                    </label>
                  )}
                </form.Field>

                <form.Field name="deliveryAddress">
                  {(field) => (
                    <label class="grid gap-2 text-sm font-bold" for="checkout-delivery-address">
                      Хүргэлтийн хаяг
                      <Textarea
                        id="checkout-delivery-address"
                        name={field().name}
                        autocomplete="street-address"
                        required
                        maxlength={500}
                        rows={4}
                        disabled={frozen()}
                        value={field().state.value}
                        onBlur={field().handleBlur}
                        onInput={(event) => field().handleChange(event.currentTarget.value)}
                        class="min-h-28 resize-y rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-base font-normal leading-6 placeholder:text-[var(--muted)] focus-visible:border-[var(--focus)] focus-visible:ring-3 focus-visible:ring-[color:var(--focus)]/20"
                        placeholder="Дүүрэг, хороо, байр, орц, тоот"
                      />
                    </label>
                  )}
                </form.Field>

                <div class="border-y border-[var(--line)] bg-[var(--surface)] px-4 py-4 text-sm leading-6">
                  <strong class="block">Төлбөрийн хэлбэр</strong>
                  <span>
                    Зөвхөн банкны шилжүүлэг · төлбөр баталгаажих хүртэл захиалга хүлээгдэнэ.
                  </span>
                </div>

                <Button
                  class="min-h-12 w-full"
                  type="submit"
                  disabled={
                    quoteMutation.isPending ||
                    acceptedQuote() === undefined ||
                    placement.isPending ||
                    placement.data !== undefined
                  }
                >
                  {placement.isPending
                    ? "Захиалга үүсгэж байна…"
                    : pendingIntent()
                      ? "Ижил захиалгыг дахин илгээх"
                      : "Банкны шилжүүлгээр захиалах"}
                </Button>
              </form>

              <Show when={message()}>
                <p class="mt-4 mb-0 text-sm font-bold text-[var(--tomato)]" role="alert">
                  {message()}
                </p>
              </Show>
            </section>
          </div>
        </Show>
      }
    >
      {(order) => (
        <section
          class="border-y border-[var(--line)] bg-white px-5 py-10 sm:px-10 lg:grid lg:grid-cols-[1fr_auto] lg:items-end lg:gap-12 lg:px-14 lg:py-14"
          aria-live="polite"
        >
          <div>
            <p class="m-0 text-sm font-bold text-[var(--green)]">Захиалга амжилттай үүслээ</p>
            <h2 class="mt-2 mb-0 text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">
              Захиалга №{order.orderNumber}
            </h2>
            <p class="mt-4 mb-0 max-w-2xl text-base leading-7 text-[var(--muted)]">
              Нийт {money.format(order.totalMnt)} ₮-ийг банкны шилжүүлгээр төлөхдөө утга хэсэгт{" "}
              <strong class="text-[var(--ink)]">{order.orderNumber}</strong> гэж бичнэ үү. Төлбөр
              баталгаажмагц захиалгын төлөв шинэчлэгдэнэ.
            </p>
          </div>
          <a
            class="ui-button ui-button--primary mt-7 inline-flex min-h-12 items-center justify-center no-underline lg:mt-0"
            href={order.statusPath}
          >
            Захиалгын төлөв харах
          </a>
        </section>
      )}
    </Show>
  );
};

export const CheckoutIsland = (props: { readonly storageKey: string }) => {
  const queryClient = createStoreQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <CartProvider storageKey={props.storageKey}>
        <CheckoutForm />
      </CartProvider>
    </QueryClientProvider>
  );
};
