"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { useAppStore } from "@/lib/store";
import { PageHeader } from "@/components/shared";
import { AccountRoleLabel, roleHasPermission } from "@/types";
import {
  AccountsTab,
  ModelsTab,
  PlatformModelTab,
  RolesTab,
  RoleTagLibraryTab,
  ReviewRulesTab,
  FlowConfigTab,
  JsonTab,
} from "@/components/config";
import {
  Bot, Cpu, ShieldCheck, Workflow, FileJson, Tags, UsersRound,
} from "lucide-react";

export default function ConfigPage() {
  const config = useAppStore((s) => s.config);
  const memberships = useAppStore((s) => s.memberships);
  const currentUserId = useAppStore((s) => s.currentUserId);
  const currentTenantId = useAppStore((s) => s.currentTenantId);
  const currentRole =
    memberships.find((item) => item.userId === currentUserId && item.tenantId === currentTenantId && item.status === "active")?.role ??
    memberships.find((item) => item.userId === currentUserId && item.role === "platform_owner" && item.status === "active")?.role;
  const canManageConfig = roleHasPermission(currentRole, "tenant.manageConfig");

  if (!canManageConfig) {
    return (
      <div className="space-y-6 max-w-5xl">
        <PageHeader
          title="系统配置"
          description="当前账号只能使用 OKR 拆解，不能修改企业配置。"
        />
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-6 text-sm text-slate-600">
            当前角色：{currentRole ? AccountRoleLabel[currentRole] : "未识别角色"}。如需配置角色、模型、评分维度或流程，请联系企业管理员。
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title="系统配置"
        description="配置账号、角色定义、模型参数、KR 质量评分维度和流程模板。"
      />

      <Tabs defaultValue="accounts" className="space-y-4">
        <TabsList className="bg-slate-100 h-auto flex-wrap gap-0.5 p-1">
          <TabsTrigger value="accounts" className="gap-1.5 text-xs">
            <UsersRound className="w-3.5 h-3.5" />
            账号管理
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-1.5 text-xs">
            <Bot className="w-3.5 h-3.5" />
            角色配置
          </TabsTrigger>
          <TabsTrigger value="tag-library" className="gap-1.5 text-xs">
            <Tags className="w-3.5 h-3.5" />
            标签库
          </TabsTrigger>
          <TabsTrigger value="models" className="gap-1.5 text-xs">
            <Cpu className="w-3.5 h-3.5" />
            模型配置
          </TabsTrigger>
          <TabsTrigger value="review" className="gap-1.5 text-xs">
            <ShieldCheck className="w-3.5 h-3.5" />
            KR 评分维度
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

        <TabsContent value="accounts">
          <AccountsTab />
        </TabsContent>

        <TabsContent value="roles">
          <RolesTab roles={config.roles} />
        </TabsContent>

        <TabsContent value="tag-library">
          <RoleTagLibraryTab libraries={config.tagLibraries} />
        </TabsContent>

        <TabsContent value="models">
          {currentRole === "platform_owner" ? (
            <PlatformModelTab />
          ) : (
            <ModelsTab roles={config.roles} />
          )}
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
