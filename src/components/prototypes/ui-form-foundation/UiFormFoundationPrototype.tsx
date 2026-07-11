import { Match, Show, Switch, createSignal } from "solid-js";
import { ActionBar } from "./ActionBar";
import { PrototypeSwitcher, type PrototypeVariant } from "./PrototypeSwitcher";
import { ReconciliationPanel } from "./ReconciliationPanel";
import { RecoveryGate } from "./RecoveryGate";
import { ScenarioLab } from "./ScenarioLab";
import { VariantA } from "./VariantA";
import { VariantB } from "./VariantB";
import { VariantC } from "./VariantC";
import { createProductEditorController } from "./product-controller";

const initialVariant = (): PrototypeVariant => {
  const value = new URL(window.location.href).searchParams.get("variant")?.toUpperCase();
  return value === "B" || value === "C" ? value : "A";
};

export const UiFormFoundationPrototype = () => {
  const controller = createProductEditorController();
  const [variant, setVariant] = createSignal<PrototypeVariant>(initialVariant());

  const changeVariant = (next: PrototypeVariant) => {
    const url = new URL(window.location.href);
    url.searchParams.set("variant", next);
    window.history.replaceState({}, "", url);
    setVariant(next);
  };

  return (
    <div class="min-h-screen bg-[oklch(0.975_0.008_70)] text-foreground">
      <header class="border-b bg-background">
        <div class="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div class="flex items-center gap-3">
            <div class="bg-foreground text-background grid size-9 place-items-center rounded-lg text-sm font-bold">
              M
            </div>
            <div>
              <p class="text-sm font-semibold leading-4">Merchant Admin</p>
              <p class="text-muted-foreground text-xs">Өрнүү · Prototype store</p>
            </div>
          </div>
          <span class="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">
            PROTOTYPE ONLY
          </span>
        </div>
      </header>

      <main class="mx-auto max-w-5xl px-4 pt-6 pb-40 sm:px-6 sm:pt-8" id="prototype-main">
        <div class="mb-6 grid gap-2">
          <p class="text-muted-foreground text-sm font-medium">Бүтээгдэхүүн · Ноорог</p>
          <div class="flex flex-wrap items-end justify-between gap-3">
            <h1 class="text-2xl font-semibold tracking-tight sm:text-3xl">Бүтээгдэхүүн засах</h1>
            <span class="text-muted-foreground text-sm tabular-nums">
              Server v{controller.merchant.baseRecord().revision}
            </span>
          </div>
        </div>

        <ScenarioLab controller={controller} />

        <div class="mt-7">
          <Show when={controller.merchant.recovery()}>
            <RecoveryGate controller={controller} />
          </Show>
          <Show when={controller.merchant.reconciliation()}>
            <ReconciliationPanel controller={controller} />
          </Show>
          <Show when={!controller.merchant.recovery() && !controller.merchant.reconciliation()}>
            <form
              class="relative"
              onSubmit={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void controller.merchant.form.handleSubmit();
              }}
            >
              <Switch>
                <Match when={variant() === "A"}>
                  <VariantA controller={controller} />
                </Match>
                <Match when={variant() === "B"}>
                  <VariantB controller={controller} />
                </Match>
                <Match when={variant() === "C"}>
                  <VariantC controller={controller} />
                </Match>
              </Switch>
              <ActionBar controller={controller} />
            </form>
          </Show>
        </div>
      </main>

      <PrototypeSwitcher current={variant} onChange={changeVariant} />
    </div>
  );
};
