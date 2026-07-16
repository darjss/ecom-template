import { createStoreQueryClient, healthQueryOptions } from "@ecom/client";
import { Route, Router } from "@solidjs/router";
import { QueryClientProvider, useQuery } from "@tanstack/solid-query";
import { Show } from "solid-js";
export { StaffLoginForm } from "./StaffLoginForm";

const Dashboard = () => {
  const health = useQuery(() => healthQueryOptions());
  return (
    <div class="admin-shell">
      <aside class="admin-sidebar" aria-label="Үндсэн цэс">
        <a class="admin-brand" href="/">
          Өрнүүн 48
        </a>
        <nav>
          <a class="active" aria-current="page" href="/admin">
            Тойм
          </a>
        </nav>
        <a class="store-link" href="/">
          Дэлгүүр рүү очих
        </a>
      </aside>
      <main id="admin-content" class="admin-main" tabindex="-1">
        <header>
          <div>
            <p class="eyebrow">Өнөөдөр</p>
            <h1>Дэлгүүрийн төлөв</h1>
          </div>
        </header>
        <section class="attention" aria-labelledby="attention-title">
          <div>
            <p class="eyebrow">Bootstrap</p>
            <h2 id="attention-title">Үйл ажиллагааны суурь бэлэн</h2>
            <p>Худалдааны боломжууд дараагийн батлагдсан ажлуудаар нэмэгдэнэ.</p>
          </div>
        </section>
        <section class="operations" aria-labelledby="operations-title">
          <div>
            <p class="eyebrow">Систем</p>
            <h2 id="operations-title">Үйлчилгээний төлөв</h2>
          </div>
          <Show when={!health.isError} fallback={<span class="health unavailable">Сааталтай</span>}>
            <Show when={health.data} fallback={<span class="health pending">Шалгаж байна</span>}>
              <span class="health ready">Хэвийн</span>
            </Show>
          </Show>
        </section>
      </main>
    </div>
  );
};

const AdminRoutes = () => (
  <Router>
    <Route path="/*" component={Dashboard} />
  </Router>
);

export const AdminApp = () => (
  <QueryClientProvider client={createStoreQueryClient()}>
    <AdminRoutes />
  </QueryClientProvider>
);
