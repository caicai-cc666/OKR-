"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/shared";
import type { OkrCase, DisplayStatus } from "@/types";
import { getDisplayStatus } from "@/types";
import { useAppStore } from "@/lib/store";
import {
  ArrowRight,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Bot,
  Gauge,
} from "lucide-react";

function getNextAction(ds: DisplayStatus, c: OkrCase) {
  switch (ds) {
    case "info_insufficient":
      return {
        label: "补充缺失信息",
        desc: c.missingInfo
          ? `还有 ${c.missingInfo.missingFields.length} 项信息需要补充`
          : "等待信息收集与结构化",
        color: "border-amber-200 text-amber-700 hover:bg-amber-50",
        tab: "missing",
      };
    case "review_failed":
      return {
        label: "查看审核报告并修改",
        desc: c.reviewReport
          ? `评分 ${c.reviewReport.overallScore} 分，${c.reviewReport.fatalIssues?.length ? c.reviewReport.fatalIssues.length + " 个致命问题" : "未达阈值"}`
          : "审核未通过",
        color: "border-red-200 text-red-700 hover:bg-red-50",
        tab: "review",
      };
    case "review_passed":
      return {
        label: "查看最终 OKR",
        desc: c.reviewReport
          ? `评分 ${c.reviewReport.overallScore} 分，审核通过`
          : "已通过审核",
        color: "border-emerald-200 text-emerald-700 hover:bg-emerald-50",
        tab: "final",
      };
  }
}

export function OverviewTab({ caseData }: { caseData: OkrCase }) {
  const ds = getDisplayStatus(caseData.status);
  const action = getNextAction(ds, caseData);
  const config = useAppStore((s) => s.config);
  const threshold = config.review.passThreshold;

  const latestOutput = caseData.reviewReport
    ? `审核评分 ${caseData.reviewReport.overallScore}/100，${caseData.reviewReport.passed ? "已通过" : "未通过"}`
    : caseData.okrDrafts
      ? "三版 OKR 草稿已生成，等待审核"
      : caseData.factPack
        ? "事实信息已结构化"
        : "等待信息输入";

  return (
    <div className="space-y-4">
      {/* Status + Next Action */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-400 mb-1">当前状态</p>
                <StatusBadge status={ds} />
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">推荐下一步</p>
                <p className="text-sm font-medium text-slate-800">
                  {action.label}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{action.desc}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className={`gap-1.5 ${action.color}`}
            >
              {action.label}
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Latest Output */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-600">最近输出</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-700">{latestOutput}</p>
            <p className="text-xs text-slate-400 mt-1">
              更新于 {new Date(caseData.updatedAt).toLocaleDateString("zh-CN")}
            </p>
          </CardContent>
        </Card>

        {/* Threshold */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-600 flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5" />
              审核阈值
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-slate-900">
                {threshold}
              </span>
              <span className="text-sm text-slate-400">/ 100 分通过</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {config.review.humanReviewThreshold} 分以上需人工审核
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Role Model Bindings */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-slate-600 flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5" />
            角色模型绑定
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {config.roles.map((role) => (
              <div
                key={role.roleId}
                className="bg-slate-50 rounded-lg p-3 border border-slate-100"
              >
                <p className="text-xs font-medium text-slate-700">
                  {role.roleName}
                </p>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
                  {role.model.modelId}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
