import { NextResponse } from "next/server";
import { clearSessionCookie, destroyCurrentSession } from "@/lib/server/auth";

export async function POST() {
  await destroyCurrentSession();
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
