import {
  HealthApiErrorSchema,
  HealthClientErrorSchema,
  HealthResponseSchema,
  type HealthClientError,
  type HealthResponse,
} from "@ecom/contracts";
import * as v from "valibot";
import { createApiClient } from "./eden";

const healthClientError = (error: HealthClientError) => v.parse(HealthClientErrorSchema, error);

export const requestHealth = async (): Promise<HealthResponse> => {
  const response = await createApiClient().api.health.get();
  if (response.error) {
    const parsedError = v.safeParse(HealthApiErrorSchema, response.error.value);
    if (!parsedError.success) {
      throw healthClientError({ kind: "contract", message: "Invalid API error response" });
    }
    throw healthClientError({ kind: "api", error: parsedError.output.error });
  }
  const parsedHealth = v.safeParse(HealthResponseSchema, response.data);
  if (!parsedHealth.success) {
    throw healthClientError({ kind: "contract", message: "Invalid health response" });
  }
  return parsedHealth.output;
};
