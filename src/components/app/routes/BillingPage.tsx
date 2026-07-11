import { useMutation, useQuery } from "@tanstack/solid-query";
import { Match, Switch } from "solid-js";
import { toast } from "solid-sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, queryErrorMessage, unwrap } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { plans } from "@/lib/plans";

const useBillingState = () =>
  useQuery(() => ({
    queryKey: ["billing", "state"],
    queryFn: async () => unwrap(await api.billing.state.get()),
  }));

export const BillingPage = () => {
  const state = useBillingState();

  const checkout = useMutation(() => ({
    mutationFn: async (planSlug: string) => unwrap(await api.billing.checkout.post({ planSlug })),
    onSuccess: (result) => window.location.assign(result.url),
    onError: (error) => toast.error(queryErrorMessage(error)),
  }));

  const openPortal = async () => {
    const result = await authClient.customer.portal();
    if (result.error) toast.error(result.error.message ?? "Could not open portal");
  };

  const planName = (slug: string | null) =>
    plans.find((plan) => plan.slug === slug)?.name ?? "Free";

  return (
    <div class="mx-auto max-w-2xl">
      <h1 class="text-2xl font-bold">Billing</h1>
      <Switch>
        <Match when={state.isPending}>
          <p class="text-muted-foreground mt-6 text-sm">Loading…</p>
        </Match>
        <Match when={state.isError}>
          <p class="text-destructive mt-6 text-sm">{queryErrorMessage(state.error)}</p>
        </Match>
        <Match when={state.data}>
          {(billing) => (
            <Card class="mt-6">
              <CardHeader>
                <CardTitle>Current plan: {planName(billing().activePlanSlug)}</CardTitle>
              </CardHeader>
              <CardContent class="flex gap-2">
                <Switch>
                  <Match when={billing().subscriptionStatus === "active"}>
                    <Button variant="outline" onClick={openPortal}>
                      Manage subscription
                    </Button>
                  </Match>
                  <Match when={true}>
                    <Button onClick={() => checkout.mutate("pro")} disabled={checkout.isPending}>
                      Upgrade to Pro
                    </Button>
                  </Match>
                </Switch>
              </CardContent>
            </Card>
          )}
        </Match>
      </Switch>
    </div>
  );
};
