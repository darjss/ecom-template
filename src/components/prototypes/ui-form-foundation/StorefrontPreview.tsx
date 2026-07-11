import Eye from "lucide-solid/icons/eye";
import type { ProductEditorController } from "./product-controller";
import { themeStyle, urnuuTheme } from "./storefront-theme";

const price = (value: number) => `${new Intl.NumberFormat("mn-MN").format(value)} ₮`;

const CardiganFigure = () => (
  <svg viewBox="0 0 320 360" aria-labelledby="cardigan-figure-title" class="h-full w-full">
    <title id="cardigan-figure-title">Ноолууран кардиганы дүрслэл</title>
    <path
      d="M92 66 48 104l28 64 28-15v138h112V153l28 15 28-64-44-38-39-20c-9 18-20 27-29 27s-20-9-29-27L92 66Z"
      fill="oklch(0.76 0.055 63)"
      stroke="oklch(0.35 0.05 52)"
      stroke-width="3"
    />
    <path
      d="M160 73v218M126 48l34 25 34-25"
      fill="none"
      stroke="oklch(0.35 0.05 52)"
      stroke-width="3"
    />
    <circle cx="148" cy="118" r="3" fill="oklch(0.35 0.05 52)" />
    <circle cx="148" cy="154" r="3" fill="oklch(0.35 0.05 52)" />
    <circle cx="148" cy="190" r="3" fill="oklch(0.35 0.05 52)" />
  </svg>
);

export const StorefrontPreview = (props: { controller: ProductEditorController }) => {
  const values = props.controller.merchant.values;
  return (
    <section
      data-storefront-theme="urnuu"
      style={themeStyle(urnuuTheme)}
      class="overflow-hidden rounded-[var(--storefront-radius)] bg-[var(--storefront-surface)] text-[var(--storefront-text)]"
      aria-labelledby="storefront-preview-title"
    >
      <header class="flex items-center justify-between border-b border-[color:var(--storefront-text)]/15 px-5 py-4">
        <span style="font-family:var(--storefront-font-display)" class="text-xl tracking-[0.16em]">
          ӨРНҮҮ
        </span>
        <span class="flex items-center gap-1.5 text-xs text-[var(--storefront-text-muted)]">
          <Eye class="size-3.5" /> Урьдчилсан харагдац
        </span>
      </header>
      <div class="grid gap-5 p-5">
        <div class="aspect-[4/4.3] overflow-hidden rounded-[var(--storefront-radius)] bg-[var(--storefront-surface-raised)] p-5">
          <CardiganFigure />
        </div>
        <div class="grid gap-3">
          <div class="flex items-center justify-between gap-3 text-xs font-medium tracking-wide uppercase">
            <span class="text-[var(--storefront-text-muted)]">{values().category}</span>
            <span class="rounded-full border border-current px-2 py-1">
              {values().published ? "Нийтлэгдэнэ" : "Ноорог"}
            </span>
          </div>
          <h2
            id="storefront-preview-title"
            style="font-family:var(--storefront-font-display)"
            class="text-2xl leading-tight"
          >
            {values().name || "Бүтээгдэхүүний нэр"}
          </h2>
          <p class="text-lg font-semibold tabular-nums">{price(values().price)}</p>
          <p class="text-sm leading-6 text-[var(--storefront-text-muted)]">
            {values().description || "Дэлгүүрийн товч тайлбар энд харагдана."}
          </p>
        </div>
      </div>
    </section>
  );
};
