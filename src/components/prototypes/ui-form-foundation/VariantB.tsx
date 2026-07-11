import ChevronRight from "lucide-solid/icons/chevron-right";
import { For, Match, Switch } from "solid-js";
import { BasicFields } from "./BasicFields";
import type { ProductEditorController, ProductSection } from "./product-controller";
import { PublishField } from "./PublishField";
import { StoryField } from "./StoryField";

const sections: { id: ProductSection; number: string; label: string; detail: string }[] = [
  { id: "basics", number: "01", label: "Үндсэн мэдээлэл", detail: "Нэр, үнэ, ангилал" },
  { id: "story", number: "02", label: "Товч тайлбар", detail: "Дэлгүүрийн агуулга" },
  { id: "publishing", number: "03", label: "Нийтлэх төлөв", detail: "Хадгалалтын үр дүн" },
];

export const VariantB = (props: { controller: ProductEditorController }) => {
  const active = () => sections.find((section) => section.id === props.controller.section());
  return (
    <div class="grid gap-6 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-10">
      <nav aria-label="Бүтээгдэхүүний хэсгүүд">
        <div class="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:overflow-visible md:px-0">
          <For each={sections}>
            {(section) => (
              <button
                type="button"
                aria-current={props.controller.section() === section.id ? "step" : undefined}
                aria-controls="focused-product-section"
                class="border-border hover:bg-muted focus-visible:ring-ring/50 flex min-h-12 min-w-48 snap-start items-center gap-3 rounded-xl border px-3 text-left outline-none focus-visible:ring-3 md:min-w-0 md:border-transparent md:aria-[current=step]:border-border md:aria-[current=step]:bg-muted"
                onClick={() => props.controller.setSection(section.id)}
              >
                <span class="text-muted-foreground text-xs font-semibold tabular-nums">
                  {section.number}
                </span>
                <span class="grid flex-1">
                  <span class="text-sm font-medium">{section.label}</span>
                  <span class="text-muted-foreground text-xs">{section.detail}</span>
                </span>
                <ChevronRight class="size-4 md:hidden" />
              </button>
            )}
          </For>
        </div>
      </nav>

      <section id="focused-product-section" class="min-w-0" aria-live="polite">
        <div class="mb-7 border-b pb-5">
          <p class="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            {active()?.number} · {active()?.detail}
          </p>
          <h2 class="mt-2 text-xl font-semibold tracking-tight">{active()?.label}</h2>
        </div>
        <Switch>
          <Match when={props.controller.section() === "basics"}>
            <BasicFields controller={props.controller} />
          </Match>
          <Match when={props.controller.section() === "story"}>
            <StoryField controller={props.controller} />
          </Match>
          <Match when={props.controller.section() === "publishing"}>
            <PublishField controller={props.controller} />
          </Match>
        </Switch>
      </section>
    </div>
  );
};
