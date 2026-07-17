import { catalogQueryOptions } from "@ecom/client";
import { Button } from "@ecom/ui";
import { useQuery } from "@tanstack/solid-query";
import { For, Show } from "solid-js";
import { CatalogProductRow } from "./CatalogProductRow";
import { CreateProductForm } from "./CreateProductForm";

export const CatalogManagement = () => {
  const catalog = useQuery(() => catalogQueryOptions());
  return (
    <section class="border-t border-black/15" aria-labelledby="catalog-title">
      <div class="flex flex-col items-start justify-between gap-4 py-8 md:flex-row md:gap-8">
        <div>
          <h2 id="catalog-title" class="m-0 text-xl font-bold tracking-tight">
            Бүтээгдэхүүн ба нөөц
          </h2>
          <p class="mt-2 mb-0 max-w-prose text-(--muted)">
            Default Variant, байнгын SKU болон шалтгаант үлдэгдлийг нэг дор удирдана.
          </p>
        </div>
        <span class="rounded-full bg-(--surface) px-2.5 py-1.5 text-xs font-bold whitespace-nowrap">
          {catalog.data?.data.length ?? 0} бүтээгдэхүүн
        </span>
      </div>
      <CreateProductForm />
      <Show
        when={!catalog.isError}
        fallback={
          <div role="alert">
            <p>
              Каталогийг ачаалж чадсангүй. Сүлжээ болон Store үйлчилгээг шалгаад дахин оролдоно уу.
            </p>
            <Button
              type="button"
              variant="secondary"
              disabled={catalog.isFetching}
              onClick={() => void catalog.refetch()}
            >
              Дахин ачаалах
            </Button>
          </div>
        }
      >
        <Show
          when={catalog.isSuccess ? catalog.data : undefined}
          keyed
          fallback={<p role="status">Каталог ачаалж байна…</p>}
        >
          {(data) => (
            <Show when={data.data.length > 0} fallback={<p>Анхны бүтээгдэхүүнээ үүсгэнэ үү.</p>}>
              <ul class="m-0 list-none border-b border-black/15 p-0">
                <For each={data.data}>{(product) => <CatalogProductRow product={product} />}</For>
              </ul>
            </Show>
          )}
        </Show>
      </Show>
    </section>
  );
};
