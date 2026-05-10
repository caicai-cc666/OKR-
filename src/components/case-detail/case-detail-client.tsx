"use client";

import { useState } from "react";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppStore } from "@/lib/store";
import { canReadCaseForAccount, CaseRunDisplayColor, CaseRunDisplayLabel, getCaseRunDisplayStatus, CaseStatus } from "@/types";
import {
  InputsTab,
  FactPackTab,
  DraftsTab,
  LogsTab,
  FlowGraphTab,
  ReportTab,
} from "@/components/case-detail";
import {
  FileText, ListChecks, AlertCircle, Target,
  ClipboardCheck, CheckCircle2, Users, CalendarRange, Clock,
} from "lucide-react";

function EmptyTabState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Clock className="w-8 h-8 text-slate-200 mb-3" />
      <p className="text-sm text-slate-400">{label}</p>
    </div>
  );
}

export function CaseDetailClient({ id, tab }: { id: string; tab?: string }) {
  const caseData = useAppStore((s) => s.cases.find((c) => c.id === id));
  const memberships = useAppStore((s) => s.memberships);
  const currentUserId = useAppStore((s) => s.currentUserId);
  const currentTenantId = useAppStore((s) => s.currentTenantId);
  const normalizedInitialTab = tab === "missing" || tab === "overview" ? "factpack" : tab === "review" || tab === "final" ? "drafts" : tab;
  const [activeTab, setActiveTab] = useState(normalizedInitialTab || "inputs");

  const currentRole =
    memberships.find((item) => item.userId === currentUserId && item.tenantId === currentTenantId && item.status === "active")?.role ??
    memberships.find((item) => item.userId === currentUserId && item.role === "platform_owner" && item.status === "active")?.role;

  if (!caseData || !canReadCaseForAccount(caseData, currentRole, currentTenantId, currentUserId)) {
    notFound();
  }

  const runDisplay = getCaseRunDisplayStatus(caseData);
  const decomposeRun = caseData.flowNodeRuns.find((run) => run.nodeId === "decompose");
  const decompositionFailed = decomposeRun?.status === "failed" && !caseData.okrDrafts;

  const steps = [
    { key: "intake", label: "信息收集", icon: FileText, done: !!caseData.intake, active: caseData.status === CaseStatus.NEW || caseData.status === CaseStatus.INTAKE_RECEIVED },
    { key: "structured", label: "信息结构化", icon: ListChecks, done: !!caseData.factPack, active: caseData.status === CaseStatus.INTERVIEW_STRUCTURED },
    { key: "missing", label: "信息检查", icon: AlertCircle, done: caseData.status !== CaseStatus.NEW && caseData.status !== CaseStatus.INTAKE_RECEIVED && caseData.status !== CaseStatus.INTERVIEW_STRUCTURED, active: caseData.status === CaseStatus.INFO_INSUFFICIENT, warn: caseData.status === CaseStatus.INFO_INSUFFICIENT },
    { key: "draft", label: "OKR 拆解", icon: Target, done: !!caseData.okrDrafts, active: caseData.status === CaseStatus.READY_FOR_DECOMPOSITION || caseData.status === CaseStatus.OKR_DRAFT_GENERATED },
    { key: "review", label: "质量审核", icon: ClipboardCheck, done: !!caseData.reviewReport, active: caseData.status === CaseStatus.UNDER_REVIEW || caseData.status === CaseStatus.REVIEW_FAILED || caseData.status === CaseStatus.HUMAN_REVIEW_REQUIRED, warn: caseData.status === CaseStatus.REVIEW_FAILED || caseData.status === CaseStatus.HUMAN_REVIEW_REQUIRED },
    { key: "final", label: "定稿", icon: CheckCircle2, done: caseData.status === CaseStatus.REVIEW_PASSED || caseData.status === CaseStatus.FINALIZED, active: false },
  ];

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">{caseData.title}</h1>
          <Badge variant="secondary" className={`${CaseRunDisplayColor[runDisplay]} border-0`}>
            {CaseRunDisplayLabel[runDisplay]}
          </Badge>
        </div>
        <div className="flex items-center gap-4 mt-1.5 text-sm text-slate-500">
          <span>{caseData.createdBy}</span>
          <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{caseData.team}</span>
          <span className="flex items-center gap-1"><CalendarRange className="w-3.5 h-3.5" />{caseData.cycle}</span>
          <span>创建于 {new Date(caseData.createdAt).toLocaleDateString("zh-CN")}</span>
        </div>
      </div>

      {decompositionFailed && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <div>
            <p className="text-sm font-medium text-red-800">OKR 拆解失败</p>
            <p className="mt-0.5 text-xs text-red-700">{decomposeRun?.error ?? "模型未生成可用草稿，请检查模型配置、补充业务背景或重新生成。"}</p>
          </div>
        </div>
      )}

      {/* Progress Steps */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="py-4 px-6">
          <div className="flex items-center justify-between">
            {steps.map((step, i) => (
              <div key={step.key} className="flex items-center">
                <div className="flex flex-col items-center gap-1.5">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                    step.done ? (step.warn ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600")
                      : step.active ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-400"
                  }`}>
                    <step.icon className="w-4 h-4" />
                  </div>
                  <span className={`text-xs ${step.done || step.active ? "text-slate-700 font-medium" : "text-slate-400"}`}>
                    {step.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`w-12 h-px mx-2 mt-[-18px] ${step.done ? "bg-emerald-300" : "bg-slate-200"}`} />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Controlled tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-slate-100 flex-wrap h-auto gap-0.5 p-1">
          <TabsTrigger value="inputs" className="text-xs">原始输入</TabsTrigger>
          <TabsTrigger value="factpack" className="text-xs">
            信息整理
            {caseData.missingInfo && caseData.missingInfo.missingFields.length > 0 && (
              <>
              {caseData.missingInfo.missingFields.filter(f => f.priority === "high").length > 0 && (
                <span className="ml-1 w-2 h-2 rounded-full bg-red-500 inline-block" />
              )}
              </>
            )}
          </TabsTrigger>
          <TabsTrigger value="drafts" className="text-xs">OKR 草稿</TabsTrigger>
          <TabsTrigger value="report" className="text-xs">过程报告</TabsTrigger>
          <TabsTrigger value="logs" className="text-xs">操作日志</TabsTrigger>
          <TabsTrigger value="flow" className="text-xs">流程图</TabsTrigger>
        </TabsList>

        <TabsContent value="inputs"><InputsTab caseData={caseData} /></TabsContent>
        <TabsContent value="factpack">
          {caseData.factPack ? (
            <FactPackTab factPack={caseData.factPack} missingInfo={caseData.missingInfo} caseId={id} />
          ) : (
            <EmptyTabState label="事实包尚未生成，请先完成信息收集与结构化" />
          )}
        </TabsContent>
        <TabsContent value="drafts">
          {caseData.okrDrafts ? (
            <DraftsTab drafts={caseData.okrDrafts} caseId={id} />
          ) : (
            <EmptyTabState label={decompositionFailed ? `OKR 拆解失败：${decomposeRun?.error ?? "模型未生成可用草稿"}` : "OKR 草稿尚未生成，请先完成拆解"} />
          )}
        </TabsContent>
        <TabsContent value="report"><ReportTab caseData={caseData} /></TabsContent>
        <TabsContent value="logs"><LogsTab logs={caseData.logs} /></TabsContent>
        <TabsContent value="flow"><FlowGraphTab caseData={caseData} /></TabsContent>
      </Tabs>
    </div>
  );
}
