import { availabilityFreshnessMs, availabilityQueryOptions, useCart } from "@ecom/client";
import type { CartLine } from "@ecom/contracts";
import { Button, Input } from "@ecom/ui";
import { useQueryClient } from "@tanstack/solid-query";
import { createMemo, createSignal, For, Show } from "solid-js";
import { resolveCartEditDemand } from "./purchase-demand";

const money = new Intl.NumberFormat("mn-MN");

export type CartCatalogEntry = {
  readonly kind: "variant" | "bundle";
  readonly id: string;
  readonly name: string;
  readonly href: string;
  readonly sku: string;
  readonly optionLabel: string;
  readonly priceMnt: number;
  readonly image: {
    readonly mediaAssetId: string;
    readonly altText: string;
  } | null;
};

type CartPresentationProps = {
  readonly catalog: readonly CartCatalogEntry[];
};

const lineKey = (line: CartLine) =>
  `${line.kind}:${line.kind === "variant" ? line.variantId : line.bundleId}`;

export const CartPresentation = (props: CartPresentationProps) => {
  const cart = useCart();
  const queryClient = useQueryClient();
  const [announcement, setAnnouncement] = createSignal("");
  const [checking, setChecking] = createSignal(false);
  const catalog = createMemo(
    () => new Map(props.catalog.map((entry) => [`${entry.kind}:${entry.id}`, entry])),
  );
  const subtotalMnt = createMemo(() => {
    let total = 0;
    for (const line of cart.lines()) {
      total += (catalog().get(lineKey(line))?.priceMnt ?? 0) * line.quantity;
    }
    return total;
  });
  const hasMissingCatalogEntry = createMemo(() => {
    for (const line of cart.lines()) {
      if (!catalog().has(lineKey(line))) {
        return true;
      }
    }
    return false;
  });
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
    <>
      <Show when={cart.recovery()} keyed>
        {(recovery) => (
          <div class="mb-5 rounded-lg border border-(--accent) bg-white p-4" role="alert">
            <p class="m-0">{recovery.message}</p>
            <Button type="button" class="mt-3" onClick={cart.reset}>
              Сагсыг шинэчлэх
            </Button>
          </div>
        )}
      </Show>
      <Show
        when={cart.lines().length > 0}
        fallback={
          <section
            class="border-y border-black/15 py-14 text-center"
            aria-labelledby="empty-cart-title"
          >
            <h2 id="empty-cart-title" class="m-0 text-2xl font-extrabold tracking-tight">
              Сагс хоосон байна
            </h2>
            <p class="mx-auto mt-3 mb-6 max-w-md text-(--muted)">
              Өдөр тутмын тавиураас хэрэгтэй бараагаа сонгоод энд буцаж ирээрэй.
            </p>
            <a
              class="inline-flex min-h-12 items-center rounded-lg bg-(--accent) px-5 font-bold text-(--accent-ink) no-underline transition-transform duration-150 active:scale-97"
              href="/#featured"
            >
              Бүтээгдэхүүн үзэх
            </a>
          </section>
        }
      >
        <section aria-labelledby="cart-lines-title">
          <div class="flex flex-wrap items-end justify-between gap-4 border-b border-black/15 pb-5">
            <div>
              <h2 id="cart-lines-title" class="m-0 text-2xl font-extrabold tracking-tight">
                Сонгосон бараа
              </h2>
              <p class="mt-2 mb-0 text-sm text-(--muted)">
                {cart.itemCount()} ширхэг · Каталогийн дүн {money.format(subtotalMnt())} ₮
              </p>
            </div>
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
          </div>
          <ul class="m-0 grid list-none p-0">
            <For each={cart.lines()}>
              {(line) => {
                const entry = () => catalog().get(lineKey(line));
                return (
                  <li class="grid grid-cols-[6rem_minmax(0,1fr)] gap-4 border-b border-black/15 py-5 sm:grid-cols-[8rem_minmax(0,1fr)_auto] sm:items-center sm:gap-6">
                    <Show
                      when={entry()?.image}
                      fallback={
                        <div
                          class="aspect-square bg-(--surface)"
                          aria-label="Бүтээгдэхүүний зураг алга"
                        />
                      }
                      keyed
                    >
                      {(image) => (
                        <img
                          class="aspect-square w-full rounded-lg object-cover"
                          src={`/media/${image.mediaAssetId}/320.webp`}
                          alt={image.altText}
                          width="320"
                          height="320"
                        />
                      )}
                    </Show>
                    <div class="min-w-0 self-center">
                      <Show
                        when={entry()}
                        fallback={
                          <>
                            <strong class="block">Мэдээлэл нь шинэчлэгдсэн бараа</strong>
                            <p class="mt-1 mb-0 text-sm text-(--muted)">
                              Арилгаад каталогоос дахин сонгоно уу.
                            </p>
                          </>
                        }
                        keyed
                      >
                        {(catalogEntry) => (
                          <>
                            <a
                              class="text-lg font-extrabold tracking-tight underline decoration-transparent underline-offset-4 hover:decoration-current"
                              href={catalogEntry.href}
                            >
                              {catalogEntry.name}
                            </a>
                            <p class="mt-1 mb-0 text-sm text-(--muted)">
                              {catalogEntry.optionLabel} · {catalogEntry.sku}
                            </p>
                            <p class="mt-2 mb-0 font-bold tabular-nums">
                              {money.format(catalogEntry.priceMnt)} ₮
                            </p>
                          </>
                        )}
                      </Show>
                    </div>
                    <div class="col-span-2 flex flex-wrap items-end justify-between gap-3 sm:col-span-1 sm:justify-end">
                      <label class="grid gap-1 text-sm font-bold">
                        Тоо
                        <Input
                          class="h-11 w-20 rounded-lg border border-black/30 bg-white px-3 tabular-nums focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-(--focus)"
                          type="number"
                          min="1"
                          max="999"
                          value={line.quantity}
                          disabled={checking()}
                          onChange={(event) => void updateQuantity(line, event.currentTarget)}
                        />
                      </label>
                      <Show when={entry()} keyed>
                        {(catalogEntry) => (
                          <strong class="min-w-28 text-right text-lg tabular-nums">
                            {money.format(catalogEntry.priceMnt * line.quantity)} ₮
                          </strong>
                        )}
                      </Show>
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
                    </div>
                  </li>
                );
              }}
            </For>
          </ul>
          <p class="sr-only" aria-live="polite" aria-atomic="true">
            {announcement()}
          </p>
        </section>
        <Show
          when={!hasMissingCatalogEntry()}
          fallback={
            <p class="mt-6 border-y border-black/15 py-5 font-bold" role="alert">
              Мэдээлэл нь шинэчлэгдсэн барааг арилгасны дараа захиалгын дүнг тооцоолно.
            </p>
          }
        >
          <div class="mt-8 flex flex-col gap-4 border-t border-black/15 pt-6 sm:items-end">
            <p class="m-0 max-w-xl text-sm text-(--muted) sm:text-right">
              Эцсийн үнэ, үлдэгдэл, хүргэлтийн дүнг дараагийн алхамд серверээс баталгаажуулна.
            </p>
            <a
              class="inline-flex min-h-12 items-center justify-center rounded-lg bg-(--accent) px-5 font-bold text-(--accent-ink) no-underline transition-transform duration-150 active:scale-97"
              href="/checkout"
            >
              Захиалга баталгаажуулах
            </a>
          </div>
        </Show>
      </Show>
    </>
  );
};
