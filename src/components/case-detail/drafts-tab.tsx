"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { OkrCase, OkrDraftSet, OkrDraftVersion, DraftVariant, Objective, KeyResult, ReviewKrResult, ReviewObjectiveResult, CandidateKr } from "@/types";
import { DraftVariantLabel, DraftVariantColor, canCaseAcceptUserInput } from "@/types";
import { useAppStore } from "@/lib/store";
import {
  User, Calendar, RotateCcw, Star, Loader2, GitBranch, AlertTriangle,
  ChevronDown, ChevronRight,
} from "lucide-react";

type KrScoreSection = {
  label: string;
  body: string;
};

function meaningfulValue(value?: string): boolean {
  return Boolean(value?.trim()) && !/待|未明确|暂无|unknown|n\/a|NA/i.test(value ?? "");
}

function stripMeasurementSuffix(title: string): string {
  const markerIndex = title.lastIndexOf("，以");
  if (markerIndex < 8) return title;
  const suffix = title.slice(markerIndex);
  if (!suffix.includes("为衡量指标")) return title;
  return title.slice(0, markerIndex).trim();
}

function formatKrStatement(kr: KeyResult): string {
  return stripMeasurementSuffix(kr.title.trim());
}

function KrMetadata({ kr }: { kr: KeyResult }) {
  const items = [
    meaningfulValue(kr.metric) ? { label: "指标", value: kr.metric!.trim() } : undefined,
    meaningfulValue(kr.currentValue) ? { label: "基线", value: kr.currentValue!.trim() } : undefined,
    meaningfulValue(kr.targetValue) ? { label: "目标", value: kr.targetValue!.trim() } : undefined,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  if (!items.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item.label} className="rounded-md bg-white px-2 py-1 text-[11px] leading-none text-slate-500 ring-1 ring-slate-100">
          <span className="font-medium text-slate-400">{item.label}</span>
          <span className="ml-1 text-slate-600">{item.value}</span>
        </span>
      ))}
    </div>
  );
}

function isLikelyDemoDraft(drafts: OkrDraftSet): boolean {
  const versions = [drafts.conservative, drafts.balanced, drafts.aggressive];
  const text = versions.flatMap((version) => [
    version.generatedBy,
    version.reasoning,
    ...version.objectives.flatMap((objective) =>
      objective.keyResults.flatMap((kr) => [kr.title, kr.metric, kr.currentValue, kr.targetValue])
    ),
  ]).join(" ");
  return /演示模式|提升核心业务结果|改善关键支撑指标|核心结果指标|支撑指标|待填/.test(text);
}

