import { createSignal } from "solid-js";
import * as v from "valibot";

type FieldErrors = Partial<Record<string, string>>;

export const formValues = (form: HTMLFormElement) =>
  Object.fromEntries(new FormData(form).entries());

export const createForm = <TSchema extends v.GenericSchema>(schema: TSchema) => {
  const [errors, setErrors] = createSignal<FieldErrors>({});

  const validate = (form: HTMLFormElement): v.InferOutput<TSchema> | null => {
    const result = v.safeParse(schema, formValues(form));
    if (result.success) {
      setErrors({});
      return result.output;
    }
    const fieldErrors: FieldErrors = {};
    for (const issue of result.issues) {
      const path = issue.path?.map((segment) => String(segment.key)).join(".");
      if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    setErrors(fieldErrors);
    return null;
  };

  return { errors, validate };
};
