import ArrowRight from "lucide-solid/icons/arrow-right";
import Search from "lucide-solid/icons/search";
import X from "lucide-solid/icons/x";
import { createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { categories, collections, formatPrice, products } from "./catalog";

export type SearchMode = "shelf" | "overlay" | "canvas";

type SearchExperienceProps = {
  mode: SearchMode;
  variant: string;
  onClose: () => void;
};

const normalize = (value: string) => value.trim().toLocaleLowerCase("mn-MN");

export const SearchExperience = (props: SearchExperienceProps) => {
  const [query, setQuery] = createSignal("");
  let input: HTMLInputElement | undefined;
  const term = createMemo(() => normalize(query()));
  const matches = createMemo(() => {
    if (!term()) return products.slice(0, 4);
    return products.filter((product) =>
      normalize(
        [product.name, product.category, product.collection, ...product.tags].join(" "),
      ).includes(term()),
    );
  });
  const categoryMatches = createMemo(() =>
    term() ? categories.filter((category) => normalize(category).includes(term())) : categories.slice(0, 3),
  );
  const collectionMatches = createMemo(() =>
    term()
      ? collections.filter((collection) => normalize(collection).includes(term()))
      : collections.slice(0, 3),
  );

  onMount(() => {
    input?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    onCleanup(() => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    });
  });

  return (
    <section
      class={`khev-search khev-search-${props.mode}`}
      role="dialog"
      aria-modal={props.mode !== "shelf"}
      aria-label="Бүтээгдэхүүн хайх"
    >
      <div class="khev-search-inner">
        <div class="khev-search-bar">
          <Search aria-hidden="true" />
          <label class="sr-only" for="prototype-search">
            Хайх
          </label>
          <input
            id="prototype-search"
            ref={input}
            type="search"
            value={query()}
            onInput={(event) => setQuery(event.currentTarget.value)}
            placeholder="Хүрэм, цамц, коллекц хайх"
            autocomplete="off"
          />
          <button type="button" class="khev-icon-button" onClick={props.onClose} aria-label="Хайлтыг хаах">
            <X aria-hidden="true" />
          </button>
        </div>

        <Show
          when={matches().length > 0 || categoryMatches().length > 0 || collectionMatches().length > 0}
          fallback={
            <div class="khev-no-results">
              <p class="khev-kicker">Илэрц олдсонгүй</p>
              <h2>Өөр үгээр хайгаад үзээрэй.</h2>
              <button type="button" onClick={() => setQuery("")}>Шинэ бүтээгдэхүүн үзэх</button>
            </div>
          }
        >
          <div class="khev-search-results" aria-live="polite">
            <aside class="khev-search-groups">
              <div>
                <p class="khev-kicker">Ангилал</p>
                <For each={categoryMatches()}>
                  {(category) => <button type="button" onClick={() => setQuery(category)}>{category}</button>}
                </For>
              </div>
              <div>
                <p class="khev-kicker">Коллекц</p>
                <For each={collectionMatches()}>
                  {(collection) => <button type="button" onClick={() => setQuery(collection)}>{collection}</button>}
                </For>
              </div>
            </aside>
            <div class="khev-search-products">
              <p class="khev-kicker">{term() ? `${matches().length} бүтээгдэхүүн` : "Одоо эрэлттэй"}</p>
              <For each={matches()}>
                {(product) => (
                  <a href={`/prototype/storefront/${product.slug}?variant=${props.variant}`}>
                    <img src={product.image} alt="" width="140" height="180" />
                    <span>
                      <strong>{product.name}</strong>
                      <small>{formatPrice(product.price)}</small>
                    </span>
                    <ArrowRight aria-hidden="true" />
                  </a>
                )}
              </For>
            </div>
          </div>
        </Show>
      </div>
    </section>
  );
};
