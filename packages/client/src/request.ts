import {
  ApiErrorSchema,
  ClientErrorSchema,
  HealthResponseSchema,
  type ClientError,
  type HealthResponse,
} from "@ecom/contracts";
import * as v from "valibot";
import { createApiClient } from "./eden";

const clientError = (error: ClientError) => v.parse(ClientErrorSchema, error);

export const requestHealth = async (): Promise<HealthResponse> => {
  try {
    const response = await createApiClient().api.health.get();
    if (response.error) {
      const parsedError = v.safeParse(ApiErrorSchema, response.error.value);
      if (!parsedError.success) {
        throw clientError({ kind: "contract", message: "Invalid API error response" });
      }
      throw clientError({ kind: "api", error: parsedError.output.error });
    }
    const parsedHealth = v.safeParse(HealthResponseSchema, response.data);
    if (!parsedHealth.success) {
      throw clientError({ kind: "contract", message: "Invalid health response" });
    }
    return parsedHealth.output;
  } catch (error) {
    const parsedError = v.safeParse(ClientErrorSchema, error);
    if (parsedError.success) {
      throw parsedError.output;
    }
    throw clientError({ kind: "network", message: "Network request failed" });
  }
};
