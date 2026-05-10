import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/server/auth";

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "AUTH_NOT_CONFIGURED" }, { status: 501 });
  }

  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  return NextResponse.json({ session });
}
