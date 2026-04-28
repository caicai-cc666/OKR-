"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { RoleConfig } from "@/types";
import { useAppStore } from "@/lib/store";
import { mockConfig } from "@/data/mock-config";
import { Bot, ChevronDown, ChevronUp, Power, PowerOff } from "lucide-react";

function TagList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs text-slate-400 mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <Badge key={i} variant="outline" className="text-xs text-slate-600 border-slate-200 px-2 py-0.5">
            {item}
          </Badge>
        ))}
        {items.length === 0 && <span className="text-xs text-slate-300">暂无</span>}
      </div>
    </div>
  );
}

function RoleEditor({ role }: { role: RoleConfig }) {
  const [expanded, setExpanded] = useState(false);
  const updateRoleConfig = useAppStore((s) => s.updateRoleConfig);
  const formRef = useRef<HTMLDivElement>(null);

  const handleToggleEnabled = () => {
    updateRoleConfig(role.roleId, { enabled: !role.enabled });
    toast.success(`${role.roleName} 已${role.enabled ? "禁用" : "启用"}`);
  };

  const handleSave = () => {
    if (!formRef.current) return;
    const get = (name: string) => {
      const el = formRef.current!.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-field="${name}"]`);
      return el?.value ?? "";
    };
    updateRoleConfig(role.roleId, {
      systemPrompt: get("systemPrompt"),
      stylePrompt: get("stylePrompt"),
      maxRetries: parseInt(get("maxRetries")) || role.maxRetries,
      operationalNotes: get("operationalNotes"),
    });
    toast.success(`${role.roleName} 配置已保存`);
  };

  const handleResetDefault = () => {
    const defaultRole = mockConfig.roles.find((r) => r.roleId === role.roleId);
    if (defaultRole) {
      updateRoleConfig(role.roleId, { ...defaultRole });
      toast.success(`${role.roleName} 已恢复默认配置`);
    }
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
              <Bot className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <CardTitle className="text-base">{role.roleName}</CardTitle>
              <CardDescription className="text-xs">{role.description}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className={`gap-1.5 text-xs ${role.enabled ? "text-emerald-600 border-emerald-200" : "text-slate-400 border-slate-200"}`}
              onClick={handleToggleEnabled}
            >
              {role.enabled ? <Power className="w-3.5 h-3.5" /> : <PowerOff className="w-3.5 h-3.5" />}
              {role.enabled ? "已启用" : "已禁用"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <>
          <Separator />
          <CardContent className="pt-4 space-y-5" ref={formRef}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TagList label="宪法性原则" items={role.principles} />
              <TagList label="通用技能" items={role.generalSkills} />
              <TagList label="专用技能" items={role.specializedSkills} />
              <TagList label="风格特色" items={role.styleTraits} />
            </div>
            <Separator />
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-slate-500">System Prompt</Label>
                <Textarea data-field="systemPrompt" defaultValue={role.systemPrompt} key={role.systemPrompt} rows={4} className="mt-1 text-xs border-slate-200 font-mono resize-none" />
              </div>
              <div>
                <Label className="text-xs text-slate-500">Style Prompt</Label>
                <Textarea data-field="stylePrompt" defaultValue={role.stylePrompt} key={role.stylePrompt} rows={2} className="mt-1 text-xs border-slate-200 font-mono resize-none" />
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-slate-500">最大重试次数</Label>
                <Input data-field="maxRetries" type="number" defaultValue={role.maxRetries} key={role.maxRetries} className="mt-1 w-24 border-slate-200" />
              </div>
              <div>
                <Label className="text-xs text-slate-500">运行说明</Label>
                <Input data-field="operationalNotes" defaultValue={role.operationalNotes} key={role.operationalNotes} className="mt-1 border-slate-200 text-xs" />
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
              <p className="text-xs text-slate-400 mb-1">模型绑定</p>
              <p className="text-xs font-mono text-slate-600">
                {role.model.provider} / {role.model.modelId} · temp={role.model.temperature} · max={role.model.maxTokens}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" className="text-xs" onClick={handleResetDefault}>恢复默认</Button>
              <Button size="sm" className="text-xs bg-blue-600 hover:bg-blue-700" onClick={handleSave}>保存修改</Button>
            </div>
          </CardContent>
        </>
      )}
    </Card>
  );
}

export function RolesTab({ roles }: { roles: RoleConfig[] }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        每个角色提供系统默认模板，你可以完全自定义。未修改的字段将使用系统默认值。
      </p>
      {roles.map((role) => (
        <RoleEditor key={role.roleId} role={role} />
      ))}
    </div>
  );
}
