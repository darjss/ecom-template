import { formOptions } from "@tanstack/solid-form";

export const contactFormOptions = formOptions({
  defaultValues: {
    name: "",
    phone: "",
  },
});
