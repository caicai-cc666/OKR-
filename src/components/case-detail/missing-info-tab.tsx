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
  const [supplements, setSupplements] = useState<Record<string, string>>({});

  const blocking = missingInfo.missingFields.filter((f) => f.priority === "high");
  const nonBlocking = missingInfo.missingFields.filter((f) => f.priority !== "high");

  const handleSupplement = (field: string) => {
    const value = supplements[field];
    if (!value?.trim()) { toast.error(`请填写「${field}」`); return; }
    supplementInfo(caseId, field, value);
    toast.success(`「${field}」已补充`);
  };

  const handleStartDecomposition = () => {
    setLoading(true);
    startDecomposition(caseId);
    toast.success("拆解流程已启动，请稍候...");
    setTimeout(() => setLoading(false), 4000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <OctagonAlert className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-800">信息不足，无法开始拆解</p>
          <p className="text-xs text-amber-600 mt-0.5">请补充以下缺失信息后，点击「开始拆解」</p>
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
              <div key={i} className="bg-white rounded-lg border border-red-100 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-slate-800">{field.field}</h4>
                  <Badge className="text-[10px] bg-red-100 text-red-600 border-0">阻塞</Badge>
                </div>
                <p className="text-sm text-slate-600">{field.reason}</p>
                {field.suggestion && <p className="text-xs text-blue-600">建议追问：{field.suggestion}</p>}
                <Textarea
                  value={supplements[field.field] ?? ""}
                  onChange={(e) => setSupplements({ ...supplements, [field.field]: e.target.value })}
                  placeholder={`请补充：${field.field}...`}
                  rows={2} className="border-slate-200 resize-none text-sm mt-1"
                />
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => handleSupplement(field.field)}>
                    提交此项
                  </Button>
                </div>
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
              <div key={i} className="bg-white rounded-lg border border-slate-200 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-slate-800">{field.field}</h4>
                  <Badge variant="secondary" className={`text-[10px] ${field.priority === "medium" ? "bg-amber-50 text-amber-600" : "bg-slate-50 text-slate-500"}`}>
                    {field.priority === "medium" ? "建议补充" : "可选"}
                  </Badge>
                </div>
                <p className="text-sm text-slate-600">{field.reason}</p>
                <Textarea
                  value={supplements[field.field] ?? ""}
                  onChange={(e) => setSupplements({ ...supplements, [field.field]: e.target.value })}
                  placeholder={`请补充：${field.field}...`}
                  rows={2} className="border-slate-200 resize-none text-sm mt-1"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Separator />

      <div className="flex justify-end">
        <Button className="bg-blue-600 hover:bg-blue-700 gap-2 px-6" onClick={handleStartDecomposition} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          开始拆解
        </Button>
      </div>
    </div>
  );
}
