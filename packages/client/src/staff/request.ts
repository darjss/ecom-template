import {
  StaffCleanupResponseSchema,
  StaffLifecycleApiErrorSchema,
  StaffListResponseSchema,
  StaffMutationResponseSchema,
  type StaffCleanupResponse,
  type StaffCreateInput,
  type StaffId,
  type StaffMutationResponse,
  type StaffRole,
} from "@ecom/contracts";
import { createApiClient } from "../eden";
import { requestResult } from "../request";

export const requestStaffList = () =>
  requestResult(
    () => createApiClient().api.staff.get(),
    StaffListResponseSchema,
    StaffLifecycleApiErrorSchema,
    "Invalid Staff list response",
  );

export type StaffMutation =
  | ({ readonly kind: "create" } & StaffCreateInput)
  | { readonly kind: "cleanup" }
  | { readonly kind: "approve"; readonly id: StaffId; readonly role: StaffRole }
  | { readonly kind: "role"; readonly id: StaffId; readonly role: StaffRole }
  | { readonly kind: "revoke"; readonly id: StaffId }
  | { readonly kind: "remove"; readonly id: StaffId };

export type StaffMutationResult = StaffMutationResponse | StaffCleanupResponse;

export const requestStaffMutation = (mutation: StaffMutation) => {
  const client = createApiClient();
  if (mutation.kind === "cleanup") {
    return requestResult(
      () => client.api.staff["session-cleanup"].retry.post(),
      StaffCleanupResponseSchema,
      StaffLifecycleApiErrorSchema,
      "Invalid Staff mutation response",
    );
  }
  const request = () =>
    mutation.kind === "create"
      ? client.api.staff.post({ email: mutation.email, role: mutation.role })
      : mutation.kind === "approve"
        ? client.api.staff({ id: mutation.id }).approve.post({ role: mutation.role })
        : mutation.kind === "role"
          ? client.api.staff({ id: mutation.id }).role.patch({ role: mutation.role })
          : mutation.kind === "revoke"
            ? client.api.staff({ id: mutation.id }).revoke.post()
            : client.api.staff({ id: mutation.id }).delete();
  return requestResult(
    request,
    StaffMutationResponseSchema,
    StaffLifecycleApiErrorSchema,
    "Invalid Staff mutation response",
  );
};
