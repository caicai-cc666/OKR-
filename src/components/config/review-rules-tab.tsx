"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ReviewConfig, ReviewWeightedRule } from "@/types";
import { useAppStore } from "@/lib/store";
import {
  downloadJson,
  isRecord,
  makeExportEnvelope,
  readJsonFile,
  safeFilePart,
  unwrapConfigImport,
  type ReviewRuleExportPayload,
} from "@/lib/config-transfer";
import { Download, Upload, X } from "lucide-react";

function defaultWeightedRules(config: ReviewConfig): ReviewWeightedRule[] {
  if (config.weightedRules?.length) return config.weightedRules;
  const rules = [...new Set([...config.prerequisites, ...config.coreDimensions].map((item) => item.trim()).filter(Boolean))];
  const weight = rules.length ? Math.round(100 / rules.length) : 10;
  return rules.map((label, index) => ({
    id: `rule-${index}-${label}`,
    label,
    weight,
  }));
}

export function ReviewRulesTab({ config }: { config: ReviewConfig }) {
  const updateReviewConfig = useAppStore((s) => s.updateReviewConfig);

  const [requiredRules, setRequiredRules] = useState<ReviewWeightedRule[]>(defaultWeightedRules(config));
  const [auxDims, setAuxDims] = useState([...config.auxDimensions]);
  const [newRequiredRule, setNewRequiredRule] = useState("");
  const [newRequiredWeight, setNewRequiredWeight] = useState("");
  const [newAuxDim, setNewAuxDim] = useState("");
  const [dirty, setDirty] = useState(false);
  const totalWeight = requiredRules.reduce((sum, rule) => sum + (Number(rule.weight) || 0), 0);

  const handleSave = () => {
    const cleaned = requiredRules
      .map((rule) => ({ ...rule, label: rule.label.trim(), weight: Number(rule.weight) || 0 }))
      .filter((rule) => rule.label);
    if (cleaned.length === 0) { toast.error("至少保留一条 KR 质量评分维度"); return; }
    if (cleaned.some((rule) => rule.weight <= 0 || rule.weight > 100)) {
      toast.error("每个维度权重应在 1-100% 之间");
      return;
    }
    updateReviewConfig({
      weightedRules: cleaned,
      prerequisites: cleaned.map((rule) => rule.label),
      coreDimensions: cleaned.map((rule) => rule.label),
      auxDimensions: auxDims,
    });
    setDirty(false);
    toast.success("KR质量评分维度已保存");
  };

  const addRequiredRule = () => {
    const v = newRequiredRule.trim();
    const weight = Number.parseInt(newRequiredWeight, 10);
    if (!v) { toast.error("评分维度不能为空"); return; }
    if (requiredRules.some((rule) => rule.label === v)) { toast.error("评分维度已存在"); return; }
    if (!Number.isFinite(weight) || weight <= 0 || weight > 100) {
      toast.error("请填写 1-100 之间的整数权重");
      return;
    }
    setRequiredRules([...requiredRules, { id: `rule-${Date.now()}`, label: v, weight }]);
    setNewRequiredRule("");
    setNewRequiredWeight("");
    setDirty(true);
  };

  const handleExportRule = (rule: ReviewWeightedRule) => {
    const data = makeExportEnvelope<ReviewRuleExportPayload>("review-rule", rule.label, { rule });
    downloadJson(`okr-review-rule-${safeFilePart(rule.label)}.json`, data);
    toast.success("KR 评分维度 JSON 已导出");
  };

  const handleImportRuleAt = async (index: number) => {
    let parsed: unknown;
    try {
      parsed = await readJsonFile();
    } catch {
      toast.error("JSON 文件读取失败，请检查文件格式");
      return;
    }

    const imported = unwrapConfigImport(parsed);
    const payload = imported.payload;
    const importedRule =
      isRecord(payload) && isRecord(payload.rule)
        ? (payload.rule as unknown as ReviewWeightedRule)
        : isRecord(payload) && typeof payload.label === "string"
          ? (payload as unknown as ReviewWeightedRule)
          : undefined;

    if (!importedRule?.label) {
      toast.error("未识别到单条 KR 评分维度");
      return;
    }

    const next = [...requiredRules];
    next[index] = {
      id: next[index]?.id ?? importedRule.id ?? `rule-${Date.now()}`,
      label: importedRule.label,
      weight: Number(importedRule.weight) || 0,
    };
    setRequiredRules(next);
    setDirty(true);
    toast.success("KR 评分维度已导入到当前行");
  };

  const addAuxDim = () => {
    const v = newAuxDim.trim();
    if (!v) { toast.error("评分项不能为空"); return; }
    if (auxDims.includes(v)) { toast.error("评分项已存在"); return; }
    setAuxDims([...auxDims, v]);
    setNewAuxDim("");
    setDirty(true);
  };

  return (
    <div className="space-y-4">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">KR质量评分维度</CardTitle>
            <Badge variant="secondary" className={`border-0 text-xs ${totalWeight === 100 ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
              权重合计 {totalWeight}%
            </Badge>
          </div>
          <CardDescription className="text-xs leading-relaxed">
            由审核官用于给单条 KR 打质量分。这里不设置通过阈值、循环次数或人工审核条件；这些流程规则请在流程配置里设置。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {requiredRules.map((rule, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={rule.label}
                onChange={(e) => {
                  const n = [...requiredRules];
                  n[i] = { ...n[i], label: e.target.value };
                  setRequiredRules(n);
                  setDirty(true);
                }}
                className="text-xs border-slate-200 flex-1"
              />
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  inputMode="numeric"
                  value={rule.weight}
                  onChange={(e) => {
                    const n = [...requiredRules];
                    n[i] = { ...n[i], weight: Number.parseInt(e.target.value, 10) || 0 };
                    setRequiredRules(n);
                    setDirty(true);
                  }}
                  className="text-xs border-slate-200 w-20"
                />
                <span className="text-xs text-slate-400">%</span>
              </div>
              <Button variant="ghost" size="sm" className="px-2 text-xs text-slate-400" onClick={() => handleExportRule(rule)}>
                <Download className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="px-2 text-xs text-slate-400" onClick={() => handleImportRuleAt(i)}>
                <Upload className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="text-red-400 text-xs px-2" onClick={() => {
                setRequiredRules(requiredRules.filter((_, j) => j !== i));
                setDirty(true);
              }}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <Input value={newRequiredRule} onChange={(e) => setNewRequiredRule(e.target.value)} placeholder="输入新维度，如：可衡量性、结果导向、战略承接..." className="text-xs border-slate-200 flex-1" onKeyDown={(e) => e.key === "Enter" && addRequiredRule()} />
            <Input type="number" min={1} max={100} step={1} inputMode="numeric" value={newRequiredWeight} onChange={(e) => setNewRequiredWeight(e.target.value)} placeholder="权重" className="text-xs border-slate-200 w-20" />
            <span className="text-xs text-slate-400">%</span>
            <Button variant="outline" size="sm" className="text-xs" onClick={addRequiredRule}>添加</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-slate-500">辅助加减分项</CardTitle>
          <CardDescription className="text-xs">作为小幅修正参考，不直接决定单条 KR 是否过线。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {auxDims.map((dim) => (
              <Badge key={dim} variant="outline" className="text-xs text-slate-400 border-slate-200 px-3 py-1 gap-1">
                {dim}
                <button onClick={() => {
                  setAuxDims(auxDims.filter((d) => d !== dim));
                  setDirty(true);
                }} className="text-red-400 hover:text-red-600 ml-1"><X className="w-3 h-3" /></button>
              </Badge>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Input value={newAuxDim} onChange={(e) => setNewAuxDim(e.target.value)} placeholder="新辅助项..." className="text-xs border-slate-200 w-40" onKeyDown={(e) => e.key === "Enter" && addAuxDim()} />
            <Button variant="outline" size="sm" className="text-xs" onClick={addAuxDim}>添加</Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          size="sm"
          disabled={!dirty}
          className={dirty ? "bg-blue-600 hover:bg-blue-700" : "bg-slate-200 text-slate-500 hover:bg-slate-200"}
          onClick={handleSave}
        >
          {dirty ? "保存评分维度" : "已保存"}
        </Button>
      </div>
    </div>
  );
}