function ChildDecompositionPanel({
  parentCase,
  objective,
  keyResult,
}: {
  parentCase?: OkrCase;
  objective: Objective;
  keyResult: KeyResult;
}) {
  const router = useRouter();
  const createCase = useAppStore((s) => s.createCase);
  const updateCase = useAppStore((s) => s.updateCase);
  const startAnalysis = useAppStore((s) => s.startAnalysis);
  const flowTemplates = useAppStore((s) => s.config.flowTemplates);
  const [open, setOpen] = useState(false);
  const [team, setTeam] = useState("");
  const [cycle, setCycle] = useState(parentCase?.cycle ?? "");
  const [childGoal, setChildGoal] = useState(keyResult.title);
  const [background, setBackground] = useState("");
  const [flowTemplateId, setFlowTemplateId] = useState(parentCase?.flowTemplateId ?? "");

  if (!parentCase) return null;

  const handleCreateChild = () => {
    if (!childGoal.trim()) {
      toast.error("请确认下级目标");
      return;
    }

    const childTeam = team.trim() || `${parentCase.team} 下级团队`;
    const childCycle = cycle.trim() || parentCase.cycle;
    const childFlowTemplateId = flowTemplateId || parentCase.flowTemplateId;
    const title = `承接 KR：${childGoal.trim()}`;
    const rawText = [
      `这是一个独立的下级 OKR 拆解分支。`,
      `上级案例：${parentCase.title}`,
      `上级案例 ID：${parentCase.id}`,
      `上级团队：${parentCase.team}`,
      `上级周期：${parentCase.cycle}`,
      `上级 Objective：${objective.title}`,
      `承接 Key Result：${keyResult.title}`,
      keyResult.owner ? `上级 KR owner：${keyResult.owner}` : "",
      "",
      `下级默认目标：${childGoal.trim()}`,
      `下级承接团队：${childTeam}`,
      `下级周期：${childCycle}`,
      background.trim() ? `下级业务背景：${background.trim()}` : "下级业务背景：用户暂未补充，默认以上级 KR 作为下级目标进行拆解。",
    ].filter(Boolean).join("\n");

    const id = createCase(title, childTeam, childCycle, rawText, childFlowTemplateId);
    updateCase(id, {
      tags: [`parent:${parentCase.id}`, `parentKr:${keyResult.id}`, "下级拆解"],
    });
    startAnalysis(id);
    toast.success("已创建下级拆解案例");
    router.push(`/cases/${id}?tab=factpack`);
  };

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
        onClick={() => setOpen(!open)}
      >
        <GitBranch className="w-3.5 h-3.5" />
        {open ? "收起下级拆解" : "从此 KR 拆下一级"}
      </Button>
      {open && (
        <div className="mt-3 space-y-3 rounded-lg border border-blue-100 bg-blue-50/30 p-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              placeholder={`下级团队，默认：${parentCase.team} 下级团队`}
              className="bg-white border-blue-100 text-sm"
            />
            <Input
              value={cycle}
              onChange={(e) => setCycle(e.target.value)}
              placeholder="下级周期"
              className="bg-white border-blue-100 text-sm"
            />
          </div>
          <Textarea
            value={childGoal}
            onChange={(e) => setChildGoal(e.target.value)}
            placeholder="下级目标，默认承接上级这条 KR"
            rows={2}
            className="resize-none bg-white border-blue-100 text-sm"
          />
          <Textarea
            value={background}
            onChange={(e) => setBackground(e.target.value)}
            placeholder="可选：补充下级业务背景、现状数据、资源约束。如果不填，将默认以上级 KR 作为下级目标继续拆解。"
            rows={4}
            className="resize-none bg-white border-blue-100 text-sm"
          />
          <select
            value={flowTemplateId || parentCase.flowTemplateId}
            onChange={(e) => setFlowTemplateId(e.target.value)}
            className="h-9 w-full rounded-md border border-blue-100 bg-white px-3 text-sm text-slate-700 outline-none transition-colors focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
          >
            {flowTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}{template.id === parentCase.flowTemplateId ? "（默认同上级）" : ""}
              </option>
            ))}
          </select>
          <div className="flex justify-end">
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={handleCreateChild}>
              开始下级拆解
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function variantDrafts(drafts: OkrDraftSet): OkrDraftVersion[] {
  return [drafts.conservative, drafts.balanced, drafts.aggressive];
}

function pickObjective(versions: OkrDraftVersion[], objectiveIndex: number): Objective | undefined {
  return versions.find((version) => version.variant === "balanced")?.objectives[objectiveIndex]
    ?? versions.find((version) => version.objectives[objectiveIndex])?.objectives[objectiveIndex];
}

function krReason(draft: OkrDraftVersion, kr: KeyResult): string {
  if (kr.reasoning?.trim()) return kr.reasoning;
  const variantReason: Record<DraftVariant, string> = {
    conservative: "保守型强调可达成性和执行确定性，目标幅度相对稳健，适合资源或信息仍不充分时采用。",
    balanced: "平衡型在业务牵引和资源可行性之间取中间值，通常适合作为默认候选方案。",
    aggressive: "进取型提高目标牵引力，适合希望拉开增长空间，但需要更多资源、协同或风险承受能力。",
  };
  return `${variantReason[draft.variant]} ${draft.reasoning}`;
}

type DraftKrItem = {
  draft: OkrDraftVersion;
  objective: Objective;
  kr: KeyResult;
};

