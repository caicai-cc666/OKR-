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
import type { RoleConfig, RoleModelConfig, ConnectionType } from "@/types";
import { ConnectionTypeLabel } from "@/types";
import { useAppStore } from "@/lib/store";
import { mockConfig } from "@/data/mock-config";
import { testConnection } from "@/lib/ai/provider";
import {
  downloadJson,
  isRecord,
  makeExportEnvelope,
  readJsonFile,
  safeFilePart,
  sanitizeModelForExport,
  unwrapConfigImport,
  type ModelExportPayload,
} from "@/lib/config-transfer";
import {
  Bot, Cpu, ChevronDown, ChevronUp, Download, Eye, EyeOff, Globe, Key, Settings2, Upload, Wifi, Loader2,
} from "lucide-react";

const costTierLabel: Record<string, string> = { low: "低成本", medium: "中等成本", high: "高成本" };
const costTierColor: Record<string, string> = { low: "bg-slate-50 text-slate-500", medium: "bg-blue-50 text-blue-600", high: "bg-purple-50 text-purple-600" };
const retryPolicyLabel: Record<string, string> = { none: "不重试", fixed: "固定间隔", exponential: "指数退避" };
const reasoningModeLabel: Record<string, string> = { standard: "标准模式", extended: "深度推理" };

export interface RoleModelCardProps {
  role: RoleConfig;
  model?: RoleModelConfig;
  onSaveModel?: (roleId: string, model: RoleModelConfig) => void | Promise<void>;
  onResetModel?: (roleId: string) => void | Promise<void>;
}

