"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { FlowTemplate, FlowNodeConfig, FlowLoopSettings } from "@/types";
import { useAppStore } from "@/lib/store";
import {
  downloadJson,
  isRecord,
  makeExportEnvelope,
  readJsonFile,
  safeFilePart,
  unwrapConfigImport,
  type FlowTemplateExportPayload,
} from "@/lib/config-transfer";
import {
  Workflow, Plus, Copy, Download, Trash2, Star, ChevronDown, ChevronUp,
  Circle, Diamond, Square, Hexagon, ArrowRight, GripVertical,
  Power, Undo2, Upload,
} from "lucide-react";

const nodeTypeIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  start: Circle, process: Square, decision: Diamond, end: Hexagon,
};
const nodeTypeLabel: Record<string, string> = {
  start: "起点", process: "处理", decision: "决策", end: "终点",
};
const nodeTypeColor: Record<string, string> = {
  start: "bg-emerald-100 text-emerald-600", process: "bg-blue-100 text-blue-600",
  decision: "bg-amber-100 text-amber-600", end: "bg-purple-100 text-purple-600",
};

const defaultLoopSettings: FlowLoopSettings = {
  outerLoop: { enabled: true, maxIterations: 5 },
  infoCheckLoop: { enabled: true, maxIterations: 3 },
  okrReviewLoop: {
    enabled: true,
    passThreshold: 85,
    stopConditionMode: "or",
    maxIterationsEnabled: true,
    maxIterations: 3,
    maxTokensEnabled: true,
    maxTokens: 24000,
    timeoutEnabled: true,
    timeoutSeconds: 180,
  },
};

function parseIntegerInput(value: string, fallback = 0): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mergedLoopSettings(template: FlowTemplate): FlowLoopSettings {
  return {
    ...defaultLoopSettings,
    ...template.loopSettings,
    outerLoop: { ...defaultLoopSettings.outerLoop, ...template.loopSettings?.outerLoop },
    infoCheckLoop: { ...defaultLoopSettings.infoCheckLoop, ...template.loopSettings?.infoCheckLoop },
    okrReviewLoop: { ...defaultLoopSettings.okrReviewLoop, ...template.loopSettings?.okrReviewLoop },
  };
}

