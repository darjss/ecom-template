import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/solid-query";
import type { InferErr, InferOk } from "better-result";
import { requestStaffList, requestStaffMutation, type StaffMutation } from "../staff/request";
import { unwrapRequestResult } from "../request";

const staffQueryKey = ["staff"] as const;

type StaffListResult = Awaited<ReturnType<typeof requestStaffList>>;
type StaffMutationResult = Awaited<ReturnType<typeof requestStaffMutation>>;

export const staffQueryOptions = () =>
  queryOptions<InferOk<StaffListResult>, InferErr<StaffListResult>>({
    queryKey: staffQueryKey,
    queryFn: async () => unwrapRequestResult(await requestStaffList()),
  });

const refetchAuthoritativeStaff = async (queryClient: QueryClient) => {
  await queryClient.invalidateQueries({ queryKey: staffQueryKey, refetchType: "none" });
  await queryClient.refetchQueries({ queryKey: staffQueryKey, type: "active" });
};

export const staffMutationOptions = (queryClient: QueryClient) =>
  mutationOptions<InferOk<StaffMutationResult>, InferErr<StaffMutationResult>, StaffMutation>({
    mutationFn: async (mutation) => unwrapRequestResult(await requestStaffMutation(mutation)),
    onSuccess: async () => refetchAuthoritativeStaff(queryClient),
    onError: async (error) => {
      if (error.kind === "api" && error.error.reason === "session_revocation_failed") {
        await refetchAuthoritativeStaff(queryClient);
      }
    },
  });
