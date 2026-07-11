import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { FieldMessage, firstError, validateChangedField } from "./field-helpers";
import type { ProductEditorController } from "./product-controller";
import { descriptionSchema } from "./product-model";

export const StoryField = (props: { controller: ProductEditorController }) => {
  const merchant = props.controller.merchant;
  return (
    <merchant.form.Field
      name="description"
      validators={{
        onBlur: descriptionSchema,
        onChange: ({ value, fieldApi }) =>
          validateChangedField(descriptionSchema, value, fieldApi.state.meta.errors.length > 0),
      }}
    >
      {(field) => {
        const error = () => firstError(field().state.meta.errors);
        return (
          <Field>
            <div class="flex items-end justify-between gap-4">
              <FieldLabel for="product-description">Дэлгүүрийн товч тайлбар</FieldLabel>
              <span class="text-muted-foreground text-xs tabular-nums">
                {field().state.value.length}/180
              </span>
            </div>
            <Textarea
              id="product-description"
              name={field().name}
              value={field().state.value}
              rows={4}
              maxlength={180}
              class="min-h-28 resize-y"
              aria-invalid={Boolean(error())}
              aria-describedby="product-description-help product-description-error"
              onBlur={field().handleBlur}
              onInput={(event) => {
                merchant.noteEdit();
                field().handleChange(event.currentTarget.value);
              }}
            />
            <FieldDescription id="product-description-help">
              Худалдан авагчид материал, хэрэглээг нэг дор ойлгуулна.
            </FieldDescription>
            <FieldMessage id="product-description-error" errors={field().state.meta.errors} />
          </Field>
        );
      }}
    </merchant.form.Field>
  );
};
