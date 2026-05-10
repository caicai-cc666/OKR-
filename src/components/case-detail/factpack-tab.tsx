"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { canCaseAcceptUserInput } from "@/types";
import type { FactPack, MissingInfoPack } from "@/types";
import { useAppStore } from "@/lib/store";
import {
  Target,
  AlertTriangle,
  Clock,
  Users,
  BarChart3,
  ShieldAlert,
  Link2,
  Ban,
  TrendingUp,
  Loader2,
  Sparkles,
  SkipForward,
} from "lucide-react";

function FactSection({
  icon: Icon,
  title,
  items,
  color = "text-slate-400",
  emptyText = "暂无",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  items: string[];
  color?: string;
  emptyText?: string;
}) {
  return (
    <div>
      <h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1.5">
        <Icon className={`w-3.5 h-3.5 ${color}`} />
        {title}
      </h4>
      {items.length > 0 ? (
        <ul className="space-y-1">
          {items.map((item, i) => (
            <li
              key={i}
              className="text-sm text-slate-600 flex items-start gap-2"
            >
              <span className={`mt-0.5 ${color}`}>&#8226;</span>
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-400">{emptyText}</p>
      )}
    </div>
  );
}

export function FactPackTab({
  factPack,
  missingInfo,
  caseId,
}: {
  factPack: FactPack;
  missingInfo?: MissingInfoPack;
  caseId?: string;
}) {
  return <FactPackView factPack={factPack} missingInfo={missingInfo} caseId={caseId} />;
}

const requiredFactFields: Array<{
  key: keyof FactPack;
  label: string;
  reason: string;
  suggestion: string;
}> = [
  {
    key: "strategicGoals",
    label: "战略目标",
    reason: "没有明确目标时，OKR 拆解容易变成任务清单。",
    suggestion: "请补充本周期最想达成的 1-3 个业务结果。",
  },
  {
    key: "baselines",
    label: "当前基线",
    reason: "缺少现状数据时，KR 的目标值无法判断是否合理。",
    suggestion: "请补充当前指标、规模、转化率、收入或效率等基线。",
  },
  {
    key: "candidateMetrics",
    label: "候选指标",
    reason: "缺少可衡量指标时，KR 很难通过审核。",
    suggestion: "请补充能衡量目标是否达成的指标。",
  },
  {
    key: "constraints",
    label: "约束条件",
    reason: "缺少资源、预算、时间或团队约束时，方案可行性难判断。",
    suggestion: "请补充周期、预算、人力、技术或业务限制。",
  },
  {
    key: "stakeholders",
    label: "干系人 / Owner 候选",
    reason: "缺少承接团队时，后续执行责任不清晰。",
    suggestion: "请补充负责团队、协作团队或关键负责人。团队可以作为 owner。",
  },
];

function isMissingFactValue(value: FactPack[keyof FactPack]): boolean {
  if (Array.isArray(value)) return value.length === 0;
  return !value;
}

function structuredOrFallback(primary: string[] | undefined, fallback: string[] = []): string[] {
  return primary?.length ? primary : fallback;
}

function dimensionSections(factPack: FactPack) {
  const d = factPack.structuredDimensions;
  return [
    {
      icon: Target,
      title: "战略背景",
      definition: "讲清为什么做、想达成什么、当前最重要的优先级是什么。",
      items: structuredOrFallback(d?.strategicBackground, factPack.strategicGoals),
      color: "text-blue-500",
    },
    {
      icon: TrendingUp,
      title: "业务现状",
      definition: "说明现在做到哪一步、过去做过什么、效果怎么样。",
      items: structuredOrFallback(d?.businessStatus, factPack.baselines),
      color: "text-indigo-500",
    },
    {
      icon: Link2,
      title: "业务链路",
      definition: "描述业务是怎么运转的，以及用哪些核心指标来衡量好坏。",
      items: structuredOrFallback(d?.businessChain, factPack.candidateMetrics),
      color: "text-cyan-500",
    },
    {
      icon: AlertTriangle,
      title: "问题瓶颈",
      definition: "指出当前卡在哪、主要矛盾是什么，以及潜在风险在哪里。",
      items: structuredOrFallback(d?.bottlenecks, [...factPack.currentChallenges, ...factPack.risks]),
      color: "text-red-500",
    },
    {
      icon: ShieldAlert,
      title: "资源与约束",
      definition: "明确手里有什么资源、同时有哪些不能突破的限制条件。",
      items: structuredOrFallback(d?.resourcesConstraints, [...factPack.constraints, ...factPack.dependencies]),
      color: "text-orange-500",
    },
    {
      icon: Users,
      title: "组织分工",
      definition: "说明谁负责什么，协同关系是怎样的。",
      items: structuredOrFallback(d?.organization, factPack.stakeholders),
      color: "text-emerald-500",
    },
    {
      icon: BarChart3,
      title: "客户市场",
      definition: "讲清面对的是谁、市场环境和竞争情况如何。",
      items: d?.customerMarket ?? [],
      color: "text-violet-500",
    },
    {
      icon: Clock,
      title: "时间与成功标准",
      definition: "明确节奏安排，以及做到什么程度才算成功。",
      items: structuredOrFallback(d?.timeSuccessCriteria, factPack.timeframe ? [factPack.timeframe] : []),
      color: "text-sky-500",
    },
    {
      icon: Ban,
      title: "其他补充",
      definition: "不在以上维度的内容。",
      items: structuredOrFallback(d?.other, factPack.nonGoals),
      color: "text-slate-500",
    },
  ];
}

function FactGaps({
  factPack,
  missingInfo,
  caseId,
}: {
  factPack: FactPack;
  missingInfo?: MissingInfoPack;
  caseId?: string;
}) {
  const supplementInfo = useAppStore((s) => s.supplementInfo);
  const startDecomposition = useAppStore((s) => s.startDecomposition);
  const ignoreMissingField = useAppStore((s) => s.ignoreMissingField);
  const ignoredTags = useAppStore((s) => {
    const c = caseId ? s.cases.find((item) => item.id === caseId) : undefined;
    return c?.tags;
  });
  const caseData = useAppStore((s) => caseId ? s.cases.find((item) => item.id === caseId) : undefined);
  const canEdit = caseData ? canCaseAcceptUserInput(caseData) : true;
  const ignoredFields = useMemo(() => {
    return new Set(
      (ignoredTags ?? [])
        .filter((tag) => tag.startsWith("ignoredMissing:"))
        .map((tag) => {
          try {
            return decodeURIComponent(tag.slice("ignoredMissing:".length));
          } catch {
            return tag.slice("ignoredMissing:".length);
          }
        })
    );
  }, [ignoredTags]);
  const [supplement, setSupplement] = useState("");
  const [loading, setLoading] = useState(false);
  const [ignoringField, setIgnoringField] = useState<string | null>(null);

  const inferredGaps = requiredFactFields
    .filter((field) => isMissingFactValue(factPack[field.key]))
    .map((field) => ({
      field: field.label,
      reason: field.reason,
      priority: field.key === "strategicGoals" || field.key === "candidateMetrics" ? "high" : "medium",
      suggestion: field.suggestion,
    }));

  const explicitGaps = missingInfo?.missingFields ?? [];
  const gaps = [...explicitGaps, ...inferredGaps].filter(
    (gap, index, all) => !ignoredFields.has(gap.field) && all.findIndex((item) => item.field === gap.field) === index
  );

  if (gaps.length === 0) return null;

  const handleSubmit = () => {
    if (!canEdit) {
      toast.info("当前流程正在拆解或审核中，请等待本轮结束");
      return;
    }
    if (!caseId) {
      toast.info("请在 Missing Info 页补充该信息");
      return;
    }
    if (!supplement.trim()) {
      toast.error("请填写综合补充说明");
      return;
    }
    setLoading(true);
    supplementInfo(caseId, "综合补充信息", supplement.trim());
    startDecomposition(caseId);
    setSupplement("");
    toast.success("补充说明已写入，正在重新结构化并继续拆解...");
    setTimeout(() => setLoading(false), 4000);
  };

  const handleIgnore = (gap: { field: string; reason: string; priority: string }) => {
    if (!caseId) return;
    if (!canEdit) {
      toast.info("当前流程正在拆解或审核中，请等待本轮结束");
      return;
    }
    setIgnoringField(gap.field);
    ignoreMissingField(caseId, gap.field, gap.reason);
    const remainingHighGaps = gaps.filter((item) => item.priority === "high" && item.field !== gap.field);
    if (remainingHighGaps.length === 0) {
      startDecomposition(caseId);
      toast.success("已忽略该关键缺口，正在继续拆解。建议后续在报告或下一轮补充中补齐。");
      setTimeout(() => setIgnoringField(null), 4000);
      return;
    }
    toast.success(`已忽略「${gap.field}」，仍有 ${remainingHighGaps.length} 个关键缺口建议处理。`);
    setIgnoringField(null);
  };

  return (
    <div className="space-y-4">
    {caseId && (
      <Card className="sticky top-0 z-10 overflow-visible border-blue-200 bg-blue-50 shadow-md before:absolute before:-top-4 before:left-0 before:right-0 before:h-4 before:bg-blue-50 before:content-['']">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-blue-800 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" />
            一次性补充并继续拆解
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!canEdit && (
            <p className="rounded-md border border-blue-100 bg-white px-3 py-2 text-xs text-blue-700">
              当前流程正在拆解或审核中，暂时不能补充信息。
            </p>
          )}
          <Textarea
            value={supplement}
            onChange={(e) => setSupplement(e.target.value)}
            disabled={!canEdit}
            placeholder="把缺失信息一次性写在这里，例如：周期、预算、当前数据、目标数据、负责团队、约束和风险。下面可以边看缺口提示边补充。"
            rows={4}
            className="resize-none border-blue-100 bg-white text-sm leading-relaxed"
          />
          <div className="flex justify-end">
            <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700" onClick={handleSubmit} disabled={!canEdit || loading || !supplement.trim()}>
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              提交补充并继续拆解
            </Button>
          </div>
        </CardContent>
      </Card>
    )}

    <Card className="border-amber-200 bg-amber-50/30 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-amber-800 flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4" />
          结构化信息缺口
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-amber-700 leading-relaxed">
          以下信息没有从原始输入中明确提取到。建议优先补充；如果你暂时无法提供某个关键缺口，也可以手动忽略它，系统会记录该决策并继续拆解。
        </p>
        {gaps.map((gap) => (
          <div key={gap.field} className="rounded-lg border border-amber-100 bg-white p-3 space-y-1.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-slate-800">{gap.field}</p>
                <Badge variant="secondary" className={`text-[10px] border-0 ${
                  gap.priority === "high" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
                }`}>
                  {gap.priority === "high" ? "关键缺口" : "建议补充"}
                </Badge>
              </div>
              {caseId && gap.priority === "high" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0 gap-1.5 border-amber-200 px-2 text-xs text-amber-700 hover:bg-amber-50"
                  onClick={() => handleIgnore(gap)}
                  disabled={!canEdit || ignoringField === gap.field}
                >
                  {ignoringField === gap.field ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SkipForward className="w-3.5 h-3.5" />}
                  忽略并继续
                </Button>
              )}
            </div>
            <p className="text-xs text-slate-500">{gap.reason}</p>
            {gap.suggestion && <p className="text-xs text-blue-600">{gap.suggestion}</p>}
          </div>
        ))}
      </CardContent>
    </Card>
    </div>
  );
}

export function FactPackView({
  factPack,
  missingInfo,
  caseId,
}: {
  factPack: FactPack;
  missingInfo?: MissingInfoPack;
  caseId?: string;
}) {
  return (
    <div className="space-y-4">
      <FactGaps factPack={factPack} missingInfo={missingInfo} caseId={caseId} />

      {/* Business Context */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">业务背景</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-700 leading-relaxed">
            {factPack.businessContext}
          </p>
          <div className="flex items-center gap-2 mt-3">
            <Badge variant="outline" className="text-xs text-slate-500">
              <Clock className="w-3 h-3 mr-1" />
              {factPack.timeframe}
            </Badge>
            <Badge variant="secondary" className="text-[10px] text-slate-400">
              结构化于{" "}
              {new Date(factPack.structuredAt).toLocaleDateString("zh-CN")}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {dimensionSections(factPack).map((section) => (
          <Card key={section.title} className="border-slate-200 shadow-sm">
            <CardContent className="p-5 space-y-3">
              <FactSection
                icon={section.icon}
                title={section.title}
                items={section.items}
                color={section.color}
              />
              <p className="text-xs leading-relaxed text-slate-400">{section.definition}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
