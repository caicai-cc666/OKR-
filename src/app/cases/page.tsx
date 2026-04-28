"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/lib/store";
import { getDisplayStatus } from "@/types";
import type { OkrCase } from "@/types";
import {
  StatusBadge,
  CaseActionButton,
  EmptyState,
} from "@/components/shared";
import {
  Plus, Search, Users, CalendarRange, FolderKanban,
  AlertTriangle, FileText, Sparkles,
} from "lucide-react";

function getCaseSummary(c: OkrCase): string {
  const ds = getDisplayStatus(c.status);
  if (ds === "review_passed" && c.reviewReport) {
    return `审核评分 ${c.reviewReport.overallScore} 分，已通过`;
  }
  if (ds === "review_failed" && c.reviewReport) {
    return `审核评分 ${c.reviewReport.overallScore} 分 — ${c.reviewReport.suggestions[0] || "需要修改后重新提交"}`;
  }
  if (c.missingInfo) {
    const highCount = c.missingInfo.missingFields.filter(
      (f) => f.priority === "high"
    ).length;
    return `缺少 ${c.missingInfo.missingFields.length} 项信息${highCount > 0 ? `（${highCount} 项高优先级）` : ""}`;
  }
  if (c.okrDrafts) {
    return "草稿已生成，等待审核";
  }
  return "等待信息收集与结构化";
}

export default function WorkspacePage() {
  const cases = useAppStore((s) => s.cases);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Hero */}
      <Card className="border-dashed border-2 border-blue-200 bg-gradient-to-r from-blue-50/60 to-indigo-50/40 shadow-none">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">开始新的 OKR 拆解</h3>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                  只需要用自然语言描述你的业务背景和目标，系统会自动整理信息、拆解出三版不同力度的 OKR，并进行质量审核。无需手动分类，无需填写复杂表单。
                </p>
                <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    多角色自动协作
                  </span>
                  <span className="flex items-center gap-1">
                    <CalendarRange className="w-3.5 h-3.5" />
                    保守 / 平衡 / 进取 三版方案
                  </span>
                </div>
              </div>
            </div>
            <Link href="/cases/new" className="shrink-0">
              <Button className="bg-blue-600 hover:bg-blue-700 gap-2">
                <Plus className="w-4 h-4" />
                新建拆解
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="搜索案例标题..." className="pl-9 bg-white border-slate-200" />
        </div>
        <Button variant="outline" size="sm" className="text-slate-600 gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" />
          全部状态
        </Button>
        <Button variant="outline" size="sm" className="text-slate-600 gap-1.5">
          <Users className="w-3.5 h-3.5" />
          全部团队
        </Button>
      </div>

      {/* Case List */}
      {cases.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="暂无案例"
          description="点击上方按钮创建你的第一个 OKR 拆解案例"
          action={
            <Link href="/cases/new">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                新建拆解
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3">
          {[...cases]
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .map((c) => {
              const ds = getDisplayStatus(c.status);
              const summary = getCaseSummary(c);
              return (
                <Card
                  key={c.id}
                  className="border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all"
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5">
                          <Link
                            href={`/cases/${c.id}`}
                            className="text-base font-semibold text-slate-900 hover:text-blue-600 transition-colors truncate"
                          >
                            {c.title}
                          </Link>
                          <StatusBadge status={ds} />
                        </div>
                        <p className="mt-1.5 text-sm text-slate-500 flex items-start gap-1.5">
                          <FileText className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
                          <span className="line-clamp-1">{summary}</span>
                        </p>
                        <div className="flex items-center gap-4 mt-2.5 text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            {c.team}
                          </span>
                          <span className="flex items-center gap-1">
                            <CalendarRange className="w-3.5 h-3.5" />
                            {c.cycle}
                          </span>
                          <span>
                            更新于 {new Date(c.updatedAt).toLocaleDateString("zh-CN")}
                          </span>
                          {c.tags.slice(0, 3).map((tag) => (
                            <Badge
                              key={tag}
                              variant="outline"
                              className="text-[11px] text-slate-400 border-slate-200 px-1.5 py-0"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        <CaseActionButton status={ds} caseId={c.id} />
                        <Link href={`/cases/${c.id}`}>
                          <Button variant="ghost" size="sm" className="text-slate-500">
                            详情
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
        </div>
      )}
    </div>
  );
}
