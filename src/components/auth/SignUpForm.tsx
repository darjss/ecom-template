import { createSignal } from "solid-js";
import { toast } from "solid-sonner";
import * as v from "valibot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUp } from "@/lib/auth-client";
import { createForm } from "@/lib/form";

const schema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(1, "Name is required")),
  email: v.pipe(v.string(), v.email("Enter a valid email")),
  password: v.pipe(v.string(), v.minLength(8, "At least 8 characters")),
});

export const SignUpForm = (props: { redirect: string }) => {
  const form = createForm(schema);
  const [pending, setPending] = createSignal(false);

  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    const values = form.validate(event.currentTarget as HTMLFormElement);
    if (!values) return;
    setPending(true);
    const result = await signUp.email({ ...values, callbackURL: props.redirect });
    setPending(false);
    if (result.error) {
      toast.error(result.error.message ?? "Sign up failed");
      return;
    }
    window.location.assign(props.redirect);
  };

  return (
    <form onSubmit={submit} class="flex flex-col gap-4">
      <div class="flex flex-col gap-1.5">
        <Label for="signup-name">Name</Label>
        <Input id="signup-name" name="name" autocomplete="name" />
        <p class="text-destructive text-sm">{form.errors().name}</p>
      </div>
      <div class="flex flex-col gap-1.5">
        <Label for="signup-email">Email</Label>
        <Input id="signup-email" name="email" type="email" autocomplete="email" />
        <p class="text-destructive text-sm">{form.errors().email}</p>
      </div>
      <div class="flex flex-col gap-1.5">
        <Label for="signup-password">Password</Label>
        <Input id="signup-password" name="password" type="password" autocomplete="new-password" />
        <p class="text-destructive text-sm">{form.errors().password}</p>
      </div>
      <Button type="submit" disabled={pending()}>
        Create account
      </Button>
    </form>
  );
};
