import { GroupingClientErrorSchema, type GroupingClientError } from "@ecom/contracts";
import * as v from "valibot";

export const groupingErrorMessage = (error: GroupingClientError) =>
  error.kind === "api" ? error.error.message : "Өөрчлөлтийг хадгалж чадсангүй.";

export const submitAndFocusGroupingError = async (
  form: HTMLFormElement,
  submit: () => Promise<void>,
) => {
  try {
    await submit();
  } catch (error) {
    if (!v.safeParse(GroupingClientErrorSchema, error).success) {
      throw error;
    }
    form
      .querySelector<HTMLElement>(
        "input:not(:disabled), select:not(:disabled), button:not(:disabled)",
      )
      ?.focus();
  }
};
