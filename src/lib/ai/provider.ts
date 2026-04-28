import type { RoleConfig, RoleModelConfig, AppConfig } from "@/types";

export interface AICallResult {
  content: string;
  mode: "live" | "mock";
  usage?: { inputTokens: number; outputTokens: number };
  durationMs?: number;
  error?: string;
}

/** Mock response generator */
function mockResponse(model: RoleModelConfig): AICallResult {
  return {
    content: `[Mock response for ${model.provider}/${model.modelId}]`,
    mode: "mock",
    usage: { inputTokens: 500, outputTokens: 300 },
    durationMs: 800,
  };
}

/** Call the server-side AI route */
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
      maxTokens: model.maxTokens,
      topP: model.topP,
      timeout: model.timeout,
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

/** Run an agent: live with mock fallback */
export async function runAgent(
  role: RoleConfig,
  userInput: string,
  runMode: "mock" | "live" = "mock"
): Promise<AICallResult> {
  if (runMode === "mock" || !role.model.apiKey) {
    // Mock mode or no API key configured
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 500));
    return mockResponse(role.model);
  }

  // Live mode with retry
  let lastError: Error | null = null;
  const maxRetries = role.maxRetries || 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await callLive(role.systemPrompt, userInput, role.model);
    } catch (err) {
      lastError = err as Error;
      if (attempt < maxRetries) {
        const delay = role.model.retryPolicy === "exponential"
          ? Math.pow(2, attempt) * 1000
          : 1000;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  // Fallback to mock on failure
  console.warn(`[AI] Live call failed for ${role.roleName}, falling back to mock:`, lastError?.message);
  const result = mockResponse(role.model);
  result.error = `Live 调用失败，已回退 mock: ${lastError?.message?.replace(/sk-[a-zA-Z0-9]+/g, "sk-***")}`;
  return result;
}

/** Test connection to a model */
export async function testConnection(model: RoleModelConfig): Promise<{ success: boolean; message: string }> {
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
    return { success: data.success, message: data.message || data.error || "未知结果" };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "网络错误" };
  }
}
