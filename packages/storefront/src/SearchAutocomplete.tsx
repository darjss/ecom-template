import { catalogSearchQueryOptions, createStoreQueryClient } from "@ecom/client";
import { QueryClientProvider, createQuery } from "@tanstack/solid-query";
import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";

type Props = { readonly initialQuery: string };

const navigate = (href: string) => window.location.assign(href);

const SearchAutocompleteField = (props: Props) => {
  const [value, setValue] = createSignal(props.initialQuery);
  const [debounced, setDebounced] = createSignal("");
  const [activeIndex, setActiveIndex] = createSignal(-1);
  let timer: number | undefined;

  createEffect(() => {
    const next = value().trim();
    window.clearTimeout(timer);
    timer = window.setTimeout(() => setDebounced(next.length >= 2 ? next : ""), 180);
  });
  onCleanup(() => window.clearTimeout(timer));

  const query = createQuery(() => ({
    ...catalogSearchQueryOptions({ query: debounced(), page: 1, limit: 6 }),
    enabled: debounced().length >= 2,
  }));
  const choices = () => [
    ...(query.data?.results.items ?? []).map((item) => ({
      id: item.id,
      label: item.name,
      detail: item.kind === "product" ? "Бүтээгдэхүүн" : "Багц",
      href: `/${item.kind === "product" ? "products" : "bundles"}/${item.slug}`,
    })),
    ...(query.data
      ? [...query.data.shortcuts.categories, ...query.data.shortcuts.collections]
          .slice(0, 3)
          .map((shortcut) => ({
            id: shortcut.id,
            label: shortcut.label,
            detail: shortcut.kind === "category" ? "Ангилал" : "Цуглуулга",
            href: shortcut.url,
          }))
      : []),
  ];
  const onKeyDown = (event: KeyboardEvent) => {
    const count = choices().length;
    if (event.key === "ArrowDown" && count) {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % count);
    } else if (event.key === "ArrowUp" && count) {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? count - 1 : index - 1));
    } else if (event.key === "Escape") {
      setDebounced("");
      setActiveIndex(-1);
    } else if (event.key === "Enter" && activeIndex() >= 0) {
      const choice = choices()[activeIndex()];
      if (choice) {
        event.preventDefault();
        navigate(choice.href);
      }
    }
  };

  return (
    <div class="relative flex-1">
      <label class="sr-only" for="catalog-search-input">
        Каталогоос хайх
      </label>
      <input
        id="catalog-search-input"
        name="q"
        type="search"
        role="combobox"
        autocomplete="off"
        aria-autocomplete="list"
        aria-controls="catalog-search-suggestions"
        aria-expanded={debounced().length >= 2 && (query.isLoading || choices().length > 0)}
        aria-activedescendant={
          activeIndex() >= 0 ? `catalog-search-choice-${activeIndex()}` : undefined
        }
        value={value()}
        onInput={(event) => {
          setValue(event.currentTarget.value);
          setActiveIndex(-1);
        }}
        onKeyDown={onKeyDown}
        placeholder="Нэр эсвэл SKU"
        class="h-12 w-full rounded-lg border border-[var(--line)] bg-white px-4 text-base text-[var(--ink)] outline-none placeholder:text-stone-600 focus-visible:ring-3 focus-visible:ring-blue-600"
      />
      <Show when={debounced().length >= 2}>
        <div
          id="catalog-search-suggestions"
          role="listbox"
          aria-label="Хайлтын санал"
          class="absolute inset-x-0 top-[calc(100%+0.5rem)] z-20 overflow-hidden rounded-lg border border-[var(--line)] bg-white shadow-xl"
        >
          <Show when={query.isLoading}>
            <p class="m-0 px-4 py-3 text-sm text-stone-700" role="status">
              Хайж байна…
            </p>
          </Show>
          <Show when={query.isError}>
            <p class="m-0 px-4 py-3 text-sm text-red-800" role="alert">
              Санал ачаалж чадсангүй.
            </p>
          </Show>
          <For each={choices()}>
            {(choice, index) => (
              <button
                id={`catalog-search-choice-${index()}`}
                type="button"
                role="option"
                aria-selected={activeIndex() === index()}
                class="flex min-h-12 w-full items-center justify-between gap-4 border-0 border-b border-[var(--line)] bg-white px-4 py-3 text-left text-[var(--ink)] last:border-b-0 hover:bg-amber-50 focus-visible:outline-3 focus-visible:outline-blue-600 aria-selected:bg-amber-100"
                onMouseEnter={() => setActiveIndex(index())}
                onClick={() => navigate(choice.href)}
              >
                <span class="font-bold">{choice.label}</span>
                <span class="text-sm text-stone-700">{choice.detail}</span>
              </button>
            )}
          </For>
          <Show when={!query.isLoading && !query.isError && choices().length === 0}>
            <p class="m-0 px-4 py-3 text-sm text-stone-700" role="status">
              Санал олдсонгүй.
            </p>
          </Show>
        </div>
      </Show>
    </div>
  );
};

export const SearchAutocomplete = (props: Props) => {
  const queryClient = createStoreQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <SearchAutocompleteField initialQuery={props.initialQuery} />
    </QueryClientProvider>
  );
};
