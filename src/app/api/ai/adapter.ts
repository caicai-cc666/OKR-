/**
 * Shared server-side AI adapter.
 * Used by both /api/ai/run and /api/ai/test to ensure consistent behavior.
 */

// ---- Types ----

export interface AdapterRequest {
  provider: string;
  modelId: string;
  apiKey?: string;
  apiBaseUrl?: string;
  connectionType?: string;
  customHeaders?: string;
  customParams?: string;
  timeout?: number;
  // Chat fields (optional for test)
  systemPrompt?: string;
  userPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

export interface AdapterResponse {
  content: string;
  mode: "live";
  usage?: { inputTokens: number; outputTokens: number };
  durationMs?: number;
}

export interface AdapterError {
  code: string;
  message: string;
  provider: string;
  model: string;
  statusCode?: number;
}

// ---- URL normalization ----

/**
 * Normalize base URL: strip trailing slash and /v1 suffix,
 * so we can always append /v1/chat/completions safely.
 */
function normalizeBaseUrl(url: string): string {
  let u = url.trim().replace(/\/+$/, "");
  // Strip trailing /v1 or /v1/ to avoid double /v1/v1
  if (u.endsWith("/v1")) u = u.slice(0, -3);
  return u;
}

function normalizeEndpoint(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function resolveBaseUrl(provider: string, apiBaseUrl?: string): string {
  if (apiBaseUrl) return normalizeBaseUrl(apiBaseUrl);
  const p = provider.toLowerCase().trim();
  if (p === "anthropic" || p === "claude") return "https://api.anthropic.com";
  if (p === "deepseek" || p === "deep-seek") return "https://api.deepseek.com";
  if (p === "openai" || p === "gpt") return "https://api.openai.com";
  if (p === "moonshot" || p === "kimi") return "https://api.moonshot.cn";
  if (p === "zhipu" || p === "glm" || p === "chatglm") return "https://open.bigmodel.cn/api/paas";
  if (p === "qwen" || p === "tongyi" || p === "dashscope") return "https://dashscope.aliyuncs.com/compatible-mode";
  // Unknown provider — default to OpenAI-compatible
  return "https://api.openai.com";
}

function isAnthropicProvider(provider: string, baseUrl: string): boolean {
  const p = provider.toLowerCase().trim();
  return p === "anthropic" || p === "claude" || baseUrl.includes("anthropic.com");
}

function isAutoModel(modelId: string): boolean {
  return modelId.trim().toLowerCase() === "auto";
}

function resolveChatCompletionsUrl(provider: string, apiBaseUrl?: string): string {
  const raw = apiBaseUrl?.trim();
  if (raw && /\/(?:v\d+\/)?chat\/completions\/?$/i.test(raw)) {
    return normalizeEndpoint(raw);
  }
  return `${resolveBaseUrl(provider, apiBaseUrl)}/v1/chat/completions`;
}

function resolveMessagesUrl(provider: string, apiBaseUrl?: string): string {
  const raw = apiBaseUrl?.trim();
  if (raw && /\/(?:v\d+\/)?messages\/?$/i.test(raw)) {
    return normalizeEndpoint(raw);
  }
  return `${resolveBaseUrl(provider, apiBaseUrl)}/v1/messages`;
}

function resolveModelsUrl(provider: string, apiBaseUrl?: string): string {
  const raw = apiBaseUrl?.trim().replace(/\/+$/, "");
  if (raw && /\/(?:v\d+\/)?chat\/completions$/i.test(raw)) {
    return raw.replace(/\/(?:v\d+\/)?chat\/completions$/i, "/v1/models");
  }
  if (raw && /\/(?:v\d+\/)?messages$/i.test(raw)) {
    return raw.replace(/\/(?:v\d+\/)?messages$/i, "/v1/models");
  }
  return `${resolveBaseUrl(provider, apiBaseUrl)}/v1/models`;
}

async function resolveAutoModel(req: AdapterRequest, isAnthropic: boolean, timeout: number): Promise<string> {
  if (!isAutoModel(req.modelId)) return req.modelId;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const extraHeaders = parseJson(req.customHeaders) as Record<string, string>;
    const res = await fetch(resolveModelsUrl(req.provider, req.apiBaseUrl), {
      method: "GET",
      signal: controller.signal,
      headers: isAnthropic ? {
        "x-api-key": req.apiKey!,
        "anthropic-version": "2023-06-01",
        ...extraHeaders,
      } : {
        "Authorization": `Bearer ${req.apiKey!}`,
        ...extraHeaders,
      },
    });
    if (!res.ok) return req.modelId;
    const data = await res.json();
    const first = Array.isArray(data.data) ? data.data[0] : undefined;
    const id = typeof first === "string" ? first : first?.id;
    return typeof id === "string" && id.trim() ? id.trim() : req.modelId;
  } catch {
    return req.modelId;
  } finally {
    clearTimeout(timer);
  }
}

// ---- Validation ----

function validate(req: AdapterRequest): AdapterError | null {
  if (!req.apiKey) {
    return { code: "NO_API_KEY", message: "API Key 未配置", provider: req.provider, model: req.modelId };
  }
  if (!req.modelId) {
    return { code: "NO_MODEL", message: "模型名称为空", provider: req.provider, model: "" };
  }
  if (!req.provider) {
    return { code: "NO_PROVIDER", message: "服务提供方为空", provider: "", model: req.modelId };
  }
  return null;
}

// ---- Sanitize ----

const KEY_PATTERNS = [/sk-[a-zA-Z0-9_-]+/g, /key-[a-zA-Z0-9_-]+/g, /Bearer\s+\S+/g];

export function sanitize(msg: string): string {
  let s = msg;
  for (const p of KEY_PATTERNS) s = s.replace(p, "***");
  return s;
}

// ---- Parse extra headers/params ----

function parseJson(raw?: string): Record<string, unknown> {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

// ---- Classify HTTP errors ----

function classifyHttpError(status: number, body: string, provider: string, model: string): AdapterError {
  const snippet = sanitize(body.slice(0, 300));
  const base = { provider, model, statusCode: status };
  const autoHint = isAutoModel(model) ? " 当前使用 model=auto，但该服务可能不支持自动模型名；请向服务方确认真实 model 参数后填写到模型名称。" : "";
  switch (status) {
    case 400: return { ...base, code: "BAD_REQUEST", message: `请求参数错误 (400): 请检查模型名称、Base URL、额外参数是否符合该平台要求。${autoHint}${snippet}` };
    case 401: return { ...base, code: "AUTH_FAILED", message: `认证失败 (401): API Key 无效或已过期。${snippet}` };
    case 403: return { ...base, code: "FORBIDDEN", message: `权限不足 (403): 无权访问该模型。${autoHint}${snippet}` };
    case 404: return { ...base, code: "NOT_FOUND", message: `端点不存在或模型不存在 (404): 请检查 Base URL 是否应填到域名、/v1，或完整 /chat/completions；同时确认模型名称。${autoHint}${snippet}` };
    case 429: return { ...base, code: "RATE_LIMIT", message: `请求过于频繁 (429): 已触发速率限制。${snippet}` };
    default:
      if (status >= 500) return { ...base, code: "SERVER_ERROR", message: `服务端错误 (${status}): ${snippet}` };
      return { ...base, code: "HTTP_ERROR", message: `HTTP ${status}: ${snippet}` };
  }
}

// ---- Core call function ----

export async function callModel(req: AdapterRequest): Promise<AdapterResponse> {
  // Validate
  const err = validate(req);
  if (err) throw err;

  const baseUrl = resolveBaseUrl(req.provider, req.apiBaseUrl);
  const isAnthropic = isAnthropicProvider(req.provider, baseUrl);
  const timeout = req.timeout || 60000;
  const modelId = await resolveAutoModel(req, isAnthropic, Math.min(timeout, 10000));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  const extraHeaders = parseJson(req.customHeaders) as Record<string, string>;
  const extraParams = parseJson(req.customParams) as Record<string, unknown>;

  const systemPrompt = req.systemPrompt || "You are a helpful assistant.";
  const userPrompt = req.userPrompt || "ping";
  const maxTokens = req.maxTokens || 50;
  const temperature = req.temperature ?? 0.3;
  const topP = req.topP ?? 0.9;

  try {
    let res: Response;

    if (isAnthropic) {
      res = await fetch(resolveMessagesUrl(req.provider, req.apiBaseUrl), {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": req.apiKey!,
          "anthropic-version": "2023-06-01",
          ...extraHeaders,
        },
        body: JSON.stringify({
          model: modelId,
          max_tokens: maxTokens,
          temperature,
          top_p: topP,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
          ...extraParams,
        }),
      });
    } else {
      // OpenAI-compatible
      res = await fetch(resolveChatCompletionsUrl(req.provider, req.apiBaseUrl), {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${req.apiKey!}`,
          ...extraHeaders,
        },
        body: JSON.stringify({
          model: modelId,
          max_tokens: maxTokens,
          temperature,
          top_p: topP,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          ...extraParams,
        }),
      });
    }

    if (!res.ok) {
      const errBody = await res.text();
      throw classifyHttpError(res.status, errBody, req.provider, modelId);
    }

    const data = await res.json();

    // Extract content
    let content: string;
    let usage: { inputTokens: number; outputTokens: number };

    if (isAnthropic) {
      content = data.content?.[0]?.text ?? "";
      usage = { inputTokens: data.usage?.input_tokens ?? 0, outputTokens: data.usage?.output_tokens ?? 0 };
    } else {
      content = data.choices?.[0]?.message?.content ?? "";
      usage = { inputTokens: data.usage?.prompt_tokens ?? 0, outputTokens: data.usage?.completion_tokens ?? 0 };
    }

    return { content, mode: "live", usage };
  } catch (thrown) {
    // Re-throw AdapterError as-is
    if (typeof thrown === "object" && thrown !== null && "code" in thrown) throw thrown;

    // Classify other errors
    const e = thrown as Error;
    if (e.name === "AbortError") {
      throw {
        code: "TIMEOUT",
        message: `请求超时 (${Math.round(timeout / 1000)}s): 请检查网络或增加超时时间`,
        provider: req.provider,
        model: modelId,
      } as AdapterError;
    }

    // Network / DNS / TLS errors
    throw {
      code: "NETWORK_ERROR",
      message: `网络错误: ${sanitize(e.message)}`,
      provider: req.provider,
      model: modelId,
    } as AdapterError;
  } finally {
    clearTimeout(timer);
  }
}

// ---- Test connection (minimal call) ----

export async function testModelConnection(req: AdapterRequest): Promise<{
  success: boolean;
  message: string;
  error?: AdapterError;
  durationMs?: number;
}> {
  const start = Date.now();
  try {
    // Use a minimal prompt to test the connection
    const result = await callModel({
      ...req,
      systemPrompt: "Reply with exactly: ok",
      userPrompt: "ping",
      maxTokens: 10,
      temperature: 0,
    });
    return {
      success: true,
      message: `连接成功 (${req.provider} / ${req.modelId}) — 响应: "${result.content.slice(0, 30)}"`,
      durationMs: Date.now() - start,
    };
  } catch (thrown) {
    const err = thrown as AdapterError;
    return {
      success: false,
      message: err.message || "未知错误",
      error: err,
      durationMs: Date.now() - start,
    };
  }
}
