import { Elysia, t } from "elysia";
import { env } from "@/env";
import { paymentProvider } from "@/server/billing";
import { authPlugin } from "../plugins/auth";

export const billingRoute = new Elysia({ prefix: "/billing" })
  .use(authPlugin)
  .get("/state", ({ user }) => paymentProvider.getCustomerState(user.id), {
    requireAuth: true,
  })
  .post(
    "/checkout",
    ({ user, body }) =>
      paymentProvider.createCheckout({
        userId: user.id,
        userEmail: user.email,
        planSlug: body.planSlug,
        successUrl: `${env.APP_URL}/app/billing?checkout=success`,
      }),
    {
      requireAuth: true,
      body: t.Object({ planSlug: t.String({ minLength: 1 }) }),
    },
  );
