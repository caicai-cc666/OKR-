import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DisplayStatus,
  DisplayStatusLabel,
  DisplayStatusColor,
} from "@/types";
import type { LucideIcon } from "lucide-react";

// ---- PageHeader ----

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {description && (
          <p className="text-sm text-slate-500 mt-1">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

// ---- StatCard ----

export function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  color: string;
}) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          <p className="text-sm text-slate-500">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ---- StatusBadge ----

export function StatusBadge({ status }: { status: DisplayStatus }) {
  return (
    <Badge
      variant="secondary"
      className={`${DisplayStatusColor[status]} border-0 text-xs shrink-0`}
    >
      {DisplayStatusLabel[status]}
    </Badge>
  );
}

// ---- EmptyState ----

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-slate-300" />
      </div>
      <h3 className="text-sm font-medium text-slate-600 mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-slate-400 max-w-sm mb-4">{description}</p>
      )}
      {action}
    </div>
  );
}

// ---- LoadingState ----

export function LoadingState({ text = "加载中..." }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin mb-3" />
      <p className="text-sm text-slate-400">{text}</p>
    </div>
  );
}

// ---- SectionCard ----

export function SectionCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`border-slate-200 shadow-sm ${className}`}>
      <CardContent className="p-6">{children}</CardContent>
    </Card>
  );
}

// ---- CaseActionButton (per status) ----

export function CaseActionButton({
  status,
  caseId,
  size = "sm",
}: {
  status: DisplayStatus;
  caseId: string;
  size?: "sm" | "default";
}) {
  switch (status) {
    case "info_insufficient":
      return (
        <Link href={`/cases/${caseId}?tab=factpack`}>
          <Button
            size={size}
            variant="outline"
            className="gap-1.5 border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
          >
            继续
          </Button>
        </Link>
      );
    case "review_failed":
      return (
        <Link href={`/cases/${caseId}?tab=drafts`}>
          <Button
            size={size}
            variant="outline"
            className="gap-1.5 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
          >
            继续
          </Button>
        </Link>
      );
    case "review_passed":
      return (
        <Link href={`/cases/${caseId}?tab=drafts`}>
          <Button
            size={size}
            variant="outline"
            className="gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
          >
            查看结果
          </Button>
        </Link>
      );
  }
}
