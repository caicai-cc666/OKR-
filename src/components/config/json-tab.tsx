"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Download, Copy, CheckCircle2, RotateCcw } from "lucide-react";
import type { AppConfig, FlowTemplate, ReviewWeightedRule, RoleConfig, RoleModelConfig, RoleTagLibraries } from "@/types";
import { useAppStore } from "@/lib/store";
import {
  configExportSummary,
  copyJson,
  downloadJson,
  emptyRoleTagLibraries,
  isRecord,
  makeExportEnvelope,
  mergeRoleTagLibraries,
  readJsonFile,
  remapSelectedTagIds,
  roleListsFromSelectedTags,
  safeFilePart,
  sanitizeModelForExport,
  selectedRoleTagLibraries,
  unwrapConfigImport,
  upsertById,
  upsertReviewRuleById,
  upsertRoleById,
  type FlowTemplateExportPayload,
  type ModelExportPayload,
  type ReviewRuleExportPayload,
  type RoleExportPayload,
} from "@/lib/config-transfer";

type ExportScope = "all" | "role" | "model" | "review-rule" | "flow-template" | "tag-libraries";

const scopeLabels: Record<ExportScope, string> = {
  all: "全部配置",
  role: "单个角色",
  model: "单个模型",
  "review-rule": "单条评分维度",
  "flow-template": "单个流程",
  "tag-libraries": "标签库",
};

function weightedRules(config: AppConfig): ReviewWeightedRule[] {
  return config.review.weightedRules ?? [];
}

function itemOptions(config: AppConfig, scope: ExportScope): Array<{ id: string; label: string }> {
  if (scope === "role" || scope === "model") {
    return config.roles.map((role) => ({ id: role.roleId, label: role.roleName }));
  }
  if (scope === "review-rule") {
    return weightedRules(config).map((rule) => ({ id: rule.id, label: rule.label }));
  }
  if (scope === "flow-template") {
    return config.flowTemplates.map((flow) => ({ id: flow.id, label: flow.name }));
  }
  return [];
}

function exportData(config: AppConfig, scope: ExportScope, selectedId: string) {
  if (scope === "all") {
    return makeExportEnvelope("app-config", "全部配置", config);
  }

  if (scope === "tag-libraries") {
    return makeExportEnvelope("tag-libraries", "标签库", config.tagLibraries ?? emptyRoleTagLibraries());
  }

  if (scope === "role") {
    const role = config.roles.find((item) => item.roleId === selectedId) ?? config.roles[0];
    if (!role) return {};
    const roleForExport: RoleConfig = { ...role, model: sanitizeModelForExport(role.model) };
    return makeExportEnvelope<RoleExportPayload>(
      "role",
      role.roleName,
      { role: roleForExport },
      { tagLibraries: selectedRoleTagLibraries(role, config.tagLibraries) }
    );
  }

  if (scope === "model") {
    const role = config.roles.find((item) => item.roleId === selectedId) ?? config.roles[0];
    if (!role) return {};
    return makeExportEnvelope<ModelExportPayload>("model", role.roleName, {
      roleId: role.roleId,
      roleName: role.roleName,
      model: sanitizeModelForExport(role.model),
    });
  }

  if (scope === "review-rule") {
    const rule = weightedRules(config).find((item) => item.id === selectedId) ?? weightedRules(config)[0];
    if (!rule) return {};
    return makeExportEnvelope<ReviewRuleExportPayload>("review-rule", rule.label, { rule });
  }

  const template = config.flowTemplates.find((item) => item.id === selectedId) ?? config.flowTemplates[0];
  if (!template) return {};
  return makeExportEnvelope<FlowTemplateExportPayload>("flow-template", template.name, { template });
}

function importedRoleFromPayload(payload: unknown): RoleConfig | undefined {
  if (isRecord(payload) && isRecord(payload.role)) return payload.role as unknown as RoleConfig;
  if (isRecord(payload) && typeof payload.roleId === "string") return payload as unknown as RoleConfig;
  return undefined;
}

function importedModelFromPayload(payload: unknown): ModelExportPayload | undefined {
  if (isRecord(payload) && isRecord(payload.model)) {
    return {
      roleId: String(payload.roleId ?? ""),
      roleName: String(payload.roleName ?? ""),
      model: payload.model as unknown as RoleModelConfig,
    };
  }
  if (isRecord(payload) && typeof payload.connectionType === "string") {
    return { roleId: "", roleName: "", model: payload as unknown as RoleModelConfig };
  }
  return undefined;
}

