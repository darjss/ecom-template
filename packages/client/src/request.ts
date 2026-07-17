import {
  ClientFailureSchema,
  HealthApiErrorSchema,
  HealthResponseSchema,
  type ClientRequestError,
} from "@ecom/contracts";
import { Result, type InferOk, type Result as ResultType } from "better-result";
import * as v from "valibot";
import { createApiClient } from "./eden";

type EdenResponse<Data, ApiErrorEnvelope> = {
  readonly data: Data | null;
  readonly error: { readonly value: ApiErrorEnvelope } | null;
};

export const requestResult = async <
  ResponseData,
  ResponseError,
  DataInput,
  Data,
  ErrorInput,
  ApiError,
>(
  request: () => Promise<EdenResponse<ResponseData, ResponseError>>,
  dataSchema: v.GenericSchema<DataInput, Data>,
  errorSchema: v.GenericSchema<ErrorInput, { readonly error: ApiError }>,
  invalidDataMessage: string,
): Promise<ResultType<Data, ClientRequestError<ApiError>>> => {
  try {
    const response = await request();
    if (response.error) {
      const parsedError = v.safeParse(errorSchema, response.error.value);
      return parsedError.success
        ? Result.err({ kind: "api", error: parsedError.output.error })
        : Result.err({ kind: "contract", message: "Invalid API error response" });
    }
    const parsedData = v.safeParse(dataSchema, response.data);
    return parsedData.success
      ? Result.ok(parsedData.output)
      : Result.err({ kind: "contract", message: invalidDataMessage });
  } catch (error) {
    const parsedFailure = v.safeParse(ClientFailureSchema, error);
    if (parsedFailure.success && parsedFailure.output.kind === "network") {
      return Result.err(parsedFailure.output);
    }
    throw error;
  }
};

export function unwrapRequestResult<Request extends ResultType<unknown, unknown>>(
  result: Request,
): InferOk<Request>;
export function unwrapRequestResult(result: ResultType<unknown, unknown>): unknown {
  if (result.isErr()) {
    throw result.error;
  }
  return result.value;
}

export const requestHealth = () =>
  requestResult(
    () => createApiClient().api.health.get(),
    HealthResponseSchema,
    HealthApiErrorSchema,
    "Invalid health response",
  );
