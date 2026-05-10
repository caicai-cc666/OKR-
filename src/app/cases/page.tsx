"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/lib/store";
import { canReadCaseForAccount, CaseRunDisplayColor, CaseRunDisplayLabel, getCaseRunDisplayStatus } from "@/types";
import type { CaseRunDisplayStatus, OkrCase } from "@/types";
import {
  EmptyState,
} from "@/components/shared";
import {
  Plus, Search, Users, CalendarRange, FolderKanban,
  AlertTriangle, Sparkles, ChevronDown, ChevronRight,
} from "lucide-react";

function getParentId(c: OkrCase): string | null {
  const tag = c.tags.find((item) => item.startsWith("parent:"));
  return tag ? tag.slice("parent:".length) : null;
}

function flattenCaseTree(cases: OkrCase[], collapsed: Set<string>): Array<{ item: OkrCase; depth: number; childCount: number }> {
  const sorted = [...cases].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const children = new Map<string, OkrCase[]>();
  for (const item of sorted) {
    const parentId = getParentId(item);
    if (parentId) children.set(parentId, [...(children.get(parentId) ?? []), item]);
  }

  const seen = new Set<string>();
  const result: Array<{ item: OkrCase; depth: number; childCount: number }> = [];
  const visit = (item: OkrCase, depth: number) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    const childItems = children.get(item.id) ?? [];
    result.push({ item, depth, childCount: childItems.length });
    if (collapsed.has(item.id)) return;
    for (const child of childItems) visit(child, depth + 1);
  };

  for (const item of sorted) {
    if (!getParentId(item)) visit(item, 0);
  }
  for (const item of sorted) visit(item, 0);
  return result;
}

const statusOptions: Array<{ value: "all" | CaseRunDisplayStatus; label: string }> = [
  { value: "all", label: "全部状态" },
  { value: "running_waiting_for_info", label: CaseRunDisplayLabel.running_waiting_for_info },
  { value: "running_processing", label: CaseRunDisplayLabel.running_processing },
  { value: "completed_passed", label: CaseRunDisplayLabel.completed_passed },
  { value: "completed_quality_failed", label: CaseRunDisplayLabel.completed_quality_failed },
  { value: "failed_no_result", label: CaseRunDisplayLabel.failed_no_result },
];

export default function WorkspacePage() {
  const cases = useAppStore((s) => s.cases);
  const memberships = useAppStore((s) => s.memberships);
  const currentUserId = useAppStore((s) => s.currentUserId);
  const currentTenantId = useAppStore((s) => s.currentTenantId);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | CaseRunDisplayStatus>("all");

  const toggleCollapsed = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const query = searchQuery.trim().toLowerCase();
  const currentRole =
    memberships.find((item) => item.userId === currentUserId && item.tenantId === currentTenantId && item.status === "active")?.role ??
    memberships.find((item) => item.userId === currentUserId && item.role === "platform_owner" && item.status === "active")?.role;
  const visibleCases = cases.filter((item) =>
    canReadCaseForAccount(item, currentRole, currentTenantId, currentUserId)
  );
  const filteredCases = visibleCases.filter((item) => {
    const matchesQuery = !query || item.title.toLowerCase().includes(query);
    const matchesStatus = statusFilter === "all" || getCaseRunDisplayStatus(item) === statusFilter;
    return matchesQuery && matchesStatus;
  });
  const hasActiveFilter = Boolean(query) || statusFilter !== "all";

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
                  只需要用自然语言描述你的业务背景和目标，系统会自动整理信息、拆解 Objective 下不同强度的 KR，并进行质量审核。无需手动分类，无需填写复杂表单。
                </p>
                <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    多角色自动协作
                  </span>
                  <span className="flex items-center gap-1">
                    <CalendarRange className="w-3.5 h-3.5" />
                    保守 / 平衡 / 进取 KR
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
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="搜索案例标题..."
            className="pl-9 bg-white border-slate-200"
          />
        </div>
        <div className="relative">
          <AlertTriangle className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "all" | CaseRunDisplayStatus)}
            className="h-9 rounded-md border border-slate-200 bg-white pl-8 pr-8 text-sm text-slate-600 outline-none transition-colors hover:bg-slate-50 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Case List */}
      {visibleCases.length === 0 ? (
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
      ) : filteredCases.length === 0 ? (
        <EmptyState
          icon={Search}
          title="没有匹配的案例"
          description="换一个标题关键词或状态再试试"
          action={
            hasActiveFilter ? (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-slate-600"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                }}
              >
                清空筛选
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-2">
          {flattenCaseTree(filteredCases, collapsed)
            .map(({ item: c, depth, childCount }) => {
              const runDisplay = getCaseRunDisplayStatus(c);
              return (
                <Card
                  key={c.id}
                  className="border-slate-200 shadow-none transition-all hover:border-slate-300 hover:bg-slate-50/40 hover:shadow-sm"
                  style={{ marginLeft: depth ? Math.min(depth * 22, 66) : 0 }}
                >
                  <CardContent className="px-3 py-2">
                    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        {childCount > 0 ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 text-slate-400 hover:text-slate-700"
                            onClick={() => toggleCollapsed(c.id)}
                            aria-label={collapsed.has(c.id) ? "展开下级拆解" : "收起下级拆解"}
                          >
                            {collapsed.has(c.id) ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </Button>
                        ) : (
                          <span className="w-5 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <Link
                            href={`/cases/${c.id}`}
                            className="block truncate text-sm font-medium leading-5 text-slate-900 transition-colors hover:text-blue-600"
                          >
                            {depth > 0 && <span className="mr-1 text-slate-400">↳</span>}
                            {c.title}
                          </Link>
                          <p className="text-[11px] leading-4 text-slate-400">
                            更新于 {new Date(c.updatedAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Badge variant="secondary" className={`${CaseRunDisplayColor[runDisplay]} h-5 border-0 px-1.5 text-[11px] leading-none`}>
                          {CaseRunDisplayLabel[runDisplay]}
                        </Badge>
                        <Link href={`/cases/${c.id}`}>
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-slate-500">
                            查看详情
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
