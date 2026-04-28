"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { OkrCase } from "@/types";
import { useAppStore } from "@/lib/store";
import { Pencil, RotateCcw, Loader2 } from "lucide-react";

export function InputsTab({ caseData }: { caseData: OkrCase }) {
  const updateCase = useAppStore((s) => s.updateCase);
  const addLog = useAppStore((s) => s.addLog);
  const startAnalysis = useAppStore((s) => s.startAnalysis);

  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(caseData.intake?.rawText ?? "");
  const [supplement, setSupplement] = useState("");
  const [analyzing, setAnalyzing] = useState(false);

  const handleSaveEdit = () => {
    if (!editText.trim()) { toast.error("输入内容不能为空"); return; }
    updateCase(caseData.id, {
      intake: { rawText: editText, submittedAt: new Date().toISOString(), submittedBy: "用户" },
    });
    addLog(caseData.id, "编辑输入", "用户", "修改了原始业务描述");
    setEditing(false);
    toast.success("输入内容已更新");
  };

  const handleSubmitSupplement = () => {
    if (!supplement.trim()) { toast.error("补充内容不能为空"); return; }
    const newText = (caseData.intake?.rawText ?? "") + "\n\n【补充说明】" + supplement;
    updateCase(caseData.id, {
      intake: { rawText: newText, submittedAt: new Date().toISOString(), submittedBy: "用户" },
    });
    addLog(caseData.id, "提交补充", "用户", supplement.slice(0, 50));
    setSupplement("");
    toast.success("补充信息已提交");
  };

  const handleReanalyze = () => {
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
                onClick={() => { setEditing(!editing); setEditText(caseData.intake?.rawText ?? ""); }}>
                <Pencil className="w-3.5 h-3.5" />{editing ? "取消" : "编辑"}
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50"
                disabled={analyzing} onClick={handleReanalyze}>
                {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                重新分析
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="space-y-3">
              <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={8}
                className="border-slate-200 resize-none text-sm leading-relaxed" />
              <div className="flex justify-end">
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={handleSaveEdit}>保存修改</Button>
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

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">补充说明</CardTitle>
          <CardDescription>添加初次输入时遗漏的补充信息</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea value={supplement} onChange={(e) => setSupplement(e.target.value)}
            placeholder="在这里补充额外的业务背景、数据或约束条件..." rows={4}
            className="border-slate-200 resize-none text-sm" />
          <div className="flex justify-end">
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={handleSubmitSupplement}
              disabled={!supplement.trim()}>
              提交补充
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
