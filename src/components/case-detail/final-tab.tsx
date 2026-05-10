"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { KeyResult, Objective, OkrCase } from "@/types";
import { useAppStore } from "@/lib/store";
import { Target, CheckCircle2, Copy, Download, GitBranch } from "lucide-react";

function objectivesToMarkdown(caseData: OkrCase): string {
  const objectives = caseData.finalOkr?.objectives ?? caseData.okrDrafts?.balanced.objectives ?? [];
  let md = `# ${caseData.title}\n\n`;
  md += `团队: ${caseData.team} | 周期: ${caseData.cycle}\n\n`;
  for (const obj of objectives) {
    md += `## O: ${obj.title}\n\n${obj.description}\n\n`;
    for (const kr of obj.keyResults) {
      md += `- **KR: ${kr.title}**`;
      if (kr.owner || kr.deadline) {
        md += `\n  - ${[kr.owner ? `Owner: ${kr.owner}` : "", kr.deadline ? `截止: ${kr.deadline}` : ""].filter(Boolean).join(" | ")}`;
      }
      md += "\n";
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

function ChildDecompositionPanel({
  caseData,
  objective,
  keyResult,
}: {
  caseData: OkrCase;
  objective: Objective;
  keyResult: KeyResult;
}) {
  const router = useRouter();
  const createCase = useAppStore((s) => s.createCase);
  const startAnalysis = useAppStore((s) => s.startAnalysis);
  const [open, setOpen] = useState(false);
  const [team, setTeam] = useState("");
  const [cycle, setCycle] = useState(caseData.cycle);
  const [background, setBackground] = useState("");

  const handleCreateChild = () => {
    if (!background.trim()) {
      toast.error("请补充下级业务背景");
      return;
    }

    const childTeam = team.trim() || `${caseData.team} 下级团队`;
    const childCycle = cycle.trim() || caseData.cycle;
    const rawText = [
      "这是从上级 OKR 下钻产生的下级拆解。",
      `上级案例：${caseData.title}`,
      `上级团队：${caseData.team}`,
      `上级 Objective：${objective.title}`,
      `承接 Key Result：${keyResult.title}`,
      keyResult.owner ? `上级 KR owner：${keyResult.owner}` : "",
      "",
      `下级承接团队：${childTeam}`,
      `下级周期：${childCycle}`,
      `下级业务背景：${background.trim()}`,
    ].filter(Boolean).join("\n");

    const id = createCase(`承接 KR：${keyResult.title}`, childTeam, childCycle, rawText);
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
              placeholder={`下级团队，默认：${caseData.team} 下级团队`}
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
            value={background}
            onChange={(e) => setBackground(e.target.value)}
            placeholder="补充下级业务背景：这个团队负责什么、现状数据、资源约束、希望如何承接上级 KR..."
            rows={4}
            className="resize-none bg-white border-blue-100 text-sm"
          />
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
                {(kr.owner || kr.deadline) && (
                  <div className="flex items-center gap-6 mt-2 text-xs text-slate-500">
                    {kr.owner && <span>Owner: {kr.owner}</span>}
                    {kr.deadline && <span>截止: {kr.deadline}</span>}
                  </div>
                )}
                <ChildDecompositionPanel caseData={caseData} objective={obj} keyResult={kr} />
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
