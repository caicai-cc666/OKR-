"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Download, Copy, CheckCircle2, RotateCcw } from "lucide-react";
import type { AppConfig } from "@/types";
import { useAppStore } from "@/lib/store";

export function JsonTab({ config }: { config: AppConfig }) {
  const [importText, setImportText] = useState("");
  const [exportType, setExportType] = useState<"roles" | "models" | "review" | "flow" | "all">("all");
  const saveConfig = useAppStore((s) => s.saveConfig);
  const resetConfig = useAppStore((s) => s.resetConfig);

  function getExportData() {
    switch (exportType) {
      case "roles": return { roles: config.roles };
      case "models": return { roles: config.roles.map(r => ({ roleId: r.roleId, model: r.model })) };
      case "review": return { review: config.review };
      case "flow": return { flowTemplates: config.flowTemplates };
      case "all": return config;
    }
  }

  const exportJson = JSON.stringify(getExportData(), null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(exportJson);
    toast.success("已复制到剪贴板");
  };

  const handleDownload = () => {
    const blob = new Blob([exportJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `okr-config-${exportType}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("文件已下载");
  };

  const handleImport = () => {
    if (!importText.trim()) { toast.error("请粘贴或上传 JSON 内容"); return; }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(importText);
    } catch {
      toast.error("JSON 格式错误，请检查语法");
      return;
    }

    // Merge into config based on what fields exist
    const partial: Partial<AppConfig> = {};
    if (parsed.roles && Array.isArray(parsed.roles)) {
      partial.roles = parsed.roles as AppConfig["roles"];
    }
    if (parsed.review && typeof parsed.review === "object") {
      partial.review = parsed.review as AppConfig["review"];
    }
    if (parsed.flowTemplates && Array.isArray(parsed.flowTemplates)) {
      partial.flowTemplates = parsed.flowTemplates as AppConfig["flowTemplates"];
    }

    if (Object.keys(partial).length === 0) {
      toast.error("JSON 中未找到可识别的配置字段（roles / review / flowTemplates）");
      return;
    }

    saveConfig(partial);
    setImportText("");
    toast.success(`配置已导入：${Object.keys(partial).join(", ")}`);
  };

  const handleUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          setImportText(ev.target?.result as string);
          toast.success("文件已加载，请点击「验证并导入」");
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleReset = () => {
    resetConfig();
    toast.success("已恢复系统默认配置");
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="export" className="space-y-4">
        <TabsList className="bg-slate-100">
          <TabsTrigger value="export" className="gap-1.5 text-xs">
            <Download className="w-3.5 h-3.5" />导出
          </TabsTrigger>
          <TabsTrigger value="import" className="gap-1.5 text-xs">
            <Upload className="w-3.5 h-3.5" />导入
          </TabsTrigger>
        </TabsList>

        <TabsContent value="export">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">导出配置</CardTitle>
              <CardDescription className="text-xs">
                选择要导出的配置范围，然后复制 JSON 或下载文件
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                {(["all", "roles", "models", "review", "flow"] as const).map((t) => (
                  <Button
                    key={t}
                    variant={exportType === t ? "default" : "outline"}
                    size="sm"
                    className={`text-xs ${exportType === t ? "bg-blue-600" : ""}`}
                    onClick={() => setExportType(t)}
                  >
                    {{ all: "全部", roles: "角色", models: "模型", review: "审核", flow: "流程" }[t]}
                  </Button>
                ))}
              </div>
              <Textarea value={exportJson} readOnly rows={16} className="font-mono text-xs border-slate-200 bg-slate-50" />
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleCopy}>
                  <Copy className="w-3.5 h-3.5" />复制 JSON
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleDownload}>
                  <Download className="w-3.5 h-3.5" />下载文件
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">导入配置</CardTitle>
              <CardDescription className="text-xs">
                粘贴 JSON 或上传文件导入配置。导入将覆盖对应范围的现有配置。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={"在此粘贴 JSON 配置...\n\n支持导入：角色配置、模型配置、审核规则、流程配置"}
                rows={12}
                className="font-mono text-xs border-slate-200"
              />
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleUpload}>
                  <Upload className="w-3.5 h-3.5" />上传文件
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-700"
                  disabled={!importText.trim()}
                  onClick={handleImport}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />验证并导入
                </Button>
                <div className="flex-1" />
                <Button variant="outline" size="sm" className="gap-1.5 text-xs text-amber-600 border-amber-200" onClick={handleReset}>
                  <RotateCcw className="w-3.5 h-3.5" />恢复系统默认
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
