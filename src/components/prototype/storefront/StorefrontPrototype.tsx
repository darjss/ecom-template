import ArrowLeft from "lucide-solid/icons/arrow-left";
import ArrowRight from "lucide-solid/icons/arrow-right";
import { createMemo, createSignal, onCleanup, onMount, Show, Switch, Match } from "solid-js";
import { findProduct } from "./catalog";
import { ProductView } from "./ProductView";
import { SearchExperience, type SearchMode } from "./SearchExperience";
import { VariantA } from "./VariantA";
import { VariantB } from "./VariantB";
import { VariantC } from "./VariantC";
import "./storefront-prototype.css";

type VariantKey = "A" | "B" | "C";

type StorefrontPrototypeProps = {
  initialVariant: string;
  productSlug?: string;
};

const variants: readonly VariantKey[] = ["A", "B", "C"];
const names: Record<VariantKey, string> = {
  A: "Product theatre",
  B: "Catalog momentum",
  C: "Guided collections",
};
const modes: Record<VariantKey, SearchMode> = {
  A: "shelf",
  B: "overlay",
  C: "canvas",
};

const normalizeVariant = (value: string): VariantKey => {
  if (value === "B" || value === "C") return value;
  return "A";
};

export const StorefrontPrototype = (props: StorefrontPrototypeProps) => {
  const [variant, setVariant] = createSignal<VariantKey>(normalizeVariant(props.initialVariant));
  const [searchOpen, setSearchOpen] = createSignal(false);
  const product = createMemo(() => findProduct(props.productSlug));

  const chooseVariant = (next: VariantKey) => {
    setVariant(next);
    setSearchOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.set("variant", next);
    window.history.replaceState({}, "", url);
  };

  const cycle = (direction: number) => {
    const current = variants.indexOf(variant());
    const next = variants[(current + direction + variants.length) % variants.length];
    if (next) chooseVariant(next);
  };

  onMount(() => {
    const cycleWithKeyboard = (event: KeyboardEvent) => {
      if (searchOpen()) return;
      const target = event.target;
      if (target instanceof HTMLElement) {
        const editing = target.matches("input, textarea, [contenteditable='true']");
        if (editing) return;
      }
      if (event.key === "ArrowLeft") cycle(-1);
      if (event.key === "ArrowRight") cycle(1);
    };
    window.addEventListener("keydown", cycleWithKeyboard);
    onCleanup(() => window.removeEventListener("keydown", cycleWithKeyboard));
  });

  return (
    <div class="khev-prototype">
      <a class="khev-skip-link" href="#prototype-main">Үндсэн хэсэг рүү очих</a>
      <div id="prototype-main" inert={searchOpen()}>
        <Show
          when={product()}
          fallback={
            <Switch>
              <Match when={variant() === "A"}><VariantA variant={variant()} onSearch={() => setSearchOpen(true)} /></Match>
              <Match when={variant() === "B"}><VariantB variant={variant()} onSearch={() => setSearchOpen(true)} /></Match>
              <Match when={variant() === "C"}><VariantC variant={variant()} onSearch={() => setSearchOpen(true)} /></Match>
            </Switch>
          }
        >
          {(selected) => <ProductView product={selected()} variant={variant()} onSearch={() => setSearchOpen(true)} />}
        </Show>
      </div>

      <Show when={searchOpen()}>
        <SearchExperience mode={modes[variant()]} variant={variant()} onClose={() => setSearchOpen(false)} />
      </Show>

      <Show when={!searchOpen()}>
        <nav class="khev-switcher" aria-label="Прототипын хувилбар сонгох">
          <button type="button" onClick={() => cycle(-1)} aria-label="Өмнөх хувилбар"><ArrowLeft aria-hidden="true" /></button>
          <span><small>ПРОТОТИП</small><strong>{variant()} · {names[variant()]}</strong></span>
          <button type="button" onClick={() => cycle(1)} aria-label="Дараагийн хувилбар"><ArrowRight aria-hidden="true" /></button>
        </nav>
      </Show>
    </div>
  );
};
