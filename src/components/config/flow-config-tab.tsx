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
import type { FlowTemplate, FlowNodeConfig } from "@/types";
import { useAppStore } from "@/lib/store";
import {
  Workflow, Plus, Copy, Trash2, Star, ChevronDown, ChevronUp,
  Circle, Diamond, Square, Hexagon, ArrowRight, GripVertical,
  Power, Undo2,
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
  const updateFlowTemplate = useAppStore((s) => s.updateFlowTemplate);
  const deleteFlowTemplate = useAppStore((s) => s.deleteFlowTemplate);
  const setDefaultFlowTemplate = useAppStore((s) => s.setDefaultFlowTemplate);
  const addFlowTemplate = useAppStore((s) => s.addFlowTemplate);

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

  const handleDelete = () => {
    if (template.isDefault) { toast.error("不能删除默认流程"); return; }
    deleteFlowTemplate(template.id);
    toast.success(`「${template.name}」已删除`);
  };

  const handleSave = () => {
    // For now, just mark as updated — node/edge inline editing triggers will be added later
    updateFlowTemplate(template.id, { updatedAt: new Date().toISOString() });
    toast.success(`「${template.name}」已保存`);
  };

  const handleAddNode = () => {
    const newNode: FlowNodeConfig = {
      id: `node-${Date.now()}`,
      roleId: "coordinator",
      label: "新节点",
      nodeType: "process",
      allowAutoTransition: true,
      allowFallback: false,
      position: { x: (template.nodes.length + 1) * 200, y: 200 },
    };
    updateFlowTemplate(template.id, { nodes: [...template.nodes, newNode] });
    toast.success("节点已添加");
  };

  const handleDeleteNode = (nodeId: string) => {
    updateFlowTemplate(template.id, {
      nodes: template.nodes.filter((n) => n.id !== nodeId),
      edges: template.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    });
    toast.success("节点已删除");
  };

  const handleDeleteEdge = (edgeId: string) => {
    updateFlowTemplate(template.id, {
      edges: template.edges.filter((e) => e.id !== edgeId),
    });
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
    toast.success("连线已添加");
  };

  return (
    <Card className={`border-slate-200 shadow-sm ${template.isDefault ? "ring-1 ring-blue-200" : ""}`}>
      <CardHeader className="pb-3">
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
          <Separator />
          <CardContent className="pt-4 space-y-5">
            <div>
              <Label className="text-xs text-slate-400 mb-2 block">流程可视化</Label>
              <FlowVisualizer template={template} />
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
                        <Input defaultValue={node.label} className="text-xs border-slate-200" />
                        <select defaultValue={node.nodeType} className="text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-700">
                          <option value="start">起点</option>
                          <option value="process">处理</option>
                          <option value="decision">决策</option>
                          <option value="end">终点</option>
                        </select>
                        <Input defaultValue={node.roleId} className="text-xs border-slate-200 font-mono" placeholder="角色 ID" />
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
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-xs" onClick={handleSave}>保存流程</Button>
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
