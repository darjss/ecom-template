import {
  StaffLifecycleApiErrorSchema,
  StaffListResponseSchema,
  StaffMutationResponseSchema,
  type StaffCreateInput,
  type StaffId,
  type StaffRole,
} from "@ecom/contracts";
import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/solid-query";
import type { InferErr, InferOk } from "better-result";
import { createApiClient } from "./eden";
import { requestResult, unwrapRequestResult } from "./request";

const staffQueryKey = ["staff"] as const;

export type StaffMutation =
  | ({ readonly kind: "create" } & StaffCreateInput)
  | { readonly kind: "approve"; readonly id: StaffId; readonly role: StaffRole }
  | { readonly kind: "role"; readonly id: StaffId; readonly role: StaffRole }
  | { readonly kind: "revoke"; readonly id: StaffId }
  | { readonly kind: "remove"; readonly id: StaffId };

const requestStaffList = () =>
  requestResult(
    () => createApiClient().api.staff.get(),
    StaffListResponseSchema,
    StaffLifecycleApiErrorSchema,
    "Invalid Staff list response",
  );

const requestStaffMutation = (mutation: StaffMutation) => {
  const client = createApiClient();
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

type StaffListResult = Awaited<ReturnType<typeof requestStaffList>>;
type StaffMutationResult = Awaited<ReturnType<typeof requestStaffMutation>>;

export const staffQueryOptions = () =>
  queryOptions<InferOk<StaffListResult>, InferErr<StaffListResult>>({
    queryKey: staffQueryKey,
    queryFn: async () => unwrapRequestResult(await requestStaffList()),
  });

export const staffMutationOptions = (queryClient: QueryClient) =>
  mutationOptions<InferOk<StaffMutationResult>, InferErr<StaffMutationResult>, StaffMutation>({
    mutationFn: async (mutation) => unwrapRequestResult(await requestStaffMutation(mutation)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: staffQueryKey, refetchType: "none" });
      await queryClient.refetchQueries({ queryKey: staffQueryKey, type: "active" });
    },
  });
