import { NextResponse } from "next/server";
import { callModel } from "@/app/api/ai/adapter";
import { getCurrentSession } from "@/lib/server/auth";
import { deletePlatformModelConfig, getPlatformModelConfig, getPlatformModelConfigs, savePlatformModelConfig } from "@/lib/server/platform-model";

function isOpenAiCompatible(connectionType?: string) {
  return connectionType === "thirdparty" || connectionType === "custom";
}

export async function GET() {
  const session = await getCurrentSession();
  if (!session || session.role !== "platform_owner") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const configs = await getPlatformModelConfigs();
  if (!configs.length) {
    return NextResponse.json({ configured: false, configs: [] });
  }

  return NextResponse.json({
    configured: true,
    configs: configs.map((config) => ({
      roleId: config.roleId,
      provider: config.provider,
      modelId: config.modelId,
      apiBaseUrl: config.apiBaseUrl,
      connectionType: config.connectionType,
      temperature: config.temperature,
      topP: config.topP,
      customHeaders: config.customHeaders,
      customParams: config.customParams,
      apiKeyMasked: "********",
    })),
  });
}

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session || session.role !== "platform_owner") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const body = (await request.json()) as {
    roleId?: string;
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

  const roleId = body.roleId?.trim();
  const connectionType = body.connectionType || "official";
  const provider = body.provider?.trim() || (isOpenAiCompatible(connectionType) ? "openai-compatible" : "");
  const modelId = body.modelId?.trim() || (isOpenAiCompatible(connectionType) ? "auto" : "");
  const apiKey = body.apiKey?.trim();

  if (!roleId) {
    return NextResponse.json({ error: "角色不能为空" }, { status: 400 });
  }
  const existingConfig = await getPlatformModelConfig(roleId);
  const effectiveApiKey = apiKey || existingConfig?.apiKey;
  if (!provider || !modelId || !effectiveApiKey) {
    return NextResponse.json({ error: "服务提供方、模型名称和 API Key 不能为空" }, { status: 400 });
  }

  const config = {
    roleId,
    provider,
    modelId,
    apiBaseUrl: body.apiBaseUrl?.trim() || undefined,
    apiKey: effectiveApiKey,
    connectionType,
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

export async function DELETE(request: Request) {
  const session = await getCurrentSession();
  if (!session || session.role !== "platform_owner") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const roleId = searchParams.get("roleId")?.trim();
  if (!roleId) {
    return NextResponse.json({ error: "角色不能为空" }, { status: 400 });
  }

  await deletePlatformModelConfig(roleId);
  return NextResponse.json({ ok: true });
}
