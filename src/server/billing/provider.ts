import type { BetterAuthPlugin } from "better-auth";

export interface CheckoutInput {
  userId: string;
  userEmail: string;
  planSlug: string;
  successUrl: string;
}

export interface CustomerState {
  activePlanSlug: string | null;
  subscriptionStatus: "active" | "canceled" | "none";
  portalConfigured: boolean;
}

export interface PaymentProvider {
  name: string;
  createCheckout: (input: CheckoutInput) => Promise<{ url: string }>;
  getCustomerState: (userId: string) => Promise<CustomerState>;
  authPlugin: BetterAuthPlugin;
}
