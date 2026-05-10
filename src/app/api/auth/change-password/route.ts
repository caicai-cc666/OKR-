import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { hashPassword, verifyPassword } from "@/lib/server/security";

interface PasswordRow {
  password_hash: string;
}

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const body = (await request.json()) as { currentPassword?: string; newPassword?: string };
  const currentPassword = body.currentPassword ?? "";
  const newPassword = body.newPassword ?? "";

  if (newPassword.length < 8) {
    return NextResponse.json({ error: "新密码至少需要 8 位" }, { status: 400 });
  }

  const result = await query<PasswordRow>(
    "SELECT password_hash FROM users WHERE id = $1 LIMIT 1",
    [session.user.id],
  );
  const row = result.rows[0];
  if (!row) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  const valid = await verifyPassword(currentPassword, row.password_hash);
  if (!valid) {
    return NextResponse.json({ error: "当前密码不正确" }, { status: 400 });
  }

  await query(
    `
      UPDATE users
      SET password_hash = $1, password_reset_required = false, updated_at = now()
      WHERE id = $2
    `,
    [await hashPassword(newPassword), session.user.id],
  );

  return NextResponse.json({ ok: true });
}
