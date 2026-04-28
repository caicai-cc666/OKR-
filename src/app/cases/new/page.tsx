"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppStore } from "@/lib/store";
import {
  ArrowRight, Lightbulb, Save, Sparkles, Users, CalendarRange, Info, Loader2,
} from "lucide-react";

const exampleChips = [
  "用户增长", "转化率优化", "客户续费", "研发效能",
  "出海拓展", "降本增效", "品牌升级", "团队建设",
];

const exampleTexts = [
  "我们想在 Q3 做用户增长，目前 DAU 约 50 万，预算 200 万，团队 20 人，希望增长到 100 万...",
  "公司计划进入东南亚市场，首站新加坡，当前仅支持中文，需要国际化，年预算 1000 万...",
  "研发团队 60 人，迭代周期 4 周，上线 Bug 率高，目标缩短迭代周期、降低 Bug 率...",
];

export default function NewCasePage() {
  const router = useRouter();
  const createCase = useAppStore((s) => s.createCase);
  const startAnalysis = useAppStore((s) => s.startAnalysis);
  const [title, setTitle] = useState("");
  const [team, setTeam] = useState("");
  const [cycle, setCycle] = useState("");
  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = title.trim() && rawText.trim();

  const handleSaveDraft = () => {
    if (!title.trim()) {
      toast.error("请输入案例标题");
      return;
    }
    const id = createCase(title.trim(), team.trim() || "默认团队", cycle.trim() || "Q3 2026", rawText.trim());
    toast.success("草稿已保存");
    router.push(`/cases/${id}`);
  };

  const handleStartAnalysis = async () => {
    if (!canSubmit) {
      toast.error("请填写案例标题和业务背景");
      return;
    }
    setLoading(true);
    const id = createCase(title.trim(), team.trim() || "默认团队", cycle.trim() || "Q3 2026", rawText.trim());
    toast.success("案例已创建，开始分析...");

    // Start analysis asynchronously
    startAnalysis(id);

    // Navigate immediately
    router.push(`/cases/${id}?tab=overview`);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">新建 OKR 拆解</h1>
        <p className="text-sm text-slate-500 mt-1">
          用自然语言描述你的业务背景，系统会自动整理和拆解，无需手动分类
        </p>
      </div>

      {/* Hint */}
      <div className="flex items-start gap-3 bg-blue-50/60 border border-blue-100 rounded-xl px-4 py-3">
        <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
        <div className="text-sm text-blue-700 leading-relaxed">
          <span className="font-medium">你不需要先分类。</span>{" "}
          只要描述清楚你的业务背景、目标和约束，OKR拆解会自动完成信息整理、结构化拆解、多维度审核。你将获得保守、平衡、进取三版方案供选择。
        </div>
      </div>

      {/* Basic Info */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">基本信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title" className="text-sm text-slate-700">
              案例标题 <span className="text-red-400">*</span>
            </Label>
            <Input
              id="title"
              placeholder="例如：Q3 用户增长战略规划"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1.5 border-slate-200"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="team" className="text-sm text-slate-700 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                团队
              </Label>
              <Input
                id="team"
                placeholder="例如：增长团队"
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                className="mt-1.5 border-slate-200"
              />
            </div>
            <div>
              <Label htmlFor="cycle" className="text-sm text-slate-700 flex items-center gap-1.5">
                <CalendarRange className="w-3.5 h-3.5 text-slate-400" />
                周期
              </Label>
              <Input
                id="cycle"
                placeholder="例如：Q3 2026"
                value={cycle}
                onChange={(e) => setCycle(e.target.value)}
                className="mt-1.5 border-slate-200"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Natural Language Input */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">业务背景 <span className="text-red-400">*</span></CardTitle>
          <CardDescription>
            请尽可能详细地描述你的业务背景、目标、挑战和约束条件。自由输入，不需要格式化。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs text-slate-400 mb-2">热门话题（点击可作为输入起点）</p>
            <div className="flex flex-wrap gap-1.5">
              {exampleChips.map((chip) => (
                <button
                  key={chip}
                  onClick={() => {
                    if (!rawText.includes(chip)) {
                      setRawText((prev) =>
                        prev ? `${prev}\n我们想做${chip}方面的工作...` : `我们想做${chip}方面的工作...`
                      );
                    }
                  }}
                  className="text-xs px-2.5 py-1 rounded-full border border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50 transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          <Textarea
            placeholder={"在这里输入你的业务背景描述...\n\n例如：我们是一个 B2B SaaS 产品，目前年收入约 5000 万，客户 200 家。当前续费率只有 75%，NPS 35 分。我们希望在下半年建立客户成功体系，把续费率提升到 85%..."}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={10}
            className="border-slate-200 resize-none text-sm leading-relaxed"
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">
              建议包含：业务现状、核心目标、现有挑战、团队规模、预算范围、时间要求
            </p>
            <span className="text-xs text-slate-300">{rawText.length} 字</span>
          </div>
        </CardContent>
      </Card>

      {/* Examples */}
      <Card className="border-slate-100 bg-slate-50/50 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-slate-600">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            输入示例
          </CardTitle>
          <CardDescription className="text-xs">点击任意示例可快速填入</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {exampleTexts.map((ex, i) => (
            <button
              key={i}
              onClick={() => setRawText(ex)}
              className="block w-full text-left text-xs text-slate-500 bg-white rounded-lg px-3 py-2.5 border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
            >
              {ex}
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between pb-6">
        <Button
          variant="outline"
          onClick={handleSaveDraft}
          disabled={!title.trim() || loading}
          className="gap-2 text-slate-600"
        >
          <Save className="w-4 h-4" />
          保存草稿
        </Button>
        <Button
          onClick={handleStartAnalysis}
          disabled={!canSubmit || loading}
          className="bg-blue-600 hover:bg-blue-700 gap-2 px-6"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          开始分析
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
