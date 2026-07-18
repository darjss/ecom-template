import {
  createStoreQueryClient,
  healthQueryOptions,
  staffMutationOptions,
  staffQueryOptions,
} from "@ecom/client";
import {
  StaffRoleSchema,
  type StaffClientError,
  type StaffMember,
  type StaffRole,
} from "@ecom/contracts";
import { Button } from "@ecom/ui";
import { createForm } from "@tanstack/solid-form";
import { QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/solid-query";
import { createSignal, For, Show } from "solid-js";
import * as v from "valibot";
import { resolveAdminSurface } from "./access";
import { BundleManagement } from "./BundleManagement";
import { CatalogManagement } from "./CatalogManagement";
import { CmsManagement } from "./CmsManagement";
import { GroupingManagement } from "./GroupingManagement";

export { resolveAdminSurface, type AdminSurface } from "./access";
export { StaffLoginForm } from "./StaffLoginForm";

const roleLabels: Record<StaffRole, string> = {
  owner: "Owner",
  manager: "Manager",
  staff: "Staff",
};

const statusLabels = {
  pending: "Зөвшөөрөл хүлээж буй",
  active: "Идэвхтэй",
  revoked: "Эрх цуцлагдсан",
};

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

type RoleEditableStaffMember = Extract<StaffMember, { status: "pending" | "active" }>;

const StaffRoleForm = (props: {
  member: RoleEditableStaffMember;
  isPending: boolean;
  onSubmit: (role: StaffRole) => Promise<unknown>;
}) => {
  const form = createForm(() => ({
    defaultValues: { role: props.member.role ?? "staff" },
    onSubmit: async ({ value }) => props.onSubmit(value.role),
  }));

  return (
    <form
      class="flex flex-wrap items-center gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        await form.handleSubmit();
      }}
    >
      <form.Field name="role">
        {(field) => (
          <label>
            <span class="sr-only">{props.member.email} эрх</span>
            <select
              class="min-h-11 rounded-lg border border-black/25 bg-(--paper) pr-9 pl-3 text-(--ink)"
              value={field().state.value}
              onChange={(event) => {
                const role = v.safeParse(StaffRoleSchema, event.currentTarget.value);
                if (role.success) {
                  field().handleChange(role.output);
                }
              }}
              disabled={props.isPending}
            >
              <For each={Object.entries(roleLabels)}>
                {([value, label]) => <option value={value}>{label}</option>}
              </For>
            </select>
          </label>
        )}
      </form.Field>
      <Button type="submit" variant="secondary" disabled={props.isPending}>
        {props.member.status === "active" ? "Эрх хадгалах" : "Зөвшөөрөх"}
      </Button>
    </form>
  );
};

const StaffRow = (props: { member: StaffMember }) => {
  const queryClient = useQueryClient();
  const mutation = useMutation(() => staffMutationOptions(queryClient));
  const [confirmingRemoval, setConfirmingRemoval] = createSignal(false);
  const revoke = () => mutation.mutate({ kind: "revoke", id: props.member.id });
  const remove = () => mutation.mutate({ kind: "remove", id: props.member.id });

  return (
    <li class="grid grid-cols-1 items-start gap-4 border-t border-black/10 py-4 md:grid-cols-[minmax(14rem,1fr)_auto_auto] md:items-center">
      <div class="grid min-w-0 justify-items-start gap-2">
        <strong class="max-w-full break-all">{props.member.email}</strong>
        <span
          class="rounded-full px-2.5 py-1.5 text-xs font-bold whitespace-nowrap"
          classList={{
            "bg-(--surface)": props.member.status === "pending",
            "bg-green-200": props.member.status === "active",
            "bg-red-200": props.member.status === "revoked",
          }}
        >
          {statusLabels[props.member.status]}
        </span>
      </div>
      <Show when={props.member.status === "revoked" ? undefined : props.member} keyed>
        {(member) => (
          <StaffRoleForm
            member={member}
            isPending={mutation.isPending}
            onSubmit={(role) =>
              mutation.mutateAsync(
                member.status === "active"
                  ? { kind: "role", id: member.id, role }
                  : { kind: "approve", id: member.id, role },
              )
            }
          />
        )}
      </Show>
      <div class="flex flex-wrap items-center gap-2">
        <Show when={props.member.status === "active"}>
          <Button type="button" variant="secondary" disabled={mutation.isPending} onClick={revoke}>
            Эрх цуцлах
          </Button>
        </Show>
        <Show
          when={confirmingRemoval()}
          fallback={
            <Button
              type="button"
              variant="secondary"
              disabled={mutation.isPending}
              onClick={() => setConfirmingRemoval(true)}
            >
              Устгах
            </Button>
          }
        >
          <span
            class="flex items-center gap-2"
            role="group"
            aria-label={`${props.member.email} устгах баталгаа`}
          >
            <Button
              type="button"
              variant="secondary"
              disabled={mutation.isPending}
              onClick={remove}
            >
              Батлах
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={mutation.isPending}
              onClick={() => setConfirmingRemoval(false)}
            >
              Болих
            </Button>
          </span>
        </Show>
      </div>
    </li>
  );
};

