"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CaseRunEvent, OkrCase, OkrDraftSet } from "@/types";
import { CaseRunDisplayLabel, DraftVariantLabel, getCaseRunDisplayStatus } from "@/types";
import { Copy, Download, FileText } from "lucide-react";

function list(items?: string[]): string {
  if (!items || items.length === 0) return "- 暂无明确记录";
  return items.map((item) => `- ${item}`).join("\n");
}

function formatTime(value?: string): string {
  if (!value) return "时间未知";
  return new Date(value).toLocaleString("zh-CN");
}

function timelineBlock(time: string, actor: string, title: string, body: string): string {
  return `\n---\n\n### ${time} · ${actor} · ${title}\n\n${body.trim() || "暂无详细说明"}\n`;
}

function draftSetToMarkdown(drafts?: OkrDraftSet): string {
  if (!drafts) return "暂无 OKR 草稿";
  return (["conservative", "balanced", "aggressive"] as const)
    .map((variant) => {
      const draft = drafts[variant];
      const objectives = draft.objectives
        .map((objective, objIndex) => {
          const krs = objective.keyResults
            .map((kr, krIndex) => {
              const meta = [
                kr.metric ? `指标：${kr.metric}` : "",
                kr.currentValue ? `基线：${kr.currentValue}` : "",
                kr.targetValue ? `目标：${kr.targetValue}` : "",
                kr.owner ? `Owner：${kr.owner}` : "",
                kr.deadline ? `截止：${kr.deadline}` : "",
              ].filter(Boolean);
              return `   ${krIndex + 1}. KR：${kr.title}${meta.length ? `\n      - ${meta.join(" | ")}` : ""}`;
            })
            .join("\n");
          return `${objIndex + 1}. O：${objective.title}\n   ${objective.description}\n${krs}`;
        })
        .join("\n\n");

      return `### ${DraftVariantLabel[variant]}\n\n${objectives || "暂无 Objective"}\n\n拆解理由：${draft.reasoning || "暂无"}`;
    })
    .join("\n\n");
}

function initialRawText(rawText?: string): string {
  if (!rawText) return "暂无输入";
  return rawText.split(/\n\n【补充】|\n\n【重新拆解补充】/)[0] || rawText;
}

function runEventBody(event: CaseRunEvent): string {
  return [
    event.iteration ? `轮次：第 ${event.iteration} 轮` : "",
    `摘要：${event.summary}`,
    event.detail ? `\n${event.detail}` : "",
  ].filter(Boolean).join("\n\n");
}

