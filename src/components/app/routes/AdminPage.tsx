import { useQuery } from "@tanstack/solid-query";
import { For, Match, Switch } from "solid-js";
import { api, queryErrorMessage, unwrap } from "@/lib/api";

const useUsers = () =>
  useQuery(() => ({
    queryKey: ["admin", "users"],
    queryFn: async () => unwrap(await api.admin.users.get()),
  }));

export const AdminPage = () => {
  const users = useUsers();

  return (
    <div class="mx-auto max-w-3xl">
      <h1 class="text-2xl font-bold">Admin</h1>
      <Switch>
        <Match when={users.isPending}>
          <p class="text-muted-foreground mt-6 text-sm">Loading…</p>
        </Match>
        <Match when={users.isError}>
          <p class="text-destructive mt-6 text-sm">{queryErrorMessage(users.error)}</p>
        </Match>
        <Match when={users.data}>
          {(list) => (
            <table class="mt-6 w-full text-left text-sm">
              <thead>
                <tr class="border-b">
                  <th class="p-2 font-medium">Name</th>
                  <th class="p-2 font-medium">Email</th>
                  <th class="p-2 font-medium">Role</th>
                </tr>
              </thead>
              <tbody>
                <For each={list()}>
                  {(row) => (
                    <tr class="border-b">
                      <td class="p-2">{row.name}</td>
                      <td class="p-2">{row.email}</td>
                      <td class="p-2">{row.role ?? "user"}</td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          )}
        </Match>
      </Switch>
    </div>
  );
};
