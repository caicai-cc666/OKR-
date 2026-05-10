import type { AccountRole } from "@/types";

export interface ServerSessionUser {
  id: string;
  email: string;
  name: string;
  tenantId: string | null;
  role: AccountRole;
}

export function assertTenantAccess(user: ServerSessionUser, tenantId: string): void {
  if (user.role === "platform_owner") return;
  if (user.tenantId !== tenantId) {
    throw new Error("Forbidden tenant access");
  }
}