const addStaffErrorMessage = (error: StaffClientError) => {
  if (error.kind === "network") {
    return "Сүлжээний холболтыг шалгаад дахин оролдоно уу.";
  }
  if (error.kind === "api") {
    if (error.error.reason === "invalid_transition") {
      return "Энэ и-мэйлтэй ажилтан аль хэдийн бүртгэлтэй байна.";
    }
    if (error.error.code === "forbidden") {
      return "Ажилтан нэмэхэд Owner эрх шаардлагатай.";
    }
    if (error.error.code === "validation") {
      return "Оруулсан мэдээллээ шалгаад дахин оролдоно уу.";
    }
  }
  return "Ажилтныг нэмж чадсангүй. Дахин оролдох эсвэл дэмжлэгтэй холбогдоно уу.";
};

const AddStaffForm = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation(() => staffMutationOptions(queryClient));
  const form = createForm(() => ({
    defaultValues: { email: "", role: v.parse(StaffRoleSchema, "staff") },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync({ kind: "create", email: value.email, role: value.role });
      form.reset();
    },
  }));

  return (
    <form
      class="grid grid-cols-1 items-end gap-3 border-b border-black/15 pb-8 md:grid-cols-[minmax(14rem,1fr)_minmax(8rem,0.4fr)_auto]"
      onSubmit={async (event) => {
        event.preventDefault();
        await form.handleSubmit();
      }}
    >
      <form.Field name="email">
        {(field) => (
          <label class="grid gap-1.5 text-xs font-bold text-(--muted)">
            <span>Google и-мэйл</span>
            <input
              class="min-h-11 rounded-lg border border-black/25 bg-(--paper) px-3 font-normal text-(--ink)"
              type="email"
              autocomplete="email"
              required
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.value)}
              disabled={mutation.isPending}
              placeholder="name@example.com"
            />
          </label>
        )}
      </form.Field>
      <form.Field name="role">
        {(field) => (
          <label class="grid gap-1.5 text-xs font-bold text-(--muted)">
            <span>Эрх</span>
            <select
              class="min-h-11 rounded-lg border border-black/25 bg-(--paper) px-3 font-normal text-(--ink)"
              value={field().state.value}
              onChange={(event) => {
                const role = v.safeParse(StaffRoleSchema, event.currentTarget.value);
                if (role.success) {
                  field().handleChange(role.output);
                }
              }}
              disabled={mutation.isPending}
            >
              <For each={Object.entries(roleLabels)}>
                {([value, label]) => <option value={value}>{label}</option>}
              </For>
            </select>
          </label>
        )}
      </form.Field>
      <Button class="w-full md:w-auto" type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Нэмж байна…" : "Ажилтан нэмэх"}
      </Button>
      <Show when={mutation.error} keyed>
        {(error) => (
          <p class="col-span-full m-0 text-sm text-red-800" role="alert">
            {addStaffErrorMessage(error)}
          </p>
        )}
      </Show>
    </form>
  );
};

const StaffManagement = () => {
  const staff = useQuery(() => staffQueryOptions());
  return (
    <section class="border-t border-black/15" aria-labelledby="staff-title">
      <div class="flex flex-col items-start justify-between gap-4 py-8 md:flex-row md:gap-8">
        <div>
          <h2 id="staff-title" class="m-0 text-xl font-bold tracking-tight">
            Ажилтны эрх
          </h2>
          <p class="mt-2 mb-0 max-w-prose text-(--muted)">
            Ажилтны Google и-мэйлийг урьдчилан нэмж эсвэл хүсэлтийг зөвшөөрч эрхийг удирдана.
          </p>
        </div>
        <span class="rounded-full bg-(--surface) px-2.5 py-1.5 text-xs font-bold whitespace-nowrap">
          {staff.data?.data.members.length ?? 0} бүртгэл
        </span>
      </div>
      <Show
        when={staff.isSuccess ? staff.data : undefined}
        keyed
        fallback={
          <Show
            when={staff.isPending}
            fallback={<p role="alert">Ажилтны жагсаалтыг харуулж чадсангүй.</p>}
          >
            <p role="status">Ажилтны жагсаалтыг ачаалж байна…</p>
          </Show>
        }
      >
        {(data) => (
          <>
            <AddStaffForm />
            <Show
              when={data.data.members.length > 0}
              fallback={<p class="py-10 text-(--muted)">Одоогоор ажилтны хүсэлт байхгүй байна.</p>}
            >
              <ul class="m-0 list-none border-b border-black/15 p-0">
                <For each={data.data.members}>{(member) => <StaffRow member={member} />}</For>
              </ul>
            </Show>
          </>
        )}
      </Show>
    </section>
  );
};

export type AdminAppProps = { storeName: string; store: string; role: StaffRole };

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
          {props.role === "owner" ? "Ажилтны эрх" : "Хяналтын самбар"}
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
          <h1 class="m-0 text-4xl font-bold tracking-tight sm:text-6xl">
            {props.role === "owner" ? "Store-ийн баг" : "Удирдлагын самбар"}
          </h1>
        </div>
        <div class="flex items-center gap-3 text-sm text-(--muted)">
          <span>Систем</span>
          <HealthStatus />
        </div>
      </header>
      <CmsManagement store={props.store} />
      <CatalogManagement />
      <BundleManagement />
      <GroupingManagement />
      <Show when={resolveAdminSurface(props.role) === "staff_management"}>
        <StaffManagement />
      </Show>
    </main>
  </div>
);

export const AdminApp = (props: AdminAppProps) => {
  const queryClient = createStoreQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard role={props.role} store={props.store} storeName={props.storeName} />
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
