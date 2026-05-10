"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { RoleConfig, RoleSelectedTagIds, RoleTagItem, RoleTagLibraries } from "@/types";
import { useAppStore } from "@/lib/store";
import { mockConfig } from "@/data/mock-config";
import {
  downloadJson,
  emptyRoleTagLibraries,
  isRecord,
  makeExportEnvelope,
  mergeRoleTagLibraries,
  readJsonFile,
  remapSelectedTagIds,
  roleListsFromSelectedTags,
  safeFilePart,
  sanitizeModelForExport,
  selectedRoleTagLibraries,
  unwrapConfigImport,
  type RoleExportPayload,
} from "@/lib/config-transfer";
import {
  Bot, Check, ChevronDown, ChevronUp, Copy, Download, Plus, Power, PowerOff, Search, Trash2, Upload, X,
} from "lucide-react";

type LibraryKey = keyof RoleTagLibraries;

const libraryMeta: Record<LibraryKey, { title: string; description: string; placeholder: string }> = {
  principles: {
    title: "宪法性原则",
    description: "这个角色必须遵守的底层原则和判断边界。",
    placeholder: "例如：不遗漏用户原始表达中的任何关键信息",
  },
  capabilities: {
    title: "专业能力",
    description: "这个角色需要具备的方法论、分析能力和执行技能。",
    placeholder: "例如：指标设计、质量审核、信息结构化",
  },
  expressionStyles: {
    title: "表达方式",
    description: "这个角色输出时采用的语气、结构和沟通风格。",
    placeholder: "例如：严谨、直接、建设性、透明",
  },
};

function emptyLibraries(): RoleTagLibraries {
  return emptyRoleTagLibraries();
}

function labelWithDefinition(item: RoleTagItem): string {
  return `${item.name}：${item.definition}`;
}

function deriveSelectedIds(items: RoleTagItem[], roleValues: string[], selectedIds?: string[]): string[] {
  if (selectedIds?.length) return selectedIds.filter((id) => items.some((item) => item.id === id));
  return items
    .filter((item) => roleValues.some((value) => value.includes(item.name) || value.includes(item.definition)))
    .map((item) => item.id);
}

function makeTagId(type: LibraryKey, name: string, existing: RoleTagItem[]): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32) || "tag";
  let id = `${type}-${slug}`;
  let i = existing.length + 1;
  while (existing.some((item) => item.id === id)) {
    id = `${type}-${slug}-${i}`;
    i += 1;
  }
  return id;
}

function selectedItems(items: RoleTagItem[], selected: string[]): RoleTagItem[] {
  return selected
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is RoleTagItem => Boolean(item));
}

function makeCustomRoleId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `custom-role-${crypto.randomUUID()}`;
  }
  return `custom-role-${Math.random().toString(36).slice(2, 10)}`;
}

function cloneRole(role: RoleConfig): RoleConfig {
  return {
    ...role,
    roleId: makeCustomRoleId(),
    roleName: `${role.roleName}（副本）`,
    selectedTagIds: {
      principles: [...(role.selectedTagIds?.principles ?? [])],
      capabilities: [...(role.selectedTagIds?.capabilities ?? [])],
      expressionStyles: [...(role.selectedTagIds?.expressionStyles ?? [])],
    },
    principles: [...role.principles],
    generalSkills: [...role.generalSkills],
    specializedSkills: [...role.specializedSkills],
    styleTraits: [...role.styleTraits],
    model: JSON.parse(JSON.stringify(role.model)) as RoleConfig["model"],
    enabled: true,
  };
}

