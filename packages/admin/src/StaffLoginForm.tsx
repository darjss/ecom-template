import { createForm } from "@tanstack/solid-form";
import * as v from "valibot";

const SocialSignInResponseSchema = v.strictObject({
  redirect: v.boolean(),
  url: v.pipe(v.string(), v.url()),
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
      const body: unknown = await response.json();
      const parsed = v.safeParse(SocialSignInResponseSchema, body);
      if (!response.ok || !parsed.success) {
        form.setFieldValue("message", "Google нэвтрэх тохиргоо одоогоор боломжгүй байна.");
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
      <button class="ui-button ui-button--primary" type="submit">
        Google-ээр үргэлжлүүлэх
      </button>
      <form.Subscribe selector={(state) => state.values.message}>
        {(message) => (
          <p class="login-message" role="status">
            {message()}
          </p>
        )}
      </form.Subscribe>
    </form>
  );
};
