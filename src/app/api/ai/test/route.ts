import { NextRequest, NextResponse } from "next/server";
import { testModelConnection, sanitize } from "../adapter";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await testModelConnection(body);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({
      success: false,
      message: sanitize(message),
      error: { code: "INTERNAL", message: sanitize(message), provider: "unknown", model: "unknown" },
    });
  }
}
