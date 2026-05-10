"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { ReviewReport } from "@/types";
import { CaseStatus } from "@/types";
import { useAppStore } from "@/lib/store";
import {
  CheckCircle2, XCircle, AlertTriangle, RotateCcw, Pencil, ThumbsUp,
} from "lucide-react";

function ScoreBar({ name, score, maxScore, comment }: { name: string; score: number; maxScore: number; comment: string }) {
  const pct = (score / maxScore) * 100;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-slate-700">{name}</span>
        <span className="text-sm text-slate-500">{score}/{maxScore}</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2">
        <div className={`h-2 rounded-full ${pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-400" : "bg-red-400"}`}
          style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-slate-500 mt-1">{comment}</p>
    </div>
  );
}

export function ReviewTab({ report, caseId, onNavigateTab }: { report: ReviewReport; caseId: string; onNavigateTab?: (tab: string) => void }) {
  const updateCase = useAppStore((s) => s.updateCase);
  const addLog = useAppStore((s) => s.addLog);
  const retryDecomposition = useAppStore((s) => s.retryDecomposition);
  const caseData = useAppStore((s) => s.cases.find((c) => c.id === caseId));
  const reviewConfig = useAppStore((s) => s.config.review);
  const [retrySupplement, setRetrySupplement] = useState("");

  const handleMarkPassed = () => {
    const drafts = caseData?.okrDrafts;
    updateCase(caseId, {
      status: CaseStatus.REVIEW_PASSED,
      reviewReport: { ...report, passed: true, overallScore: Math.max(report.overallScore, 80) },
      finalOkr: drafts ? {
        objectives: drafts.balanced.objectives,
        finalizedAt: new Date().toISOString(),
        finalizedBy: "用户",
        version: (caseData?.finalOkr?.version ?? 0) + 1,
      } : caseData?.finalOkr,
    });
    addLog(caseId, "标记通过", "用户", "用户手动标记审核通过并定稿");
    toast.success("审核已标记通过，已自动定稿");
  };

  const handleRetry = () => {
    retryDecomposition(caseId, retrySupplement);
    addLog(
      caseId,
      "重新拆解",
      "用户",
      retrySupplement.trim()
        ? `审核未通过，带补充说明重新拆解：${retrySupplement.trim().slice(0, 80)}`
        : "审核未通过，用户选择重新拆解"
    );
    setRetrySupplement("");
    toast.success("正在基于原信息和补充说明重新拆解...");
  };

  const handleContinueEdit = () => {
    if (onNavigateTab) {
      onNavigateTab("drafts");
    } else {
      toast.info("请切换到 Drafts 选项卡编辑草案");
    }
  };

  return (
    <div className="space-y-4">
      {/* Score */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-6">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold ${
              report.passed ? "bg-emerald-50 text-emerald-600" : report.needsHumanReview ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600"
            }`}>
              {report.overallScore}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-slate-900">
                {report.passed ? "审核通过" : report.needsHumanReview ? "需要人工审核" : "审核未通过"}
              </h3>
              <p className="text-sm text-slate-500 mt-0.5">
                {report.reviewedBy} 于 {new Date(report.reviewedAt).toLocaleDateString("zh-CN")} 审核
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                通过阈值 {reviewConfig.passThreshold}/100{reviewConfig.humanReviewEnabled ? ` · 人工审核阈值 ${reviewConfig.humanReviewThreshold}/100` : ""}
              </p>
            </div>
            {/* Action buttons always visible */}
            <div className="flex items-center gap-2 shrink-0">
              {!report.passed && (
                <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={handleMarkPassed}>
                  <ThumbsUp className="w-3.5 h-3.5" />标记通过
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Prerequisites */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-sm">A. 必要条件</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(report.prerequisites || []).map((p, i) => (
            <div key={i} className="flex items-start gap-2">
              {p.met ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />}
              <div>
                <p className="text-sm text-slate-700">{p.label}</p>
                {p.note && <p className="text-xs text-slate-400">{p.note}</p>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Core Dimensions */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-sm">B. 核心评分</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {(report.coreDimensions || []).map((dim) => <ScoreBar key={dim.name} {...dim} />)}
        </CardContent>
      </Card>

      {report.auxDimensions && report.auxDimensions.length > 0 && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">辅助评分</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {report.auxDimensions.map((dim) => <ScoreBar key={dim.name} {...dim} />)}
          </CardContent>
        </Card>
      )}

      {/* Decision for failed */}
      {!report.passed && (
        <Card className="border-red-200 bg-red-50/30 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-red-700 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />D. 审核未通过
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {report.fatalIssues && report.fatalIssues.length > 0 && (
              <div>
                <p className="text-xs font-medium text-red-600 mb-1">致命问题</p>
                {report.fatalIssues.map((issue, i) => (
                  <p key={i} className="text-sm text-red-800 flex items-start gap-2">
                    <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{issue}
                  </p>
                ))}
              </div>
            )}
            <Separator className="border-red-100" />
            {report.suggestions.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-600 mb-1">修改建议</p>
                <ul className="space-y-1">
                  {report.suggestions.map((s, i) => (
                    <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                      <span className="mt-0.5 text-slate-400">&#8226;</span>{s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Separator className="border-red-100" />
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-600">重新拆解补充说明</p>
              <Textarea
                value={retrySupplement}
                onChange={(e) => setRetrySupplement(e.target.value)}
                placeholder="可补充你希望下一轮调整的方向，例如：更保守、聚焦续费率、预算只有 50 万、由增长团队承接..."
                rows={3}
                className="resize-none border-red-100 bg-white text-sm"
              />
              <p className="text-[11px] text-slate-400">
                留空也可以直接重跑；填写后会附加到原始上下文里一起生成新草稿。
              </p>
            </div>
            <Separator className="border-red-100" />
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1.5 text-slate-600" onClick={handleContinueEdit}>
                <Pencil className="w-3.5 h-3.5" />继续修改
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50" onClick={handleRetry}>
                <RotateCcw className="w-3.5 h-3.5" />重新拆解
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Passed suggestions */}
      {report.passed && report.suggestions.length > 0 && (
        <Card className="border-blue-100 bg-blue-50/30 shadow-none">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-blue-700">改进建议（非阻塞）</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {report.suggestions.map((s, i) => (
                <li key={i} className="text-sm text-blue-800 flex items-start gap-2"><span className="mt-0.5">&#8226;</span>{s}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
