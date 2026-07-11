import { Match, Switch, createSignal } from "solid-js";
import { toast } from "solid-sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { twoFactor, useSession } from "@/lib/auth-client";

export const TwoFactorSettings = () => {
  const session = useSession();
  const [totpUri, setTotpUri] = createSignal<string | null>(null);
  const [password, setPassword] = createSignal("");
  const [code, setCode] = createSignal("");

  const enabled = () => session().data?.user.twoFactorEnabled ?? false;

  const start = async (event: SubmitEvent) => {
    event.preventDefault();
    const result = await twoFactor.enable({ password: password() });
    if (result.error) {
      toast.error(result.error.message ?? "Could not start enrollment");
      return;
    }
    setTotpUri(result.data.totpURI);
  };

  const confirm = async (event: SubmitEvent) => {
    event.preventDefault();
    const result = await twoFactor.verifyTotp({ code: code() });
    if (result.error) {
      toast.error(result.error.message ?? "Invalid code");
      return;
    }
    toast.success("Two-factor enabled");
    setTotpUri(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Two-factor authentication</CardTitle>
      </CardHeader>
      <CardContent>
        <Switch>
          <Match when={enabled()}>
            <p class="text-muted-foreground text-sm">Two-factor authentication is enabled.</p>
          </Match>
          <Match when={totpUri()}>
            {(uri) => (
              <form onSubmit={confirm} class="flex flex-col gap-3">
                <p class="text-muted-foreground text-sm">
                  Add this URI to your authenticator app, then enter the code it shows.
                </p>
                <code class="bg-muted overflow-x-auto rounded p-2 text-xs">{uri()}</code>
                <div class="flex items-end gap-2">
                  <div class="flex flex-1 flex-col gap-1.5">
                    <Label for="totp-confirm">Code</Label>
                    <Input
                      id="totp-confirm"
                      inputmode="numeric"
                      value={code()}
                      onInput={(event) => setCode(event.currentTarget.value)}
                    />
                  </div>
                  <Button type="submit">Confirm</Button>
                </div>
              </form>
            )}
          </Match>
          <Match when={true}>
            <form onSubmit={start} class="flex items-end gap-2">
              <div class="flex flex-1 flex-col gap-1.5">
                <Label for="totp-password">Confirm password to enable</Label>
                <Input
                  id="totp-password"
                  type="password"
                  value={password()}
                  onInput={(event) => setPassword(event.currentTarget.value)}
                />
              </div>
              <Button type="submit">Enable 2FA</Button>
            </form>
          </Match>
        </Switch>
      </CardContent>
    </Card>
  );
};
