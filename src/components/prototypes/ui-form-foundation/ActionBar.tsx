import AlertCircle from "lucide-solid/icons/circle-alert";
import Check from "lucide-solid/icons/check";
import LoaderCircle from "lucide-solid/icons/loader-circle";
import { Match, Switch } from "solid-js";
import { Button } from "@/components/ui/button";
import type { ProductEditorController } from "./product-controller";

export const ActionBar = (props: { controller: ProductEditorController }) => {
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
    <div class="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm md:absolute md:px-6">
      <div class="mx-auto flex max-w-4xl items-center justify-between gap-4">
        <div class="min-w-0 text-sm">
          <Switch fallback={<span class="text-muted-foreground">Өөрчлөлт байхгүй</span>}>
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
                <span role="status" class="text-emerald-700 flex items-center gap-2 font-medium">
                  <Check class="size-4" /> Бүтээгдэхүүн хадгалагдлаа · v{status().revision}
                </span>
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

        <merchant.form.Subscribe
          selector={(state) => state.isSubmitting}
          children={(isSubmitting) => (
            <Button
              type="submit"
              class="min-h-11 min-w-32 shrink-0"
              disabled={!merchant.hasChanges() || isSubmitting()}
            >
              {isSubmitting()
                ? "Хадгалж байна"
                : merchant.saveStatus().kind === "error"
                  ? "Дахин хадгалах"
                  : "Бүтээгдэхүүн хадгалах"}
            </Button>
          )}
        />
      </div>
    </div>
  );
};
