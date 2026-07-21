import { createStoreQueryClient, healthQueryOptions } from "@ecom/client";
import { QueryClientProvider, useQuery } from "@tanstack/solid-query";
import { Show } from "solid-js";
import { CatalogManagement } from "./CatalogManagement";
import { CmsManagement } from "./CmsManagement";
import { DiscountManagement } from "./DiscountManagement";
import { GroupingManagement } from "./GroupingManagement";

export { StaffLoginForm } from "./StaffLoginForm";

const HealthStatus = () => {
  const health = useQuery(() => healthQueryOptions());
  return (
    <Show
      when={!health.isError}
      fallback={
        <span class="rounded-full bg-red-200 px-3 py-2 text-xs font-bold whitespace-nowrap">
          Сааталтай
        </span>
      }
    >
      <Show
        when={health.data}
        fallback={
          <span class="rounded-full bg-(--surface) px-3 py-2 text-xs font-bold whitespace-nowrap">
            Шалгаж байна
          </span>
        }
      >
        <span class="rounded-full bg-green-200 px-3 py-2 text-xs font-bold whitespace-nowrap">
          Хэвийн
        </span>
      </Show>
    </Show>
  );
};

export type AdminAppProps = { storeName: string; store: string };

const Dashboard = (props: AdminAppProps) => (
  <div class="grid min-h-screen grid-cols-1 md:grid-cols-[15rem_1fr]">
    <aside
      class="sticky top-0 z-20 grid min-w-0 grid-cols-[1fr_auto] bg-(--ink) px-4 py-3 text-stone-100 md:static md:flex md:flex-col md:px-4 md:py-6"
      aria-label="Үндсэн цэс"
    >
      <a class="self-center font-extrabold no-underline md:mx-3 md:mt-2 md:mb-10" href="/">
        {props.storeName}
      </a>
      <nav class="order-3 col-span-full mt-3 flex min-w-0 max-w-full gap-1 overflow-x-auto md:order-none md:mt-0 md:grid">
        <a
          class="rounded-xl bg-white/10 px-3 py-3 text-sm no-underline hover:bg-white/10"
          aria-current="page"
          href="/admin"
        >
          Удирдлагын самбар
        </a>
      </nav>
      <a
        class="col-start-2 row-start-1 p-2 text-sm text-stone-300 no-underline md:mt-auto md:p-3"
        href="/"
      >
        Дэлгүүр рүү очих
      </a>
    </aside>
    <main id="admin-content" class="min-w-0 p-6 sm:p-10 lg:p-20" tabindex="-1">
      <header class="mb-8 flex flex-col items-start justify-between gap-4 md:mb-20 md:flex-row md:items-center">
        <div>
          <p class="mb-2 text-xs font-extrabold tracking-widest text-(--muted) uppercase">
            Удирдлага
          </p>
          <h1 class="m-0 text-4xl font-bold tracking-tight sm:text-6xl">Удирдлагын самбар</h1>
        </div>
        <div class="flex items-center gap-3 text-sm text-(--muted)">
          <span>Систем</span>
          <HealthStatus />
        </div>
      </header>
      <CmsManagement store={props.store} />
      <CatalogManagement />
      <GroupingManagement />
      <DiscountManagement />
    </main>
  </div>
);

export const AdminApp = (props: AdminAppProps) => {
  const queryClient = createStoreQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard store={props.store} storeName={props.storeName} />
    </QueryClientProvider>
  );
};

export const AdminHealthStatus = () => {
  const queryClient = createStoreQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <HealthStatus />
    </QueryClientProvider>
  );
};
