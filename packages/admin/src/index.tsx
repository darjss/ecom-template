import { createStoreQueryClient, healthQueryOptions } from "@ecom/client";
import { QueryClientProvider, useQuery } from "@tanstack/solid-query";
import { Show } from "solid-js";
import { CatalogManagement } from "./CatalogManagement";
import { CmsManagement } from "./CmsManagement";
import { DiscountManagement } from "./DiscountManagement";
import { GroupingManagement } from "./GroupingManagement";

export { resolveAdminSurface, type AdminSurface } from "./access";
export { AdminOrderDetail, AdminOrderInbox } from "./OrderManagement";
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

export type AdminManagementProps = { store: string; role: "owner" };

const Management = (props: AdminManagementProps) => (
  <>
    <CmsManagement store={props.store} />
    <CatalogManagement />
    <GroupingManagement />
    <DiscountManagement />
  </>
);

export const AdminManagement = (props: AdminManagementProps) => {
  const queryClient = createStoreQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <Management role={props.role} store={props.store} />
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
