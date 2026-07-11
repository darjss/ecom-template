import { useQuery, useQueryClient } from "@tanstack/solid-query";
import { For, Show, createSignal } from "solid-js";
import { toast } from "solid-sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { organization } from "@/lib/auth-client";

const membersKey = ["organization", "members"];

const useActiveOrganization = () =>
  useQuery(() => ({
    queryKey: membersKey,
    queryFn: async () => {
      const result = await organization.getFullOrganization();
      if (result.error) throw new Error(result.error.message ?? "Could not load organization");
      return result.data;
    },
    retry: false,
  }));

export const OrgMembers = () => {
  const queryClient = useQueryClient();
  const org = useActiveOrganization();
  const [email, setEmail] = createSignal("");

  const invite = async (event: SubmitEvent) => {
    event.preventDefault();
    const result = await organization.inviteMember({ email: email().trim(), role: "member" });
    if (result.error) {
      toast.error(result.error.message ?? "Invite failed");
      return;
    }
    toast.success("Invitation sent");
    setEmail("");
    await queryClient.invalidateQueries({ queryKey: membersKey });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization members</CardTitle>
      </CardHeader>
      <CardContent>
        <Show
          when={org.data}
          fallback={
            <p class="text-muted-foreground text-sm">
              No active organization. Create one to invite teammates.
            </p>
          }
        >
          {(active) => (
            <div class="flex flex-col gap-4">
              <ul class="divide-y rounded-lg border">
                <For each={active().members}>
                  {(member) => (
                    <li class="flex items-center justify-between p-3 text-sm">
                      <span>{member.user.email}</span>
                      <span class="text-muted-foreground">{member.role}</span>
                    </li>
                  )}
                </For>
              </ul>
              <form onSubmit={invite} class="flex gap-2">
                <Input
                  type="email"
                  placeholder="teammate@example.com"
                  value={email()}
                  onInput={(event) => setEmail(event.currentTarget.value)}
                  class="flex-1"
                />
                <Button type="submit">Invite</Button>
              </form>
            </div>
          )}
        </Show>
      </CardContent>
    </Card>
  );
};
