"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAppStore } from "@/lib/store";
import type { RoleConfig, RoleModelConfig } from "@/types";
import { RoleModelCard } from "./models-tab";

type PlatformModelPayload = RoleModelConfig & {
  roleId?: string;
  apiKeyMasked?: string;
};

function modelFromPayload(role: RoleConfig, payload?: PlatformModelPayload): RoleModelConfig {
  if (!payload) return { ...role.model, apiKey: "" };
  return {
    ...role.model,
    connectionType: payload.connectionType ?? role.model.connectionType,
    provider: payload.provider ?? role.model.provider,
    modelId: payload.modelId ?? role.model.modelId,
    apiBaseUrl: payload.apiBaseUrl,
    apiKey: "",
    temperature: payload.temperature ?? role.model.temperature,
    topP: payload.topP ?? role.model.topP,
    customHeaders: payload.customHeaders,
    customParams: payload.customParams,
  };
}

export function PlatformModelTab() {
  const roles = useAppStore((s) => s.config.roles);
  const [platformModels, setPlatformModels] = useState<Record<string, PlatformModelPayload>>({});
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/admin/platform-model", { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) return;
        const data = (await response.json()) as { configs?: PlatformModelPayload[] };
        const next: Record<string, PlatformModelPayload> = {};
        for (const item of data.configs ?? []) {
          if (item.roleId) next[item.roleId] = item;
        }
        setPlatformModels(next);
      })
      .catch(() => undefined)
      .finally(() => setIsLoaded(true));
  }, []);

  const platformRoles = useMemo(
    () => roles.filter((role) => role.enabled),
    [roles],
  );

  const savePlatformModel = async (roleId: string, model: RoleModelConfig) => {
    const response = await fetch("/api/admin/platform-model", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ...model, roleId }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error(data.error ?? "保存平台模型失败");
      return;
    }
    setPlatformModels((current) => ({
      ...current,
      [roleId]: { ...model, roleId, apiKey: "", apiKeyMasked: "********" },
    }));
    toast.success("平台角色模型已保存");
  };

  const resetPlatformModel = async (roleId: string) => {
    const response = await fetch(`/api/admin/platform-model?roleId=${encodeURIComponent(roleId)}`, {
      method: "DELETE",
      credentials: "include",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error(data.error ?? "删除平台角色模型失败");
      return;
    }
    setPlatformModels((current) => {
      const next = { ...current };
      delete next[roleId];
      return next;
    });
    toast.success("已恢复为角色默认模型");
  };

  return (
    <div className="space-y-4">
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
            <ShieldCheck className="h-4 w-4 text-blue-600" />
            平台托管模型
          </div>
          <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm leading-6 text-blue-800">
            平台超级管理员可以按角色分别配置托管模型。企业没有配置自己的角色 Key 时，会优先使用这里对应角色的托管模型。
            第三方接口只知道 Key 和 Base URL 时，可把服务提供方、模型名称留空，保存时会自动补为
            <span className="font-mono"> openai-compatible / auto</span>。
          </div>
        </CardContent>
      </Card>

      {platformRoles.map((role) => (
        <RoleModelCard
          key={role.roleId}
          role={role}
          model={modelFromPayload(role, platformModels[role.roleId])}
          onSaveModel={savePlatformModel}
          onResetModel={resetPlatformModel}
        />
      ))}

      {isLoaded && platformRoles.length === 0 && (
        <p className="rounded-md bg-slate-50 px-3 py-4 text-sm text-slate-500">暂无启用角色。</p>
      )}
    </div>
  );
}
