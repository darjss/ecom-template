import GitCompareArrows from "lucide-solid/icons/git-compare-arrows";
import { For } from "solid-js";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { ProductEditorController } from "./product-controller";

export const ReconciliationPanel = (props: { controller: ProductEditorController }) => {
  const merchant = props.controller.merchant;
  const state = () => merchant.reconciliation();
  const complete = () =>
    state()?.conflicts.every((conflict) => merchant.choices()[conflict.descriptor.id]) ?? false;

  return (
    <section class="mx-auto grid max-w-2xl gap-7 py-8" aria-labelledby="conflict-title">
      <div class="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-start">
        <div class="bg-blue-100 text-blue-950 grid size-12 place-items-center rounded-full">
          <GitCompareArrows class="size-5" />
        </div>
        <div class="grid gap-2">
          <p class="text-muted-foreground text-sm font-medium">Шинэ серверийн хувилбар олдлоо</p>
          <h2 id="conflict-title" class="text-2xl font-semibold tracking-tight">
            Аль утгыг хадгалахаа сонгоно уу
          </h2>
          <p class="text-muted-foreground max-w-[65ch] text-sm leading-6">
            Давхцаагүй өөрчлөлтүүдийг нэгтгэсэн. Доорх талбар бүрт серверийн эсвэл таны ноорог
            утгаас нэгийг сонгоно.
          </p>
        </div>
      </div>

      <div class="divide-y rounded-2xl border bg-background">
        <For each={state()?.conflicts ?? []}>
          {(conflict) => {
            const id = conflict.descriptor.id;
            return (
              <fieldset class="grid gap-4 p-4 sm:p-5">
                <legend class="px-1 text-sm font-semibold">{conflict.descriptor.label}</legend>
                <RadioGroup
                  value={merchant.choices()[id]}
                  onChange={(value) => {
                    if (value === "server" || value === "draft") {
                      merchant.resolveConflict(id, value);
                    }
                  }}
                  aria-label={`${conflict.descriptor.label} утга сонгох`}
                  class="grid gap-3 sm:grid-cols-2"
                >
                  <label
                    for={`${id}-server`}
                    class="has-[[data-checked]]:border-foreground has-[[data-checked]]:bg-muted flex min-h-20 cursor-pointer items-start gap-3 rounded-xl border p-4"
                  >
                    <RadioGroupItem
                      id={`${id}-server`}
                      value="server"
                      aria-label={`Серверийн утга: ${conflict.serverValue}`}
                      class="mt-0.5 size-5 after:-inset-3"
                    />
                    <span class="grid min-w-0 gap-1">
                      <span class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                        Серверийн утга
                      </span>
                      <span class="break-words text-sm leading-5">{conflict.serverValue}</span>
                    </span>
                  </label>
                  <label
                    for={`${id}-draft`}
                    class="has-[[data-checked]]:border-foreground has-[[data-checked]]:bg-muted flex min-h-20 cursor-pointer items-start gap-3 rounded-xl border p-4"
                  >
                    <RadioGroupItem
                      id={`${id}-draft`}
                      value="draft"
                      aria-label={`Миний ноорог: ${conflict.draftValue}`}
                      class="mt-0.5 size-5 after:-inset-3"
                    />
                    <span class="grid min-w-0 gap-1">
                      <span class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                        Миний ноорог
                      </span>
                      <span class="break-words text-sm leading-5">{conflict.draftValue}</span>
                    </span>
                  </label>
                </RadioGroup>
              </fieldset>
            );
          }}
        </For>
      </div>

      <div class="flex justify-end">
        <Button
          type="button"
          class="min-h-11 w-full sm:w-auto"
          disabled={!complete()}
          onClick={merchant.applyResolution}
        >
          Сонголтуудыг нэгтгэх
        </Button>
      </div>
    </section>
  );
};
