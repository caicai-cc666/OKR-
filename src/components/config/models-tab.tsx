"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { RoleConfig, ConnectionType } from "@/types";
import { ConnectionTypeLabel } from "@/types";
import { useAppStore } from "@/lib/store";
import { mockConfig } from "@/data/mock-config";
import { testConnection } from "@/lib/ai/provider";
import {
  Bot, Cpu, ChevronDown, ChevronUp, Eye, EyeOff, Globe, Key, Settings2, Wifi, Loader2,
} from "lucide-react";

const costTierLabel: Record<string, string> = { low: "低成本", medium: "中等成本", high: "高成本" };
const costTierColor: Record<string, string> = { low: "bg-slate-50 text-slate-500", medium: "bg-blue-50 text-blue-600", high: "bg-purple-50 text-purple-600" };
const retryPolicyLabel: Record<string, string> = { none: "不重试", fixed: "固定间隔", exponential: "指数退避" };
const reasoningModeLabel: Record<string, string> = { standard: "标准模式", extended: "深度推理" };

function msToMinutes(ms?: number): string {
  if (!ms) return "1";
  return String(Math.round(ms / 60000));
}

function RoleModelCard({ role }: { role: RoleConfig }) {
  const m = role.model;
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const updateModelConfig = useAppStore((s) => s.updateModelConfig);
  const formRef = useRef<HTMLDivElement>(null);

  const connType = (m.connectionType ?? "official") as ConnectionType;
  const displayName = m.providerDisplayName ?? m.provider;
  const timeoutMin = msToMinutes(m.timeout);

  const handleSave = () => {
    if (!formRef.current) return;
    const get = (name: string) => {
      const el = formRef.current!.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-field="${name}"]`);
      return el?.value ?? "";
    };

    const provider = get("provider").trim();
    const modelId = get("modelId").trim();
    const ct = get("connectionType") as ConnectionType;

    if (!provider) { toast.error("服务提供方不能为空"); return; }
    if (!modelId) { toast.error("模型名称不能为空"); return; }
    if (!ct) { toast.error("请选择接入类型"); return; }

    const timeoutMinutes = parseFloat(get("timeout")) || 1;

    updateModelConfig(role.roleId, {
      connectionType: ct,
      provider,
      modelId,
      temperature: parseFloat(get("temperature")) || m.temperature,
      maxTokens: parseInt(get("maxTokens")) || m.maxTokens,
      topP: parseFloat(get("topP")) || m.topP,
      timeout: Math.round(timeoutMinutes * 60000),
      retryPolicy: get("retryPolicy") || m.retryPolicy,
      reasoningMode: get("reasoningMode") || m.reasoningMode,
      costTier: get("costTier") || m.costTier,
      apiKey: get("apiKey") || undefined,
      apiBaseUrl: get("apiBaseUrl") || undefined,
      providerDisplayName: get("providerDisplayName") || undefined,
      organizationId: get("organizationId") || undefined,
      projectId: get("projectId") || undefined,
      customHeaders: get("customHeaders") || undefined,
      customParams: get("customParams") || undefined,
    });
    toast.success(`${role.roleName} 模型配置已保存`);
  };

  const handleResetDefault = () => {
    const defaultRole = mockConfig.roles.find((r) => r.roleId === role.roleId);
    if (defaultRole) {
      updateModelConfig(role.roleId, { ...defaultRole.model });
      toast.success(`${role.roleName} 模型配置已恢复默认`);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const result = await testConnection(m);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(`连接失败: ${result.message}`);
      }
    } catch {
      toast.error("测试连接时发生错误");
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
            <Bot className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm">{role.roleName}</CardTitle>
            <p className="text-xs text-slate-400 mt-0.5">
              {displayName} / {m.modelId} · 超时 {timeoutMin} 分钟
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className={`text-[10px] ${costTierColor[m.costTier ?? "medium"]}`}>
              <Cpu className="w-3 h-3 mr-1" />
              {costTierLabel[m.costTier ?? "medium"]}
            </Badge>
            <Badge variant="outline" className="text-[10px] text-slate-500">
              <Globe className="w-3 h-3 mr-1" />
              {ConnectionTypeLabel[connType]}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="pt-4 space-y-5" ref={formRef}>
        {/* Connection */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs text-slate-500">接入类型</Label>
            <select data-field="connectionType" defaultValue={connType} key={connType} className="mt-1 text-xs border border-slate-200 rounded-md px-2 py-1.5 w-full bg-white text-slate-700">
              <option value="official">官方模型</option>
              <option value="thirdparty">第三方平台</option>
              <option value="custom">自定义接口</option>
            </select>
          </div>
          <div>
            <Label className="text-xs text-slate-500">服务提供方</Label>
            <Input data-field="provider" defaultValue={m.provider} key={m.provider} placeholder="如 anthropic" className="mt-1 text-xs border-slate-200" />
          </div>
          <div>
            <Label className="text-xs text-slate-500">模型名称</Label>
            <Input data-field="modelId" defaultValue={m.modelId} key={m.modelId} placeholder="如 claude-opus-4-6" className="mt-1 text-xs border-slate-200 font-mono" />
          </div>
        </div>
        <Separator />
        {/* Core params */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <Label className="text-xs text-slate-500">温度</Label>
            <Input data-field="temperature" type="number" step="0.1" min="0" max="2" defaultValue={m.temperature} key={m.temperature} className="mt-1 text-xs border-slate-200 w-24" />
          </div>
          <div>
            <Label className="text-xs text-slate-500">最大 Token 数</Label>
            <Input data-field="maxTokens" type="number" defaultValue={m.maxTokens} key={m.maxTokens} className="mt-1 text-xs border-slate-200 w-28" />
          </div>
          <div>
            <Label className="text-xs text-slate-500">Top P</Label>
            <Input data-field="topP" type="number" step="0.05" min="0" max="1" defaultValue={m.topP ?? 0.9} key={m.topP} className="mt-1 text-xs border-slate-200 w-24" />
          </div>
          <div>
            <Label className="text-xs text-slate-500">超时时间（分钟）</Label>
            <Input data-field="timeout" type="number" step="0.5" min="0.5" defaultValue={timeoutMin} key={timeoutMin} className="mt-1 text-xs border-slate-200 w-24" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <Label className="text-xs text-slate-500">重试策略</Label>
            <select data-field="retryPolicy" defaultValue={m.retryPolicy ?? "none"} key={m.retryPolicy} className="mt-1 text-xs border border-slate-200 rounded-md px-2 py-1.5 w-full bg-white text-slate-700">
              {Object.entries(retryPolicyLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs text-slate-500">推理模式</Label>
            <select data-field="reasoningMode" defaultValue={m.reasoningMode ?? "standard"} key={m.reasoningMode} className="mt-1 text-xs border border-slate-200 rounded-md px-2 py-1.5 w-full bg-white text-slate-700">
              {Object.entries(reasoningModeLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs text-slate-500">成本等级</Label>
            <select data-field="costTier" defaultValue={m.costTier ?? "medium"} key={m.costTier} className="mt-1 text-xs border border-slate-200 rounded-md px-2 py-1.5 w-full bg-white text-slate-700">
              {Object.entries(costTierLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
        {/* API Key */}
        <div>
          <Label className="text-xs text-slate-500 flex items-center gap-1"><Key className="w-3 h-3" />API Key</Label>
          <div className="flex items-center gap-2 mt-1">
            <Input data-field="apiKey" type={showApiKey ? "text" : "password"} defaultValue={m.apiKey ?? ""} key={m.apiKey} placeholder="sk-...（可选）" className="text-xs border-slate-200 font-mono flex-1" />
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400" onClick={() => setShowApiKey(!showApiKey)}>
              {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
        {/* Advanced */}
        <div>
          <button onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors">
            <Settings2 className="w-3.5 h-3.5" />高级设置
            {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showAdvanced && (
            <div className="mt-3 p-4 bg-slate-50 rounded-lg border border-slate-100 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-slate-500">API Base URL</Label>
                  <Input data-field="apiBaseUrl" defaultValue={m.apiBaseUrl ?? ""} placeholder="https://api.example.com/v1" className="mt-1 text-xs border-slate-200 font-mono" />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">服务方显示名</Label>
                  <Input data-field="providerDisplayName" defaultValue={m.providerDisplayName ?? ""} placeholder="如「我的中转」" className="mt-1 text-xs border-slate-200" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-slate-500">组织标识</Label>
                  <Input data-field="organizationId" defaultValue={m.organizationId ?? ""} placeholder="org-..." className="mt-1 text-xs border-slate-200 font-mono" />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">项目标识</Label>
                  <Input data-field="projectId" defaultValue={m.projectId ?? ""} placeholder="proj-..." className="mt-1 text-xs border-slate-200 font-mono" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-slate-500">额外请求头</Label>
                <Input data-field="customHeaders" defaultValue={m.customHeaders ?? ""} placeholder='{"X-Header": "val"}' className="mt-1 text-xs border-slate-200 font-mono" />
              </div>
              <div>
                <Label className="text-xs text-slate-500">额外参数</Label>
                <Input data-field="customParams" defaultValue={m.customParams ?? ""} placeholder='{"stream": true}' className="mt-1 text-xs border-slate-200 font-mono" />
              </div>
            </div>
          )}
        </div>
        <Separator />
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" className="text-xs gap-1.5 text-slate-500" onClick={handleTestConnection} disabled={testing}>
            {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
            测试连接
          </Button>
          <Button variant="outline" size="sm" className="text-xs" onClick={handleResetDefault}>恢复默认</Button>
          <Button size="sm" className="text-xs bg-blue-600 hover:bg-blue-700" onClick={handleSave}>保存配置</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ModelsTab({ roles }: { roles: RoleConfig[] }) {
  const runMode = useAppStore((s) => s.config.runMode);
  const saveConfig = useAppStore((s) => s.saveConfig);

  return (
    <div className="space-y-4">
      {/* Run Mode Toggle */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700">运行模式</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {runMode === "mock" ? "Mock 模式：使用模拟数据，无需 API Key" : "Live 模式：调用真实模型 API，需要配置 API Key"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={runMode === "mock" ? "default" : "outline"}
              size="sm"
              className={`text-xs ${runMode === "mock" ? "bg-slate-700" : ""}`}
              onClick={() => { saveConfig({ runMode: "mock" }); toast.success("已切换到 Mock 模式"); }}
            >
              Mock
            </Button>
            <Button
              variant={runMode === "live" ? "default" : "outline"}
              size="sm"
              className={`text-xs ${runMode === "live" ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
              onClick={() => { saveConfig({ runMode: "live" }); toast.success("已切换到 Live 模式"); }}
            >
              Live
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="text-sm text-slate-500">
        每个角色单独配置模型接入方式和参数。支持官方模型、第三方平台和自定义接口。修改后点击保存生效。
      </p>
      {roles.map((role) => (
        <RoleModelCard key={role.roleId} role={role} />
      ))}
    </div>
  );
}
