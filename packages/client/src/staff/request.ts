import {
  StaffClientErrorSchema,
  StaffLifecycleApiErrorSchema,
  StaffListResponseSchema,
  StaffMutationResponseSchema,
  type StaffClientError,
  type StaffListResponse,
  type StaffMutationResponse,
  type StaffRole,
} from "@ecom/contracts";
import * as v from "valibot";
import { createApiClient } from "../eden";

const clientError = (error: StaffClientError) => v.parse(StaffClientErrorSchema, error);

const parseFailure = (source: unknown): StaffClientError => {
  const parsed = v.safeParse(StaffLifecycleApiErrorSchema, source);
  return parsed.success
    ? clientError({ kind: "api", error: parsed.output.error })
    : clientError({ kind: "contract", message: "Invalid Staff API error response" });
};

export const requestStaffList = async (): Promise<StaffListResponse> => {
  const response = await createApiClient().api.staff.get();
  if (response.error) {
    throw parseFailure(response.error.value);
  }
  const parsed = v.safeParse(StaffListResponseSchema, response.data);
  if (!parsed.success) {
    throw clientError({ kind: "contract", message: "Invalid Staff list response" });
  }
  return parsed.output;
};

export type StaffMutation =
  | { readonly kind: "approve"; readonly id: string; readonly role: StaffRole }
  | { readonly kind: "role"; readonly id: string; readonly role: StaffRole }
  | { readonly kind: "revoke"; readonly id: string }
  | { readonly kind: "remove"; readonly id: string };

export const requestStaffMutation = async (
  mutation: StaffMutation,
): Promise<StaffMutationResponse> => {
  const client = createApiClient();
  const response =
    mutation.kind === "approve"
      ? await client.api.staff({ id: mutation.id }).approve.post({ role: mutation.role })
      : mutation.kind === "role"
        ? await client.api.staff({ id: mutation.id }).role.patch({ role: mutation.role })
        : mutation.kind === "revoke"
          ? await client.api.staff({ id: mutation.id }).revoke.post()
          : await client.api.staff({ id: mutation.id }).delete();
  if (response.error) {
    throw parseFailure(response.error.value);
  }
  const parsed = v.safeParse(StaffMutationResponseSchema, response.data);
  if (!parsed.success) {
    throw clientError({ kind: "contract", message: "Invalid Staff mutation response" });
  }
  return parsed.output;
};
