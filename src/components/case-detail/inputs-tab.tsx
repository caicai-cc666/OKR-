"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { canCaseAcceptUserInput } from "@/types";
import type { OkrCase } from "@/types";
import { useAppStore } from "@/lib/store";
import { Pencil, RotateCcw, Loader2 } from "lucide-react";

export function InputsTab({ caseData }: { caseData: OkrCase }) {
  const updateCase = useAppStore((s) => s.updateCase);
  const addLog = useAppStore((s) => s.addLog);
  const startAnalysis = useAppStore((s) => s.startAnalysis);

  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(caseData.intake?.rawText ?? "");
  const [analyzing, setAnalyzing] = useState(false);
  const canEdit = canCaseAcceptUserInput(caseData);

  const handleSaveEdit = () => {
    if (!canEdit) { toast.info("当前流程正在拆解或审核中，暂时不能修改输入"); return; }
    if (!editText.trim()) { toast.error("输入内容不能为空"); return; }
    updateCase(caseData.id, {
      intake: { rawText: editText, submittedAt: new Date().toISOString(), submittedBy: "用户" },
    });
    addLog(caseData.id, "编辑输入", "用户", "修改了原始业务描述");
    setEditing(false);
    toast.success("输入内容已更新");
  };

  const handleReanalyze = () => {
    if (!canEdit) { toast.info("当前流程正在拆解或审核中，请等待本轮结束"); return; }
    setAnalyzing(true);
    addLog(caseData.id, "重新分析", "用户", "用户触发重新分析");
    startAnalysis(caseData.id);
    toast.success("重新分析已启动");
    setTimeout(() => setAnalyzing(false), 3000);
  };

  return (
    <div className="space-y-4">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">原始业务描述</CardTitle>
              <CardDescription>用户提交的自然语言业务背景</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1.5 text-slate-600"
                disabled={!canEdit}
                onClick={() => { setEditing(!editing); setEditText(caseData.intake?.rawText ?? ""); }}>
                <Pencil className="w-3.5 h-3.5" />{editing ? "取消" : "编辑"}
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50"
                disabled={analyzing || !canEdit} onClick={handleReanalyze}>
                {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                重新拆解
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="space-y-3">
              <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={8}
                disabled={!canEdit}
                className="border-slate-200 resize-none text-sm leading-relaxed" />
              <div className="flex justify-end">
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700" disabled={!canEdit} onClick={handleSaveEdit}>保存修改</Button>
              </div>
            </div>
          ) : caseData.intake ? (
            <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
              {caseData.intake.rawText}
            </div>
          ) : (
            <p className="text-sm text-slate-400">暂无输入</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
