"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import type { MissingInfoPack } from "@/types";
import { useAppStore } from "@/lib/store";
import { AlertCircle, Sparkles, OctagonAlert, Info, Loader2 } from "lucide-react";

export function MissingInfoTab({
  missingInfo,
  caseId,
}: {
  missingInfo: MissingInfoPack;
  caseId: string;
}) {
  const startDecomposition = useAppStore((s) => s.startDecomposition);
  const supplementInfo = useAppStore((s) => s.supplementInfo);
  const [loading, setLoading] = useState(false);
  const [supplement, setSupplement] = useState("");

  const blocking = missingInfo.missingFields.filter((f) => f.priority === "high");
  const nonBlocking = missingInfo.missingFields.filter((f) => f.priority !== "high");

  const handleSubmitAndStart = () => {
    if (!supplement.trim()) {
      toast.error("请在补充说明里一次性补全相关信息");
      return;
    }
    setLoading(true);
    supplementInfo(caseId, "综合补充信息", supplement.trim());
    setSupplement("");
    startDecomposition(caseId);
    toast.success("补充信息已写入，正在重新结构化并尝试拆解...");
    setTimeout(() => setLoading(false), 4000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <OctagonAlert className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-800">信息不足，暂时无法开始拆解</p>
          <p className="text-xs text-amber-600 mt-0.5">下面会一次性提示缺口，你只需要在一个输入框里补充完整说明。</p>
        </div>
      </div>

      {blocking.length > 0 && (
        <Card className="border-red-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-red-700">
              <AlertCircle className="w-4 h-4" />阻塞缺口（{blocking.length} 项）
            </CardTitle>
            <CardDescription className="text-xs text-red-500">这些信息必须补充，否则无法拆解</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {blocking.map((field, i) => (
              <div key={i} className="bg-white rounded-lg border border-red-100 p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-slate-800">{field.field}</h4>
                  <Badge className="text-[10px] bg-red-100 text-red-600 border-0">阻塞</Badge>
                </div>
                <p className="text-sm text-slate-600">{field.reason}</p>
                {field.suggestion && <p className="text-xs text-blue-600">建议追问：{field.suggestion}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {nonBlocking.length > 0 && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-slate-600">
              <Info className="w-4 h-4 text-slate-400" />非阻塞缺口（{nonBlocking.length} 项）
            </CardTitle>
            <CardDescription className="text-xs">这些信息有助于提高拆解质量，但不是必须的</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {nonBlocking.map((field, i) => (
              <div key={i} className="bg-white rounded-lg border border-slate-200 p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-slate-800">{field.field}</h4>
                  <Badge variant="secondary" className={`text-[10px] ${field.priority === "medium" ? "bg-amber-50 text-amber-600" : "bg-slate-50 text-slate-500"}`}>
                    {field.priority === "medium" ? "建议补充" : "可选"}
                  </Badge>
                </div>
                <p className="text-sm text-slate-600">{field.reason}</p>
                {field.suggestion && <p className="text-xs text-blue-600">建议补充：{field.suggestion}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Separator />

      <Card className="border-blue-100 bg-blue-50/30 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-blue-700">一次性补充说明</CardTitle>
          <CardDescription className="text-xs">
            直接用自然语言把上面提到的信息一次性说清楚，系统会重新从这段话里提取结构化信息。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={supplement}
            onChange={(e) => setSupplement(e.target.value)}
            placeholder="例如：本次周期是 Q3，预算 80 万，由增长团队承接。当前 DAU 50 万、7 日留存 22%、获客成本 18 元，希望把 DAU 提到 80 万并把留存提升到 28%..."
            rows={6}
            className="resize-none border-blue-100 bg-white text-sm leading-relaxed"
          />
          <div className="flex justify-end">
            <Button className="bg-blue-600 hover:bg-blue-700 gap-2 px-6" onClick={handleSubmitAndStart} disabled={loading || !supplement.trim()}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              提交补充并继续拆解
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
