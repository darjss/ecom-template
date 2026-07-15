import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import { array, number, object, parse, string } from "valibot";

interface SearchProduct {
  id: string;
  slug: string;
  name: string;
  description: string;
  price_mnt: number;
}

const searchSchema = object({
  products: array(
    object({ id: string(), slug: string(), name: string(), description: string(), price_mnt: number() }),
  ),
});

export const LiveSearch = () => {
  const [query, setQuery] = createSignal("");
  const [products, setProducts] = createSignal<SearchProduct[]>([]);
  const [status, setStatus] = createSignal<"idle" | "searching" | "ready" | "failed">("idle");

  createEffect(() => {
    const value = query().trim();
    if (value.length < 2) {
      setProducts([]);
      setStatus("idle");
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setStatus("searching");
      void fetch(`/api/prototype/search?q=${encodeURIComponent(value)}`, {
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error("search failed");
          const result = parse(searchSchema, await response.json());
          setProducts(result.products);
          setStatus("ready");
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setStatus("failed");
        });
    }, 180);

    onCleanup(() => {
      window.clearTimeout(timeout);
      controller.abort();
    });
  });

  return (
    <section class="proof-search" aria-labelledby="search-title">
      <p class="proof-eyebrow">No-store search</p>
      <h2 id="search-title">Каталог хайх</h2>
      <label for="catalog-search">Бүтээгдэхүүн</label>
      <input
        id="catalog-search"
        type="search"
        placeholder="Жишээ нь аяга"
        value={query()}
        onInput={(event) => setQuery(event.currentTarget.value)}
      />
      <p class="proof-live" aria-live="polite">
        <Show when={status() === "idle"}>Хоёр ба түүнээс олон үсэг бичнэ үү.</Show>
        <Show when={status() === "searching"}>Хайж байна…</Show>
        <Show when={status() === "failed"}>Хайлтыг шинэчилж чадсангүй.</Show>
        <Show when={status() === "ready"}>{products().length} үр дүн</Show>
      </p>
      <ul>
        <For each={products()}>
          {(product) => (
            <li>
              <a href={`/prototype/products/${product.slug}`}>{product.name}</a>
              <span>{new Intl.NumberFormat("mn-MN").format(product.price_mnt)} ₮</span>
            </li>
          )}
        </For>
      </ul>
    </section>
  );
};