function combinedKrsForObjective(versions: OkrDraftVersion[], objectiveIndex: number): DraftKrItem[] {
  const order: DraftVariant[] = ["conservative", "balanced", "aggressive"];
  return versions
    .slice()
    .sort((a, b) => order.indexOf(a.variant) - order.indexOf(b.variant))
    .flatMap((draft) => {
      const objective = draft.objectives[objectiveIndex];
      if (!objective) return [];
      return objective.keyResults.map((kr) => ({ draft, objective, kr }));
    });
}

function isOfficialReview(krReview: ReviewKrResult | undefined): boolean {
  return krReview?.source === "reviewer";
}

function krReviewSections(krReview: ReviewKrResult | undefined): KrScoreSection[] {
  if (!krReview) {
    return [
      { label: "审核结论", body: "尚未生成审核官的正式逐条审核结果。" },
    ];
  }
  if (krReview.source === "pending") {
    return [
      { label: "审核结论", body: krReview.summary ?? "审核官未返回这条 KR 的正式逐条审核结果。" },
      krReview.deductions.length ? { label: "主要扣分", body: krReview.deductions.join("；") } : undefined,
      krReview.suggestions.length ? { label: "改进建议", body: krReview.suggestions.join("；") } : undefined,
    ].filter(Boolean) as KrScoreSection[];
  }
  if (krReview.source === "local" || !krReview.source) {
    return [
      { label: "审核结论", body: "审核官未生成正式逐条审核结果，当前不展示本地估算。" },
      krReview.suggestions.length ? { label: "建议", body: krReview.suggestions.join("；") } : undefined,
    ].filter(Boolean) as KrScoreSection[];
  }
  return [
    krReview.summary ? { label: "审核结论", body: krReview.summary } : undefined,
    krReview.strengths.length ? { label: "较好部分", body: krReview.strengths.join("；") } : undefined,
    krReview.deductions.length ? { label: "主要扣分", body: krReview.deductions.join("；") } : undefined,
    krReview.suggestions.length ? { label: "改进建议", body: krReview.suggestions.join("；") } : undefined,
    krReview.dimensionComments?.length ? {
      label: "维度判断",
      body: krReview.dimensionComments
        .slice(0, 3)
        .map((item) => `${item.name}${typeof item.score === "number" ? ` ${item.score}/100` : ""}：${item.comment}`)
        .join("；"),
    } : undefined,
  ].filter(Boolean) as KrScoreSection[];
}

function objectiveScoreLabel(result: ReviewObjectiveResult | undefined, passThreshold: number): { label: string; className: string } {
  if (!result) {
    return { label: "Objective 审核未生成", className: "bg-slate-100 text-slate-500" };
  }
  const base = `O${result.objectiveIndex + 1} ${result.passedKrCount}/${result.totalKrCount} KR 达标`;
  if (result.passed) {
    return { label: `${base} · 通过`, className: "bg-emerald-50 text-emerald-600" };
  }
  if (result.score >= Math.max(0, passThreshold - 20)) {
    return { label: `${base} · 未通过`, className: "bg-amber-50 text-amber-600" };
  }
  return { label: `${base} · 未通过`, className: "bg-red-50 text-red-600" };
}