function buildRunEventFlow(events?: CaseRunEvent[]): string {
  if (!events?.length) {
    return "暂无角色产出流。后续新运行会按用户、信息整理官、OKR 拆解专家、审核官、协调器的顺序沉淀到这里。";
  }

  const ordered = [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const groups = new Map<string, CaseRunEvent[]>();
  ordered.forEach((event) => {
    groups.set(event.runId, [...(groups.get(event.runId) ?? []), event]);
  });

  return [...groups.entries()]
    .map(([, runEvents], runIndex) => {
      const startedAt = runEvents[0]?.timestamp;
      const blocks = runEvents
        .map((event) => timelineBlock(formatTime(event.timestamp), event.actor, event.title, runEventBody(event)))
        .join("");
      return `## 第 ${runIndex + 1} 次运行（${formatTime(startedAt)}）\n${blocks}`;
    })
    .join("\n");
}

function factPackMarkdown(caseData: OkrCase): string {
  const factPack = caseData.factPack;
  if (!factPack) return "暂无 Fact Pack";

  const dimensions = factPack.structuredDimensions;
  if (dimensions) {
    return [
      `**业务背景**\n${factPack.businessContext || "暂无"}`,
      `**战略背景**\n${list(dimensions.strategicBackground)}`,
      `**业务现状**\n${list(dimensions.businessStatus)}`,
      `**业务链路**\n${list(dimensions.businessChain)}`,
      `**问题瓶颈**\n${list(dimensions.bottlenecks)}`,
      `**资源与约束**\n${list(dimensions.resourcesConstraints)}`,
      `**组织分工**\n${list(dimensions.organization)}`,
      `**客户市场**\n${list(dimensions.customerMarket)}`,
      `**时间与成功标准**\n${list(dimensions.timeSuccessCriteria)}`,
      `**其他补充**\n${list(dimensions.other)}`,
    ].join("\n\n");
  }

  return [
    `**业务背景**\n${factPack.businessContext || "暂无"}`,
    `**战略目标**\n${list(factPack.strategicGoals)}`,
    `**当前挑战**\n${list(factPack.currentChallenges)}`,
    `**当前基线**\n${list(factPack.baselines)}`,
    `**候选指标**\n${list(factPack.candidateMetrics)}`,
    `**约束条件**\n${list(factPack.constraints)}`,
    `**干系人 / Owner 候选**\n${list(factPack.stakeholders)}`,
  ].join("\n\n");
}

function missingInfoMarkdown(caseData: OkrCase): string {
  const fields = caseData.missingInfo?.missingFields ?? [];
  if (!fields.length) return "当前没有阻塞拆解的关键信息缺口。";
  return fields
    .map((field) => `- ${field.field}（${field.priority}）：${field.reason}${field.suggestion ? `\n  - 建议：${field.suggestion}` : ""}`)
    .join("\n");
}

function reviewMarkdown(caseData: OkrCase): string {
  const review = caseData.reviewReport;
  if (!review) return "暂无审核结果";

  return [
    `审核结论：${review.passed ? "通过" : review.needsHumanReview ? "需要人工确认" : "未通过"}，质量分 ${review.overallScore}/100`,
    review.objectiveResults?.length
      ? `\n**Objective 审核结果**\n${review.objectiveResults.map((item) => `- O${item.objectiveIndex + 1} ${item.passed ? "通过" : "未通过"}：${item.passedKrCount}/${item.totalKrCount} 条 KR 达到阈值，均分 ${item.score}/100`).join("\n")}`
      : "",
    `\n**主要问题**\n${list(review.fatalIssues)}`,
    `\n**改进建议**\n${list(review.suggestions)}`,
  ].filter(Boolean).join("\n\n");
}

export function buildCaseReportMarkdown(caseData: OkrCase): string {
  const runDisplay = getCaseRunDisplayStatus(caseData);

  let md = `# ${caseData.title} - OKR 拆解过程报告\n\n`;
  md += `- 团队：${caseData.team}\n`;
  md += `- 周期：${caseData.cycle}\n`;
  md += `- 当前状态：${CaseRunDisplayLabel[runDisplay]}\n`;
  md += `- 更新时间：${formatTime(caseData.updatedAt)}\n\n`;

  md += "## 用户初始输入\n\n";
  md += `${initialRawText(caseData.intake?.rawText)}\n\n`;

  md += "## 角色产出流\n\n";
  md += `${buildRunEventFlow(caseData.runEvents)}\n\n`;

  md += "## 当前最新结果\n\n";
  md += "### Fact Pack\n\n";
  md += `${factPackMarkdown(caseData)}\n\n`;
  md += "### 信息缺口\n\n";
  md += `${missingInfoMarkdown(caseData)}\n\n`;
  md += "### OKR Drafts\n\n";
  md += `${draftSetToMarkdown(caseData.okrDrafts)}\n\n`;
  md += "### 质量审核\n\n";
  md += `${reviewMarkdown(caseData)}\n`;

  return md;
}

function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportTab({ caseData }: { caseData: OkrCase }) {
  const markdown = buildCaseReportMarkdown(caseData);

  const handleCopy = () => {
    navigator.clipboard.writeText(markdown);
    toast.success("过程报告 Markdown 已复制");
  };

  const handleDownload = () => {
    downloadFile(markdown, `${caseData.title}-okr-report.md`);
    toast.success("过程报告已下载");
  };

  return (
    <div className="space-y-4">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-500" />
              过程报告
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1.5 text-slate-600" onClick={handleCopy}>
                <Copy className="w-3.5 h-3.5" />
                复制 Markdown
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-slate-600" onClick={handleDownload}>
                <Download className="w-3.5 h-3.5" />
                下载报告
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <pre className="max-h-[640px] overflow-auto whitespace-pre-wrap rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
            {markdown}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
