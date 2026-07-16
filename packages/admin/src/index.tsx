import { createStoreQueryClient, healthQueryOptions } from "@ecom/client";
import { Button } from "@ecom/ui";
import { QueryClientProvider, useQuery } from "@tanstack/solid-query";
import { For, Show } from "solid-js";

const navigation = ["Тойм", "Захиалга", "Бараа", "Агуулга"];

const Dashboard = () => {
  const health = useQuery(() => healthQueryOptions());
  return (
    <div class="admin-shell">
      <aside class="admin-sidebar" aria-label="Үндсэн цэс">
        <a class="admin-brand" href="/">
          Өрнүүн 48
        </a>
        <nav>
          <For each={navigation}>
            {(item, index) => (
              <a classList={{ active: index() === 0 }} href={`/admin?view=${index()}`}>
                {item}
              </a>
            )}
          </For>
        </nav>
        <a class="store-link" href="/">
          Дэлгүүр рүү очих
        </a>
      </aside>
      <main class="admin-main" tabindex="-1">
        <header>
          <div>
            <p class="eyebrow">Өнөөдөр</p>
            <h1>Дэлгүүрийн тойм</h1>
          </div>
          <Button>Шинэ бараа</Button>
        </header>
        <section class="attention" aria-labelledby="attention-title">
          <div>
            <p class="eyebrow">Анхаарах зүйл</p>
            <h2 id="attention-title">Өнөөдрийн ажил цэгцтэй байна</h2>
            <p>Шинэ захиалга орж ирэхэд энд хамгийн түрүүнд харагдана.</p>
          </div>
          <span class="status-dot">0 хүлээгдэж буй</span>
        </section>
        <section class="operations" aria-labelledby="operations-title">
          <div>
            <p class="eyebrow">Систем</p>
            <h2 id="operations-title">Үйлчилгээний төлөв</h2>
          </div>
          <Show when={health.data} fallback={<span class="health pending">Шалгаж байна</span>}>
            {(data) => (
              <span class="health ready">
                {data().data.database === "connected" ? "Хэвийн" : "Сааталтай"}
              </span>
            )}
          </Show>
        </section>
      </main>
    </div>
  );
};

export const AdminApp = () => (
  <QueryClientProvider client={createStoreQueryClient()}>
    <Dashboard />
  </QueryClientProvider>
);
