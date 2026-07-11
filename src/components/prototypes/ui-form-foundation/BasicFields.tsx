import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldMessage, firstError, validateChangedField } from "./field-helpers";
import type { ProductEditorController } from "./product-controller";
import { categoryOptions, categorySchema, nameSchema, priceSchema } from "./product-model";

export const BasicFields = (props: { controller: ProductEditorController }) => {
  const merchant = props.controller.merchant;
  return (
    <FieldGroup class="gap-5">
      <merchant.form.Field
        name="name"
        validators={{
          onBlur: nameSchema,
          onChange: ({ value, fieldApi }) =>
            validateChangedField(nameSchema, value, fieldApi.state.meta.errors.length > 0),
        }}
      >
        {(field) => {
          const error = () => firstError(field().state.meta.errors);
          return (
            <Field>
              <FieldLabel for="product-name">Бүтээгдэхүүний нэр</FieldLabel>
              <Input
                id="product-name"
                name={field().name}
                value={field().state.value}
                class="min-h-11"
                aria-invalid={Boolean(error())}
                aria-describedby="product-name-help product-name-error"
                onBlur={field().handleBlur}
                onInput={(event) => {
                  merchant.noteEdit();
                  field().handleChange(event.currentTarget.value);
                }}
              />
              <FieldDescription id="product-name-help">
                Дэлгүүр болон хайлтад харагдах тодорхой нэр.
              </FieldDescription>
              <FieldMessage id="product-name-error" errors={field().state.meta.errors} />
            </Field>
          );
        }}
      </merchant.form.Field>

      <merchant.form.Field
        name="price"
        validators={{
          onBlur: priceSchema,
          onChange: ({ value, fieldApi }) =>
            validateChangedField(priceSchema, value, fieldApi.state.meta.errors.length > 0),
        }}
      >
        {(field) => {
          const error = () => firstError(field().state.meta.errors);
          return (
            <Field>
              <FieldLabel for="product-price">Үндсэн үнэ</FieldLabel>
              <div class="relative">
                <Input
                  id="product-price"
                  name={field().name}
                  type="number"
                  inputmode="numeric"
                  min="1000"
                  step="1000"
                  class="min-h-11 pr-10 font-medium tabular-nums"
                  value={Number.isNaN(field().state.value) ? "" : field().state.value}
                  aria-invalid={Boolean(error())}
                  aria-describedby="product-price-help product-price-error"
                  onBlur={field().handleBlur}
                  onInput={(event) => {
                    merchant.noteEdit();
                    field().handleChange(
                      event.currentTarget.value === ""
                        ? Number.NaN
                        : event.currentTarget.valueAsNumber,
                    );
                  }}
                />
                <span class="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm">
                  ₮
                </span>
              </div>
              <FieldDescription id="product-price-help">
                Хямдрал ороогүй бүхэл төгрөгийн үнэ.
              </FieldDescription>
              <FieldMessage id="product-price-error" errors={field().state.meta.errors} />
            </Field>
          );
        }}
      </merchant.form.Field>

      <merchant.form.Field
        name="category"
        validators={{
          onBlur: categorySchema,
          onChange: ({ value, fieldApi }) =>
            validateChangedField(categorySchema, value, fieldApi.state.meta.errors.length > 0),
        }}
      >
        {(field) => {
          const error = () => firstError(field().state.meta.errors);
          return (
            <Field>
              <FieldLabel for="product-category">Ангилал</FieldLabel>
              <Select
                options={categoryOptions}
                value={field().state.value}
                onChange={(value) => {
                  if (!value) return;
                  merchant.noteEdit();
                  field().handleChange(value);
                }}
                itemComponent={(itemProps) => (
                  <SelectItem item={itemProps.item} class="min-h-11">
                    {itemProps.item.rawValue}
                  </SelectItem>
                )}
              >
                <SelectTrigger
                  id="product-category"
                  name={field().name}
                  class="min-h-11 w-full"
                  aria-invalid={Boolean(error())}
                  aria-describedby="product-category-help product-category-error"
                  onBlur={field().handleBlur}
                >
                  <SelectValue<string>>{(state) => state.selectedOption()}</SelectValue>
                </SelectTrigger>
                <SelectContent />
              </Select>
              <FieldDescription id="product-category-help">
                Дэлгүүрийн үндсэн ангиллын нэгийг сонгоно уу.
              </FieldDescription>
              <FieldMessage id="product-category-error" errors={field().state.meta.errors} />
            </Field>
          );
        }}
      </merchant.form.Field>
    </FieldGroup>
  );
};
