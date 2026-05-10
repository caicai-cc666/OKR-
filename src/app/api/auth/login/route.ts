import { NextResponse } from "next/server";
import { authenticateWithPassword, setSessionCookie } from "@/lib/server/auth";

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "AUTH_NOT_CONFIGURED" }, { status: 501 });
  }

  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const email = body.email?.trim();
    const password = body.password ?? "";

    if (!email || !password) {
      return NextResponse.json({ error: "邮箱和密码不能为空" }, { status: 400 });
    }

    const { token, expiresAt, ...session } = await authenticateWithPassword(email, password);
    const response = NextResponse.json({ session });
    setSessionCookie(response, token, expiresAt);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "登录失败";
    const status = message === "Invalid email or password" ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? "邮箱或密码错误" : message }, { status });
  }
}
