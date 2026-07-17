import { Button } from "@ecom/ui";
import { createForm } from "@tanstack/solid-form";
import * as v from "valibot";

const SocialSignInResponseSchema = v.strictObject({
  redirect: v.boolean(),
  url: v.pipe(
    v.string(),
    v.url(),
    v.check((url) => new URL(url).protocol === "https:"),
  ),
});

export const StaffLoginForm = () => {
  const form = createForm(() => ({
    defaultValues: { provider: "google", message: "" },
    onSubmit: async ({ value }) => {
      const response = await fetch("/api/auth/staff/sign-in/social", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: value.provider, callbackURL: "/admin" }),
      });
      const source = await response.text();
      if (!response.ok || source.length === 0) {
        form.setFieldValue("message", "Google нэвтрэх тохиргоо одоогоор боломжгүй байна.");
        return;
      }
      let body: unknown;
      try {
        body = JSON.parse(source);
      } catch {
        form.setFieldValue("message", "Нэвтрэх үйлчилгээний хариуг шалгаж чадсангүй.");
        return;
      }
      const parsed = v.safeParse(SocialSignInResponseSchema, body);
      if (!parsed.success) {
        form.setFieldValue("message", "Нэвтрэх үйлчилгээний хариуг шалгаж чадсангүй.");
        return;
      }
      window.location.assign(parsed.output.url);
    },
  }));

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        await form.handleSubmit();
      }}
    >
      <Button type="submit">Google-ээр үргэлжлүүлэх</Button>
      <form.Subscribe selector={(state) => state.values.message}>
        {(message) => (
          <p class="mt-4 min-h-6 text-sm text-red-800" role="status">
            {message()}
          </p>
        )}
      </form.Subscribe>
    </form>
  );
};
