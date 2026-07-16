import {
  createStoreQueryClient,
  healthQueryOptions,
  staffMutationOptions,
  staffQueryOptions,
} from "@ecom/client";
import { StaffRoleSchema, type StaffMember, type StaffRole } from "@ecom/contracts";
import { Button } from "@ecom/ui";
import { createForm } from "@tanstack/solid-form";
import { QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/solid-query";
import { createSignal, For, Show } from "solid-js";
import * as v from "valibot";

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
    <Show when={!health.isError} fallback={<span class="health unavailable">Сааталтай</span>}>
      <Show when={health.data} fallback={<span class="health pending">Шалгаж байна</span>}>
        <span class="health ready">Хэвийн</span>
      </Show>
    </Show>
  );
};

const StaffRow = (props: { member: StaffMember }) => {
  const queryClient = useQueryClient();
  const mutation = useMutation(() => staffMutationOptions(queryClient));
  const [confirmingRemoval, setConfirmingRemoval] = createSignal(false);
  const form = createForm(() => ({
    defaultValues: { role: props.member.role ?? "staff" },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync({
        kind: props.member.status === "active" ? "role" : "approve",
        id: props.member.id,
        role: value.role,
      });
    },
  }));

  const revoke = () => mutation.mutate({ kind: "revoke", id: props.member.id });
  const remove = () => mutation.mutate({ kind: "remove", id: props.member.id });

  return (
    <li class="staff-row">
      <div class="staff-identity">
        <strong>{props.member.email}</strong>
        <span class={`staff-status staff-status--${props.member.status}`}>
          {statusLabels[props.member.status]}
        </span>
      </div>
      <form
        class="staff-role-form"
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
        <Button type="submit" variant="secondary" disabled={mutation.isPending}>
          {props.member.status === "active" ? "Эрх хадгалах" : "Зөвшөөрөх"}
        </Button>
      </form>
      <div class="staff-actions">
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
            class="remove-confirmation"
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

const StaffManagement = () => {
  const staff = useQuery(() => staffQueryOptions());
  return (
    <section class="staff-management" aria-labelledby="staff-title">
      <div class="section-heading">
        <div>
          <h2 id="staff-title">Ажилтны эрх</h2>
          <p>Google хүсэлтийг зөвшөөрч, Store-ийн үүргийг удирдана.</p>
        </div>
        <span class="staff-count">{staff.data?.data.members.length ?? 0} бүртгэл</span>
      </div>
      <Show
        when={!staff.isPending}
        fallback={<p role="status">Ажилтны жагсаалтыг ачаалж байна…</p>}
      >
        <Show
          when={!staff.isError}
          fallback={<p role="alert">Ажилтны жагсаалтыг харуулж чадсангүй.</p>}
        >
          <Show
            when={(staff.data?.data.members.length ?? 0) > 0}
            fallback={<p class="staff-empty">Одоогоор ажилтны хүсэлт байхгүй байна.</p>}
          >
            <ul class="staff-list">
              <For each={staff.data?.data.members}>{(member) => <StaffRow member={member} />}</For>
            </ul>
          </Show>
        </Show>
      </Show>
    </section>
  );
};

export type AdminAppProps = { storeName: string };

const Dashboard = (props: AdminAppProps) => (
  <div class="admin-shell">
    <aside class="admin-sidebar" aria-label="Үндсэн цэс">
      <a class="admin-brand" href="/">
        {props.storeName}
      </a>
      <nav>
        <a class="active" aria-current="page" href="/admin">
          Ажилтны эрх
        </a>
      </nav>
      <a class="store-link" href="/">
        Дэлгүүр рүү очих
      </a>
    </aside>
    <main id="admin-content" class="admin-main" tabindex="-1">
      <header>
        <div>
          <p class="eyebrow">Удирдлага</p>
          <h1>Store-ийн баг</h1>
        </div>
        <div class="system-health">
          <span>Систем</span>
          <HealthStatus />
        </div>
      </header>
      <StaffManagement />
    </main>
  </div>
);

export const AdminApp = (props: AdminAppProps) => (
  <QueryClientProvider client={createStoreQueryClient()}>
    <Dashboard storeName={props.storeName} />
  </QueryClientProvider>
);

export const AdminHealthStatus = () => (
  <QueryClientProvider client={createStoreQueryClient()}>
    <HealthStatus />
  </QueryClientProvider>
);
