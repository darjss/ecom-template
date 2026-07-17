import {
  CustomerAuthApiErrorSchema,
  CustomerOtpAcceptedResponseSchema,
  CustomerOtpRequestSchema,
  CustomerOtpVerifySchema,
  CustomerSessionResponseSchema,
  type StoreDefinition,
} from "@ecom/contracts";
import {
  readCustomerSession,
  requestCustomerOtp,
  signOutCustomer,
  verifyCustomerOtp,
  type CustomerAuthFailure,
  type CustomerSmsDelivery,
} from "@ecom/kernel";
import { Elysia } from "elysia";
import * as v from "valibot";
import { resolveStoreRequestOrigin } from "./request-origin";

const authError = (
  code: "unauthorized" | "validation" | "rate_limited" | "unavailable",
  message: string,
  retryAfterSeconds?: number,
) =>
  v.parse(CustomerAuthApiErrorSchema, {
    error: { code, message, ...(retryAfterSeconds ? { retryAfterSeconds } : {}) },
  });

const mapFailure = (
  failure: CustomerAuthFailure,
  status: (code: number, body: unknown) => unknown,
  headers: Record<string, string | number | readonly string[]>,
) => {
  if (failure.code === "invalid_input") {
    return status(422, authError("validation", "Утасны дугаар эсвэл код буруу байна"));
  }
  if (failure.code === "invalid_otp") {
    return status(422, authError("validation", "Код хүчингүй эсвэл хугацаа дууссан"));
  }
  if (failure.code === "rate_limited") {
    headers["retry-after"] = String(failure.retryAfterSeconds);
    return status(
      429,
      authError("rate_limited", "Шинэ код хүсэхийн өмнө түр хүлээнэ үү", failure.retryAfterSeconds),
    );
  }
  return status(
    503,
    authError(
      "unavailable",
      failure.code === "delivery_unavailable"
        ? "Мессеж илгээх үйлчилгээ түр ажиллахгүй байна"
        : "Нэвтрэх үйлчилгээ түр ажиллахгүй байна",
    ),
  );
};

const requestIpAddress = (request: Request) => {
  const source =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0];
  const parsed = v.safeParse(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(64)), source);
  return parsed.success ? parsed.output : "unknown";
};

export const createCustomerAuthRoutes = (
  definition: StoreDefinition,
  smsGateway: CustomerSmsDelivery,
) =>
  new Elysia({ aot: false })
    .post("/auth/customer/otp", async ({ body, request, set, status }) => {
      const input = v.safeParse(CustomerOtpRequestSchema, body);
      if (!input.success) {
        return status(422, authError("validation", "Монгол утасны дугаар оруулна уу"));
      }
      const origin = resolveStoreRequestOrigin(request, definition.profile.slug);
      if (!origin) {
        return status(421, authError("validation", "Request host is not accepted"));
      }
      const result = await requestCustomerOtp(
        input.output.phone,
        requestIpAddress(request),
        smsGateway,
      );
      return result.isErr()
        ? mapFailure(result.error, status, set.headers)
        : v.parse(CustomerOtpAcceptedResponseSchema, { data: result.value });
    })
    .post("/auth/customer/otp/verify", async ({ body, request, set, status }) => {
      const input = v.safeParse(CustomerOtpVerifySchema, body);
      if (!input.success) {
        return status(422, authError("validation", "Утасны дугаар болон 4 оронтой код оруулна уу"));
      }
      const origin = resolveStoreRequestOrigin(request, definition.profile.slug);
      if (!origin) {
        return status(421, authError("validation", "Request host is not accepted"));
      }
      const result = await verifyCustomerOtp(
        request,
        origin,
        input.output.phone,
        input.output.code,
      );
      if (result.isErr()) {
        return mapFailure(result.error, status, set.headers);
      }
      const cookie = result.value.response.headers.get("set-cookie");
      if (cookie) {
        set.headers["set-cookie"] = cookie;
      }
      return v.parse(CustomerSessionResponseSchema, {
        data: { kind: "authenticated", phone: result.value.phone },
      });
    })
    .get("/auth/customer/session", async ({ request, set, status }) => {
      const origin = resolveStoreRequestOrigin(request, definition.profile.slug);
      if (!origin) {
        return status(421, authError("validation", "Request host is not accepted"));
      }
      const session = await readCustomerSession(request, origin);
      if (session.kind === "unavailable") {
        return status(503, authError("unavailable", "Нэвтрэх үйлчилгээ түр ажиллахгүй байна"));
      }
      const cookie = session.responseHeaders.get("set-cookie");
      if (cookie) {
        set.headers["set-cookie"] = cookie;
      }
      return v.parse(CustomerSessionResponseSchema, {
        data:
          session.kind === "active"
            ? { kind: "authenticated", phone: session.phone }
            : { kind: "anonymous" },
      });
    })
    .post("/auth/customer/logout", async ({ request, set, status }) => {
      const origin = resolveStoreRequestOrigin(request, definition.profile.slug);
      if (!origin) {
        return status(421, authError("validation", "Request host is not accepted"));
      }
      const response = await signOutCustomer(request, origin);
      if (!response?.ok) {
        return status(503, authError("unavailable", "Гарах үйлдлийг хийж чадсангүй"));
      }
      const cookie = response.headers.get("set-cookie");
      if (cookie) {
        set.headers["set-cookie"] = cookie;
      }
      return v.parse(CustomerSessionResponseSchema, { data: { kind: "anonymous" } });
    });
