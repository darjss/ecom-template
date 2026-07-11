import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import type { ProductEditorController } from "./product-controller";

export const PublishField = (props: { controller: ProductEditorController }) => {
  const merchant = props.controller.merchant;
  return (
    <merchant.form.Field name="published">
      {(field) => (
        <Field orientation="horizontal" class="items-start rounded-xl border p-4">
          <Checkbox
            id="product-published"
            name={field().name}
            checked={field().state.value}
            class="size-5 after:-inset-3"
            onChange={(checked) => {
              merchant.noteEdit();
              field().handleChange(checked);
            }}
          />
          <div class="grid gap-1.5">
            <FieldLabel for="product-published">Хадгалахад нийтлэх</FieldLabel>
            <FieldDescription>
              Сонгосон үед бүтээгдэхүүн амжилттай хадгалагдсаны дараа дэлгүүрт харагдана.
            </FieldDescription>
          </div>
        </Field>
      )}
    </merchant.form.Field>
  );
};
