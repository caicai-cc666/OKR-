import { NextRequest, NextResponse } from "next/server";
import { callModel, sanitize, type AdapterError } from "../adapter";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const start = Date.now();
    const result = await callModel(body);
    result.durationMs = Date.now() - start;
    return NextResponse.json(result);
  } catch (thrown: unknown) {
    // AdapterError (structured)
    if (typeof thrown === "object" && thrown !== null && "code" in thrown) {
      const err = thrown as AdapterError;
      return NextResponse.json(
        {
          content: "",
          mode: "live" as const,
          error: err.message,
          errorDetail: { code: err.code, provider: err.provider, model: err.model, statusCode: err.statusCode },
        },
        { status: err.statusCode && err.statusCode < 500 ? err.statusCode : 502 }
      );
    }
    // Generic error
    const message = thrown instanceof Error ? thrown.message : "Unknown error";
    return NextResponse.json(
      { content: "", mode: "live" as const, error: sanitize(message) },
      { status: 500 }
    );
  }
}
