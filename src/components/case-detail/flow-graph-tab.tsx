"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { OkrCase, FlowNodeRun, FlowNodeConfig } from "@/types";
import { CaseStatus } from "@/types";
import { useAppStore } from "@/lib/store";
import {
  Circle, Square, Diamond, Hexagon, ArrowRight,
  RotateCcw, Bot, CheckCircle2, XCircle, Clock, Loader2,
  X, AlertTriangle,
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

function resolvedStatus(run: FlowNodeRun | undefined, nodeId: string, caseData: OkrCase): FlowNodeRun["status"] {
  if (run?.status !== "running") return run?.status ?? "pending";
  if (nodeId === "structuring" && caseData.factPack) return "success";
  if (nodeId === "info-check") {
    if (caseData.status === CaseStatus.INFO_INSUFFICIENT) return "failed";
    if (caseData.factPack && !caseData.missingInfo?.missingFields.some((field) => field.priority === "high")) return "success";
  }
  if (nodeId === "decompose" && caseData.okrDrafts) return "success";
  if ((nodeId === "review" || nodeId === "auto-review") && caseData.reviewReport) {
    return caseData.reviewReport.passed ? "success" : "failed";
  }
  if (nodeId === "finalize" && caseData.finalOkr) return "success";
  return "running";
}

/** Generate input/output summaries for a node based on case data */
function getNodeSummary(nodeId: string, caseData: OkrCase): { input?: string; output?: string } {
  switch (nodeId) {
    case "intake":
      return {
        input: caseData.intake?.rawText ? `${caseData.intake.rawText.slice(0, 80)}${caseData.intake.rawText.length > 80 ? "..." : ""}` : undefined,
        output: caseData.intake ? "已接收用户输入" : undefined,
      };
    case "structuring":
      return {
        input: caseData.intake?.rawText ? `原始输入 ${caseData.intake.rawText.length} 字` : undefined,
        output: caseData.factPack ? `已结构化: ${caseData.factPack.strategicGoals.length} 个目标, ${caseData.factPack.currentChallenges.length} 个挑战` : undefined,
      };
    case "info-check":
      return {
        input: caseData.factPack ? "事实包已就绪" : undefined,
        output: caseData.missingInfo ? `缺失 ${caseData.missingInfo.missingFields.length} 项信息` : caseData.factPack ? "信息充足" : undefined,
      };
    case "decompose":
      return {
        input: caseData.factPack ? `事实包: ${caseData.factPack.strategicGoals.length} 个目标` : undefined,
        output: caseData.okrDrafts ? `OKR 草稿已生成 (${caseData.okrDrafts.balanced.generatedBy})` : undefined,
      };
    case "review":
    case "auto-review":
      return {
        input: caseData.okrDrafts ? "Objective 草稿待审核" : undefined,
        output: caseData.reviewReport ? `Objective 审核 ${caseData.reviewReport.objectiveResults?.filter((item) => item.passed).length ?? 0}/${caseData.reviewReport.objectiveResults?.length ?? 0} 通过` : undefined,
      };
    case "finalize":
      return {
        input: caseData.reviewReport ? `审核评分 ${caseData.reviewReport.overallScore}` : undefined,
        output: caseData.finalOkr ? `v${caseData.finalOkr.version} 已定稿` : undefined,
      };
    default:
      return {};
  }
}

const unsupportedNodes = new Set(["finalize", "human-review"]);

function NodeDetail({
  node,
  run,
  caseData,
  rerunning,
  onRerun,
  onClose,
}: {
  node: FlowNodeConfig;
  run?: FlowNodeRun;
  caseData: OkrCase;
  rerunning: boolean;
  onRerun: () => void;
  onClose: () => void;
}) {
  const role = useAppStore((s) => s.config.roles.find((r) => r.roleId === node.roleId));
  const runMode = useAppStore((s) => s.config.runMode);
  const summary = getNodeSummary(node.id, caseData);
  const isRunning = rerunning || run?.status === "running";
  const canRerun = !unsupportedNodes.has(node.id);

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
            <Badge variant="secondary" className={`text-[10px] ${statusStyle[resolvedStatus(run, node.id, caseData)]}`}>
              {statusLabel[resolvedStatus(run, node.id, caseData)]}
            </Badge>
          </div>
          <div>
            <p className="text-slate-400">使用模型</p>
            <p className="text-slate-700 font-mono text-[10px]">{role?.model.modelId ?? "—"}</p>
          </div>
          <div>
            <p className="text-slate-400">运行模式</p>
            <Badge variant="secondary" className={`text-[10px] ${runMode === "live" ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-500"}`}>
              {runMode === "live" ? "Live" : "Mock"}
            </Badge>
          </div>
          {run?.startedAt && (
            <div>
              <p className="text-slate-400">开始时间</p>
              <p className="text-slate-600">{new Date(run.startedAt).toLocaleString("zh-CN")}</p>
            </div>
          )}
        </div>

        {summary.input && (
          <div>
            <p className="text-slate-400">输入摘要</p>
            <p className="text-slate-600 break-all">{summary.input}</p>
          </div>
        )}

        {summary.output && (
          <div>
            <p className="text-slate-400">输出摘要</p>
            <p className="text-slate-600">{summary.output}</p>
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
          {canRerun ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
              onClick={onRerun}
              disabled={isRunning}
            >
              {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
              {isRunning ? "重跑中..." : "从此节点重跑"}
            </Button>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <AlertTriangle className="w-3 h-3" />
              该节点不支持自动重跑
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function FlowGraphTab({ caseData }: { caseData: OkrCase }) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [rerunningNode, setRerunningNode] = useState<string | null>(null);
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

  const handleRerun = (nodeId: string) => {
    setRerunningNode(nodeId);
    const result = rerunNode(caseData.id, nodeId);

    switch (result) {
      case "started":
        toast.success("重跑已启动，请关注节点状态变化");
        // Keep panel open so user can watch status change
        // Clear rerunning after a short delay (the async pipeline will update node status)
        setTimeout(() => setRerunningNode(null), 2000);
        break;
      case "unsupported":
        toast.warning("该节点不支持自动重跑");
        setRerunningNode(null);
        break;
      case "no-data":
        toast.error("重跑所需的前置数据不存在，请先完成前序步骤");
        setRerunningNode(null);
        break;
      case "error":
        toast.error("重跑失败，请检查案例状态");
        setRerunningNode(null);
        break;
    }
  };

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
              const status = resolvedStatus(run, node.id, caseData);
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
            const active = resolvedStatus(sourceRun, edge.source, caseData) === "success"
              && targetRun
              && resolvedStatus(targetRun, edge.target, caseData) !== "pending";
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

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">回旋执行记录</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {caseData.logs
            .filter((log) => ["开始分析", "信息检查", "补充信息", "开始拆解", "拆解暂停", "信息检查通过", "拆解完成", "审核通过", "审核未通过", "重新拆解", "重新拆解暂停", "重新拆解完成"].includes(log.action))
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .map((log) => (
              <div key={log.id} className="flex items-start gap-2 text-xs">
                <Badge variant="outline" className="shrink-0 text-[10px] text-slate-500">
                  {new Date(log.timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                </Badge>
                <div>
                  <p className="font-medium text-slate-700">{log.actor} · {log.action}</p>
                  {log.detail && <p className="text-slate-500">{log.detail}</p>}
                </div>
              </div>
            ))}
        </CardContent>
      </Card>

      {/* Node Detail Panel */}
      {selected && (
        <NodeDetail
          node={selected}
          run={getNodeRun(runs, selected.id)}
          caseData={caseData}
          rerunning={rerunningNode === selected.id}
          onRerun={() => handleRerun(selected.id)}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
}
