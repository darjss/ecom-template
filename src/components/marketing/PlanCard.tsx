import Check from "lucide-solid/icons/check";
import { For } from "solid-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Plan } from "@/lib/plans";
import { cn } from "@/lib/utils";

export const PlanCard = (props: { plan: Plan }) => {
  const checkout = () => {
    const target =
      props.plan.priceMonthly === 0 ? "/login" : `/app/billing?upgrade=${props.plan.slug}`;
    window.location.assign(target);
  };

  return (
    <Card class={cn("flex flex-col", props.plan.highlighted && "border-primary")}>
      <CardHeader>
        <CardTitle>{props.plan.name}</CardTitle>
        <p class="text-3xl font-bold">
          ${props.plan.priceMonthly}
          <span class="text-muted-foreground text-sm font-normal">/mo</span>
        </p>
        <p class="text-muted-foreground text-sm">{props.plan.description}</p>
      </CardHeader>
      <CardContent class="flex flex-1 flex-col justify-between gap-6">
        <ul class="flex flex-col gap-2 text-sm">
          <For each={props.plan.features}>
            {(feature) => (
              <li class="flex items-center gap-2">
                <Check class="text-primary size-4" />
                {feature}
              </li>
            )}
          </For>
        </ul>
        <Button variant={props.plan.highlighted ? "default" : "outline"} onClick={checkout}>
          {props.plan.priceMonthly === 0 ? "Get started" : "Upgrade"}
        </Button>
      </CardContent>
    </Card>
  );
};
