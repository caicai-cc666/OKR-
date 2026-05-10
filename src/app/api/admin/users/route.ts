import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { generateSecret, hashPassword } from "@/lib/server/security";
import type { AccountRole } from "@/types";

const manageableRoles: AccountRole[] = ["tenant_owner", "tenant_admin", "member"];

function canManageUsers(role: AccountRole): boolean {
  return role === "platform_owner" || role === "tenant_owner" || role === "tenant_admin";
}

function canAssignRole(actorRole: AccountRole, targetRole: AccountRole): boolean {
  if (actorRole === "platform_owner") return manageableRoles.includes(targetRole);
  if (actorRole === "tenant_owner") return targetRole === "tenant_admin" || targetRole === "member";
  if (actorRole === "tenant_admin") return targetRole === "member";
  return false;
}

async function tenantForRequest(request: Request, role: AccountRole, currentTenantId: string): Promise<string> {
  const url = new URL(request.url);
  const requested = url.searchParams.get("tenantId")?.trim();
  if (role === "platform_owner" && requested) return requested;
  return currentTenantId;
}

export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session || !canManageUsers(session.role)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const tenantId = await tenantForRequest(request, session.role, session.currentTenantId);
  const result = await query(
    `
      SELECT
        u.id,
        u.email,
        u.name,
        u.status,
        u.password_reset_required,
        m.role,
        m.status AS membership_status,
        m.tenant_id
      FROM memberships m
      JOIN users u ON u.id = m.user_id
      WHERE m.tenant_id = $1
      ORDER BY
        CASE m.role
          WHEN 'tenant_owner' THEN 0
          WHEN 'tenant_admin' THEN 1
          ELSE 2
        END,
        u.created_at DESC
    `,
    [tenantId],
  );

  return NextResponse.json({ users: result.rows });
}

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session || !canManageUsers(session.role)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const body = (await request.json()) as {
    tenantId?: string;
    email?: string;
    name?: string;
    role?: AccountRole;
  };

  const tenantId = session.role === "platform_owner" && body.tenantId ? body.tenantId : session.currentTenantId;
  const email = body.email?.trim().toLowerCase();
  const name = body.name?.trim() || email;
  const role = body.role ?? "member";

  if (!email || !name || !canAssignRole(session.role, role)) {
    return NextResponse.json({ error: "用户信息不完整或角色权限不足" }, { status: 400 });
  }

  const temporaryPassword = generateSecret(12);
  const userResult = await query<{ id: string }>(
    `
      INSERT INTO users (email, name, password_hash, password_reset_required)
      VALUES ($1, $2, $3, true)
      ON CONFLICT (email)
      DO UPDATE SET
        name = EXCLUDED.name,
        password_hash = EXCLUDED.password_hash,
        password_reset_required = true,
        status = 'active',
        updated_at = now()
      RETURNING id
    `,
    [email, name, await hashPassword(temporaryPassword)],
  );
  const userId = userResult.rows[0].id;

  await query(
    `
      INSERT INTO memberships (tenant_id, user_id, role, status)
      VALUES ($1, $2, $3, 'active')
      ON CONFLICT (tenant_id, user_id)
      DO UPDATE SET role = EXCLUDED.role, status = 'active'
    `,
    [tenantId, userId, role],
  );

  return NextResponse.json({ userId, email, role, temporaryPassword });
}
