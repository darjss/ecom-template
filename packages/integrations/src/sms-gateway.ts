import { Result } from "better-result";
import { env } from "cloudflare:workers";
import * as v from "valibot";

const SmsGatewayResponseSchema = v.strictObject({ accepted: v.literal(true) });

export type SmsDeliveryIntent = {
  readonly requestId: string;
  readonly phone: string;
  readonly message: string;
};

export type SmsDeliveryFailure = { readonly code: "delivery_unavailable" };

const attemptDelivery = async (intent: SmsDeliveryIntent) => {
  const response = await env.SMS_GATEWAY.fetch("https://sms-gateway.internal/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": intent.requestId,
    },
    body: JSON.stringify({
      requestId: intent.requestId,
      phone: intent.phone,
      message: intent.message,
    }),
  });
  if (!response.ok) {
    return false;
  }
  const parsed = v.safeParse(SmsGatewayResponseSchema, await response.json());
  return parsed.success;
};

export const deliverSms = async (
  intent: SmsDeliveryIntent,
): Promise<Result<undefined, SmsDeliveryFailure>> => {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      if (await attemptDelivery(intent)) {
        return Result.ok(undefined);
      }
    } catch {
      continue;
    }
  }
  return Result.err({ code: "delivery_unavailable" });
};
