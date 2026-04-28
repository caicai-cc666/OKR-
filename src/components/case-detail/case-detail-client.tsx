"use client";

import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppStore } from "@/lib/store";
import { getDisplayStatus, CaseStatus } from "@/types";
import { StatusBadge } from "@/components/shared";
import {
  OverviewTab,
  InputsTab,
  FactPackTab,
  MissingInfoTab,
  DraftsTab,
  ReviewTab,
  FinalTab,
  LogsTab,
  FlowGraphTab,
} from "@/components/case-detail";
import {
  FileText, ListChecks, AlertCircle, Target,
  ClipboardCheck, CheckCircle2, Users, CalendarRange,
} from "lucide-react";

export function CaseDetailClient({ id, tab }: { id: string; tab?: string }) {
  const caseData = useAppStore((s) => s.getCase(id));

  if (!caseData) {
    notFound();
  }

  const ds = getDisplayStatus(caseData.status);

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
          <StatusBadge status={ds} />
        </div>
        <div className="flex items-center gap-4 mt-1.5 text-sm text-slate-500">
          <span>{caseData.createdBy}</span>
          <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{caseData.team}</span>
          <span className="flex items-center gap-1"><CalendarRange className="w-3.5 h-3.5" />{caseData.cycle}</span>
          <span>创建于 {new Date(caseData.createdAt).toLocaleDateString("zh-CN")}</span>
        </div>
      </div>

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

      {/* 9 Tabs */}
      <Tabs defaultValue={tab || "overview"} className="space-y-4">
        <TabsList className="bg-slate-100 flex-wrap h-auto gap-0.5 p-1">
          <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
          <TabsTrigger value="inputs" className="text-xs">Inputs</TabsTrigger>
          {caseData.factPack && <TabsTrigger value="factpack" className="text-xs">Fact Pack</TabsTrigger>}
          {caseData.missingInfo && (
            <TabsTrigger value="missing" className="text-xs">
              Missing Info
              {caseData.missingInfo.missingFields.filter(f => f.priority === "high").length > 0 && (
                <span className="ml-1 w-2 h-2 rounded-full bg-red-500 inline-block" />
              )}
            </TabsTrigger>
          )}
          {caseData.okrDrafts && <TabsTrigger value="drafts" className="text-xs">Drafts</TabsTrigger>}
          {caseData.reviewReport && <TabsTrigger value="review" className="text-xs">Review</TabsTrigger>}
          <TabsTrigger value="final" className="text-xs">Final</TabsTrigger>
          <TabsTrigger value="logs" className="text-xs">Logs</TabsTrigger>
          <TabsTrigger value="flow" className="text-xs">Flow Graph</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><OverviewTab caseData={caseData} /></TabsContent>
        <TabsContent value="inputs"><InputsTab caseData={caseData} /></TabsContent>
        {caseData.factPack && <TabsContent value="factpack"><FactPackTab factPack={caseData.factPack} /></TabsContent>}
        {caseData.missingInfo && <TabsContent value="missing"><MissingInfoTab missingInfo={caseData.missingInfo} caseId={id} /></TabsContent>}
        {caseData.okrDrafts && <TabsContent value="drafts"><DraftsTab drafts={caseData.okrDrafts} caseId={id} /></TabsContent>}
        {caseData.reviewReport && <TabsContent value="review"><ReviewTab report={caseData.reviewReport} caseId={id} /></TabsContent>}
        <TabsContent value="final"><FinalTab caseData={caseData} /></TabsContent>
        <TabsContent value="logs"><LogsTab logs={caseData.logs} /></TabsContent>
        <TabsContent value="flow"><FlowGraphTab caseData={caseData} /></TabsContent>
      </Tabs>
    </div>
  );
}
