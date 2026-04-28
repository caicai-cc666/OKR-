import { NextRequest, NextResponse } from "next/server";

export interface AIRunRequest {
  systemPrompt: string;
  userPrompt: string;
  provider: string;
  modelId: string;
  temperature: number;
  maxTokens: number;
  topP?: number;
  timeout?: number;
  apiBaseUrl?: string;
  apiKey?: string;
  customHeaders?: string;
  customParams?: string;
  connectionType?: string;
}

export interface AIRunResponse {
  content: string;
  mode: "live" | "mock";
  usage?: { inputTokens: number; outputTokens: number };
  durationMs?: number;
  error?: string;
}

async function callOpenAICompatible(req: AIRunRequest): Promise<AIRunResponse> {
  const baseUrl = req.apiBaseUrl || (
    req.provider === "anthropic" ? "https://api.anthropic.com" :
    req.provider === "deepseek" ? "https://api.deepseek.com" :
    "https://api.openai.com"
  );

  const isAnthropic = req.provider === "anthropic" || baseUrl.includes("anthropic");
  const apiKey = req.apiKey;
  if (!apiKey) throw new Error("API Key 未配置");

  const timeout = req.timeout || 60000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let extraHeaders: Record<string, string> = {};
  if (req.customHeaders) {
    try { extraHeaders = JSON.parse(req.customHeaders); } catch {}
  }

  let extraParams: Record<string, unknown> = {};
  if (req.customParams) {
    try { extraParams = JSON.parse(req.customParams); } catch {}
  }

  try {
    if (isAnthropic) {
      // Anthropic Messages API
      const res = await fetch(`${baseUrl}/v1/messages`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          ...extraHeaders,
        },
        body: JSON.stringify({
          model: req.modelId,
          max_tokens: req.maxTokens,
          temperature: req.temperature,
          top_p: req.topP ?? 0.9,
          system: req.systemPrompt,
          messages: [{ role: "user", content: req.userPrompt }],
          ...extraParams,
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Anthropic API ${res.status}: ${errBody.slice(0, 200)}`);
      }

      const data = await res.json();
      const content = data.content?.[0]?.text ?? "";
      return {
        content,
        mode: "live",
        usage: { inputTokens: data.usage?.input_tokens ?? 0, outputTokens: data.usage?.output_tokens ?? 0 },
      };
    } else {
      // OpenAI-compatible Chat Completions API
      const res = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          ...extraHeaders,
        },
        body: JSON.stringify({
          model: req.modelId,
          max_tokens: req.maxTokens,
          temperature: req.temperature,
          top_p: req.topP ?? 0.9,
          messages: [
            { role: "system", content: req.systemPrompt },
            { role: "user", content: req.userPrompt },
          ],
          ...extraParams,
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`API ${res.status}: ${errBody.slice(0, 200)}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content ?? "";
      return {
        content,
        mode: "live",
        usage: { inputTokens: data.usage?.prompt_tokens ?? 0, outputTokens: data.usage?.completion_tokens ?? 0 },
      };
    }
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: AIRunRequest = await request.json();
    const start = Date.now();
    const result = await callOpenAICompatible(body);
    result.durationMs = Date.now() - start;
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    // Don't leak API key in error messages
    const safeMessage = message.replace(/sk-[a-zA-Z0-9]+/g, "sk-***");
    return NextResponse.json(
      { content: "", mode: "mock" as const, error: safeMessage },
      { status: 500 }
    );
  }
}
