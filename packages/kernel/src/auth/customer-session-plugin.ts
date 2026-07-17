import { CustomerIdSchema, MongolianPhoneSchema } from "@ecom/contracts";
import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import * as v from "valibot";

const EstablishCustomerSessionSchema = v.strictObject({
  customerId: CustomerIdSchema,
  phone: MongolianPhoneSchema,
});

export const customerSessionPlugin = () =>
  ({
    id: "store-customer-session",
    endpoints: {
      establishCustomerSession: createAuthEndpoint(
        "/establish-customer-session",
        { method: "POST", body: EstablishCustomerSessionSchema },
        async (context) => {
          const email = `${context.body.customerId}@customer.invalid`;
          const existing = await context.context.internalAdapter.findUserById(
            context.body.customerId,
          );
          if (existing && existing.email !== email) {
            throw new Error("Customer Auth identity does not match the Store Customer");
          }
          const user =
            existing ??
            (await context.context.internalAdapter.createUser({
              id: context.body.customerId,
              email,
              emailVerified: true,
              name: context.body.phone,
            }));
          const session = await context.context.internalAdapter.createSession(user.id, false);
          if (!session) {
            throw new Error("Customer Auth session could not be created");
          }
          await setSessionCookie(context, { session, user }, false);
          return context.json({ customerId: context.body.customerId });
        },
      ),
    },
  }) satisfies BetterAuthPlugin;
