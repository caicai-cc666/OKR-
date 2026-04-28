"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { ReviewConfig } from "@/types";
import { useAppStore } from "@/lib/store";
import { X } from "lucide-react";

export function ReviewRulesTab({ config }: { config: ReviewConfig }) {
  const updateReviewConfig = useAppStore((s) => s.updateReviewConfig);

  const [passThreshold, setPassThreshold] = useState(config.passThreshold);
  const [humanThreshold, setHumanThreshold] = useState(config.humanReviewThreshold);
  const [maxRetries, setMaxRetries] = useState(config.maxRetries);
  const [humanEnabled, setHumanEnabled] = useState(config.humanReviewEnabled);
  const [failAction, setFailAction] = useState(config.failAction);
  const [prerequisites, setPrerequisites] = useState([...config.prerequisites]);
  const [coreDims, setCoreDims] = useState([...config.coreDimensions]);
  const [auxDims, setAuxDims] = useState([...config.auxDimensions]);
  const [newPrereq, setNewPrereq] = useState("");
  const [newCoreDim, setNewCoreDim] = useState("");
  const [newAuxDim, setNewAuxDim] = useState("");

  const handleSave = () => {
    if (passThreshold <= 0 || passThreshold > 100) { toast.error("通过阈值应在 1-100 之间"); return; }
    if (humanThreshold <= 0 || humanThreshold > passThreshold) { toast.error("人工审核阈值应小于等于通过阈值"); return; }
    updateReviewConfig({
      passThreshold,
      humanReviewThreshold: humanThreshold,
      maxRetries,
      humanReviewEnabled: humanEnabled,
      failAction,
      prerequisites,
      coreDimensions: coreDims,
      auxDimensions: auxDims,
    });
    toast.success("审核规则已保存");
  };

  const addPrereq = () => {
    const v = newPrereq.trim();
    if (!v) { toast.error("条件不能为空"); return; }
    if (prerequisites.includes(v)) { toast.error("条件已存在"); return; }
    setPrerequisites([...prerequisites, v]);
    setNewPrereq("");
  };

  const addCoreDim = () => {
    const v = newCoreDim.trim();
    if (!v) { toast.error("评分项不能为空"); return; }
    if (coreDims.includes(v)) { toast.error("评分项已存在"); return; }
    setCoreDims([...coreDims, v]);
    setNewCoreDim("");
  };

  const addAuxDim = () => {
    const v = newAuxDim.trim();
    if (!v) { toast.error("评分项不能为空"); return; }
    if (auxDims.includes(v)) { toast.error("评分项已存在"); return; }
    setAuxDims([...auxDims, v]);
    setNewAuxDim("");
  };

  return (
    <div className="space-y-4">
      {/* Thresholds */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="text-base">阈值配置</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-emerald-50/50 rounded-lg p-4 border border-emerald-100">
              <Label className="text-xs text-emerald-600">通过阈值</Label>
              <Input type="number" value={passThreshold} onChange={(e) => setPassThreshold(Number(e.target.value))} className="mt-1 w-24 border-emerald-200 text-lg font-bold text-emerald-700" />
              <p className="text-xs text-emerald-500 mt-1">分以上自动通过</p>
            </div>
            <div className="bg-amber-50/50 rounded-lg p-4 border border-amber-100">
              <Label className="text-xs text-amber-600">人工审核阈值</Label>
              <Input type="number" value={humanThreshold} onChange={(e) => setHumanThreshold(Number(e.target.value))} className="mt-1 w-24 border-amber-200 text-lg font-bold text-amber-700" />
              <p className="text-xs text-amber-500 mt-1">分以上需人工审核</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <Label className="text-xs text-slate-500">最大重试</Label>
              <Input type="number" value={maxRetries} onChange={(e) => setMaxRetries(Number(e.target.value))} className="mt-1 w-24 border-slate-200 text-lg font-bold text-slate-700" />
              <p className="text-xs text-slate-400 mt-1">次不通过后终止</p>
            </div>
          </div>
          <Separator />
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm text-slate-700">启用人工审核</Label>
              <Button variant="outline" size="sm" className={`text-xs ${humanEnabled ? "text-emerald-600 border-emerald-200" : "text-slate-400"}`}
                onClick={() => setHumanEnabled(!humanEnabled)}>
                {humanEnabled ? "已启用" : "已禁用"}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm text-slate-700">审核失败默认动作</Label>
              <select value={failAction} onChange={(e) => setFailAction(e.target.value as ReviewConfig["failAction"])} className="text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-700">
                <option value="retry">自动重试</option>
                <option value="human_review">转人工审核</option>
                <option value="halt">停止流程</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Prerequisites */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">必要条件</CardTitle>
          <CardDescription className="text-xs">不满足则直接不通过</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {prerequisites.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={p} onChange={(e) => { const n = [...prerequisites]; n[i] = e.target.value; setPrerequisites(n); }} className="text-xs border-slate-200 flex-1" />
              <Button variant="ghost" size="sm" className="text-red-400 text-xs px-2" onClick={() => setPrerequisites(prerequisites.filter((_, j) => j !== i))}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <Input value={newPrereq} onChange={(e) => setNewPrereq(e.target.value)} placeholder="输入新条件..." className="text-xs border-slate-200 flex-1" onKeyDown={(e) => e.key === "Enter" && addPrereq()} />
            <Button variant="outline" size="sm" className="text-xs" onClick={addPrereq}>添加</Button>
          </div>
        </CardContent>
      </Card>

      {/* Core Dimensions */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-sm">核心评分项（1-10 分）</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {coreDims.map((dim) => (
              <Badge key={dim} variant="outline" className="text-xs text-slate-600 border-slate-200 px-3 py-1 gap-1">
                {dim}
                <button onClick={() => setCoreDims(coreDims.filter((d) => d !== dim))} className="text-red-400 hover:text-red-600 ml-1"><X className="w-3 h-3" /></button>
              </Badge>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Input value={newCoreDim} onChange={(e) => setNewCoreDim(e.target.value)} placeholder="新评分项..." className="text-xs border-slate-200 w-40" onKeyDown={(e) => e.key === "Enter" && addCoreDim()} />
            <Button variant="outline" size="sm" className="text-xs" onClick={addCoreDim}>添加</Button>
          </div>
        </CardContent>
      </Card>

      {/* Aux Dimensions */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">辅助评分项</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {auxDims.map((dim) => (
              <Badge key={dim} variant="outline" className="text-xs text-slate-400 border-slate-200 px-3 py-1 gap-1">
                {dim}
                <button onClick={() => setAuxDims(auxDims.filter((d) => d !== dim))} className="text-red-400 hover:text-red-600 ml-1"><X className="w-3 h-3" /></button>
              </Badge>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Input value={newAuxDim} onChange={(e) => setNewAuxDim(e.target.value)} placeholder="新评分项..." className="text-xs border-slate-200 w-40" onKeyDown={(e) => e.key === "Enter" && addAuxDim()} />
            <Button variant="outline" size="sm" className="text-xs" onClick={addAuxDim}>添加</Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={handleSave}>保存审核规则</Button>
      </div>
    </div>
  );
}
