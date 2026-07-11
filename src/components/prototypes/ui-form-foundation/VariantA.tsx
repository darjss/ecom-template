import Check from "lucide-solid/icons/check";
import { BasicFields } from "./BasicFields";
import type { ProductEditorController } from "./product-controller";
import { PublishField } from "./PublishField";
import { StoryField } from "./StoryField";

const SectionHeading = (props: { number: string; title: string; detail: string }) => (
  <div class="grid grid-cols-[2rem_1fr] gap-3">
    <span class="bg-foreground text-background grid size-8 place-items-center rounded-full text-xs font-semibold">
      {props.number}
    </span>
    <div class="grid gap-1">
      <h2 class="text-lg font-semibold tracking-tight">{props.title}</h2>
      <p class="text-muted-foreground text-sm leading-5">{props.detail}</p>
    </div>
  </div>
);

export const VariantA = (props: { controller: ProductEditorController }) => (
  <div class="mx-auto max-w-2xl">
    <div class="mb-7 flex items-center gap-2 text-sm font-medium text-emerald-700">
      <Check class="size-4" /> 5 талбарыг нэг урсгалаар шалгана
    </div>
    <div class="divide-y border-y">
      <section class="grid gap-6 py-7" aria-labelledby="variant-a-basics">
        <div id="variant-a-basics">
          <SectionHeading
            number="1"
            title="Үндсэн мэдээлэл"
            detail="Худалдан авагч хамгийн түрүүнд харах нэр, үнэ, ангилал."
          />
        </div>
        <div class="pl-0 sm:pl-11">
          <BasicFields controller={props.controller} />
        </div>
      </section>

      <section class="grid gap-6 py-7" aria-labelledby="variant-a-story">
        <div id="variant-a-story">
          <SectionHeading
            number="2"
            title="Дэлгүүрийн тайлбар"
            detail="Материал болон хэрэглээг товч, ойлгомжтой тайлбарлана."
          />
        </div>
        <div class="pl-0 sm:pl-11">
          <StoryField controller={props.controller} />
        </div>
      </section>

      <section class="grid gap-6 py-7" aria-labelledby="variant-a-publish">
        <div id="variant-a-publish">
          <SectionHeading
            number="3"
            title="Нийтлэх"
            detail="Хадгалсны дараах дэлгүүрийн төлвийг сонгоно."
          />
        </div>
        <div class="pl-0 sm:pl-11">
          <PublishField controller={props.controller} />
        </div>
      </section>
    </div>
  </div>
);
