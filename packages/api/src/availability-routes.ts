import {
  AvailabilityApiErrorSchema,
  AvailabilityRequestSchema,
  AvailabilityResponseSchema,
} from "@ecom/contracts";
import { readAvailability } from "@ecom/kernel";
import { Elysia } from "elysia";
import * as v from "valibot";

const availabilityError = (
  status: (code: number, body: unknown) => unknown,
  code: "validation" | "unavailable",
  message: string,
) =>
  status(
    code === "validation" ? 422 : 503,
    v.parse(AvailabilityApiErrorSchema, { error: { code, message } }),
  );

export const createAvailabilityRoutes = () =>
  new Elysia({ aot: false }).post("/catalog/availability", async ({ body, status }) => {
    const input = v.safeParse(AvailabilityRequestSchema, body);
    if (!input.success) {
      return availabilityError(
        status,
        "validation",
        "One to 50 unique purchase targets are required",
      );
    }
    const result = await readAvailability(input.output);
    return result.isErr()
      ? availabilityError(status, "unavailable", "Current availability is unavailable")
      : v.parse(AvailabilityResponseSchema, result.value);
  });
