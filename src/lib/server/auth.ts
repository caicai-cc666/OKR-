import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { query } from "@/lib/server/db";
import { verifyPassword } from "@/lib/server/security";
import type { AccountRole, Tenant, TenantMembership, UserAccount } from "@/types";

export const SESSION_COOKIE = "okr_session";
const SESSION_DAYS = 14;
const PLATFORM_TENANT_ID = "platform";

export interface AuthSessionPayload {
  user: UserAccount;
  tenants: Tenant[];
  memberships: TenantMembership[];
  currentTenantId: string;
  role: AccountRole;
  passwordResetRequired: boolean;
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  status: "active" | "inactive";
  password_reset_required: boolean;
}

interface MembershipRow {
  id: string;
  tenant_id: string | null;
  user_id: string;
  role: AccountRole;
  status: "active" | "inactive";
}

interface TenantRow {
  id: string;
  name: string;
  status: "active" | "inactive";
  owner_user_id: string | null;
  created_at: Date | string;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function sessionExpiresAt(): Date {
  return new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
}

function mapTenant(row: TenantRow): Tenant {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    ownerUserId: row.owner_user_id ?? "",
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function mapMembership(row: MembershipRow): TenantMembership {
  return {
    id: row.id,
    tenantId: row.tenant_id ?? PLATFORM_TENANT_ID,
    userId: row.user_id,
    role: row.role,
    status: row.status,
  };
}

async function buildSessionPayload(user: Omit<UserRow, "password_hash">): Promise<AuthSessionPayload> {
  const membershipResult = await query<MembershipRow>(
    `
      SELECT id, tenant_id, user_id, role, status
      FROM memberships
      WHERE user_id = $1 AND status = 'active'
      ORDER BY
        CASE role
          WHEN 'platform_owner' THEN 0
          WHEN 'tenant_owner' THEN 1
          WHEN 'tenant_admin' THEN 2
          ELSE 3
        END,
        created_at ASC
    `,
    [user.id],
  );

  const memberships = membershipResult.rows.map(mapMembership);
  const isPlatformOwner = memberships.some((item) => item.role === "platform_owner");

  const tenantResult = isPlatformOwner
    ? await query<TenantRow>(
        `
          SELECT t.id, t.name, t.status, owner.user_id::text AS owner_user_id, t.created_at
          FROM tenants t
          LEFT JOIN LATERAL (
            SELECT user_id
            FROM memberships
            WHERE tenant_id = t.id AND role = 'tenant_owner' AND status = 'active'
            ORDER BY created_at ASC
            LIMIT 1
          ) owner ON true
          WHERE t.status = 'active'
          ORDER BY t.created_at ASC
        `,
      )
    : await query<TenantRow>(
        `
          SELECT t.id, t.name, t.status, owner.user_id::text AS owner_user_id, t.created_at
          FROM tenants t
          JOIN memberships m ON m.tenant_id = t.id
          LEFT JOIN LATERAL (
            SELECT user_id
            FROM memberships
            WHERE tenant_id = t.id AND role = 'tenant_owner' AND status = 'active'
            ORDER BY created_at ASC
            LIMIT 1
          ) owner ON true
          WHERE m.user_id = $1 AND m.status = 'active' AND t.status = 'active'
          ORDER BY t.created_at ASC
        `,
        [user.id],
      );

  const tenants = tenantResult.rows.map(mapTenant);
  const tenantMembership = memberships.find((item) => item.tenantId !== PLATFORM_TENANT_ID);
  const currentTenantId = tenantMembership?.tenantId ?? tenants[0]?.id ?? PLATFORM_TENANT_ID;
  const role = memberships.find((item) => item.tenantId === currentTenantId)?.role ?? memberships[0]?.role;

  if (!role) {
    throw new Error("User has no active membership");
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    tenants,
    memberships,
    currentTenantId,
    role,
    passwordResetRequired: user.password_reset_required,
  };
}

export async function authenticateWithPassword(email: string, password: string): Promise<AuthSessionPayload & { token: string; expiresAt: Date }> {
  const normalizedEmail = email.trim().toLowerCase();
  const result = await query<UserRow>(
    `
      SELECT id, email, name, password_hash, status, password_reset_required
      FROM users
      WHERE email = $1
      LIMIT 1
    `,
    [normalizedEmail],
  );

  const user = result.rows[0];
  if (!user || user.status !== "active") {
    throw new Error("Invalid email or password");
  }

  const isValid = await verifyPassword(password, user.password_hash);
  if (!isValid) {
    throw new Error("Invalid email or password");
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = sessionExpiresAt();

  await query(
    `
      INSERT INTO sessions (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
    `,
    [user.id, hashToken(token), expiresAt],
  );

  return {
    ...(await buildSessionPayload(user)),
    token,
    expiresAt,
  };
}

export async function getCurrentSession(): Promise<AuthSessionPayload | null> {
  if (!process.env.DATABASE_URL) return null;

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const result = await query<Omit<UserRow, "password_hash">>(
    `
      SELECT u.id, u.email, u.name, u.status, u.password_reset_required
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now() AND u.status = 'active'
      LIMIT 1
    `,
    [hashToken(token)],
  );

  const user = result.rows[0];
  return user ? buildSessionPayload(user) : null;
}

export async function destroyCurrentSession(): Promise<void> {
  if (!process.env.DATABASE_URL) return;

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return;

  await query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
}

export function setSessionCookie(response: NextResponse, token: string, expiresAt: Date): void {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
