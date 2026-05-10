"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import {
  canReadCaseForAccount,
  CaseStatus,
  CaseStatusLabel,
  CaseStatusColor,
} from "@/types";
import {
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

export default function ReviewPage() {
  const cases = useAppStore((s) => s.cases);
  const memberships = useAppStore((s) => s.memberships);
  const currentUserId = useAppStore((s) => s.currentUserId);
  const currentTenantId = useAppStore((s) => s.currentTenantId);
  const currentRole =
    memberships.find((item) => item.userId === currentUserId && item.tenantId === currentTenantId && item.status === "active")?.role ??
    memberships.find((item) => item.userId === currentUserId && item.role === "platform_owner" && item.status === "active")?.role;
  const visibleCases = cases.filter((item) =>
    canReadCaseForAccount(item, currentRole, currentTenantId, currentUserId)
  );
  const reviewCases = visibleCases.filter(
    (c) =>
      c.status === CaseStatus.UNDER_REVIEW ||
      c.status === CaseStatus.HUMAN_REVIEW_REQUIRED ||
      c.status === CaseStatus.REVIEW_FAILED ||
      c.status === CaseStatus.REVIEW_PASSED
  );

  const pendingReview = reviewCases.filter(
    (c) =>
      c.status === CaseStatus.UNDER_REVIEW ||
      c.status === CaseStatus.HUMAN_REVIEW_REQUIRED
  );

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">审核中心</h1>
        <p className="text-sm text-slate-500 mt-1">
          管理和审核 OKR 拆解结果
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {pendingReview.length}
              </p>
              <p className="text-sm text-slate-500">待审核</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {
                  reviewCases.filter(
                    (c) => c.status === CaseStatus.HUMAN_REVIEW_REQUIRED
                  ).length
                }
              </p>
              <p className="text-sm text-slate-500">需人工介入</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {
                  reviewCases.filter(
                    (c) => c.status === CaseStatus.REVIEW_PASSED
                  ).length
                }
              </p>
              <p className="text-sm text-slate-500">已通过</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Review Queue */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">审核队列</CardTitle>
          <CardDescription>需要审核或已审核的 OKR 案例</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {reviewCases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ClipboardCheck className="w-12 h-12 text-slate-200 mb-3" />
              <p className="text-sm text-slate-500">暂无需要审核的案例</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {reviewCases.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="text-sm font-medium text-slate-900">
                        {c.title}
                      </h3>
                      <Badge
                        variant="secondary"
                        className={`${CaseStatusColor[c.status]} border-0 text-xs`}
                      >
                        {CaseStatusLabel[c.status]}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {c.createdBy} &middot;{" "}
                      {c.reviewReport
                        ? `评分 ${c.reviewReport.overallScore} 分`
                        : "等待审核"}
                    </p>
                  </div>
                  <Link href={`/cases/${c.id}?tab=drafts`}>
                    <Button variant="ghost" size="sm" className="gap-1.5">
                      查看详情
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
