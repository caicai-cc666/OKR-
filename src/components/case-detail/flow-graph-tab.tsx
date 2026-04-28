"use client";

import { useState } from "react";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { OkrCase, FlowNodeRun, FlowNodeConfig } from "@/types";
import { useAppStore } from "@/lib/store";
import {
  Circle, Square, Diamond, Hexagon, ArrowRight,
  RotateCcw, Bot, CheckCircle2, XCircle, Clock, Loader2,
  X,
} from "lucide-react";

const nodeTypeIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  start: Circle,
  process: Square,
  decision: Diamond,
  end: Hexagon,
};

const statusStyle: Record<string, string> = {
  pending: "bg-slate-100 text-slate-400 border-slate-200",
  running: "bg-blue-100 text-blue-600 border-blue-300 animate-pulse",
  success: "bg-emerald-100 text-emerald-600 border-emerald-300",
  failed: "bg-red-100 text-red-600 border-red-300",
  skipped: "bg-slate-50 text-slate-300 border-slate-200",
};

const statusLabel: Record<string, string> = {
  pending: "等待",
  running: "执行中",
  success: "成功",
  failed: "失败",
  skipped: "跳过",
};

function getNodeRun(runs: FlowNodeRun[], nodeId: string): FlowNodeRun | undefined {
  return runs.find((r) => r.nodeId === nodeId);
}

function NodeDetail({
  node,
  run,
  onRerun,
  onClose,
}: {
  node: FlowNodeConfig;
  run?: FlowNodeRun;
  onRerun: () => void;
  onClose: () => void;
}) {
  const role = useAppStore((s) => s.config.roles.find((r) => r.roleId === node.roleId));

  return (
    <Card className="border-blue-200 shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{node.label}</CardTitle>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-slate-400">节点类型</p>
            <p className="text-slate-700 font-medium">{node.nodeType}</p>
          </div>
          <div>
            <p className="text-slate-400">绑定角色</p>
            <p className="text-slate-700 font-medium">{role?.roleName ?? node.roleId}</p>
          </div>
          <div>
            <p className="text-slate-400">执行状态</p>
            <Badge variant="secondary" className={`text-[10px] ${statusStyle[run?.status ?? "pending"]}`}>
              {statusLabel[run?.status ?? "pending"]}
            </Badge>
          </div>
          <div>
            <p className="text-slate-400">使用模型</p>
            <p className="text-slate-700 font-mono text-[10px]">{role?.model.modelId ?? "—"}</p>
          </div>
        </div>

        {run?.startedAt && (
          <div>
            <p className="text-slate-400">开始时间</p>
            <p className="text-slate-600">{new Date(run.startedAt).toLocaleString("zh-CN")}</p>
          </div>
        )}

        {run?.error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-2">
            <p className="text-red-600">{run.error}</p>
          </div>
        )}

        {node.description && (
          <div>
            <p className="text-slate-400">说明</p>
            <p className="text-slate-600">{node.description}</p>
          </div>
        )}

        <Separator />

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
            onClick={onRerun}
          >
            <RotateCcw className="w-3 h-3" />
            从此节点重跑
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function FlowGraphTab({ caseData }: { caseData: OkrCase }) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const rerunNode = useAppStore((s) => s.rerunNode);

  const template = useAppStore((s) => {
    const templates = s.config.flowTemplates;
    return templates.find((t) => t.id === caseData.flowTemplateId) ?? templates.find((t) => t.isDefault);
  });

  if (!template) {
    return <p className="text-sm text-slate-400">未找到流程模板</p>;
  }

  const runs = caseData.flowNodeRuns;
  const selected = template.nodes.find((n) => n.id === selectedNode);

  return (
    <div className="space-y-4">
      {/* Template Info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Bot className="w-3.5 h-3.5" />
          流程模板：<span className="font-medium text-slate-700">{template.name}</span>
          <Badge variant="secondary" className="text-[10px] bg-slate-50">{template.nodes.length} 节点</Badge>
        </div>
      </div>

      {/* Visual Flow with clickable nodes */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-6 overflow-x-auto">
          <div className="flex items-center gap-3 min-w-max">
            {template.nodes.map((node, i) => {
              const Icon = nodeTypeIcon[node.nodeType] || Square;
              const run = getNodeRun(runs, node.id);
              const status = run?.status ?? "pending";
              const isSelected = selectedNode === node.id;
              const StatusIcon = status === "success" ? CheckCircle2
                : status === "failed" ? XCircle
                : status === "running" ? Loader2
                : Clock;

              return (
                <div key={node.id} className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedNode(isSelected ? null : node.id)}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all cursor-pointer ${
                      isSelected ? "ring-2 ring-blue-400 bg-blue-50/50" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center relative ${statusStyle[status]}`}>
                      <Icon className="w-5 h-5" />
                      <div className="absolute -bottom-1 -right-1">
                        <StatusIcon className={`w-3.5 h-3.5 ${
                          status === "running" ? "animate-spin text-blue-500" : ""
                        }`} />
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-600 font-medium text-center max-w-[80px] leading-tight">
                      {node.label}
                    </span>
                    <span className={`text-[9px] ${
                      status === "success" ? "text-emerald-500"
                        : status === "failed" ? "text-red-500"
                        : status === "running" ? "text-blue-500"
                        : "text-slate-300"
                    }`}>
                      {statusLabel[status]}
                    </span>
                  </button>
                  {i < template.nodes.length - 1 && (
                    <div className="flex flex-col items-center gap-0.5">
                      <ArrowRight className={`w-5 h-5 ${
                        run?.status === "success" ? "text-emerald-400" : "text-slate-200"
                      }`} />
                      {template.edges.find(
                        (e) => e.source === node.id && e.label
                      )?.label && (
                        <span className="text-[9px] text-slate-300">
                          {template.edges.find((e) => e.source === node.id && e.label)?.label}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Edge details for conditional paths */}
      <div className="flex flex-wrap gap-1.5">
        {template.edges
          .filter((e) => e.condition)
          .map((edge) => {
            const sourceRun = getNodeRun(runs, edge.source);
            const targetRun = getNodeRun(runs, edge.target);
            const active = sourceRun?.status === "success" && targetRun && targetRun.status !== "pending";
            return (
              <Badge
                key={edge.id}
                variant="outline"
                className={`text-[10px] ${active ? "border-emerald-300 text-emerald-600" : "text-slate-300 border-slate-200"}`}
              >
                {edge.source} → {edge.target}: {edge.label}
              </Badge>
            );
          })}
      </div>

      {/* Node Detail Panel */}
      {selected && (
        <NodeDetail
          node={selected}
          run={getNodeRun(runs, selected.id)}
          onRerun={() => {
            rerunNode(caseData.id, selected.id);
            setSelectedNode(null);
          }}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
}