function RoleTagSection({
  type,
  items,
  selected,
  onChange,
  onCreate,
}: {
  type: LibraryKey;
  items: RoleTagItem[];
  selected: string[];
  onChange: (ids: string[]) => void;
  onCreate: (name: string, definition: string) => void;
}) {
  const meta = libraryMeta[type];
  const [pickerOpen, setPickerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [definition, setDefinition] = useState("");

  const pickedItems = selectedItems(items, selected);
  const cleanQuery = query.trim().toLowerCase();
  const filteredItems = (cleanQuery
    ? items.filter((item) =>
        `${item.name} ${item.definition}`.toLowerCase().includes(cleanQuery)
      )
    : items.slice(0, 8)
  );

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  };

  const handleCreate = () => {
    const cleanName = name.trim();
    const cleanDefinition = definition.trim();
    if (!cleanName) {
      toast.error("请输入标签名称");
      return;
    }
    if (!cleanDefinition) {
      toast.error("请输入标签详细定义");
      return;
    }
    onCreate(cleanName, cleanDefinition);
    setName("");
    setDefinition("");
    setCreateOpen(false);
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-700">{meta.title}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">{meta.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={`h-7 gap-1 px-2 text-xs ${pickerOpen ? "border-blue-200 bg-blue-50 text-blue-700" : ""}`}
            onClick={() => {
              setPickerOpen((value) => !value);
              setCreateOpen(false);
            }}
          >
            <Search className="h-3 w-3" />
            {pickerOpen ? "收起选择" : "选择"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={`h-7 gap-1 px-2 text-xs ${createOpen ? "border-blue-200 bg-blue-50 text-blue-700" : ""}`}
            onClick={() => {
              setCreateOpen((value) => !value);
              setPickerOpen(false);
            }}
          >
            <Plus className="h-3 w-3" />
            {createOpen ? "收起新增" : "新增"}
          </Button>
        </div>
      </div>

      {pickerOpen && (
        <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50/70 p-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`搜索${meta.title}`}
              className="h-8 border-slate-200 bg-white pl-8 text-xs"
            />
          </div>
          <div className="mt-2 max-h-56 space-y-1.5 overflow-auto">
            {filteredItems.map((item) => {
              const active = selected.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggle(item.id)}
                  className={`w-full rounded-md border p-2 text-left transition-colors ${
                    active ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white hover:border-blue-200"
                  }`}
                >
                  <span className="flex items-start gap-2">
                    <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      active ? "border-blue-500 bg-blue-500 text-white" : "border-slate-300 text-transparent"
                    }`}>
                      <Check className="h-3 w-3" />
                    </span>
                    <span>
                      <span className="block text-xs font-medium text-slate-700">{item.name}</span>
                      <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">{item.definition}</span>
                    </span>
                    {active && (
                      <span className="ml-auto shrink-0 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-600">
                        已选
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
            {filteredItems.length === 0 && (
              <p className="py-5 text-center text-xs text-slate-400">没有匹配标签，可以直接新增。</p>
            )}
          </div>
        </div>
      )}

      {createOpen && (
        <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50/70 p-2">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={meta.placeholder}
            className="h-8 border-slate-200 bg-white text-xs"
          />
          <Textarea
            value={definition}
            onChange={(event) => setDefinition(event.target.value)}
            placeholder="写清楚这条标签的详细定义、适用边界和使用方式"
            rows={3}
            className="mt-2 resize-none border-slate-200 bg-white text-xs"
          />
          <div className="mt-2 flex justify-end">
            <Button type="button" size="sm" className="h-7 bg-blue-600 text-xs hover:bg-blue-700" onClick={handleCreate}>
              保存并选中
            </Button>
          </div>
        </div>
      )}

      <div className="mt-3 space-y-2">
        {pickedItems.length > 0 ? (
          pickedItems.map((item) => (
            <div key={item.id} className="rounded-md border border-blue-100 bg-blue-50/50 p-2">
              <div className="flex items-start gap-2">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-700">{item.name}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{item.definition}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 shrink-0 p-0 text-slate-400 hover:text-red-500"
                  onClick={() => onChange(selected.filter((id) => id !== item.id))}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-md border border-dashed border-slate-200 py-4 text-center text-xs text-slate-400">
            暂未选择
          </p>
        )}
      </div>
    </div>
  );
}

function RoleEditor({ role }: { role: RoleConfig }) {
  const [expanded, setExpanded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const updateRoleConfig = useAppStore((s) => s.updateRoleConfig);
  const addRoleConfig = useAppStore((s) => s.addRoleConfig);
  const deleteRoleConfig = useAppStore((s) => s.deleteRoleConfig);
  const saveConfig = useAppStore((s) => s.saveConfig);
  const tagLibraries = useAppStore((s) => s.config.tagLibraries);
  const libraries = { ...emptyLibraries(), ...tagLibraries };
  const isSystemRole = mockConfig.roles.some((item) => item.roleId === role.roleId);
  const formRef = useRef<HTMLDivElement>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<RoleSelectedTagIds>({
    principles: deriveSelectedIds(libraries.principles, role.principles, role.selectedTagIds?.principles),
    capabilities: deriveSelectedIds(libraries.capabilities, [...role.generalSkills, ...role.specializedSkills], role.selectedTagIds?.capabilities),
    expressionStyles: deriveSelectedIds(libraries.expressionStyles, role.styleTraits, role.selectedTagIds?.expressionStyles),
  });

  const handleToggleEnabled = () => {
    updateRoleConfig(role.roleId, { enabled: !role.enabled });
    toast.success(`${role.roleName} 已${role.enabled ? "禁用" : "启用"}`);
  };

  const handleCreateTag = (type: LibraryKey, name: string, definition: string) => {
    const currentLibraries = { ...emptyLibraries(), ...(useAppStore.getState().config.tagLibraries ?? {}) };
    const currentItems = currentLibraries[type];
    const duplicate = currentItems.find((item) => item.name.trim().toLowerCase() === name.trim().toLowerCase());

    if (duplicate) {
      setSelectedTagIds((prev) => ({
        ...prev,
        [type]: prev[type].includes(duplicate.id) ? prev[type] : [...prev[type], duplicate.id],
      }));
      setDirty(true);
      toast.success("标签库已有同名内容，已直接选中");
      return;
    }

    const newItem: RoleTagItem = {
      id: makeTagId(type, name, currentItems),
      name,
      definition,
    };

    saveConfig({
      tagLibraries: {
        ...currentLibraries,
        [type]: [newItem, ...currentItems],
      },
    });
    setSelectedTagIds((prev) => ({
      ...prev,
      [type]: [...prev[type], newItem.id],
    }));
    setDirty(true);
    toast.success("已新增到标签库并选中");
  };

  const handleSave = () => {
    if (!formRef.current) return;
    const get = (name: string) => {
      const el = formRef.current!.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-field="${name}"]`);
      return el?.value ?? "";
    };
    const currentLibraries = { ...emptyLibraries(), ...(useAppStore.getState().config.tagLibraries ?? {}) };
    const rolePrompt = get("rolePrompt");
    const selectedPrinciples = currentLibraries.principles.filter((item) => selectedTagIds.principles.includes(item.id));
    const selectedCapabilities = currentLibraries.capabilities.filter((item) => selectedTagIds.capabilities.includes(item.id));
    const selectedExpressionStyles = currentLibraries.expressionStyles.filter((item) => selectedTagIds.expressionStyles.includes(item.id));
    updateRoleConfig(role.roleId, {
      systemPrompt: rolePrompt,
      stylePrompt: "",
      roleName: get("roleName") || role.roleName,
      description: get("description") || role.description,
      selectedTagIds,
      principles: selectedPrinciples.map(labelWithDefinition),
      generalSkills: selectedCapabilities.map(labelWithDefinition),
      specializedSkills: [],
      styleTraits: selectedExpressionStyles.map(labelWithDefinition),
    });
    setDirty(false);
    toast.success(`${role.roleName} 配置已保存`);
  };

  const handleResetDefault = () => {
    const defaultRole = mockConfig.roles.find((r) => r.roleId === role.roleId);
    if (defaultRole) {
      updateRoleConfig(role.roleId, { ...defaultRole });
      setSelectedTagIds({
        principles: defaultRole.selectedTagIds?.principles ?? [],
        capabilities: defaultRole.selectedTagIds?.capabilities ?? [],
        expressionStyles: defaultRole.selectedTagIds?.expressionStyles ?? [],
      });
      setDirty(false);
      toast.success(`${role.roleName} 已恢复默认配置`);
    }
  };

  const handleExportRole = () => {
    const currentLibraries = { ...emptyLibraries(), ...(useAppStore.getState().config.tagLibraries ?? {}) };
    const roleForExport: RoleConfig = {
      ...role,
      model: sanitizeModelForExport(role.model),
    };
    const data = makeExportEnvelope<RoleExportPayload>(
      "role",
      role.roleName,
      { role: roleForExport },
      { tagLibraries: selectedRoleTagLibraries(role, currentLibraries) }
    );
    downloadJson(`okr-role-${safeFilePart(role.roleName)}.json`, data);
    toast.success("角色配置 JSON 已导出");
  };

  const handleImportRole = async () => {
    let parsed: unknown;
    try {
      parsed = await readJsonFile();
    } catch {
      toast.error("JSON 文件读取失败，请检查文件格式");
      return;
    }

    const imported = unwrapConfigImport(parsed);
    const payload = imported.payload;
    const importedRole =
      isRecord(payload) && isRecord(payload.role)
        ? (payload.role as unknown as RoleConfig)
        : isRecord(payload) && typeof payload.roleId === "string"
          ? (payload as unknown as RoleConfig)
          : undefined;

    if (!importedRole) {
      toast.error("未识别到单个角色配置");
      return;
    }

    const incomingLibraries = imported.dependencies?.tagLibraries;
    const currentLibraries = { ...emptyLibraries(), ...(useAppStore.getState().config.tagLibraries ?? {}) };
    const { libraries: mergedLibraries } = mergeRoleTagLibraries(currentLibraries, incomingLibraries);
    const hasSelectedTags = Boolean(importedRole.selectedTagIds);
    const nextSelectedTagIds = hasSelectedTags
      ? remapSelectedTagIds(importedRole.selectedTagIds, incomingLibraries, mergedLibraries)
      : selectedTagIds;

    saveConfig({ tagLibraries: mergedLibraries });
    updateRoleConfig(role.roleId, {
      ...importedRole,
      roleId: role.roleId,
      model: role.model,
      ...(hasSelectedTags
        ? {
            selectedTagIds: nextSelectedTagIds,
            ...roleListsFromSelectedTags(mergedLibraries, nextSelectedTagIds),
          }
        : {}),
    });
    setSelectedTagIds(nextSelectedTagIds);
    setDirty(false);
    toast.success("角色配置已导入到当前角色，模型配置已保留");
  };

  const handleCopyRole = () => {
    const nextRole = cloneRole(role);
    addRoleConfig(nextRole);
    toast.success(`已复制为「${nextRole.roleName}」`);
  };

  const handleDeleteRole = () => {
    if (isSystemRole) {
      toast.error("系统原始角色不可删除");
      return;
    }
    const confirmed = window.confirm(`确认删除「${role.roleName}」吗？对应的模型配置也会一起删除，流程中引用它的节点会改为协调器。`);
    if (!confirmed) return;
    deleteRoleConfig(role.roleId);
    toast.success(`已删除「${role.roleName}」`);
  };

  return (
    <Card className="overflow-visible border-slate-200 shadow-sm">
      <CardHeader className={`pb-3 ${expanded ? "sticky top-0 z-20 rounded-t-lg border-b border-blue-200 bg-blue-50 before:absolute before:-top-6 before:left-0 before:right-0 before:h-6 before:bg-blue-50 before:content-['']" : ""}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50">
              <Bot className="h-4 w-4 text-indigo-600" />
            </div>
            <div>
              <CardTitle className="text-base">{role.roleName}</CardTitle>
              <CardDescription className="text-xs">{role.description}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleExportRole}>
              <Download className="h-3.5 w-3.5" />
              导出
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleImportRole}>
              <Upload className="h-3.5 w-3.5" />
              导入
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleCopyRole}>
              <Copy className="h-3.5 w-3.5" />
              复制
            </Button>
            {!isSystemRole && (
              <Button variant="outline" size="sm" className="gap-1.5 border-red-200 text-xs text-red-500 hover:bg-red-50" onClick={handleDeleteRole}>
                <Trash2 className="h-3.5 w-3.5" />
                删除
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className={`gap-1.5 text-xs ${role.enabled ? "border-emerald-200 text-emerald-600" : "border-slate-200 text-slate-400"}`}
              onClick={handleToggleEnabled}
            >
              {role.enabled ? <Power className="h-3.5 w-3.5" /> : <PowerOff className="h-3.5 w-3.5" />}
              {role.enabled ? "已启用" : "已禁用"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <>
          <CardContent className="space-y-5 pt-4" ref={formRef}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label className="text-xs text-slate-500">角色名称</Label>
                <Input data-field="roleName" defaultValue={role.roleName} onChange={() => setDirty(true)} className="mt-1 border-slate-200 text-xs" />
              </div>
              <div>
                <Label className="text-xs text-slate-500">角色说明</Label>
                <Input data-field="description" defaultValue={role.description} onChange={() => setDirty(true)} className="mt-1 border-slate-200 text-xs" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-500">角色定义</Label>
              <Textarea
                data-field="rolePrompt"
                defaultValue={[role.systemPrompt, role.stylePrompt].filter(Boolean).join("\n\n")}
                key={`${role.systemPrompt}-${role.stylePrompt}`}
                rows={6}
                onChange={() => setDirty(true)}
                className="mt-1 resize-none border-slate-200 font-mono text-xs"
              />
            </div>
            <Separator />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <RoleTagSection
                type="principles"
                items={libraries.principles}
                selected={selectedTagIds.principles}
                onChange={(ids) => {
                  setSelectedTagIds((prev) => ({ ...prev, principles: ids }));
                  setDirty(true);
                }}
                onCreate={(name, definition) => handleCreateTag("principles", name, definition)}
              />
              <RoleTagSection
                type="capabilities"
                items={libraries.capabilities}
                selected={selectedTagIds.capabilities}
                onChange={(ids) => {
                  setSelectedTagIds((prev) => ({ ...prev, capabilities: ids }));
                  setDirty(true);
                }}
                onCreate={(name, definition) => handleCreateTag("capabilities", name, definition)}
              />
              <RoleTagSection
                type="expressionStyles"
                items={libraries.expressionStyles}
                selected={selectedTagIds.expressionStyles}
                onChange={(ids) => {
                  setSelectedTagIds((prev) => ({ ...prev, expressionStyles: ids }));
                  setDirty(true);
                }}
                onCreate={(name, definition) => handleCreateTag("expressionStyles", name, definition)}
              />
            </div>
            <Separator />
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <p className="mb-1 text-xs text-slate-400">模型绑定</p>
              <p className="font-mono text-xs text-slate-600">
                {role.model.provider} / {role.model.modelId} · temp={role.model.temperature}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" className="text-xs" onClick={handleResetDefault}>恢复默认</Button>
              <Button
                size="sm"
                disabled={!dirty}
                className={`text-xs ${dirty ? "bg-blue-600 hover:bg-blue-700" : "bg-slate-200 text-slate-500 hover:bg-slate-200"}`}
                onClick={handleSave}
              >
                {dirty ? "保存修改" : "已保存"}
              </Button>
            </div>
          </CardContent>
        </>
      )}
    </Card>
  );
}

export function RolesTab({ roles }: { roles: RoleConfig[] }) {
  const addRoleConfig = useAppStore((s) => s.addRoleConfig);

  const handleAddRole = () => {
    const base = mockConfig.roles.find((r) => r.roleId === "coordinator") ?? mockConfig.roles[0];
    addRoleConfig({
      ...base,
      roleId: makeCustomRoleId(),
      roleName: "自定义角色",
      description: "新的自定义流程角色",
      selectedTagIds: { principles: [], capabilities: [], expressionStyles: [] },
      principles: [],
      generalSkills: [],
      specializedSkills: [],
      styleTraits: [],
      systemPrompt: "请定义这个角色在 OKR 拆解流程中的职责、边界和输出要求。",
      stylePrompt: "",
      enabled: true,
    });
    toast.success("已新增自定义角色");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          每个角色可以直接新增或搜索选用宪法性原则、专业能力和表达方式；新增内容会自动沉淀到标签库。流程所需 JSON 输出协议由系统统一控制。
        </p>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleAddRole}>
          <Plus className="h-3.5 w-3.5" />
          新增角色
        </Button>
      </div>
      {roles.map((role) => (
        <RoleEditor key={role.roleId} role={role} />
      ))}
    </div>
  );
}
