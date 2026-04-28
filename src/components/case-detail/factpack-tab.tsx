import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { FactPack } from "@/types";
import {
  Target,
  AlertTriangle,
  Clock,
  Users,
  BarChart3,
  ShieldAlert,
  Link2,
  Ban,
  TrendingUp,
} from "lucide-react";

function FactSection({
  icon: Icon,
  title,
  items,
  color = "text-slate-400",
  emptyText = "暂无",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  items: string[];
  color?: string;
  emptyText?: string;
}) {
  return (
    <div>
      <h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1.5">
        <Icon className={`w-3.5 h-3.5 ${color}`} />
        {title}
      </h4>
      {items.length > 0 ? (
        <ul className="space-y-1">
          {items.map((item, i) => (
            <li
              key={i}
              className="text-sm text-slate-600 flex items-start gap-2"
            >
              <span className={`mt-0.5 ${color}`}>&#8226;</span>
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-400">{emptyText}</p>
      )}
    </div>
  );
}

export function FactPackTab({ factPack }: { factPack: FactPack }) {
  return (
    <div className="space-y-4">
      {/* Business Context */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">业务背景</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-700 leading-relaxed">
            {factPack.businessContext}
          </p>
          <div className="flex items-center gap-2 mt-3">
            <Badge variant="outline" className="text-xs text-slate-500">
              <Clock className="w-3 h-3 mr-1" />
              {factPack.timeframe}
            </Badge>
            <Badge variant="secondary" className="text-[10px] text-slate-400">
              结构化于{" "}
              {new Date(factPack.structuredAt).toLocaleDateString("zh-CN")}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Main grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-5 space-y-5">
            <FactSection
              icon={Target}
              title="战略目标"
              items={factPack.strategicGoals}
              color="text-blue-500"
            />
            <Separator />
            <FactSection
              icon={AlertTriangle}
              title="当前挑战"
              items={factPack.currentChallenges}
              color="text-red-400"
            />
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-5 space-y-5">
            <FactSection
              icon={TrendingUp}
              title="当前基线"
              items={factPack.baselines || []}
              color="text-indigo-400"
            />
            <Separator />
            <FactSection
              icon={BarChart3}
              title="候选指标"
              items={factPack.candidateMetrics || []}
              color="text-cyan-500"
            />
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-5 space-y-5">
            <FactSection
              icon={ShieldAlert}
              title="约束条件"
              items={factPack.constraints}
              color="text-orange-400"
            />
            <Separator />
            <FactSection
              icon={ShieldAlert}
              title="风险"
              items={factPack.risks || []}
              color="text-red-500"
            />
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-5 space-y-5">
            <FactSection
              icon={Link2}
              title="依赖项"
              items={factPack.dependencies || []}
              color="text-violet-400"
            />
            <Separator />
            <FactSection
              icon={Users}
              title="干系人 / Owner 候选"
              items={factPack.stakeholders}
              color="text-emerald-500"
            />
            <Separator />
            <FactSection
              icon={Ban}
              title="非目标"
              items={factPack.nonGoals || []}
              color="text-slate-400"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
