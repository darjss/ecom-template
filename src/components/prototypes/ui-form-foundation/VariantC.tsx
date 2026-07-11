import Eye from "lucide-solid/icons/eye";
import Pencil from "lucide-solid/icons/pencil";
import { BasicFields } from "./BasicFields";
import type { ProductEditorController, ProductView } from "./product-controller";
import { PublishField } from "./PublishField";
import { StorefrontPreview } from "./StorefrontPreview";
import { StoryField } from "./StoryField";

const ViewTab = (props: {
  id: ProductView;
  label: string;
  controller: ProductEditorController;
  icon: typeof Pencil;
}) => (
  <button
    type="button"
    role="tab"
    aria-selected={props.controller.view() === props.id}
    aria-controls={`variant-c-${props.id}`}
    class="aria-selected:bg-background aria-selected:text-foreground focus-visible:ring-ring/50 flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground outline-none focus-visible:ring-3"
    onClick={() => props.controller.setView(props.id)}
  >
    <props.icon class="size-4" /> {props.label}
  </button>
);

export const VariantC = (props: { controller: ProductEditorController }) => (
  <div>
    <div
      role="tablist"
      aria-label="Засвар ба урьдчилсан харагдац"
      class="mb-5 flex rounded-xl bg-muted p-1 lg:hidden"
    >
      <ViewTab id="editor" label="Засвар" icon={Pencil} controller={props.controller} />
      <ViewTab id="preview" label="Харагдац" icon={Eye} controller={props.controller} />
    </div>

    <div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.82fr)] lg:items-start">
      <section
        id="variant-c-editor"
        role="tabpanel"
        aria-label="Бүтээгдэхүүн засах"
        aria-hidden={props.controller.view() !== "editor"}
        class="lg:!block"
        classList={{ hidden: props.controller.view() !== "editor" }}
      >
        <div class="divide-y border-y">
          <section class="grid gap-5 py-6" aria-labelledby="variant-c-basics-title">
            <h2 id="variant-c-basics-title" class="text-base font-semibold">
              Үндсэн мэдээлэл
            </h2>
            <BasicFields controller={props.controller} />
          </section>
          <section class="grid gap-5 py-6" aria-labelledby="variant-c-story-title">
            <h2 id="variant-c-story-title" class="text-base font-semibold">
              Дэлгүүрийн тайлбар
            </h2>
            <StoryField controller={props.controller} />
          </section>
          <section class="grid gap-5 py-6" aria-labelledby="variant-c-publish-title">
            <h2 id="variant-c-publish-title" class="text-base font-semibold">
              Нийтлэх
            </h2>
            <PublishField controller={props.controller} />
          </section>
        </div>
      </section>

      <div
        id="variant-c-preview"
        role="tabpanel"
        aria-label="Дэлгүүрийн урьдчилсан харагдац"
        aria-hidden={props.controller.view() !== "preview"}
        class="lg:!sticky lg:!top-6 lg:!block"
        classList={{ hidden: props.controller.view() !== "preview" }}
      >
        <StorefrontPreview controller={props.controller} />
      </div>
    </div>
  </div>
);
