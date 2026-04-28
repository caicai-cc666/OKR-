"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { OkrDraftSet, OkrDraftVersion, DraftVariant } from "@/types";
import { DraftVariantLabel, DraftVariantColor } from "@/types";
import { useAppStore } from "@/lib/store";
import {
  Target, User, Calendar, RotateCcw, Pencil, Star, Loader2, CheckCircle2,
} from "lucide-react";

function DraftVersionCard({
  draft,
  caseId,
  isCandidate,
  onSelectCandidate,
  onRegenerate,
}: {
  draft: OkrDraftVersion;
  caseId: string;
  isCandidate: boolean;
  onSelectCandidate: () => void;
  onRegenerate: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className={`${DraftVariantColor[draft.variant]} border-0 text-xs`}>
            {DraftVariantLabel[draft.variant]}
          </Badge>
          {isCandidate && (
            <Badge className="text-[10px] bg-blue-50 text-blue-600 border-0">
              <CheckCircle2 className="w-3 h-3 mr-0.5" />当前候选
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className={`gap-1.5 text-xs ${isCandidate ? "text-blue-600 border-blue-200" : "text-slate-600"}`}
            onClick={onSelectCandidate}>
            <Star className={`w-3.5 h-3.5 ${isCandidate ? "fill-blue-500" : ""}`} />
            {isCandidate ? "已选为候选" : "选为候选"}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50"
            onClick={onRegenerate}>
            <RotateCcw className="w-3.5 h-3.5" />重新生成
          </Button>
        </div>
      </div>

      {draft.objectives.map((obj) => (
        <Card key={obj.id} className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-500" />{obj.title}
            </CardTitle>
            <CardDescription>{obj.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {obj.keyResults.map((kr) => (
              <div key={kr.id} className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                <div className="flex items-start justify-between">
                  <h4 className="text-sm font-medium text-slate-800 flex-1">{kr.title}</h4>
                  <Badge variant="secondary" className={`text-xs shrink-0 ml-2 ${
                    kr.confidence >= 0.8 ? "bg-emerald-50 text-emerald-600" : kr.confidence >= 0.6 ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600"
                  }`}>
                    置信度 {Math.round(kr.confidence * 100)}%
                  </Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                  <div><p className="text-[11px] text-slate-400">指标</p><p className="text-xs text-slate-700 font-medium">{kr.metric}</p></div>
                  <div><p className="text-[11px] text-slate-400">基线</p><p className="text-xs text-slate-700 font-medium">{kr.currentValue}</p></div>
                  <div><p className="text-[11px] text-slate-400">目标</p><p className="text-xs text-slate-700 font-medium">{kr.targetValue}</p></div>
                  {kr.owner && <div className="flex items-center gap-1"><User className="w-3 h-3 text-slate-400" /><p className="text-xs text-slate-700">{kr.owner}</p></div>}
                  {kr.deadline && <div className="flex items-center gap-1"><Calendar className="w-3 h-3 text-slate-400" /><p className="text-xs text-slate-700">{kr.deadline}</p></div>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <Card className="border-indigo-200 bg-indigo-50/30 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-indigo-700 flex items-center gap-1.5">拆解思路 / 推导说明</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{draft.reasoning}</p>
          <p className="text-xs text-slate-400 mt-3">{draft.generatedBy} · {new Date(draft.generatedAt).toLocaleDateString("zh-CN")}</p>
        </CardContent>
      </Card>
    </div>
  );
}

export function DraftsTab({ drafts, caseId }: { drafts: OkrDraftSet; caseId: string }) {
  const updateCase = useAppStore((s) => s.updateCase);
  const retryDecomposition = useAppStore((s) => s.retryDecomposition);
  const addLog = useAppStore((s) => s.addLog);
  const caseData = useAppStore((s) => s.getCase(caseId));
  const [regenerating, setRegenerating] = useState(false);

  // Track candidate: store in finalOkr.version convention or just local for now
  const [candidate, setCandidate] = useState<DraftVariant>("balanced");

  const variants = [drafts.conservative, drafts.balanced, drafts.aggressive] as const;

  const handleSelectCandidate = (variant: DraftVariant) => {
    setCandidate(variant);
    const draftVersion = drafts[variant];
    updateCase(caseId, {
      finalOkr: {
        objectives: draftVersion.objectives,
        finalizedAt: new Date().toISOString(),
        finalizedBy: "用户",
        version: (caseData?.finalOkr?.version ?? 0) + 1,
      },
    });
    addLog(caseId, "选为候选", "用户", `选择了「${DraftVariantLabel[variant]}」方案作为候选`);
    toast.success(`已选择「${DraftVariantLabel[variant]}」为候选方案`);
  };

  const handleRegenerate = (variant: DraftVariant) => {
    setRegenerating(true);
    addLog(caseId, "重新生成", "用户", `重新生成「${DraftVariantLabel[variant]}」方案`);
    retryDecomposition(caseId);
    toast.success("正在重新生成三版方案...");
    setTimeout(() => setRegenerating(false), 4000);
  };

  return (
    <Tabs defaultValue="balanced" className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-500">选择方案：</span>
          <TabsList className="bg-slate-100">
            {variants.map((dv) => (
              <TabsTrigger key={dv.variant} value={dv.variant} className="gap-1.5">
                <Badge variant="secondary" className={`${DraftVariantColor[dv.variant]} border-0 text-[10px] px-1.5`}>
                  {DraftVariantLabel[dv.variant]}
                </Badge>
                {candidate === dv.variant && <Star className="w-3 h-3 text-blue-500 fill-blue-500" />}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {regenerating && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
      </div>
      {variants.map((dv) => (
        <TabsContent key={dv.variant} value={dv.variant}>
          <DraftVersionCard
            draft={dv}
            caseId={caseId}
            isCandidate={candidate === dv.variant}
            onSelectCandidate={() => handleSelectCandidate(dv.variant)}
            onRegenerate={() => handleRegenerate(dv.variant)}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}
