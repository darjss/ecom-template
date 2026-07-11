import { Match, Show, Switch, createSignal } from "solid-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { signIn } from "@/lib/auth-client";
import { MagicLinkForm } from "./MagicLinkForm";
import { SignInForm } from "./SignInForm";
import { SignUpForm } from "./SignUpForm";
import { TwoFactorVerify } from "./TwoFactorVerify";

interface AuthCardProps {
  step: string | null;
  redirect: string;
  googleEnabled: boolean;
}

export const AuthCard = (props: AuthCardProps) => {
  const [tab, setTab] = createSignal("sign-in");

  const google = () => signIn.social({ provider: "google", callbackURL: props.redirect });

  return (
    <Card class="w-full max-w-md">
      <Switch>
        <Match when={props.step === "verify-2fa"}>
          <CardHeader>
            <CardTitle>Two-factor verification</CardTitle>
          </CardHeader>
          <CardContent>
            <TwoFactorVerify redirect={props.redirect} />
          </CardContent>
        </Match>
        <Match when={true}>
          <CardHeader>
            <CardTitle>{tab() === "sign-in" ? "Welcome back" : "Create your account"}</CardTitle>
          </CardHeader>
          <CardContent class="flex flex-col gap-4">
            <Tabs value={tab()} onChange={setTab}>
              <TabsList class="w-full">
                <TabsTrigger value="sign-in" class="flex-1">
                  Sign in
                </TabsTrigger>
                <TabsTrigger value="sign-up" class="flex-1">
                  Register
                </TabsTrigger>
              </TabsList>
              <TabsContent value="sign-in" class="mt-4">
                <SignInForm redirect={props.redirect} />
              </TabsContent>
              <TabsContent value="sign-up" class="mt-4">
                <SignUpForm redirect={props.redirect} />
              </TabsContent>
            </Tabs>
            <Separator />
            <MagicLinkForm redirect={props.redirect} />
            <Show when={props.googleEnabled}>
              <Button variant="outline" onClick={google}>
                Continue with Google
              </Button>
            </Show>
          </CardContent>
        </Match>
      </Switch>
    </Card>
  );
};