function DraftComparisonCard({
  drafts,
  parentCase,
  passThreshold,
  candidateKrIds,
  onToggleCandidateKr,
}: {
  drafts: OkrDraftSet;
  parentCase?: OkrCase;
  passThreshold: number;
  candidateKrIds: string[];
  onToggleCandidateKr: (draft: OkrDraftVersion, objective: Objective, keyResult: KeyResult, score?: number) => void;
}) {
  const versions = variantDrafts(drafts);
  const objectiveCount = Math.max(...versions.map((version) => version.objectives.length), 0);
  const [collapsedObjectives, setCollapsedObjectives] = useState<Set<number>>(new Set());

  const toggleObjective = (objectiveIndex: number) => {
    setCollapsedObjectives((prev) => {
      const next = new Set(prev);
      if (next.has(objectiveIndex)) next.delete(objectiveIndex);
      else next.add(objectiveIndex);
      return next;
    });
  };

  return (
    <div className="space-y-5">
      {Array.from({ length: objectiveCount }).map((_, objectiveIndex) => {
        const objective = pickObjective(versions, objectiveIndex);
        if (!objective) return null;
        const objectiveReview = parentCase?.reviewReport?.objectiveResults?.find((item) => item.objectiveIndex === objectiveIndex);
        const objectiveScore = objectiveScoreLabel(objectiveReview, passThreshold);
        const krItems = combinedKrsForObjective(versions, objectiveIndex);
        const collapsed = collapsedObjectives.has(objectiveIndex);
        return (
          <Card key={`${objective.id}-${objectiveIndex}`} className="overflow-visible border-blue-100 bg-white shadow-sm">
            <CardHeader className="sticky top-0 z-20 rounded-t-lg border-b border-blue-200 bg-blue-50 px-4 py-3 before:absolute before:-top-6 before:left-0 before:right-0 before:h-6 before:bg-blue-50 before:content-['']">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 shrink-0 p-0 text-blue-600 hover:bg-blue-100"
                      onClick={() => toggleObjective(objectiveIndex)}
                      aria-label={collapsed ? "展开 Objective 下的 KR" : "收起 Objective 下的 KR"}
                    >
                      {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                    <Badge variant="secondary" className="shrink-0 border-0 bg-blue-100 text-[10px] font-semibold text-blue-700">
                      O{objectiveIndex + 1}
                    </Badge>
                    <CardTitle className="text-base leading-relaxed text-blue-950">
                      {objective.title}
                    </CardTitle>
                  </div>
                  {objective.description && (
                    <CardDescription className="pl-9 text-blue-800/70">
                      {objective.description}
                    </CardDescription>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 pl-9 sm:pl-0">
                  <Badge variant="secondary" className={`w-fit text-xs ${objectiveScore.className}`}>
                    {objectiveScore.label}
                  </Badge>
                  <Badge variant="outline" className="w-fit border-blue-200 bg-white/70 text-xs text-blue-700">
                    {krItems.length} 条 KR
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              {collapsed ? (
                <button
                  type="button"
                  onClick={() => toggleObjective(objectiveIndex)}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  点击展开 KR 详情
                </button>
              ) : krItems.map((item, krIndex) => {
                const { draft, objective: variantObjective, kr } = item;
                const krReview = parentCase?.reviewReport?.krReviews?.find((review) => review.krId === kr.id);
                const officialReview = isOfficialReview(krReview);
                const displayScore = officialReview ? krReview!.score : undefined;
                const displaySections = krReviewSections(krReview);
                const scoreLabel = officialReview
                  ? `质量 ${displayScore}`
                  : krReview?.source === "pending"
                    ? "逐条审核缺失"
                    : "审核未生成";
                const scoreClass = displayScore !== undefined
                  ? displayScore! >= passThreshold
                    ? "bg-emerald-50 text-emerald-600"
                    : displayScore! >= Math.max(0, passThreshold - 20)
                      ? "bg-amber-50 text-amber-600"
                      : "bg-red-50 text-red-600"
                  : "bg-slate-100 text-slate-500";
                const candidate = candidateKrIds.includes(kr.id);
                return (
                  <div key={kr.id} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_190px]">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">KR {krIndex + 1}</p>
                          <Badge variant="secondary" className={`${DraftVariantColor[draft.variant]} border-0 text-xs`}>
                            {DraftVariantLabel[draft.variant]}
                          </Badge>
                        </div>
                        <h5 className="text-sm font-medium leading-relaxed text-slate-800">{formatKrStatement(kr)}</h5>
                        <KrMetadata kr={kr} />
                        {(kr.owner || kr.deadline) && (
                          <div className="flex flex-wrap gap-3">
                            {kr.owner && <div className="flex items-center gap-1"><User className="w-3 h-3 text-slate-400" /><p className="text-xs text-slate-700">{kr.owner}</p></div>}
                            {kr.deadline && <div className="flex items-center gap-1"><Calendar className="w-3 h-3 text-slate-400" /><p className="text-xs text-slate-700">{kr.deadline}</p></div>}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-row items-start justify-between gap-2 lg:flex-col lg:items-end">
                        <Button
                          variant="outline"
                          size="sm"
                          className={`h-7 gap-1 px-2 text-xs ${candidate ? "border-blue-200 bg-blue-50 text-blue-600" : "text-slate-500"}`}
                          onClick={() => onToggleCandidateKr(draft, variantObjective, kr, displayScore)}
                        >
                          <Star className={`h-3.5 w-3.5 ${candidate ? "fill-blue-500 text-blue-500" : ""}`} />
                          {candidate ? "候选 KR" : "列为候选"}
                        </Button>
                        <Badge variant="secondary" className={`text-xs ${scoreClass}`}>
                          {scoreLabel}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-3 space-y-1.5 rounded-md border border-slate-100 bg-white/80 p-3">
                      <div className="grid grid-cols-[72px_1fr] gap-2 text-xs leading-relaxed">
                        <span className="font-medium text-slate-500">拆解理由</span>
                        <span className="text-slate-600">{krReason(draft, kr)}</span>
                      </div>
                      {displaySections.map((section) => (
                        <div key={section.label} className="grid grid-cols-[72px_1fr] gap-2 text-xs leading-relaxed">
                          <span className="font-medium text-slate-500">{section.label}</span>
                          <span className="text-slate-600">{section.body}</span>
                        </div>
                      ))}
                    </div>
                    <ChildDecompositionPanel parentCase={parentCase} objective={variantObjective} keyResult={kr} />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function CandidateKrPool({
  parentCase,
  candidates,
  onToggleCandidate,
}: {
  parentCase?: OkrCase;
  candidates: CandidateKr[];
  onToggleCandidate: (candidate: CandidateKr) => void;
}) {
  if (candidates.length === 0) return null;

  return (
    <Card className="border-blue-200 bg-blue-50/40 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 text-blue-800">
          <Star className="h-4 w-4 fill-blue-500 text-blue-500" />
          候选 KR 池
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {candidates.map((candidate) => {
          const objective: Objective = {
            id: `${candidate.id}-objective`,
            title: candidate.objectiveTitle,
            description: candidate.objectiveDescription ?? "",
            keyResults: [candidate.kr],
          };
          return (
            <div key={candidate.id} className="rounded-lg border border-blue-100 bg-white p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className={`${DraftVariantColor[candidate.variant]} border-0 text-xs`}>
                      {DraftVariantLabel[candidate.variant]}
                    </Badge>
                    {typeof candidate.score === "number" && (
                      <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 border-0 text-xs">
                        质量 {candidate.score}
                      </Badge>
                    )}
                    <span className="text-xs text-slate-400">
                      {candidate.sourceLabel ?? candidate.objectiveTitle}
                    </span>
                  </div>
                  <h5 className="text-sm font-medium leading-relaxed text-slate-800">{formatKrStatement(candidate.kr)}</h5>
                  <KrMetadata kr={candidate.kr} />
                  <p className="text-xs text-slate-400">
                    候选于 {new Date(candidate.selectedAt).toLocaleString("zh-CN")}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs border-blue-200 bg-blue-50 text-blue-600"
                  onClick={() => onToggleCandidate(candidate)}
                >
                  <Star className="h-3.5 w-3.5 fill-blue-500 text-blue-500" />
                  取消候选
                </Button>
              </div>
              <div className="mt-3">
                <ChildDecompositionPanel parentCase={parentCase} objective={objective} keyResult={candidate.kr} />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function DraftsTab({ drafts, caseId }: { drafts: OkrDraftSet; caseId: string }) {
  const retryDecomposition = useAppStore((s) => s.retryDecomposition);
  const addLog = useAppStore((s) => s.addLog);
  const toggleCandidateKr = useAppStore((s) => s.toggleCandidateKr);
  const caseData = useAppStore((s) => s.cases.find((c) => c.id === caseId));
  const reviewConfig = useAppStore((s) => s.config.review);
  const flowTemplates = useAppStore((s) => s.config.flowTemplates);
  const [regenerating, setRegenerating] = useState(false);
  const [regenerationNote, setRegenerationNote] = useState("");

  const flowTemplate = flowTemplates.find((template) => template.id === caseData?.flowTemplateId) ?? flowTemplates.find((template) => template.isDefault);
  const passThreshold = flowTemplate?.loopSettings?.okrReviewLoop.passThreshold ?? reviewConfig.passThreshold;
  const demoDraft = isLikelyDemoDraft(drafts);
  const canEdit = caseData ? canCaseAcceptUserInput(caseData) : true;
  const candidates = caseData?.candidateKrs ?? [];
  const candidateKrIds = candidates.map((item) => item.kr.id);

  const handleToggleCandidateKr = (draft: OkrDraftVersion, objective: Objective, keyResult: KeyResult, score?: number) => {
    const exists = candidateKrIds.includes(keyResult.id);
    toggleCandidateKr(caseId, {
      id: `candidate-${keyResult.id}`,
      kr: keyResult,
      objectiveTitle: objective.title,
      objectiveDescription: objective.description,
      variant: draft.variant,
      score,
      sourceRunId: caseData?.activeRunId,
      sourceLabel: `${objective.title} / ${DraftVariantLabel[draft.variant]}`,
      selectedAt: new Date().toISOString(),
    });
    toast.success(exists ? "已取消候选 KR" : "已列为候选 KR");
  };

  const handleRegenerate = () => {
    if (!canEdit) {
      toast.info("当前流程正在拆解或审核中，请等待本轮结束");
      return;
    }
    setRegenerating(true);
    addLog(
      caseId,
      "重新生成",
      "用户",
      regenerationNote.trim()
        ? `重新生成三种强度方案，补充说明：${regenerationNote.trim().slice(0, 80)}`
        : "重新生成三种强度方案"
    );
    retryDecomposition(caseId, regenerationNote);
    setRegenerationNote("");
    toast.success("正在基于补充说明重新生成 OKR 草稿...");
    setTimeout(() => setRegenerating(false), 4000);
  };

  return (
    <div className="space-y-4">
      {demoDraft && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-medium text-amber-800">当前为演示草稿，不是正式 OKR 拆解结果</p>
            <p className="mt-0.5 text-xs text-amber-700">正式流程中如果模型返回占位内容，系统会直接标记为“拆解失败”，不会进入审核。</p>
          </div>
        </div>
      )}
      <div className="flex justify-end">
        <div className="flex items-center gap-2">
          {regenerating && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-blue-200 text-blue-600 hover:bg-blue-50"
            onClick={handleRegenerate}
            disabled={!canEdit || regenerating}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            重新生成
          </Button>
        </div>
      </div>
      <Card className="border-slate-200 bg-slate-50/40 shadow-none">
        <CardContent className="p-4 space-y-2">
          <p className="text-xs font-medium text-slate-600">重新生成补充说明</p>
          <Textarea
            value={regenerationNote}
            onChange={(e) => setRegenerationNote(e.target.value)}
            disabled={!canEdit}
            placeholder="重新生成前可补充调整方向，例如：保留第一个目标，但 KR 更聚焦收入；下调目标值；以产品团队作为 owner..."
            rows={3}
            className="resize-none bg-white border-slate-200 text-sm"
          />
        </CardContent>
      </Card>
      <CandidateKrPool
        parentCase={caseData}
        candidates={candidates}
        onToggleCandidate={(candidate) => {
          toggleCandidateKr(caseId, candidate);
          toast.success("已取消候选 KR");
        }}
      />
      <DraftComparisonCard
        drafts={drafts}
        parentCase={caseData}
        passThreshold={passThreshold}
        candidateKrIds={candidateKrIds}
        onToggleCandidateKr={handleToggleCandidateKr}
      />
    </div>
  );
}
