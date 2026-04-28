import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider, modelId, apiBaseUrl, apiKey, connectionType, customHeaders } = body;

    if (!apiKey) {
      return NextResponse.json({ success: false, error: "API Key 未配置" });
    }

    const baseUrl = apiBaseUrl || (
      provider === "anthropic" ? "https://api.anthropic.com" :
      provider === "deepseek" ? "https://api.deepseek.com" :
      "https://api.openai.com"
    );

    const isAnthropic = provider === "anthropic" || baseUrl.includes("anthropic");

    let extraHeaders: Record<string, string> = {};
    if (customHeaders) {
      try { extraHeaders = JSON.parse(customHeaders); } catch {}
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    try {
      if (isAnthropic) {
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
            model: modelId,
            max_tokens: 10,
            messages: [{ role: "user", content: "ping" }],
          }),
        });

        if (!res.ok) {
          const errBody = await res.text();
          throw new Error(`${res.status}: ${errBody.slice(0, 100)}`);
        }

        return NextResponse.json({ success: true, message: `连接成功 (${provider} / ${modelId})` });
      } else {
        const res = await fetch(`${baseUrl}/v1/models`, {
          method: "GET",
          signal: controller.signal,
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            ...extraHeaders,
          },
        });

        if (!res.ok) {
          const errBody = await res.text();
          throw new Error(`${res.status}: ${errBody.slice(0, 100)}`);
        }

        return NextResponse.json({ success: true, message: `连接成功 (${provider} / ${modelId})` });
      }
    } finally {
      clearTimeout(timer);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const safeMessage = message.replace(/sk-[a-zA-Z0-9]+/g, "sk-***");
    return NextResponse.json({ success: false, error: safeMessage });
  }
}