function FlowVisualizer({ template }: { template: FlowTemplate }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 overflow-x-auto">
      <div className="flex items-center gap-2 min-w-max">
        {template.nodes.map((node, i) => {
          const Icon = nodeTypeIcon[node.nodeType] || Square;
          return (
            <div key={node.id} className="flex items-center gap-2">
              <div className="flex flex-col items-center gap-1">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${nodeTypeColor[node.nodeType]}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[11px] text-slate-600 font-medium text-center max-w-[80px] leading-tight">{node.label}</span>
                <span className="text-[9px] text-slate-400">{nodeTypeLabel[node.nodeType]}</span>
              </div>
              {i < template.nodes.length - 1 && <ArrowRight className="w-4 h-4 text-slate-300 mx-1" />}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2 mt-4">
        {template.edges.filter(e => e.label).map((edge) => (
          <Badge key={edge.id} variant="outline" className="text-[10px] text-slate-400 border-slate-200">
            {edge.source} → {edge.target}: {edge.label}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function TemplateEditor({ template }: { template: FlowTemplate }) {
  const [expanded, setExpanded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const updateFlowTemplate = useAppStore((s) => s.updateFlowTemplate);
  const deleteFlowTemplate = useAppStore((s) => s.deleteFlowTemplate);
  const setDefaultFlowTemplate = useAppStore((s) => s.setDefaultFlowTemplate);
  const addFlowTemplate = useAppStore((s) => s.addFlowTemplate);
  const roles = useAppStore((s) => s.config.roles);

  const handleSetDefault = () => {
    setDefaultFlowTemplate(template.id);
    toast.success(`「${template.name}」已设为默认流程`);
  };

  const handleCopy = () => {
    const now = new Date().toISOString();
    const newId = `flow-${Date.now()}`;
    addFlowTemplate({
      ...template,
      id: newId,
      name: `${template.name}（副本）`,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    });
    toast.success("流程已复制");
  };

  const handleExportTemplate = () => {
    const data = makeExportEnvelope<FlowTemplateExportPayload>("flow-template", template.name, { template });
    downloadJson(`okr-flow-${safeFilePart(template.name)}.json`, data);
    toast.success("流程模板 JSON 已导出");
  };

  const handleImportTemplate = async () => {
    let parsed: unknown;
    try {
      parsed = await readJsonFile();
    } catch {
      toast.error("JSON 文件读取失败，请检查文件格式");
      return;
    }

    const imported = unwrapConfigImport(parsed);
    const payload = imported.payload;
    const importedTemplate =
      isRecord(payload) && isRecord(payload.template)
        ? (payload.template as unknown as FlowTemplate)
        : isRecord(payload) && Array.isArray(payload.nodes) && Array.isArray(payload.edges)
          ? (payload as unknown as FlowTemplate)
          : undefined;

    if (!importedTemplate) {
      toast.error("未识别到单个流程模板");
      return;
    }

    updateFlowTemplate(template.id, {
      ...importedTemplate,
      id: template.id,
      isDefault: template.isDefault,
      updatedAt: new Date().toISOString(),
    });
    setDirty(false);
    toast.success("流程模板已导入并覆盖当前流程");
  };

  const handleDelete = () => {
    if (template.isDefault) { toast.error("不能删除默认流程"); return; }
    deleteFlowTemplate(template.id);
    toast.success(`「${template.name}」已删除`);
  };

  const handleSave = () => {
    // For now, just mark as updated — node/edge inline editing triggers will be added later
    updateFlowTemplate(template.id, { updatedAt: new Date().toISOString() });
    setDirty(false);
    toast.success(`「${template.name}」已保存`);
  };

  const handleAddNode = () => {
    const newNode: FlowNodeConfig = {
      id: `node-${Date.now()}`,
      roleId: roles[0]?.roleId ?? "coordinator",
      label: "新节点",
      nodeType: "process",
      allowAutoTransition: true,
      allowFallback: false,
      position: { x: (template.nodes.length + 1) * 200, y: 200 },
    };
    updateFlowTemplate(template.id, { nodes: [...template.nodes, newNode] });
    setDirty(true);
    toast.success("节点已添加");
  };

  const handleUpdateNode = (nodeId: string, partial: Partial<FlowNodeConfig>) => {
    updateFlowTemplate(template.id, {
      nodes: template.nodes.map((node) => node.id === nodeId ? { ...node, ...partial } : node),
    });
    setDirty(true);
  };

  const loopSettings = mergedLoopSettings(template);

  const handleUpdateLoopSettings = (partial: Partial<FlowLoopSettings>) => {
    updateFlowTemplate(template.id, {
      loopSettings: {
        ...loopSettings,
        ...partial,
        outerLoop: { ...loopSettings.outerLoop, ...partial.outerLoop },
        infoCheckLoop: { ...loopSettings.infoCheckLoop, ...partial.infoCheckLoop },
        okrReviewLoop: { ...loopSettings.okrReviewLoop, ...partial.okrReviewLoop },
      },
    });
    setDirty(true);
  };

  const handleDeleteNode = (nodeId: string) => {
    updateFlowTemplate(template.id, {
      nodes: template.nodes.filter((n) => n.id !== nodeId),
      edges: template.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    });
    setDirty(true);
    toast.success("节点已删除");
  };

  const handleDeleteEdge = (edgeId: string) => {
    updateFlowTemplate(template.id, {
      edges: template.edges.filter((e) => e.id !== edgeId),
    });
    setDirty(true);
    toast.success("连线已删除");
  };

  const handleAddEdge = () => {
    if (template.nodes.length < 2) { toast.error("至少需要 2 个节点才能添加连线"); return; }
    const newEdge = {
      id: `edge-${Date.now()}`,
      source: template.nodes[0].id,
      target: template.nodes[1].id,
    };
    updateFlowTemplate(template.id, { edges: [...template.edges, newEdge] });
    setDirty(true);
    toast.success("连线已添加");
  };

  return (
    <Card className={`overflow-visible border-slate-200 shadow-sm ${template.isDefault ? "ring-1 ring-blue-200" : ""}`}>
      <CardHeader className={`pb-3 ${expanded ? "sticky top-0 z-20 rounded-t-lg border-b border-blue-200 bg-blue-50 before:absolute before:-top-6 before:left-0 before:right-0 before:h-6 before:bg-blue-50 before:content-['']" : ""}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center">
              <Workflow className="w-4 h-4 text-violet-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm">{template.name}</CardTitle>
                {template.isDefault && (
                  <Badge className="text-[10px] bg-blue-50 text-blue-600 border-0">
                    <Star className="w-3 h-3 mr-0.5" />默认
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs">{template.description}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className="text-[10px] text-slate-400">
              {template.nodes.length} 节点 · {template.edges.length} 连线
            </Badge>
            {!template.isDefault && (
              <Button variant="outline" size="sm" className="text-xs gap-1" onClick={handleSetDefault}>
                <Star className="w-3 h-3" />设为默认
              </Button>
            )}
            <Button variant="outline" size="sm" className="text-xs gap-1" onClick={handleCopy}>
              <Copy className="w-3 h-3" />复制
            </Button>
            <Button variant="outline" size="sm" className="text-xs gap-1" onClick={handleExportTemplate}>
              <Download className="w-3 h-3" />导出
            </Button>
            <Button variant="outline" size="sm" className="text-xs gap-1" onClick={handleImportTemplate}>
              <Upload className="w-3 h-3" />导入
            </Button>
            {!template.isDefault && (
              <Button variant="outline" size="sm" className="text-xs text-red-500 gap-1" onClick={handleDelete}>
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <>
          <CardContent className="pt-4 space-y-5">
            <div>
              <Label className="text-xs text-slate-400 mb-2 block">流程可视化</Label>
              <FlowVisualizer template={template} />
            </div>
            <Separator />
            <div>
              <Label className="text-xs text-slate-400 mb-2 block">流程循环设定</Label>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <Card className="border-slate-200 shadow-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">外层循环</CardTitle>
                    <CardDescription className="text-xs">控制整个流程最多允许循环几轮。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className={`text-xs ${loopSettings.outerLoop.enabled ? "text-emerald-600 border-emerald-200" : "text-slate-400"}`}
                      onClick={() => handleUpdateLoopSettings({ outerLoop: { ...loopSettings.outerLoop, enabled: !loopSettings.outerLoop.enabled } })}
                    >
                      {loopSettings.outerLoop.enabled ? "已启用" : "已停用"}
                    </Button>
                    <div>
                      <Label className="text-xs text-slate-500">最大外层循环次数</Label>
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        inputMode="numeric"
                        value={loopSettings.outerLoop.maxIterations}
                        onChange={(e) => handleUpdateLoopSettings({ outerLoop: { ...loopSettings.outerLoop, maxIterations: parseIntegerInput(e.target.value) } })}
                        className="mt-1 text-xs border-slate-200 w-24"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">信息审核小循环</CardTitle>
                    <CardDescription className="text-xs">信息不足时回到信息补充/结构化的循环上限。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className={`text-xs ${loopSettings.infoCheckLoop.enabled ? "text-emerald-600 border-emerald-200" : "text-slate-400"}`}
                      onClick={() => handleUpdateLoopSettings({ infoCheckLoop: { ...loopSettings.infoCheckLoop, enabled: !loopSettings.infoCheckLoop.enabled } })}
                    >
                      {loopSettings.infoCheckLoop.enabled ? "已启用" : "已停用"}
                    </Button>
                    <div>
                      <Label className="text-xs text-slate-500">最大信息补充轮次</Label>
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        inputMode="numeric"
                        value={loopSettings.infoCheckLoop.maxIterations}
                        onChange={(e) => handleUpdateLoopSettings({ infoCheckLoop: { ...loopSettings.infoCheckLoop, maxIterations: parseIntegerInput(e.target.value) } })}
                        className="mt-1 text-xs border-slate-200 w-24"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">OKR审核小循环</CardTitle>
                    <CardDescription className="text-xs">每个 Objective 下至少 4 条 KR 达到阈值即通过；未通过的 Objective 自动进入下一轮重拆。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-slate-500">通过阈值</Label>
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          step={1}
                          inputMode="numeric"
                          value={loopSettings.okrReviewLoop.passThreshold}
                          onChange={(e) => handleUpdateLoopSettings({ okrReviewLoop: { ...loopSettings.okrReviewLoop, passThreshold: parseIntegerInput(e.target.value) } })}
                          className="mt-1 text-xs border-slate-200"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">停止条件关系</Label>
                        <select
                          value={loopSettings.okrReviewLoop.stopConditionMode}
                          onChange={(e) => handleUpdateLoopSettings({ okrReviewLoop: { ...loopSettings.okrReviewLoop, stopConditionMode: e.target.value as FlowLoopSettings["okrReviewLoop"]["stopConditionMode"] } })}
                          className="mt-1 text-xs border border-slate-200 rounded-md px-2 py-1.5 w-full bg-white text-slate-700"
                        >
                          <option value="or">任一满足即停止（或）</option>
                          <option value="and">全部满足才停止（且）</option>
                        </select>
                      </div>
                    </div>
                    {[
                      { key: "maxIterations", enabledKey: "maxIterationsEnabled", label: "最大循环次数", suffix: "次" },
                      { key: "maxTokens", enabledKey: "maxTokensEnabled", label: "最大 Token 数", suffix: "" },
                      { key: "timeoutSeconds", enabledKey: "timeoutEnabled", label: "超时时间", suffix: "分钟" },
                    ].map((item) => (
                      <div key={item.key} className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className={`h-8 text-xs ${(loopSettings.okrReviewLoop[item.enabledKey as keyof FlowLoopSettings["okrReviewLoop"]] as boolean) ? "text-emerald-600 border-emerald-200" : "text-slate-400"}`}
                          onClick={() => handleUpdateLoopSettings({
                            okrReviewLoop: {
                              ...loopSettings.okrReviewLoop,
                              [item.enabledKey]: !(loopSettings.okrReviewLoop[item.enabledKey as keyof FlowLoopSettings["okrReviewLoop"]] as boolean),
                            },
                          })}
                        >
                          {(loopSettings.okrReviewLoop[item.enabledKey as keyof FlowLoopSettings["okrReviewLoop"]] as boolean) ? "启用" : "停用"}
                        </Button>
                        <Label className="text-xs text-slate-500 w-24">{item.label}</Label>
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          inputMode="numeric"
                          value={item.key === "timeoutSeconds"
                            ? Math.max(1, Math.round((loopSettings.okrReviewLoop.timeoutSeconds ?? 60) / 60))
                            : loopSettings.okrReviewLoop[item.key as keyof FlowLoopSettings["okrReviewLoop"]] as number}
                          onChange={(e) => handleUpdateLoopSettings({
                            okrReviewLoop: {
                              ...loopSettings.okrReviewLoop,
                              [item.key]: item.key === "timeoutSeconds" ? parseIntegerInput(e.target.value) * 60 : parseIntegerInput(e.target.value),
                            },
                          })}
                          className="text-xs border-slate-200 w-24"
                        />
                        <span className="text-xs text-slate-400">{item.suffix}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
            <Separator />
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs text-slate-400">节点编辑（{template.nodes.length}）</Label>
                <Button variant="outline" size="sm" className="text-xs gap-1" onClick={handleAddNode}>
                  <Plus className="w-3 h-3" />添加节点
                </Button>
              </div>
              <div className="space-y-2">
                {template.nodes.map((node) => {
                  const Icon = nodeTypeIcon[node.nodeType] || Square;
                  return (
                    <div key={node.id} className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg p-3">
                      <GripVertical className="w-4 h-4 text-slate-300 shrink-0" />
                      <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${nodeTypeColor[node.nodeType]}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0 grid grid-cols-3 gap-2">
                        <Input
                          value={node.label}
                          onChange={(e) => handleUpdateNode(node.id, { label: e.target.value })}
                          className="text-xs border-slate-200"
                        />
                        <select
                          value={node.nodeType}
                          onChange={(e) => handleUpdateNode(node.id, { nodeType: e.target.value as FlowNodeConfig["nodeType"] })}
                          className="text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-700"
                        >
                          <option value="start">起点</option>
                          <option value="process">处理</option>
                          <option value="decision">决策</option>
                          <option value="end">终点</option>
                        </select>
                        <select
                          value={node.roleId}
                          onChange={(e) => handleUpdateNode(node.id, { roleId: e.target.value })}
                          className="text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-700"
                        >
                          {roles.map((role) => (
                            <option key={role.roleId} value={role.roleId}>
                              {role.roleName}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="自动流转">
                          <Power className={`w-3.5 h-3.5 ${node.allowAutoTransition ? "text-emerald-500" : "text-slate-300"}`} />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="允许回退">
                          <Undo2 className={`w-3.5 h-3.5 ${node.allowFallback ? "text-blue-500" : "text-slate-300"}`} />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-600" onClick={() => handleDeleteNode(node.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <Separator />
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs text-slate-400">连线规则（{template.edges.length}）</Label>
                <Button variant="outline" size="sm" className="text-xs gap-1" onClick={handleAddEdge}>
                  <Plus className="w-3 h-3" />添加连线
                </Button>
              </div>
              <div className="space-y-2">
                {template.edges.map((edge) => (
                  <div key={edge.id} className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
                    <Badge variant="secondary" className="text-[10px] bg-slate-50 font-mono">{edge.source}</Badge>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
                    <Badge variant="secondary" className="text-[10px] bg-slate-50 font-mono">{edge.target}</Badge>
                    {edge.label && <Input defaultValue={edge.label} className="text-xs border-slate-200 flex-1 max-w-32" />}
                    {edge.condition && <Input defaultValue={edge.condition} className="text-xs border-slate-200 flex-1 max-w-40 font-mono" placeholder="条件" />}
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400" onClick={() => handleDeleteEdge(edge.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                size="sm"
                disabled={!dirty}
                className={`text-xs ${dirty ? "bg-blue-600 hover:bg-blue-700" : "bg-slate-200 text-slate-500 hover:bg-slate-200"}`}
                onClick={handleSave}
              >
                {dirty ? "保存流程" : "已保存"}
              </Button>
            </div>
          </CardContent>
        </>
      )}
    </Card>
  );
}

export function FlowConfigTab({ templates }: { templates: FlowTemplate[] }) {
  const addFlowTemplate = useAppStore((s) => s.addFlowTemplate);

  const handleNewFlow = () => {
    const now = new Date().toISOString();
    addFlowTemplate({
      id: `flow-${Date.now()}`,
      name: "新流程模板",
      description: "自定义流程",
      isDefault: false,
      nodes: [
        { id: "start", roleId: "interviewer", label: "开始", nodeType: "start", allowAutoTransition: true, allowFallback: false, position: { x: 100, y: 200 } },
        { id: "end", roleId: "coordinator", label: "结束", nodeType: "end", allowAutoTransition: false, allowFallback: false, position: { x: 400, y: 200 } },
      ],
      edges: [{ id: "e1", source: "start", target: "end" }],
      loopSettings: defaultLoopSettings,
      createdAt: now,
      updatedAt: now,
    });
    toast.success("新流程模板已创建");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          管理流程模板。系统级模板定义角色执行顺序和条件分支，案例运行时会基于模板生成实例。
        </p>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleNewFlow}>
          <Plus className="w-3.5 h-3.5" />新增流程
        </Button>
      </div>
      {templates.map((t) => (
        <TemplateEditor key={t.id} template={t} />
      ))}
    </div>
  );
}
