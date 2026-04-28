"use client";

import { toast } from "sonner";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { OkrCase } from "@/types";
import { Target, CheckCircle2, Copy, Download } from "lucide-react";

function objectivesToMarkdown(caseData: OkrCase): string {
  const objectives = caseData.finalOkr?.objectives ?? caseData.okrDrafts?.balanced.objectives ?? [];
  let md = `# ${caseData.title}\n\n`;
  md += `团队: ${caseData.team} | 周期: ${caseData.cycle}\n\n`;
  for (const obj of objectives) {
    md += `## O: ${obj.title}\n\n${obj.description}\n\n`;
    for (const kr of obj.keyResults) {
      md += `- **KR: ${kr.title}**\n  - 指标: ${kr.metric} | 基线: ${kr.currentValue} | 目标: ${kr.targetValue}\n`;
    }
    md += "\n";
  }
  if (caseData.reviewReport) {
    md += `---\n\n审核评分: ${caseData.reviewReport.overallScore}/100 (${caseData.reviewReport.passed ? "通过" : "未通过"})\n`;
  }
  return md;
}

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function FinalTab({ caseData }: { caseData: OkrCase }) {
  const finalOkr = caseData.finalOkr;
  const objectives = finalOkr?.objectives ?? caseData.okrDrafts?.balanced.objectives ?? [];
  const isFinal = !!finalOkr;

  const handleCopyMarkdown = () => {
    const md = objectivesToMarkdown(caseData);
    navigator.clipboard.writeText(md);
    toast.success("Markdown 已复制到剪贴板");
  };

  const handleExportJson = () => {
    const data = { title: caseData.title, team: caseData.team, cycle: caseData.cycle, finalOkr, reviewScore: caseData.reviewReport?.overallScore };
    downloadFile(JSON.stringify(data, null, 2), `${caseData.title}-okr.json`, "application/json");
    toast.success("JSON 已下载");
  };

  const handleExportMarkdown = () => {
    const md = objectivesToMarkdown(caseData);
    downloadFile(md, `${caseData.title}-okr.md`, "text/markdown");
    toast.success("Markdown 已下载");
  };

  return (
    <div className="space-y-4">
      {!isFinal && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-sm text-amber-700">尚未定稿。以下展示的是平衡型草稿作为候选。</p>
        </div>
      )}

      {objectives.map((obj) => (
        <Card key={obj.id} className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-500" />{obj.title}
            </CardTitle>
            <p className="text-sm text-slate-500">{obj.description}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {obj.keyResults.map((kr) => (
              <div key={kr.id} className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                <p className="text-sm font-medium text-slate-800">{kr.title}</p>
                <div className="flex items-center gap-6 mt-2 text-xs text-slate-500">
                  <span>指标: {kr.metric}</span>
                  <span>基线: {kr.currentValue}</span>
                  <span>目标: {kr.targetValue}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {caseData.reviewReport && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5 text-slate-600">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />审核结论
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 text-sm">
              <Badge variant="secondary" className={caseData.reviewReport.passed ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}>
                {caseData.reviewReport.passed ? "通过" : "未通过"}
              </Badge>
              <span className="text-slate-500">评分 {caseData.reviewReport.overallScore}/100</span>
              {finalOkr && (
                <>
                  <span className="text-slate-300">|</span>
                  <span className="text-slate-500">版本 v{finalOkr.version}</span>
                  <span className="text-slate-300">|</span>
                  <span className="text-slate-500">{new Date(finalOkr.finalizedAt).toLocaleDateString("zh-CN")} 定稿</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="gap-1.5 text-slate-600" onClick={handleCopyMarkdown}>
          <Copy className="w-3.5 h-3.5" />复制 Markdown
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5 text-slate-600" onClick={handleExportJson}>
          <Download className="w-3.5 h-3.5" />导出 JSON
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5 text-slate-600" onClick={handleExportMarkdown}>
          <Download className="w-3.5 h-3.5" />导出 Markdown
        </Button>
      </div>
    </div>
  );
}
