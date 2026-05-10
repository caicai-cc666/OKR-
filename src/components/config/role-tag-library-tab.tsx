"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { RoleTagItem, RoleTagLibraries } from "@/types";
import { useAppStore } from "@/lib/store";
import { Plus, Trash2 } from "lucide-react";

type LibraryKey = keyof RoleTagLibraries;

const libraryMeta: Record<LibraryKey, { label: string; description: string; placeholder: string }> = {
  principles: {
    label: "宪法性原则",
    description: "适用于多个角色的底层约束、判断边界和不可违反原则。",
    placeholder: "例如：不遗漏用户原始表达中的任何关键信息",
  },
  capabilities: {
    label: "专业能力",
    description: "角色可以复用的能力模块、方法论、评估能力和执行技能。",
    placeholder: "例如：OKR 方法论、指标设计、信息结构化",
  },
  expressionStyles: {
    label: "表达方式",
    description: "角色输出时采用的语气、详略、结构和沟通风格。",
    placeholder: "例如：严谨、直接、建设性、透明",
  },
};

function emptyLibraries(): RoleTagLibraries {
  return { principles: [], capabilities: [], expressionStyles: [] };
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

function TagLibraryEditor({ type, items }: { type: LibraryKey; items: RoleTagItem[] }) {
  const saveConfig = useAppStore((s) => s.saveConfig);
  const tagLibraries = useAppStore((s) => s.config.tagLibraries);
  const currentLibraries = { ...emptyLibraries(), ...tagLibraries };
  const [name, setName] = useState("");
  const [definition, setDefinition] = useState("");
  const meta = libraryMeta[type];

  const updateItems = (nextItems: RoleTagItem[]) => {
    saveConfig({
      tagLibraries: {
        ...emptyLibraries(),
        ...currentLibraries,
        [type]: nextItems,
      },
    });
  };

  const handleAdd = () => {
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
    updateItems([
      {
        id: makeTagId(type, cleanName, items),
        name: cleanName,
        definition: cleanDefinition,
      },
      ...items,
    ]);
    setName("");
    setDefinition("");
    toast.success("标签已新增");
  };

  const handleUpdate = (id: string, partial: Partial<RoleTagItem>) => {
    updateItems(items.map((item) => (item.id === id ? { ...item, ...partial } : item)));
  };

  const handleDelete = (id: string) => {
    updateItems(items.filter((item) => item.id !== id));
    toast.success("标签已删除");
  };

  return (
    <div className="space-y-4">
      <Card className="sticky top-0 z-20 overflow-visible border-blue-200 bg-blue-50 shadow-sm before:absolute before:-top-6 before:left-0 before:right-0 before:h-6 before:bg-blue-50 before:content-['']">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{meta.label}</CardTitle>
          <CardDescription className="text-xs">
            {meta.description} 新增标签会显示在列表最上方。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-[220px_1fr_auto] gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={meta.placeholder}
              className="text-xs border-slate-200"
            />
            <Textarea
              value={definition}
              onChange={(e) => setDefinition(e.target.value)}
              placeholder="写清楚这条标签的详细定义、适用边界和使用方式"
              rows={2}
              className="text-xs border-slate-200 resize-none"
            />
            <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700" onClick={handleAdd}>
              <Plus className="w-3.5 h-3.5" />
              新增
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {items.map((item) => (
          <Card key={item.id} className="border-slate-200 shadow-sm">
            <CardContent className="p-3">
              <div className="grid grid-cols-1 md:grid-cols-[220px_1fr_auto] gap-2">
                <Input
                  value={item.name}
                  onChange={(e) => handleUpdate(item.id, { name: e.target.value })}
                  className="text-xs border-slate-200"
                />
                <Textarea
                  value={item.definition}
                  onChange={(e) => handleUpdate(item.id, { definition: e.target.value })}
                  rows={2}
                  className="text-xs border-slate-200 resize-none"
                />
                <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-600" onClick={() => handleDelete(item.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {items.length === 0 && (
          <p className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
            这个标签库还没有标签。
          </p>
        )}
      </div>
    </div>
  );
}

export function RoleTagLibraryTab({ libraries }: { libraries?: RoleTagLibraries }) {
  const safeLibraries = { ...emptyLibraries(), ...libraries };

  return (
    <Tabs defaultValue="principles" className="space-y-4">
      <TabsList className="bg-slate-100">
        {(Object.keys(libraryMeta) as LibraryKey[]).map((key) => (
          <TabsTrigger key={key} value={key} className="text-xs">
            {libraryMeta[key].label}
          </TabsTrigger>
        ))}
      </TabsList>
      {(Object.keys(libraryMeta) as LibraryKey[]).map((key) => (
        <TabsContent key={key} value={key}>
          <TagLibraryEditor type={key} items={safeLibraries[key]} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
