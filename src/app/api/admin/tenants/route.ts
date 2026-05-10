import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { generateSecret, hashPassword } from "@/lib/server/security";

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function GET() {
  const session = await getCurrentSession();
  if (!session || session.role !== "platform_owner") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const result = await query(
    `
      SELECT id, slug, name, status, created_at, updated_at
      FROM tenants
      ORDER BY created_at DESC
    `,
  );

  return NextResponse.json({ tenants: result.rows });
}

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session || session.role !== "platform_owner") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const body = (await request.json()) as {
    name?: string;
    slug?: string;
    ownerEmail?: string;
    ownerName?: string;
  };

  const name = body.name?.trim();
  const slug = slugify(body.slug || body.name || "");
  const ownerEmail = body.ownerEmail?.trim().toLowerCase();
  const ownerName = body.ownerName?.trim() || "企业超级管理员";

  if (!name || !slug || !ownerEmail) {
    return NextResponse.json({ error: "企业名称、企业标识和管理员邮箱不能为空" }, { status: 400 });
  }

  const temporaryPassword = generateSecret(12);

  const tenantResult = await query<{ id: string }>(
    `
      INSERT INTO tenants (name, slug)
      VALUES ($1, $2)
      ON CONFLICT (slug)
      DO UPDATE SET name = EXCLUDED.name, updated_at = now()
      RETURNING id
    `,
    [name, slug],
  );
  const tenantId = tenantResult.rows[0].id;

  await query(
    `
      INSERT INTO tenant_configs (tenant_id, config)
      VALUES ($1, '{}'::jsonb)
      ON CONFLICT (tenant_id) DO NOTHING
    `,
    [tenantId],
  );

  const userResult = await query<{ id: string }>(
    `
      INSERT INTO users (email, name, password_hash, password_reset_required)
      VALUES ($1, $2, $3, true)
      ON CONFLICT (email)
      DO UPDATE SET
        name = EXCLUDED.name,
        password_hash = EXCLUDED.password_hash,
        password_reset_required = true,
        updated_at = now()
      RETURNING id
    `,
    [ownerEmail, ownerName, await hashPassword(temporaryPassword)],
  );
  const userId = userResult.rows[0].id;

  await query(
    `
      INSERT INTO memberships (tenant_id, user_id, role, status)
      VALUES ($1, $2, 'tenant_owner', 'active')
      ON CONFLICT (tenant_id, user_id)
      DO UPDATE SET role = 'tenant_owner', status = 'active'
    `,
    [tenantId, userId],
  );

  return NextResponse.json({
    tenantId,
    userId,
    email: ownerEmail,
    temporaryPassword,
  });
}
