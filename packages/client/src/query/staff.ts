import type { StaffClientError, StaffListResponse } from "@ecom/contracts";
import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/solid-query";
import {
  requestStaffList,
  requestStaffMutation,
  type StaffMutation,
  type StaffMutationResult,
} from "../staff/request";

const staffQueryKey = ["staff"] as const;

export const staffQueryOptions = () =>
  queryOptions<StaffListResponse, StaffClientError>({
    queryKey: staffQueryKey,
    queryFn: requestStaffList,
  });

const refetchAuthoritativeStaff = async (queryClient: QueryClient) => {
  await queryClient.invalidateQueries({ queryKey: staffQueryKey, refetchType: "none" });
  await queryClient.refetchQueries({ queryKey: staffQueryKey, type: "active" });
};

export const staffMutationOptions = (queryClient: QueryClient) =>
  mutationOptions<StaffMutationResult, StaffClientError, StaffMutation>({
    mutationFn: requestStaffMutation,
    onSuccess: async () => refetchAuthoritativeStaff(queryClient),
    onError: async (error) => {
      if (error.kind === "api" && error.error.reason === "session_revocation_failed") {
        await refetchAuthoritativeStaff(queryClient);
      }
    },
  });
