import FlaskConical from "lucide-solid/icons/flask-conical";
import RotateCcw from "lucide-solid/icons/rotate-ccw";
import { Button } from "@/components/ui/button";
import type { ProductEditorController } from "./product-controller";

export const ScenarioLab = (props: { controller: ProductEditorController }) => {
  const reset = () => {
    props.controller.merchant.discardDraft();
    props.controller.scenario.reset();
    window.location.reload();
  };

  return (
    <details class="group rounded-xl border bg-muted/40">
      <summary class="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        <span class="flex items-center gap-2">
          <FlaskConical class="size-4" /> Prototype scenario lab
        </span>
        <span class="text-muted-foreground font-normal tabular-nums">
          Simulated server v{props.controller.scenario.serverRecord().revision}
        </span>
      </summary>
      <div class="grid gap-3 border-t px-4 py-4">
        <p class="text-muted-foreground max-w-[65ch] text-xs leading-5">
          Browser-only scenario data. This demonstrates UI state transitions, not backend
          persistence or concurrency correctness.
        </p>
        <div class="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={props.controller.scenario.simulateExternalChange}
          >
            Simulate staff edit
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={props.controller.scenario.failNextSave}
          >
            Fail next server save
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={props.controller.merchant.seedIncompatibleDraft}
          >
            Load old-version draft
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={props.controller.merchant.seedInvalidDraft}
          >
            Load malformed draft
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={reset}>
            <RotateCcw class="size-4" /> Reset lab
          </Button>
        </div>
      </div>
    </details>
  );
};
