import { polarClient } from "@polar-sh/better-auth/client";
import {
  adminClient,
  magicLinkClient,
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/solid";

export const authClient = createAuthClient({
  plugins: [
    magicLinkClient(),
    twoFactorClient({
      onTwoFactorRedirect: () => {
        window.location.assign("/login?step=verify-2fa");
      },
    }),
    organizationClient(),
    adminClient(),
    polarClient(),
  ],
});

export const { signIn, signUp, signOut, useSession, twoFactor, organization } = authClient;
