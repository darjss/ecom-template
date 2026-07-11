import { createSignal } from "solid-js";
import { toast } from "solid-sonner";
import * as v from "valibot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "@/lib/auth-client";
import { createForm } from "@/lib/form";

const schema = v.object({
  email: v.pipe(v.string(), v.email("Enter a valid email")),
  password: v.pipe(v.string(), v.minLength(8, "At least 8 characters")),
});

export const SignInForm = (props: { redirect: string }) => {
  const form = createForm(schema);
  const [pending, setPending] = createSignal(false);

  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    const values = form.validate(event.currentTarget as HTMLFormElement);
    if (!values) return;
    setPending(true);
    const result = await signIn.email({ ...values, callbackURL: props.redirect });
    setPending(false);
    if (result.error) {
      toast.error(result.error.message ?? "Sign in failed");
      return;
    }
    window.location.assign(props.redirect);
  };

  return (
    <form onSubmit={submit} class="flex flex-col gap-4">
      <div class="flex flex-col gap-1.5">
        <Label for="signin-email">Email</Label>
        <Input id="signin-email" name="email" type="email" autocomplete="email" />
        <p class="text-destructive text-sm">{form.errors().email}</p>
      </div>
      <div class="flex flex-col gap-1.5">
        <Label for="signin-password">Password</Label>
        <Input
          id="signin-password"
          name="password"
          type="password"
          autocomplete="current-password"
        />
        <p class="text-destructive text-sm">{form.errors().password}</p>
      </div>
      <Button type="submit" disabled={pending()}>
        Sign in
      </Button>
    </form>
  );
};
