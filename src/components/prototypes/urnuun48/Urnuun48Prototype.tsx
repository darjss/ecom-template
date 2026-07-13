import ClipboardCheck from "lucide-solid/icons/clipboard-check";
import House from "lucide-solid/icons/house";
import Search from "lucide-solid/icons/search";
import ShoppingBag from "lucide-solid/icons/shopping-bag";
import { Match, Show, Switch, createSignal } from "solid-js";
import { CanaryView } from "./CanaryView";
import { CheckoutView } from "./CheckoutView";
import { HomeView } from "./HomeView";
import { ProductView } from "./ProductView";
import { SearchView } from "./SearchView";
import { StoreHeader } from "./StoreHeader";
import type { ReferenceProduct } from "./data";

type PrototypeView = "home" | "search" | "product" | "checkout" | "canaries";

const parseView = (value: string | null): PrototypeView => {
  if (value === "search" || value === "product" || value === "checkout" || value === "canaries") return value;
  return "home";
};

interface Urnuun48PrototypeProps {
  showPrototypeNav: boolean;
}

export const Urnuun48Prototype = (props: Urnuun48PrototypeProps) => {
  const params = new URLSearchParams(window.location.search);
  const [view, setView] = createSignal<PrototypeView>(parseView(params.get("view")));
  const [productId, setProductId] = createSignal(params.get("product") ?? "P07");
  const [query, setQuery] = createSignal(params.get("q") ?? "");
  const [cartCount, setCartCount] = createSignal(2);
  const [toast, setToast] = createSignal("");

  const navigate = (next: PrototypeView, extra: Record<string, string> = {}) => {
    const search = new URLSearchParams({ view: next, ...extra });
    window.history.replaceState({}, "", `${window.location.pathname}?${search.toString()}`);
    setView(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openProduct = (id: string) => { setProductId(id); navigate("product", { product: id }); };
  const add = (product?: ReferenceProduct) => {
    setCartCount((count) => count + 1);
    setToast(`${product?.shortName ?? "Сонголт"} сагсанд нэмэгдлээ`);
    window.setTimeout(() => setToast(""), 2200);
  };
  const search = () => navigate("search", query() ? { q: query() } : {});

  return (
    <div class="u48-shell">
      <a class="u48-skip" href="#main-content">Үндсэн хэсэг рүү очих</a>
      <StoreHeader cartCount={cartCount} query={query} onQuery={setQuery} onSearch={search} onCart={() => navigate("checkout")} />
      <Switch>
        <Match when={view() === "home"}><HomeView onOpen={openProduct} onAdd={add} /></Match>
        <Match when={view() === "search"}><SearchView query={query()} onOpen={openProduct} onAdd={add} /></Match>
        <Match when={view() === "product"}><ProductView productId={productId()} onAdd={() => add()} /></Match>
        <Match when={view() === "checkout"}><CheckoutView /></Match>
        <Match when={view() === "canaries"}><CanaryView /></Match>
      </Switch>
      <Show when={props.showPrototypeNav}><nav class="u48-prototype-nav" aria-label="Прототип харагдац"><button class={view() === "home" ? "is-active" : ""} onClick={() => navigate("home")}><House />Нүүр</button><button class={view() === "search" ? "is-active" : ""} onClick={search}><Search />Хайлт</button><button class={view() === "checkout" ? "is-active" : ""} onClick={() => navigate("checkout")}><ShoppingBag />Checkout</button><button class={view() === "canaries" ? "is-active" : ""} onClick={() => navigate("canaries")}><ClipboardCheck />Canaries</button></nav></Show>
      <Show when={toast()}><div class="u48-toast" role="status">{toast()}</div></Show>
    </div>
  );
};
