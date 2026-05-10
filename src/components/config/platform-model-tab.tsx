"use client";

import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2, ShieldCheck, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PlatformModelState {
  provider: string;
  modelId: string;
  apiBaseUrl: string;
  apiKey: string;
  connectionType: string;
  temperature: string;
  topP: string;
  customHeaders: string;
  customParams: string;
}

const initialState: PlatformModelState = {
  provider: "openai",
  modelId: "gpt-5.2",
  apiBaseUrl: "",
  apiKey: "",
  connectionType: "official",
  temperature: "0.3",
  topP: "0.9",
  customHeaders: "",
  customParams: "",
};

function payloadFromState(state: PlatformModelState, testOnly = false) {
  return {
    provider: state.provider.trim(),
    modelId: state.modelId.trim(),
    apiBaseUrl: state.apiBaseUrl.trim() || undefined,
    apiKey: state.apiKey.trim(),
    connectionType: state.connectionType,
    temperature: Number(state.temperature),
    topP: Number(state.topP),
    customHeaders: state.customHeaders.trim() || undefined,
    customParams: state.customParams.trim() || undefined,
    testOnly,
  };
}

export function PlatformModelTab() {
  const [state, setState] = useState<PlatformModelState>(initialState);
  const [configured, setConfigured] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    fetch("/api/admin/platform-model", { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json();
        if (!data.config) return;
        setConfigured(Boolean(data.configured));
        setState((current) => ({
          ...current,
          provider: data.config.provider ?? current.provider,
          modelId: data.config.modelId ?? current.modelId,
          apiBaseUrl: data.config.apiBaseUrl ?? "",
          connectionType: data.config.connectionType ?? "official",
          temperature: String(data.config.temperature ?? current.temperature),
          topP: String(data.config.topP ?? current.topP),
          customHeaders: data.config.customHeaders ?? "",
          customParams: data.config.customParams ?? "",
          apiKey: "",
        }));
      })
      .catch(() => undefined);
  }, []);

  const update = (key: keyof PlatformModelState, value: string) => {
    setState((current) => ({ ...current, [key]: value }));
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!state.apiKey.trim()) {
      toast.error(configured ? "更新平台模型时需要重新输入 API Key" : "请填写 API Key");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/platform-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payloadFromState(state)),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(data.error ?? "保存失败");
        return;
      }
      setConfigured(true);
      setState((current) => ({ ...current, apiKey: "" }));
      toast.success("平台托管模型已保存");
    } finally {
      setIsSaving(false);
    }
  };

  const test = async () => {
    if (!state.apiKey.trim()) {
      toast.error("测试连接需要填写 API Key");
      return;
    }
    setIsTesting(true);
    try {
      const response = await fetch("/api/admin/platform-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payloadFromState(state, true)),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.error) {
        toast.error(data.error ?? "测试连接失败");
        return;
      }
      toast.success(`${data.message ?? "连接成功"}${data.durationMs ? ` (${data.durationMs}ms)` : ""}`);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-blue-600" />
            平台托管模型
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm leading-6 text-blue-800">
            试用企业默认使用平台托管模型。企业管理员和普通用户不会看到 API Key，也不需要配置模型。
          </div>
          {configured && (
            <div className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              已配置平台托管模型。出于安全原因，API Key 不会回显；如需更换，请重新输入并保存。
            </div>
          )}
          <form className="grid gap-4 md:grid-cols-2" onSubmit={save}>
            <div className="space-y-1.5">
              <Label>接入类型</Label>
              <select
                value={state.connectionType}
                onChange={(event) => update("connectionType", event.target.value)}
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              >
                <option value="official">官方模型</option>
                <option value="thirdparty">第三方平台</option>
                <option value="custom">自定义接口</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>服务提供方</Label>
              <Input value={state.provider} onChange={(event) => update("provider", event.target.value)} placeholder="openai / anthropic / openai-compatible" required />
            </div>
            <div className="space-y-1.5">
              <Label>模型名称</Label>
              <Input value={state.modelId} onChange={(event) => update("modelId", event.target.value)} placeholder="gpt-5.2 / claude..." required />
            </div>
            <div className="space-y-1.5">
              <Label>API Base URL</Label>
              <Input value={state.apiBaseUrl} onChange={(event) => update("apiBaseUrl", event.target.value)} placeholder="官方可留空，第三方填 base url" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5" />API Key</Label>
              <Input type="password" value={state.apiKey} onChange={(event) => update("apiKey", event.target.value)} placeholder={configured ? "重新输入后可更新 Key" : "填写平台托管 API Key"} />
            </div>
            <div className="space-y-1.5">
              <Label>温度</Label>
              <Input type="number" step="0.1" value={state.temperature} onChange={(event) => update("temperature", event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Top P</Label>
              <Input type="number" step="0.05" value={state.topP} onChange={(event) => update("topP", event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>额外请求头</Label>
              <Input value={state.customHeaders} onChange={(event) => update("customHeaders", event.target.value)} placeholder='{"X-Header":"value"}' />
            </div>
            <div className="space-y-1.5">
              <Label>额外参数</Label>
              <Input value={state.customParams} onChange={(event) => update("customParams", event.target.value)} placeholder='{"response_format":{"type":"json_object"}}' />
            </div>
            <div className="md:col-span-2 flex gap-2">
              <Button type="button" variant="outline" className="gap-2" onClick={test} disabled={isTesting}>
                {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
                测试连接
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={isSaving}>
                {isSaving ? "保存中..." : "保存平台模型"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
