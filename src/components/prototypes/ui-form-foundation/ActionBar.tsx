import AlertCircle from "lucide-solid/icons/circle-alert";
import Check from "lucide-solid/icons/check";
import LoaderCircle from "lucide-solid/icons/loader-circle";
import { Match, Switch } from "solid-js";
import { Button } from "@/components/ui/button";
import type { ProductEditorController } from "./product-controller";
import { PrototypeSwitcher, type PrototypeVariant } from "./PrototypeSwitcher";

export const ActionBar = (props: {
  controller: ProductEditorController;
  currentVariant: () => PrototypeVariant;
  onVariantChange: (variant: PrototypeVariant) => void;
}) => {
  const merchant = props.controller.merchant;
  const saveError = () => {
    const status = merchant.saveStatus();
    return status.kind === "error" ? status : null;
  };
  const saved = () => {
    const status = merchant.saveStatus();
    return status.kind === "saved" ? status : null;
  };
  const draftError = () => {
    const status = merchant.draftStatus();
    return status.kind === "error" ? status : null;
  };
  return (
    <div class="fixed inset-x-0 bottom-0 z-30 border-t bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:sticky md:px-6">
      <div class="mx-auto grid max-w-4xl grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-x-4">
        <div class="col-span-2 row-start-2 min-w-0 text-sm md:col-span-1 md:col-start-1 md:row-start-1">
          <Switch>
            <Match when={saveError()}>
              {(status) => (
                <div
                  data-save-error
                  tabindex="-1"
                  role="alert"
                  class="text-destructive flex items-start gap-2 outline-none"
                >
                  <AlertCircle class="mt-0.5 size-4 shrink-0" />
                  <span>{status().message}</span>
                </div>
              )}
            </Match>
            <Match when={saved()}>
              {(status) => (
                <output class="text-emerald-700 flex items-center gap-2 font-medium">
                  <Check class="size-4" /> Бүтээгдэхүүн хадгалагдлаа · v{status().revision}
                </output>
              )}
            </Match>
            <Match when={draftError()}>
              <span role="alert" class="text-destructive flex items-center gap-2">
                <AlertCircle class="size-4 shrink-0" />
                Ноорог сэргээх боломжгүй
              </span>
            </Match>
            <Match when={merchant.draftStatus().kind === "pending"}>
              <span class="text-muted-foreground flex items-center gap-2">
                <LoaderCircle class="size-4 animate-spin motion-reduce:animate-none" /> Ноорог
                хадгалж байна
              </span>
            </Match>
            <Match when={merchant.draftStatus().kind === "saved"}>
              <span class="text-muted-foreground flex items-center gap-2">
                <Check class="size-4" /> Ноорог хадгалагдсан
              </span>
            </Match>
          </Switch>
          <span class="sr-only" aria-live="assertive">
            {draftError()?.message ?? ""}
          </span>
        </div>

        <div class="col-start-1 row-start-1 justify-self-start md:col-start-2 md:justify-self-center">
          <PrototypeSwitcher current={props.currentVariant} onChange={props.onVariantChange} />
        </div>

        <merchant.form.Subscribe
          selector={(state) => state.isSubmitting}
          children={(isSubmitting) => (
            <Button
              type="submit"
              class="col-start-2 row-start-1 min-h-11 min-w-24 shrink-0 justify-self-end md:col-start-3 md:min-w-32"
              disabled={!merchant.hasChanges() || isSubmitting()}
            >
              <span class="sm:hidden">
                {isSubmitting()
                  ? "Хүлээнэ үү"
                  : merchant.saveStatus().kind === "error"
                    ? "Дахин"
                    : "Хадгалах"}
              </span>
              <span class="hidden sm:inline">
                {isSubmitting()
                  ? "Хадгалж байна"
                  : merchant.saveStatus().kind === "error"
                    ? "Дахин хадгалах"
                    : "Бүтээгдэхүүн хадгалах"}
              </span>
            </Button>
          )}
        />
      </div>
    </div>
  );
};
