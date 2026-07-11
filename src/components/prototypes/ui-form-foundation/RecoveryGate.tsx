import AlertTriangle from "lucide-solid/icons/triangle-alert";
import Clock3 from "lucide-solid/icons/clock-3";
import { Show } from "solid-js";
import { Button } from "@/components/ui/button";
import type { ProductEditorController } from "./product-controller";

const savedTime = (value: string) =>
  new Intl.DateTimeFormat("mn-MN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export const RecoveryGate = (props: { controller: ProductEditorController }) => {
  const recovery = props.controller.merchant.recovery;
  const isStale = () => {
    const current = recovery();
    return (
      current?.kind === "ready" &&
      current.envelope.baseRevision !== props.controller.merchant.baseRecord().revision
    );
  };
  const invalidDraft = () => {
    const current = recovery();
    return current?.kind === "invalid" ? current : null;
  };
  const storedTime = () => {
    const current = recovery();
    if (current?.kind === "ready") return current.envelope.savedAt;
    if (current?.kind === "incompatible") return current.savedAt;
    return null;
  };

  return (
    <section class="mx-auto grid max-w-xl gap-6 py-12" aria-labelledby="recovery-title">
      <div class="bg-amber-100 text-amber-950 grid size-12 place-items-center rounded-full">
        <AlertTriangle class="size-5" />
      </div>
      <div class="grid gap-2">
        <p class="text-muted-foreground text-sm font-medium">Хадгалагдаагүй ажил олдлоо</p>
        <h2 id="recovery-title" class="text-2xl font-semibold tracking-tight">
          Нооргоо үргэлжлүүлэх үү?
        </h2>
        <Show when={storedTime()}>
          {(time) => (
            <p class="text-muted-foreground flex items-center gap-2 text-sm">
              <Clock3 class="size-4" /> {savedTime(time())}-д хадгалсан
            </p>
          )}
        </Show>
      </div>

      <div class="border-y py-5 text-sm leading-6">
        <Show when={recovery()?.kind === "ready"}>
          <p>
            {isStale()
              ? "Энэ хооронд серверийн бүтээгдэхүүн өөрчлөгдсөн. Үргэлжлүүлэхэд зөрүүтэй талбар бүрийг сонгуулна."
              : "Ноорог одоогийн серверийн хувилбартай таарч байна. Таны өөрчлөлтийг сэргээж болно."}
          </p>
        </Show>
        <Show when={recovery()?.kind === "incompatible"}>
          <p>
            Энэ ноорог хуучин маягтын хувилбартай тул аюулгүй сэргээх боломжгүй. Устгаад серверийн
            утгаар үргэлжлүүлнэ үү.
          </p>
        </Show>
        <Show when={invalidDraft()}>{(draft) => <p>{draft().message}</p>}</Show>
      </div>

      <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          class="min-h-11"
          onClick={props.controller.merchant.discardDraft}
        >
          Нооргийг устгах
        </Button>
        <Show when={recovery()?.kind === "ready"}>
          <Button type="button" class="min-h-11" onClick={props.controller.merchant.continueDraft}>
            Нооргоо үргэлжлүүлэх
          </Button>
        </Show>
      </div>
    </section>
  );
};
