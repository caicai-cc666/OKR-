import { NextResponse } from "next/server";
import { callModel } from "@/app/api/ai/adapter";
import { getCurrentSession } from "@/lib/server/auth";
import { getPlatformModelConfig, savePlatformModelConfig } from "@/lib/server/platform-model";

export async function GET() {
  const session = await getCurrentSession();
  if (!session || session.role !== "platform_owner") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const config = await getPlatformModelConfig();
  if (!config) {
    return NextResponse.json({ configured: false });
  }

  return NextResponse.json({
    configured: true,
    config: {
      provider: config.provider,
      modelId: config.modelId,
      apiBaseUrl: config.apiBaseUrl,
      connectionType: config.connectionType,
      temperature: config.temperature,
      topP: config.topP,
      customHeaders: config.customHeaders,
      customParams: config.customParams,
      apiKeyMasked: "********",
    },
  });
}

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session || session.role !== "platform_owner") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const body = (await request.json()) as {
    provider?: string;
    modelId?: string;
    apiBaseUrl?: string;
    connectionType?: string;
    apiKey?: string;
    temperature?: number;
    topP?: number;
    customHeaders?: string;
    customParams?: string;
    testOnly?: boolean;
  };

  const provider = body.provider?.trim();
  const modelId = body.modelId?.trim();
  const apiKey = body.apiKey?.trim();

  if (!provider || !modelId || !apiKey) {
    return NextResponse.json({ error: "服务商、模型名称和 API Key 不能为空" }, { status: 400 });
  }

  const config = {
    provider,
    modelId,
    apiBaseUrl: body.apiBaseUrl?.trim() || undefined,
    apiKey,
    connectionType: body.connectionType || "official",
    temperature: body.temperature,
    topP: body.topP,
    customHeaders: body.customHeaders,
    customParams: body.customParams,
  };

  if (body.testOnly) {
    const startedAt = Date.now();
    const result = await callModel({
      ...config,
      systemPrompt: "You are a connection test assistant. Reply with OK.",
      userPrompt: "Reply with OK.",
      maxTokens: 32,
      timeout: 30000,
    });
    return NextResponse.json({
      success: true,
      message: "平台托管模型连接成功",
      durationMs: Date.now() - startedAt,
      mode: result.mode,
    });
  }

  await savePlatformModelConfig(config, session.user.id);
  return NextResponse.json({ ok: true });
}