function importedRuleFromPayload(payload: unknown): ReviewWeightedRule | undefined {
  if (isRecord(payload) && isRecord(payload.rule)) return payload.rule as unknown as ReviewWeightedRule;
  if (isRecord(payload) && typeof payload.label === "string") return payload as unknown as ReviewWeightedRule;
  return undefined;
}

function importedTemplateFromPayload(payload: unknown): FlowTemplate | undefined {
  if (isRecord(payload) && isRecord(payload.template)) return payload.template as unknown as FlowTemplate;
  if (isRecord(payload) && Array.isArray(payload.nodes) && Array.isArray(payload.edges)) return payload as unknown as FlowTemplate;
  return undefined;
}

function partialConfigFromImport(input: unknown, config: AppConfig): Partial<AppConfig> | undefined {
  const imported = unwrapConfigImport(input);
  const payload = imported.payload;

  if (imported.kind === "app-config" || (!imported.kind && isRecord(payload) && Array.isArray(payload.roles))) {
    return payload as Partial<AppConfig>;
  }

  if (imported.kind === "tag-libraries" || (!imported.kind && isRecord(payload) && Array.isArray(payload.principles))) {
    const { libraries } = mergeRoleTagLibraries(config.tagLibraries, payload as RoleTagLibraries);
    return { tagLibraries: libraries };
  }

  const role = importedRoleFromPayload(payload);
  if (role) {
    const incomingLibraries = imported.dependencies?.tagLibraries;
    const { libraries } = mergeRoleTagLibraries(config.tagLibraries, incomingLibraries);
    const hasSelectedTags = Boolean(role.selectedTagIds);
    const selectedTagIds = hasSelectedTags
      ? remapSelectedTagIds(role.selectedTagIds, incomingLibraries, libraries)
      : role.selectedTagIds;
    const fallbackModel = role.model ?? config.roles[0]?.model;
    const nextRole: RoleConfig = {
      ...role,
      ...(fallbackModel ? { model: { ...fallbackModel, apiKey: role.model?.apiKey || fallbackModel.apiKey } } : {}),
      ...(hasSelectedTags && selectedTagIds
        ? {
            selectedTagIds,
            ...roleListsFromSelectedTags(libraries, selectedTagIds),
          }
        : {}),
    };
    return {
      roles: upsertRoleById(config.roles, nextRole),
      tagLibraries: libraries,
    };
  }

  const modelPayload = importedModelFromPayload(payload);
  if (modelPayload?.model) {
    const targetRoleId = modelPayload.roleId || config.roles[0]?.roleId;
    if (!targetRoleId || !config.roles.some((roleItem) => roleItem.roleId === targetRoleId)) {
      toast.error("模型配置必须关联到已有角色，请先创建对应角色");
      return undefined;
    }
    return {
      roles: config.roles.map((roleItem) =>
        roleItem.roleId === targetRoleId
          ? { ...roleItem, model: { ...modelPayload.model, apiKey: modelPayload.model.apiKey || roleItem.model.apiKey } }
          : roleItem
      ),
    };
  }

  const rule = importedRuleFromPayload(payload);
  if (rule?.label) {
    const rules = weightedRules(config);
    return {
      review: {
        ...config.review,
        weightedRules: upsertReviewRuleById(rules, rule),
        prerequisites: upsertReviewRuleById(rules, rule).map((item) => item.label),
        coreDimensions: upsertReviewRuleById(rules, rule).map((item) => item.label),
      },
    };
  }

  const template = importedTemplateFromPayload(payload);
  if (template) {
    return {
      flowTemplates: upsertById(config.flowTemplates, {
        ...template,
        isDefault: template.isDefault && !config.flowTemplates.some((item) => item.isDefault && item.id !== template.id),
        updatedAt: new Date().toISOString(),
      }),
    };
  }

  toast.error("JSON 中未找到可识别的配置项");
  return undefined;
}

