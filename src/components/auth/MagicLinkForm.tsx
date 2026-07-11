import { Show, createSignal } from "solid-js";
import { toast } from "solid-sonner";
import * as v from "valibot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "@/lib/auth-client";
import { createForm } from "@/lib/form";

const schema = v.object({
  email: v.pipe(v.string(), v.email("Enter a valid email")),
});

export const MagicLinkForm = (props: { redirect: string }) => {
  const form = createForm(schema);
  const [sent, setSent] = createSignal(false);
  const [pending, setPending] = createSignal(false);

  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    const values = form.validate(event.currentTarget as HTMLFormElement);
    if (!values) return;
    setPending(true);
    const result = await signIn.magicLink({ email: values.email, callbackURL: props.redirect });
    setPending(false);
    if (result.error) {
      toast.error(result.error.message ?? "Could not send link");
      return;
    }
    setSent(true);
  };

  return (
    <Show
      when={!sent()}
      fallback={<p class="text-muted-foreground text-sm">Check your inbox for a sign-in link.</p>}
    >
      <form onSubmit={submit} class="flex flex-col gap-4">
        <div class="flex flex-col gap-1.5">
          <Label for="magic-email">Email</Label>
          <Input id="magic-email" name="email" type="email" autocomplete="email" />
          <p class="text-destructive text-sm">{form.errors().email}</p>
        </div>
        <Button type="submit" variant="secondary" disabled={pending()}>
          Email me a link
        </Button>
      </form>
    </Show>
  );
};
