import type { StaffRole } from "@ecom/contracts";

export type AdminSurface = "staff_management" | "landing";

export const resolveAdminSurface = (role: StaffRole): AdminSurface =>
  role === "owner" ? "staff_management" : "landing";
