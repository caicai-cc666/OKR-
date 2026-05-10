import { NextRequest, NextResponse } from "next/server";
import { callModel, sanitize, type AdapterError } from "../adapter";
import { getCurrentSession } from "@/lib/server/auth";
import { getPlatformModelConfig } from "@/lib/server/platform-model";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const session = await getCurrentSession();
    const hasTenantApiKey = typeof body.apiKey === "string" && body.apiKey.trim().length > 0;
    const platformModel = session && !hasTenantApiKey ? await getPlatformModelConfig() : null;
    const requestBody = platformModel
      ? {
          ...body,
          provider: platformModel.provider,
          modelId: platformModel.modelId,
          apiBaseUrl: platformModel.apiBaseUrl,
          apiKey: platformModel.apiKey,
          connectionType: platformModel.connectionType,
          temperature: body.temperature ?? platformModel.temperature,
          topP: body.topP ?? platformModel.topP,
          customHeaders: platformModel.customHeaders ?? body.customHeaders,
          customParams: platformModel.customParams ?? body.customParams,
        }
      : body;
    const start = Date.now();
    const result = await callModel(requestBody);
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
