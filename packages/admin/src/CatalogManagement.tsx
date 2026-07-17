import { catalogQueryOptions } from "@ecom/client";
import { Button } from "@ecom/ui";
import { useQuery } from "@tanstack/solid-query";
import { For, Show } from "solid-js";
import { CatalogProductRow } from "./CatalogProductRow";
import { CreateProductForm } from "./CreateProductForm";

export const CatalogManagement = () => {
  const catalog = useQuery(() => catalogQueryOptions());
  return (
    <section class="staff-management catalog-management" aria-labelledby="catalog-title">
      <div class="section-heading">
        <div>
          <h2 id="catalog-title">Бүтээгдэхүүн ба нөөц</h2>
          <p>Default Variant, байнгын SKU болон шалтгаант үлдэгдлийг нэг дор удирдана.</p>
        </div>
        <span class="staff-count">{catalog.data?.data.length ?? 0} бүтээгдэхүүн</span>
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
              <ul class="staff-list">
                <For each={data.data}>{(product) => <CatalogProductRow product={product} />}</For>
              </ul>
            </Show>
          )}
        </Show>
      </Show>
    </section>
  );
};
