import { fromString, typeidUnboxed } from "typeid-js";
import * as v from "valibot";
import { ApiErrorCodeSchema, type ClientRequestError } from "./client-error";

export * from "./bundle";
export * from "./catalog";
export * from "./client-error";
export * from "./cms";
export * from "./grouping";

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
export const StaffStatusSchema = v.picklist(["pending", "active", "revoked"]);

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

const StaffTimestampSchema = v.pipe(v.string(), v.isoTimestamp());
export const StaffMemberSchema = v.pipe(
  v.variant("status", [
    v.strictObject({
      id: StaffIdSchema,
      email: v.pipe(v.string(), v.email()),
      status: v.literal("pending"),
      role: v.nullable(StaffRoleSchema),
      createdAt: StaffTimestampSchema,
      updatedAt: StaffTimestampSchema,
      approvedAt: v.null(),
      revokedAt: v.null(),
    }),
    v.strictObject({
      id: StaffIdSchema,
      email: v.pipe(v.string(), v.email()),
      status: v.literal("active"),
      role: StaffRoleSchema,
      createdAt: StaffTimestampSchema,
      updatedAt: StaffTimestampSchema,
      approvedAt: StaffTimestampSchema,
      revokedAt: v.null(),
    }),
    v.strictObject({
      id: StaffIdSchema,
      email: v.pipe(v.string(), v.email()),
      status: v.literal("revoked"),
      role: v.nullable(StaffRoleSchema),
      createdAt: StaffTimestampSchema,
      updatedAt: StaffTimestampSchema,
      approvedAt: StaffTimestampSchema,
      revokedAt: StaffTimestampSchema,
    }),
  ]),
  v.check((member) => {
    const createdAt = Date.parse(member.createdAt);
    const updatedAt = Date.parse(member.updatedAt);
    const approvedAt = member.approvedAt === null ? createdAt : Date.parse(member.approvedAt);
    const revokedAt = member.revokedAt === null ? approvedAt : Date.parse(member.revokedAt);
    return createdAt <= approvedAt && approvedAt <= revokedAt && revokedAt <= updatedAt;
  }, "Invalid Staff lifecycle timestamps"),
);

export const StaffListResponseSchema = v.strictObject({
  data: v.strictObject({ members: v.array(StaffMemberSchema) }),
});

export const StaffCreateInputSchema = v.strictObject({
  email: v.pipe(v.string(), v.trim(), v.toLowerCase(), v.email()),
  role: StaffRoleSchema,
});

export const StaffMutationInputSchema = v.strictObject({
  role: StaffRoleSchema,
});

export const StaffMutationResponseSchema = v.strictObject({ data: StaffMemberSchema });

export const StaffLifecycleApiErrorSchema = v.strictObject({
  error: v.strictObject({
    code: v.picklist([
      "unauthorized",
      "forbidden",
      "not_found",
      "validation",
      "conflict",
      "unavailable",
    ]),
    reason: v.optional(
      v.picklist(["final_owner", "invalid_transition", "session_revocation_failed"]),
    ),
    message: v.string(),
  }),
});

export const StaffSessionStateSchema = v.variant("kind", [
  v.strictObject({ kind: v.literal("active"), role: StaffRoleSchema }),
  v.strictObject({ kind: v.literal("awaiting_approval") }),
  v.strictObject({ kind: v.literal("identity_conflict") }),
  v.strictObject({ kind: v.literal("unauthorized") }),
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

export const CartLineSchema = v.strictObject({
  id: v.string(),
  title: v.string(),
  quantity: v.pipe(v.number(), v.integer(), v.minValue(1)),
  unitPriceMnt: v.pipe(v.number(), v.integer(), v.minValue(0)),
});

export const CartSchema = v.strictObject({
  lines: v.array(CartLineSchema),
});

export type StaffId = v.InferOutput<typeof StaffIdSchema>;
export type CustomerId = v.InferOutput<typeof CustomerIdSchema>;
export type AuditActorKind = v.InferOutput<typeof AuditActorKindSchema>;
export type AuditActor = v.InferOutput<typeof AuditActorSchema>;
export type TelegramOperatorLabel = v.InferOutput<typeof TelegramOperatorLabelSchema>;
export type TelegramUserId = v.InferOutput<typeof TelegramUserIdSchema>;
export type StaffRole = v.InferOutput<typeof StaffRoleSchema>;
export type StaffStatus = v.InferOutput<typeof StaffStatusSchema>;
export type StaffMember = v.InferOutput<typeof StaffMemberSchema>;
export type StaffCreateInput = v.InferOutput<typeof StaffCreateInputSchema>;
export type StaffListResponse = v.InferOutput<typeof StaffListResponseSchema>;
export type StaffMutationResponse = v.InferOutput<typeof StaffMutationResponseSchema>;
export type StaffClientError = ClientRequestError<
  v.InferOutput<typeof StaffLifecycleApiErrorSchema>["error"]
>;
export type StaffSessionState = v.InferOutput<typeof StaffSessionStateSchema>;
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
export type Cart = v.InferOutput<typeof CartSchema>;
export type CartLine = v.InferOutput<typeof CartLineSchema>;

export const createStaffId = () => typeidUnboxed("staff");
export const createCustomerId = () => typeidUnboxed("customer");
export const createAuditEventId = () => typeidUnboxed("audit");
export const parseStaffId = (value: string) => fromString(value, "staff");
export const createCatalogItemId = () => typeidUnboxed("product");
export const parseCatalogItemId = (value: string) => fromString(value, "product");