export function JsonTab({ config }: { config: AppConfig }) {
  const [importText, setImportText] = useState("");
  const [exportScope, setExportScope] = useState<ExportScope>("all");
  const [selectedId, setSelectedId] = useState("");
  const saveConfig = useAppStore((s) => s.saveConfig);
  const resetConfig = useAppStore((s) => s.resetConfig);

  const options = itemOptions(config, exportScope);
  const effectiveSelectedId = selectedId && options.some((item) => item.id === selectedId)
    ? selectedId
    : options[0]?.id ?? "";
  const data = exportData(config, exportScope, effectiveSelectedId);
  const exportJson = JSON.stringify(data, null, 2);
  const summary = configExportSummary(config);

  const handleCopy = async () => {
    await copyJson(data);
    toast.success("已复制到剪贴板");
  };

  const handleDownload = () => {
    downloadJson(`okr-config-${exportScope}-${safeFilePart(effectiveSelectedId || "all")}.json`, data);
    toast.success("JSON 文件已下载");
  };

  const handleImport = () => {
    if (!importText.trim()) {
      toast.error("请粘贴或上传 JSON 内容");
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(importText);
    } catch {
      toast.error("JSON 格式错误，请检查语法");
      return;
    }

    const partial = partialConfigFromImport(parsed, config);
    if (!partial || Object.keys(partial).length === 0) return;

    saveConfig(partial);
    setImportText("");
    toast.success("配置已导入");
  };

  const handleUpload = async () => {
    try {
      const parsed = await readJsonFile();
      setImportText(JSON.stringify(parsed, null, 2));
      toast.success("文件已加载，请点击「验证并导入」");
    } catch {
      toast.error("JSON 文件读取失败，请检查文件格式");
    }
  };

  const handleReset = () => {
    resetConfig();
    toast.success("已恢复系统默认配置");
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="export" className="space-y-4">
        <TabsList className="bg-slate-100">
          <TabsTrigger value="export" className="gap-1.5 text-xs">
            <Download className="w-3.5 h-3.5" />导出
          </TabsTrigger>
          <TabsTrigger value="import" className="gap-1.5 text-xs">
            <Upload className="w-3.5 h-3.5" />导入
          </TabsTrigger>
        </TabsList>

        <TabsContent value="export">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">导出配置</CardTitle>
              <CardDescription className="text-xs">
                支持导出全部配置，也可以选择单个角色、模型、KR 评分维度或流程模板。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {(Object.keys(scopeLabels) as ExportScope[]).map((scope) => (
                  <Button
                    key={scope}
                    variant={exportScope === scope ? "default" : "outline"}
                    size="sm"
                    className={`text-xs ${exportScope === scope ? "bg-blue-600" : ""}`}
                    onClick={() => {
                      setExportScope(scope);
                      setSelectedId("");
                    }}
                  >
                    {scopeLabels[scope]}
                  </Button>
                ))}
              </div>

              {options.length > 0 && (
                <select
                  value={effectiveSelectedId}
                  onChange={(event) => setSelectedId(event.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
                >
                  {options.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
              )}

              <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                当前企业配置：{summary.roles} 个角色 / {summary.models} 个模型 / {summary.reviewRules} 条评分维度 / {summary.flowTemplates} 个流程
              </div>

              <Textarea value={exportJson} readOnly rows={16} className="font-mono text-xs border-slate-200 bg-slate-50" />
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleCopy}>
                  <Copy className="w-3.5 h-3.5" />复制 JSON
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleDownload}>
                  <Download className="w-3.5 h-3.5" />下载文件
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">导入配置</CardTitle>
              <CardDescription className="text-xs">
                可导入完整配置，也可导入单个角色、模型、KR 评分维度、流程模板或标签库 JSON。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={"在此粘贴 JSON 配置...\n\n支持导入：完整配置、单个角色、单个模型、单条 KR 评分维度、单个流程模板、标签库"}
                rows={12}
                className="font-mono text-xs border-slate-200"
              />
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleUpload}>
                  <Upload className="w-3.5 h-3.5" />上传文件
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-700"
                  disabled={!importText.trim()}
                  onClick={handleImport}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />验证并导入
                </Button>
                <div className="flex-1" />
                <Button variant="outline" size="sm" className="gap-1.5 text-xs text-amber-600 border-amber-200" onClick={handleReset}>
                  <RotateCcw className="w-3.5 h-3.5" />恢复系统默认
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
