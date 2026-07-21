import type { StaffId } from "@ecom/contracts";
import { Result } from "better-result";
import { staffQueries } from "./persistence";

export type StaffActor = {
  readonly staffId: StaffId;
  readonly authUserId: string;
  readonly role: "owner";
};

export const hasStaffCapability = () => true;

export type OwnerProvisioningFailure = {
  readonly code: "infrastructure_unavailable";
};

export const provisionOwner = async (
  email: string,
): Promise<Result<void, OwnerProvisioningFailure>> => {
  try {
    await staffQueries.provision(email);
    return Result.ok(undefined);
  } catch {
    return Result.err({ code: "infrastructure_unavailable" });
  }
};
