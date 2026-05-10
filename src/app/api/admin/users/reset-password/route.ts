import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { generateSecret, hashPassword } from "@/lib/server/security";
import type { AccountRole } from "@/types";

function canReset(actorRole: AccountRole, targetRole: AccountRole): boolean {
  if (actorRole === "platform_owner") return true;
  if (actorRole === "tenant_owner") return targetRole === "tenant_admin" || targetRole === "member";
  if (actorRole === "tenant_admin") return targetRole === "member";
  return false;
}

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const body = (await request.json()) as { userId?: string; tenantId?: string };
  const userId = body.userId;
  const tenantId = session.role === "platform_owner" && body.tenantId ? body.tenantId : session.currentTenantId;
  if (!userId) {
    return NextResponse.json({ error: "缺少用户 ID" }, { status: 400 });
  }

  const membership = await query<{ role: AccountRole }>(
    `
      SELECT role
      FROM memberships
      WHERE tenant_id = $1 AND user_id = $2 AND status = 'active'
      LIMIT 1
    `,
    [tenantId, userId],
  );
  const targetRole = membership.rows[0]?.role;
  if (!targetRole || !canReset(session.role, targetRole)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const temporaryPassword = generateSecret(12);
  await query(
    `
      UPDATE users
      SET password_hash = $1, password_reset_required = true, updated_at = now()
      WHERE id = $2
    `,
    [await hashPassword(temporaryPassword), userId],
  );

  return NextResponse.json({ temporaryPassword });
}
