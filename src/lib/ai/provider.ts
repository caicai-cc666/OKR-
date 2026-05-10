import type { RoleConfig, RoleModelConfig } from "@/types";

export interface AICallResult {
  content: string;
  mode: "live" | "mock";
  usage?: { inputTokens: number; outputTokens: number };
  durationMs?: number;
  error?: string;
}

export interface RunAgentOptions {
  jsonResponse?: boolean;
}

const DEFAULT_LIVE_MAX_TOKENS = 8000;
const DEFAULT_LIVE_TIMEOUT_MS = 180000;

/** Mock response generator */
function mockResponse(model: RoleModelConfig): AICallResult {
  return {
    content: `[Mock response for ${model.provider}/${model.modelId}]`,
    mode: "mock",
    usage: { inputTokens: 500, outputTokens: 300 },
    durationMs: 800,
  };
}

function buildSystemPrompt(role: RoleConfig, options?: RunAgentOptions): string {
  const capabilities = [...role.generalSkills, ...role.specializedSkills];
  return [
    role.systemPrompt,
    role.principles.length ? `宪法性原则：\n${role.principles.map((item) => `- ${item}`).join("\n")}` : "",
    capabilities.length ? `专业能力：\n${capabilities.map((item) => `- ${item}`).join("\n")}` : "",
    role.styleTraits.length ? `表达方式：\n${role.styleTraits.map((item) => `- ${item}`).join("\n")}` : "",
    options?.jsonResponse
      ? [
          "系统输出协议：",
          "- 你的最终回复必须是一个 JSON object。",
          "- 不要输出 Markdown 代码块、解释性前后缀、自然语言总结或多余文本。",
          "- 回复内容必须能被 JSON.parse 直接解析。",
        ].join("\n")
      : "",
  ].filter(Boolean).join("\n\n");
}

function parseCustomParams(raw?: string): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function isAnthropicLike(model: RoleModelConfig): boolean {
  const provider = model.provider.trim().toLowerCase();
  const baseUrl = model.apiBaseUrl?.trim().toLowerCase() ?? "";
  return provider === "anthropic" || provider === "claude" || baseUrl.includes("anthropic.com");
}

function withJsonObjectResponse(model: RoleModelConfig): RoleModelConfig {
  if (isAnthropicLike(model)) return model;
  const customParams = parseCustomParams(model.customParams);
  if (!customParams.response_format) {
    customParams.response_format = { type: "json_object" };
  }
  return {
    ...model,
    customParams: JSON.stringify(customParams),
  };
}

function isJsonResponseFormatUnsupported(err: Error): boolean {
  const message = err.message.toLowerCase();
  return message.includes("response_format")
    && (
      message.includes("unsupported")
      || message.includes("not support")
      || message.includes("不支持")
      || message.includes("unknown parameter")
      || message.includes("unrecognized")
      || message.includes("invalid")
      || message.includes("请求参数错误")
      || message.includes("400")
    );
}

/** Call the server-side AI route (uses shared adapter on server) */
async function callLive(
  systemPrompt: string,
  userPrompt: string,
  model: RoleModelConfig
): Promise<AICallResult> {
  const res = await fetch("/api/ai/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemPrompt,
      userPrompt,
      provider: model.provider,
      modelId: model.modelId,
      temperature: model.temperature,
      maxTokens: model.maxTokens ?? DEFAULT_LIVE_MAX_TOKENS,
      topP: model.topP,
      timeout: model.timeout ?? DEFAULT_LIVE_TIMEOUT_MS,
      apiBaseUrl: model.apiBaseUrl,
      apiKey: model.apiKey,
      customHeaders: model.customHeaders,
      customParams: model.customParams,
      connectionType: model.connectionType,
    }),
  });

  const data = await res.json();

  if (!res.ok || data.error) {
    throw new Error(data.error || `API call failed: ${res.status}`);
  }

  return data as AICallResult;
}

/** Run an agent: live with optional mock fallback */
export async function runAgent(
  role: RoleConfig,
  userInput: string,
  runMode: "mock" | "live" = "mock",
  strictLive: boolean = false,
  options?: RunAgentOptions
): Promise<AICallResult> {
  if (runMode === "mock") {
    // Explicit mock mode
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 500));
    return mockResponse(role.model);
  }

  // Live mode — check API key
  if (!role.model.apiKey) {
    if (strictLive) {
      throw new Error(`[${role.roleName}] API Key 未配置，strict live 模式下不允许回退 mock`);
    }
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 500));
    const result = mockResponse(role.model);
    result.error = `API Key 未配置，已回退 mock`;
    return result;
  }

  // Live mode with retry
  let lastError: Error | null = null;
  const maxRetries = role.maxRetries || 0;
  const systemPrompt = buildSystemPrompt(role, options);
  const model = options?.jsonResponse ? withJsonObjectResponse(role.model) : role.model;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await callLive(systemPrompt, userInput, model);
    } catch (err) {
      lastError = err as Error;
      if (options?.jsonResponse && model !== role.model && isJsonResponseFormatUnsupported(lastError)) {
        try {
          return await callLive(systemPrompt, userInput, role.model);
        } catch (fallbackErr) {
          lastError = fallbackErr as Error;
        }
      }
      if (attempt < maxRetries) {
        const delay = role.model.retryPolicy === "exponential"
          ? Math.pow(2, attempt) * 1000
          : 1000;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  // All retries exhausted
  const safeMsg = lastError?.message?.replace(/sk-[a-zA-Z0-9_-]+/g, "sk-***") ?? "未知错误";

  if (strictLive) {
    throw new Error(`[${role.roleName}] Live 调用失败: ${safeMsg}`);
  }

  // Fallback to mock
  console.warn(`[AI] Live call failed for ${role.roleName}, falling back to mock:`, safeMsg);
  const result = mockResponse(role.model);
  result.error = `Live 调用失败，已回退 mock: ${safeMsg}`;
  return result;
}

/** Test connection to a model (uses shared adapter on server) */
export interface TestConnectionResult {
  success: boolean;
  message: string;
  error?: { code: string; message: string; provider: string; model: string; statusCode?: number };
  durationMs?: number;
}

export async function testConnection(model: RoleModelConfig): Promise<TestConnectionResult> {
  try {
    const res = await fetch("/api/ai/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: model.provider,
        modelId: model.modelId,
        apiBaseUrl: model.apiBaseUrl,
        apiKey: model.apiKey,
        connectionType: model.connectionType,
        customHeaders: model.customHeaders,
      }),
    });
    const data = await res.json();
    return data as TestConnectionResult;
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "网络错误" };
  }
}
