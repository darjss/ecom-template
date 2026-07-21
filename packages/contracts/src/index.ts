import { fromString, typeidUnboxed } from "typeid-js";
import * as v from "valibot";
import { ApiErrorCodeSchema, type ClientRequestError } from "./client-error";

export * from "./availability";
export * from "./bundle";
export * from "./cart";
export * from "./catalog";
export * from "./checkout";
export * from "./client-error";
export * from "./cms";
export * from "./discount";
export * from "./grouping";
export * from "./money";
export * from "./order";
export * from "./search";
export * from "./text";

export const ApiErrorSchema = v.strictObject({
  error: v.strictObject({
    code: ApiErrorCodeSchema,
    message: v.string(),
  }),
});

const isStaffId = (value: string) => {
  try {
    fromString(value, "staff");
    return true;
  } catch {
    return false;
  }
};

export const StaffIdSchema = v.pipe(v.string(), v.check(isStaffId, "Invalid Staff ID"));
const isCustomerId = (value: string) => {
  try {
    fromString(value, "customer");
    return true;
  } catch {
    return false;
  }
};
export const CustomerIdSchema = v.pipe(v.string(), v.check(isCustomerId, "Invalid Customer ID"));
export const AuditActorKindSchema = v.picklist([
  "system",
  "staff",
  "customer",
  "provider",
  "telegram_operator",
]);
export const TelegramOperatorLabelSchema = v.pipe(
  v.string(),
  v.trim(),
  v.minLength(1),
  v.maxLength(64),
);
export const TelegramUserIdSchema = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(1),
  v.maxValue(Number.MAX_SAFE_INTEGER),
);
export const StaffRoleSchema = v.picklist(["owner", "manager", "staff"]);

export const AuditActorSchema = v.variant("kind", [
  v.strictObject({
    kind: v.literal("staff"),
    actorId: StaffIdSchema,
    staffRole: StaffRoleSchema,
    telegramOperatorLabel: v.null(),
    telegramUserId: v.null(),
  }),
  v.strictObject({
    kind: v.literal("telegram_operator"),
    actorId: v.null(),
    staffRole: v.null(),
    telegramOperatorLabel: TelegramOperatorLabelSchema,
    telegramUserId: TelegramUserIdSchema,
  }),
  v.strictObject({
    kind: v.picklist(["system", "customer", "provider"]),
    actorId: v.nullable(v.string()),
    staffRole: v.null(),
    telegramOperatorLabel: v.null(),
    telegramUserId: v.null(),
  }),
]);

export const MongolianPhoneSchema = v.pipe(v.string(), v.regex(/^\+976[5-9]\d{7}$/));
export const CustomerOtpCodeSchema = v.pipe(v.string(), v.regex(/^\d{4}$/));
export const CustomerOtpRequestSchema = v.strictObject({
  phone: v.pipe(v.string(), v.trim(), v.minLength(8), v.maxLength(32)),
});
export const CustomerOtpVerifySchema = v.strictObject({
  phone: v.pipe(v.string(), v.trim(), v.minLength(8), v.maxLength(32)),
  code: CustomerOtpCodeSchema,
});
export const CustomerOtpAcceptedResponseSchema = v.strictObject({
  data: v.strictObject({ accepted: v.literal(true) }),
});
export const CustomerSessionResponseSchema = v.strictObject({
  data: v.variant("kind", [
    v.strictObject({ kind: v.literal("anonymous") }),
    v.strictObject({ kind: v.literal("authenticated"), phone: MongolianPhoneSchema }),
  ]),
});
export const CustomerAuthApiErrorSchema = v.strictObject({
  error: v.strictObject({
    code: v.picklist(["unauthorized", "forbidden", "validation", "rate_limited", "unavailable"]),
    message: v.string(),
    retryAfterSeconds: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
  }),
});
export const HealthApiErrorSchema = v.strictObject({
  error: v.strictObject({
    code: v.literal("unavailable"),
    message: v.string(),
  }),
});

export const HealthResponseSchema = v.strictObject({
  data: v.strictObject({
    status: v.literal("ok"),
    database: v.literal("connected"),
    store: v.string(),
    checkedAt: v.string(),
  }),
});

export const StoreDefinitionSchema = v.strictObject({
  profile: v.strictObject({
    slug: v.pipe(v.string(), v.regex(/^[a-z0-9-]+$/)),
    name: v.pipe(v.string(), v.minLength(1)),
    location: v.pipe(v.string(), v.minLength(1)),
    currency: v.literal("MNT"),
    locale: v.literal("mn-MN"),
    capabilities: v.strictObject({
      bankTransfer: v.boolean(),
      cashOnDelivery: v.boolean(),
      customerAccounts: v.boolean(),
      telegram: v.boolean(),
      pickup: v.boolean(),
      delivery: v.boolean(),
    }),
  }),
  providers: v.strictObject({
    payment: v.picklist(["byl", "qpay"]),
    notifications: v.array(v.picklist(["sms_gateway", "telegram"])),
  }),
});

export const StorefrontSummarySchema = v.strictObject({
  storeName: v.string(),
  location: v.string(),
  status: v.literal("open"),
});

export type StaffId = v.InferOutput<typeof StaffIdSchema>;
export type CustomerId = v.InferOutput<typeof CustomerIdSchema>;
export type AuditActorKind = v.InferOutput<typeof AuditActorKindSchema>;
export type AuditActor = v.InferOutput<typeof AuditActorSchema>;
export type TelegramOperatorLabel = v.InferOutput<typeof TelegramOperatorLabelSchema>;
export type TelegramUserId = v.InferOutput<typeof TelegramUserIdSchema>;
export type StaffRole = v.InferOutput<typeof StaffRoleSchema>;
export type MongolianPhone = v.InferOutput<typeof MongolianPhoneSchema>;
export type CustomerOtpRequest = v.InferOutput<typeof CustomerOtpRequestSchema>;
export type CustomerOtpVerify = v.InferOutput<typeof CustomerOtpVerifySchema>;
export type CustomerOtpAcceptedResponse = v.InferOutput<typeof CustomerOtpAcceptedResponseSchema>;
export type CustomerSessionResponse = v.InferOutput<typeof CustomerSessionResponseSchema>;
export type CustomerAuthClientError = ClientRequestError<
  v.InferOutput<typeof CustomerAuthApiErrorSchema>["error"]
>;
export type ApiError = v.InferOutput<typeof ApiErrorSchema>;
export type HealthApiError = v.InferOutput<typeof HealthApiErrorSchema>;
export type HealthResponse = v.InferOutput<typeof HealthResponseSchema>;
export type HealthClientError = ClientRequestError<
  v.InferOutput<typeof HealthApiErrorSchema>["error"]
>;
export type StoreDefinition = v.InferOutput<typeof StoreDefinitionSchema>;
export type StorefrontSummary = v.InferOutput<typeof StorefrontSummarySchema>;

export const createStaffId = () => typeidUnboxed("staff");
export const createCustomerId = () => typeidUnboxed("customer");
export const createAuditEventId = () => typeidUnboxed("audit");
export const parseStaffId = (value: string) => fromString(value, "staff");
export const createCatalogItemId = () => typeidUnboxed("product");
export const parseCatalogItemId = (value: string) => fromString(value, "product");