export function RoleModelCard({ role, model, onSaveModel, onResetModel }: RoleModelCardProps) {
  const m = model ?? role.model;
  const [expanded, setExpanded] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [selectedConnectionType, setSelectedConnectionType] = useState<ConnectionType>((m.connectionType ?? "official") as ConnectionType);
  const updateModelConfig = useAppStore((s) => s.updateModelConfig);
  const formRef = useRef<HTMLDivElement>(null);

  const connType = selectedConnectionType;
  const displayName = m.providerDisplayName ?? m.provider;
  const isOpenAiCompatible = connType === "thirdparty" || connType === "custom";

  const readFormModel = (): RoleModelConfig | null => {
    if (!formRef.current) return null;
    const get = (name: string) => {
      const el = formRef.current!.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-field="${name}"]`);
      return el?.value ?? "";
    };

    const ct = get("connectionType") as ConnectionType;
    const provider = get("provider").trim() || (ct === "official" ? "" : "openai-compatible");
    const modelId = get("modelId").trim() || (ct === "official" ? "" : "auto");

    return {
      ...m,
      connectionType: ct,
      provider,
      modelId,
      temperature: parseFloat(get("temperature")) || m.temperature,
      topP: parseFloat(get("topP")) || m.topP,
      retryPolicy: (get("retryPolicy") || m.retryPolicy) as RoleModelConfig["retryPolicy"],
      reasoningMode: (get("reasoningMode") || m.reasoningMode) as RoleModelConfig["reasoningMode"],
      costTier: (get("costTier") || m.costTier) as RoleModelConfig["costTier"],
      apiKey: get("apiKey") || undefined,
      apiBaseUrl: get("apiBaseUrl") || undefined,
      providerDisplayName: get("providerDisplayName") || undefined,
      organizationId: get("organizationId") || undefined,
      projectId: get("projectId") || undefined,
      customHeaders: get("customHeaders") || undefined,
      customParams: get("customParams") || undefined,
    };
  };

  const validateModel = (model: RoleModelConfig): boolean => {
    if (!model.connectionType) { toast.error("请选择接入类型"); return false; }
    if (model.connectionType === "official") {
      if (!model.provider) { toast.error("官方模型需要填写服务提供方"); return false; }
      if (!model.modelId) { toast.error("官方模型需要填写模型名称"); return false; }
      return true;
    }
    if (!model.apiBaseUrl) { toast.error("第三方/自定义接口至少需要填写 API Base URL"); return false; }
    if (!model.apiKey) { toast.error("第三方/自定义接口至少需要填写 API Key"); return false; }
    return true;
  };

  const handleSave = () => {
    const next = readFormModel();
    if (!next || !validateModel(next)) return;
    if (onSaveModel) {
      void Promise.resolve(onSaveModel(role.roleId, { ...next })).then(() => {
        setDirty(false);
      });
      return;
    }
    updateModelConfig(role.roleId, { ...next });
    setDirty(false);
    toast.success(`${role.roleName} 模型配置已保存`);
  };

  const handleResetDefault = () => {
    if (onResetModel) {
      void Promise.resolve(onResetModel(role.roleId)).then(() => {
        setDirty(false);
      });
      return;
    }
    const defaultRole = mockConfig.roles.find((r) => r.roleId === role.roleId);
    if (defaultRole) {
      updateModelConfig(role.roleId, { ...defaultRole.model });
      setSelectedConnectionType((defaultRole.model.connectionType ?? "official") as ConnectionType);
      setDirty(false);
      toast.success(`${role.roleName} 模型配置已恢复默认`);
    }
  };

  const handleTestConnection = async () => {
    const next = readFormModel();
    if (!next || !validateModel(next)) return;
    setTesting(true);
    try {
      const result = await testConnection(next);
      if (result.success) {
        toast.success(result.message + (result.durationMs ? ` (${result.durationMs}ms)` : ""));
      } else {
        const errCode = result.error?.code ? `[${result.error.code}] ` : "";
        toast.error(`连接失败: ${errCode}${result.message}`, { duration: 8000 });
      }
    } catch {
      toast.error("测试连接时发生网络错误");
    } finally {
      setTesting(false);
    }
  };

  const handleExportModel = () => {
    const data = makeExportEnvelope<ModelExportPayload>("model", role.roleName, {
      roleId: role.roleId,
      roleName: role.roleName,
      model: sanitizeModelForExport(m),
    });
    downloadJson(`okr-model-${safeFilePart(role.roleName)}.json`, data);
    toast.success("模型配置 JSON 已导出，API Key 未写入文件");
  };

  const handleImportModel = async () => {
    let parsed: unknown;
    try {
      parsed = await readJsonFile();
    } catch {
      toast.error("JSON 文件读取失败，请检查文件格式");
      return;
    }

    const imported = unwrapConfigImport(parsed);
    const payload = imported.payload;
    const importedModel =
      isRecord(payload) && isRecord(payload.model)
        ? (payload.model as unknown as RoleModelConfig)
        : isRecord(payload) && typeof payload.connectionType === "string"
          ? (payload as unknown as RoleModelConfig)
          : undefined;

    if (!importedModel) {
      toast.error("未识别到单个模型配置");
      return;
    }

    updateModelConfig(role.roleId, {
      ...importedModel,
      apiKey: importedModel.apiKey || m.apiKey,
    });
    setSelectedConnectionType((importedModel.connectionType ?? "official") as ConnectionType);
    setDirty(false);
    toast.success("模型配置已导入到当前角色");
  };

  // Summarize what will be tested
  const testSummary = `${m.provider} / ${m.modelId}${m.apiBaseUrl ? ` @ ${m.apiBaseUrl.replace(/https?:\/\//, "").slice(0, 30)}` : ""}${m.apiKey ? " (key ✓)" : " (无 key)"}`;

  return (
    <Card className="overflow-visible border-slate-200 shadow-sm">
      <CardHeader className={`pb-3 ${expanded ? "sticky top-0 z-20 rounded-t-lg border-b border-blue-200 bg-blue-50 before:absolute before:-top-6 before:left-0 before:right-0 before:h-6 before:bg-blue-50 before:content-['']" : ""}`}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
            <Bot className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm">{role.roleName}</CardTitle>
            <p className="text-xs text-slate-400 mt-0.5">
              {displayName} / {m.modelId}
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
            <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={handleExportModel}>
              <Download className="h-3 w-3" />
              导出
            </Button>
            <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={handleImportModel}>
              <Upload className="h-3 w-3" />
              导入
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      {expanded && (
      <CardContent className="pt-4 space-y-5" ref={formRef} onChangeCapture={() => setDirty(true)}>
        {isOpenAiCompatible && (
          <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-3 text-xs leading-relaxed text-amber-800">
            第三方/自定义接口默认按 OpenAI 兼容格式调用。只知道 API Key 和 Base URL 时，可以先不填服务提供方和模型名称；保存时会自动补为
            <span className="font-mono"> openai-compatible / auto</span>。如果测试返回模型不存在或参数错误，说明该平台仍要求指定模型名称，需要向服务方确认 model 参数。
          </div>
        )}
        {/* Connection */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs text-slate-500">接入类型</Label>
            <select
              data-field="connectionType"
              value={connType}
              onChange={(e) => {
                setSelectedConnectionType(e.target.value as ConnectionType);
                setDirty(true);
              }}
              className="mt-1 text-xs border border-slate-200 rounded-md px-2 py-1.5 w-full bg-white text-slate-700"
            >
              <option value="official">官方模型</option>
              <option value="thirdparty">第三方平台</option>
              <option value="custom">自定义接口</option>
            </select>
          </div>
          <div>
            <Label className="text-xs text-slate-500">服务提供方{isOpenAiCompatible ? "（可选）" : ""}</Label>
            <Input data-field="provider" defaultValue={m.provider} key={`prov-${m.provider}`} placeholder={isOpenAiCompatible ? "可空，默认 openai-compatible" : "如 openai / anthropic / deepseek"} className="mt-1 text-xs border-slate-200" />
          </div>
          <div>
            <Label className="text-xs text-slate-500">模型名称{isOpenAiCompatible ? "（不知道可留空）" : ""}</Label>
            <Input data-field="modelId" defaultValue={m.modelId} key={`mid-${m.modelId}`} placeholder={isOpenAiCompatible ? "可空，默认 auto" : "如 gpt-5.2 / claude-sonnet-4-5"} className="mt-1 text-xs border-slate-200 font-mono" />
          </div>
        </div>
        <Separator />
        {/* Core params */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs text-slate-500">温度</Label>
            <Input data-field="temperature" type="number" step="0.1" min="0" max="2" defaultValue={m.temperature} key={`temp-${m.temperature}`} className="mt-1 text-xs border-slate-200 w-24" />
          </div>
          <div>
            <Label className="text-xs text-slate-500">Top P</Label>
            <Input data-field="topP" type="number" step="0.05" min="0" max="1" defaultValue={m.topP ?? 0.9} key={`tp-${m.topP ?? 0.9}`} className="mt-1 text-xs border-slate-200 w-24" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <Label className="text-xs text-slate-500">重试策略</Label>
            <select data-field="retryPolicy" defaultValue={m.retryPolicy ?? "none"} key={`rp-${m.retryPolicy ?? "none"}`} className="mt-1 text-xs border border-slate-200 rounded-md px-2 py-1.5 w-full bg-white text-slate-700">
              {Object.entries(retryPolicyLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs text-slate-500">推理模式</Label>
            <select data-field="reasoningMode" defaultValue={m.reasoningMode ?? "standard"} key={`rm-${m.reasoningMode ?? "standard"}`} className="mt-1 text-xs border border-slate-200 rounded-md px-2 py-1.5 w-full bg-white text-slate-700">
              {Object.entries(reasoningModeLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs text-slate-500">成本等级</Label>
            <select data-field="costTier" defaultValue={m.costTier ?? "medium"} key={`cost-${m.costTier ?? "medium"}`} className="mt-1 text-xs border border-slate-200 rounded-md px-2 py-1.5 w-full bg-white text-slate-700">
              {Object.entries(costTierLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
        {/* API Key */}
        <div>
          <Label className="text-xs text-slate-500 flex items-center gap-1"><Key className="w-3 h-3" />API Key</Label>
          <div className="flex items-center gap-2 mt-1">
            <Input data-field="apiKey" type={showApiKey ? "text" : "password"} defaultValue={m.apiKey ?? ""} key={`ak-${m.apiKey ?? ""}`} placeholder={isOpenAiCompatible ? "第三方 key / sk-..." : "官方 API key，如 sk-..."} className="text-xs border-slate-200 font-mono flex-1" />
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400" onClick={() => setShowApiKey(!showApiKey)}>
              {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
        <div>
          <Label className="text-xs text-slate-500">API Base URL</Label>
          <Input data-field="apiBaseUrl" defaultValue={m.apiBaseUrl ?? ""} key={`url-${m.apiBaseUrl ?? ""}`} placeholder={isOpenAiCompatible ? "第三方给你的 base url，如 https://xxx/v1" : "官方通常可留空；中转才填"} className="mt-1 text-xs border-slate-200 font-mono" />
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
                  <Label className="text-xs text-slate-500">服务方显示名</Label>
                  <Input data-field="providerDisplayName" defaultValue={m.providerDisplayName ?? ""} key={`pdn-${m.providerDisplayName ?? ""}`} placeholder="如「我的中转」" className="mt-1 text-xs border-slate-200" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-slate-500">组织标识</Label>
                  <Input data-field="organizationId" defaultValue={m.organizationId ?? ""} key={`org-${m.organizationId ?? ""}`} placeholder="org-..." className="mt-1 text-xs border-slate-200 font-mono" />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">项目标识</Label>
                  <Input data-field="projectId" defaultValue={m.projectId ?? ""} key={`proj-${m.projectId ?? ""}`} placeholder="proj-..." className="mt-1 text-xs border-slate-200 font-mono" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-slate-500">额外请求头</Label>
                <Input data-field="customHeaders" defaultValue={m.customHeaders ?? ""} key={`ch-${m.customHeaders ?? ""}`} placeholder='{"X-Header": "val"}' className="mt-1 text-xs border-slate-200 font-mono" />
              </div>
              <div>
                <Label className="text-xs text-slate-500">额外参数</Label>
                <Input data-field="customParams" defaultValue={m.customParams ?? ""} key={`cp-${m.customParams ?? ""}`} placeholder='{"stream": true}' className="mt-1 text-xs border-slate-200 font-mono" />
              </div>
            </div>
          )}
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-slate-400 font-mono truncate max-w-[50%]">测试: {testSummary}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs gap-1.5 text-slate-500" onClick={handleTestConnection} disabled={testing}>
              {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
              测试连接
            </Button>
            <Button variant="outline" size="sm" className="text-xs" onClick={handleResetDefault}>恢复默认</Button>
            <Button
              size="sm"
              disabled={!dirty}
              className={`text-xs ${dirty ? "bg-blue-600 hover:bg-blue-700" : "bg-slate-200 text-slate-500 hover:bg-slate-200"}`}
              onClick={handleSave}
            >
              {dirty ? "保存配置" : "已保存"}
            </Button>
          </div>
        </div>
      </CardContent>
      )}
    </Card>
  );
}

export function ModelsTab({ roles }: { roles: RoleConfig[] }) {
  const runMode = useAppStore((s) => s.config.runMode);
  const strictLive = useAppStore((s) => s.config.strictLive);
  const saveConfig = useAppStore((s) => s.saveConfig);

  return (
    <div className="space-y-4">
      {/* Run Mode Toggle */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
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
          </div>
          {runMode === "live" && (
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div>
                <p className="text-xs font-medium text-slate-600">Strict Live（调试模式）</p>
                <p className="text-[11px] text-slate-400">
                  {strictLive ? "开启：失败时直接报错，不回退 mock" : "关闭：失败时自动回退 mock"}
                </p>
              </div>
              <Button
                variant={strictLive ? "default" : "outline"}
                size="sm"
                className={`text-xs ${strictLive ? "bg-amber-600 hover:bg-amber-700" : "text-slate-500"}`}
                onClick={() => { saveConfig({ strictLive: !strictLive }); toast.success(strictLive ? "已关闭 Strict Live" : "已开启 Strict Live — 失败不再回退 mock"); }}
              >
                {strictLive ? "Strict: ON" : "Strict: OFF"}
              </Button>
            </div>
          )}
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
