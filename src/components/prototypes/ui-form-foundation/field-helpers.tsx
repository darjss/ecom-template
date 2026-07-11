import { Show } from "solid-js";
import * as v from "valibot";

const errorMessage = (error: unknown) => {
  if (typeof error === "string") return error;
  if (error !== null && typeof error === "object" && "message" in error) {
    return typeof error.message === "string" ? error.message : null;
  }
  return null;
};

export const firstError = (errors: unknown[]) => {
  for (const error of errors) {
    const message = errorMessage(error);
    if (message) return message;
  }
  return null;
};

export const validateChangedField = <TValue,>(
  schema: v.GenericSchema<TValue, TValue>,
  value: TValue,
  hasError: boolean,
) => {
  if (!hasError) return undefined;
  const result = v.safeParse(schema, value);
  return result.success ? undefined : result.issues[0]?.message;
};

export const FieldMessage = (props: { id: string; errors: unknown[] }) => {
  const message = () => firstError(props.errors);
  return (
    <Show when={message()}>
      {(text) => (
        <p id={props.id} role="alert" class="text-destructive text-sm leading-5">
          {text()}
        </p>
      )}
    </Show>
  );
};
