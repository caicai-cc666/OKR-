"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppStore } from "@/lib/store";
import { PageHeader } from "@/components/shared";
import {
  RolesTab,
  ModelsTab,
  ReviewRulesTab,
  FlowConfigTab,
  JsonTab,
} from "@/components/config";
import {
  Bot, Cpu, ShieldCheck, Workflow, FileJson,
} from "lucide-react";

export default function ConfigPage() {
  const config = useAppStore((s) => s.config);

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title="系统配置"
        description="配置角色定义、模型参数、审核规则和流程模板"
      />

      <Tabs defaultValue="roles" className="space-y-4">
        <TabsList className="bg-slate-100 h-auto flex-wrap gap-0.5 p-1">
          <TabsTrigger value="roles" className="gap-1.5 text-xs">
            <Bot className="w-3.5 h-3.5" />
            角色配置
          </TabsTrigger>
          <TabsTrigger value="models" className="gap-1.5 text-xs">
            <Cpu className="w-3.5 h-3.5" />
            模型配置
          </TabsTrigger>
          <TabsTrigger value="review" className="gap-1.5 text-xs">
            <ShieldCheck className="w-3.5 h-3.5" />
            审核规则
          </TabsTrigger>
          <TabsTrigger value="flow" className="gap-1.5 text-xs">
            <Workflow className="w-3.5 h-3.5" />
            流程配置
          </TabsTrigger>
          <TabsTrigger value="json" className="gap-1.5 text-xs">
            <FileJson className="w-3.5 h-3.5" />
            导入导出
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roles">
          <RolesTab roles={config.roles} />
        </TabsContent>

        <TabsContent value="models">
          <ModelsTab roles={config.roles} />
        </TabsContent>

        <TabsContent value="review">
          <ReviewRulesTab config={config.review} />
        </TabsContent>

        <TabsContent value="flow">
          <FlowConfigTab templates={config.flowTemplates} />
        </TabsContent>

        <TabsContent value="json">
          <JsonTab config={config} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
