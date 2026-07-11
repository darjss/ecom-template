import { createSignal } from "solid-js";
import { toast } from "solid-sonner";
import * as v from "valibot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { twoFactor } from "@/lib/auth-client";
import { createForm } from "@/lib/form";

const schema = v.object({
  code: v.pipe(v.string(), v.length(6, "Enter the 6-digit code")),
});

export const TwoFactorVerify = (props: { redirect: string }) => {
  const form = createForm(schema);
  const [pending, setPending] = createSignal(false);

  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    const values = form.validate(event.currentTarget as HTMLFormElement);
    if (!values) return;
    setPending(true);
    const result = await twoFactor.verifyTotp({ code: values.code });
    setPending(false);
    if (result.error) {
      toast.error(result.error.message ?? "Invalid code");
      return;
    }
    window.location.assign(props.redirect);
  };

  return (
    <form onSubmit={submit} class="flex flex-col gap-4">
      <div class="flex flex-col gap-1.5">
        <Label for="totp-code">Authenticator code</Label>
        <Input id="totp-code" name="code" inputmode="numeric" autocomplete="one-time-code" />
        <p class="text-destructive text-sm">{form.errors().code}</p>
      </div>
      <Button type="submit" disabled={pending()}>
        Verify
      </Button>
    </form>
  );
};
