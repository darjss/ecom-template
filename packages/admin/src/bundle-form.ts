import { BundleClientErrorSchema } from "@ecom/contracts";
import * as v from "valibot";

const usefulFocusTarget =
  'textarea:not(:disabled), input:not([type="hidden"]):not(:disabled), select:not(:disabled), button:not(:disabled), [role="alert"][tabindex]';

export const submitBundleForm = async (root: HTMLElement, submit: () => Promise<unknown>) => {
  try {
    await submit();
  } catch (error) {
    if (!v.safeParse(BundleClientErrorSchema, error).success) {
      throw error;
    }
    await Promise.resolve();
    root.querySelector<HTMLElement>(usefulFocusTarget)?.focus();
  }
};
