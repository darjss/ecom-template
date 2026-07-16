import type { StaffClientError, StaffListResponse, StaffMutationResponse } from "@ecom/contracts";
import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/solid-query";
import { requestStaffList, requestStaffMutation, type StaffMutation } from "../staff/request";

const staffQueryKey = ["staff"] as const;

export const staffQueryOptions = () =>
  queryOptions<StaffListResponse, StaffClientError>({
    queryKey: staffQueryKey,
    queryFn: requestStaffList,
  });

export const staffMutationOptions = (queryClient: QueryClient) =>
  mutationOptions<StaffMutationResponse, StaffClientError, StaffMutation>({
    mutationFn: requestStaffMutation,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: staffQueryKey });
    },
  });
