import * as v from "valibot";

export const ApiErrorCodeSchema = v.picklist([
  "unauthorized",
  "forbidden",
  "not_found",
  "validation",
  "conflict",
  "rate_limited",
  "unavailable",
  "internal",
]);

const NetworkClientErrorSchema = v.strictObject({
  kind: v.literal("network"),
  message: v.string(),
});

const ContractClientErrorSchema = v.strictObject({
  kind: v.literal("contract"),
  message: v.string(),
});

export const ClientFailureSchema = v.variant("kind", [
  NetworkClientErrorSchema,
  ContractClientErrorSchema,
]);

export const ClientErrorSchema = v.variant("kind", [
  NetworkClientErrorSchema,
  ContractClientErrorSchema,
  v.object({
    kind: v.literal("api"),
    error: v.object({
      code: ApiErrorCodeSchema,
      message: v.string(),
    }),
  }),
]);

export type ClientFailure = v.InferOutput<typeof ClientFailureSchema>;
export type ClientError = v.InferOutput<typeof ClientErrorSchema>;
export type ClientRequestError<ApiError> =
  | ClientFailure
  | {
      readonly kind: "api";
      readonly error: ApiError;
    };
