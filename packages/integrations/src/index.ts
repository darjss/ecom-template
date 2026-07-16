import type { SmsSender } from "@ecom/contracts";
import * as v from "valibot";

export const PaymentProviderSchema = v.picklist(["byl", "qpay"]);
export const NotificationProviderSchema = v.picklist(["sms_gateway", "telegram"]);

export type PaymentProvider = v.InferOutput<typeof PaymentProviderSchema>;
export type NotificationProvider = v.InferOutput<typeof NotificationProviderSchema>;

export type StoreIntegrations = {
  readonly payment: PaymentProvider;
  readonly notifications: readonly NotificationProvider[];
  readonly sendSms: SmsSender;
};
