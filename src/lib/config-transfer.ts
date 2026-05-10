import type {
  AppConfig,
  FlowTemplate,
  ReviewWeightedRule,
  RoleConfig,
  RoleModelConfig,
  RoleSelectedTagIds,
  RoleTagItem,
  RoleTagLibraries,
} from "@/types";

export const CONFIG_EXPORT_SCHEMA = "okr-harness.config-export";
export const CONFIG_EXPORT_VERSION = 1;

export type ConfigExportKind =
  | "app-config"
  | "role"
  | "model"
  | "review-rule"
  | "flow-template"
  | "tag-libraries";

export interface ConfigExportEnvelope<T = unknown> {
  schema: typeof CONFIG_EXPORT_SCHEMA;
  version: typeof CONFIG_EXPORT_VERSION;
  kind: ConfigExportKind;
  name: string;
  exportedAt: string;
  payload: T;
  dependencies?: {
    tagLibraries?: RoleTagLibraries;
  };
}

export interface RoleExportPayload {
  role: RoleConfig;
}

export interface ModelExportPayload {
  roleId: string;
  roleName: string;
  model: RoleModelConfig;
}

export interface ReviewRuleExportPayload {
  rule: ReviewWeightedRule;
}

export interface FlowTemplateExportPayload {
  template: FlowTemplate;
}

const libraryKeys = ["principles", "capabilities", "expressionStyles"] as const;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function makeExportEnvelope<T>(
  kind: ConfigExportKind,
  name: string,
  payload: T,
  dependencies?: ConfigExportEnvelope<T>["dependencies"]
): ConfigExportEnvelope<T> {
  return {
    schema: CONFIG_EXPORT_SCHEMA,
    version: CONFIG_EXPORT_VERSION,
    kind,
    name,
    exportedAt: new Date().toISOString(),
    payload,
    ...(dependencies ? { dependencies } : {}),
  };
}

export function unwrapConfigImport(input: unknown): {
  kind?: ConfigExportKind;
  payload: unknown;
  dependencies?: ConfigExportEnvelope["dependencies"];
} {
  if (
    isRecord(input) &&
    input.schema === CONFIG_EXPORT_SCHEMA &&
    typeof input.kind === "string" &&
    "payload" in input
  ) {
    return {
      kind: input.kind as ConfigExportKind,
      payload: input.payload,
      dependencies: isRecord(input.dependencies)
        ? (input.dependencies as ConfigExportEnvelope["dependencies"])
        : undefined,
    };
  }

  return { payload: input };
}

export function safeFilePart(value: string): string {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 80) || "config";
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function copyJson(data: unknown) {
  await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
}

export function readJsonFile(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error("No file selected"));
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          resolve(JSON.parse(String(event.target?.result ?? "")));
        } catch {
          reject(new Error("Invalid JSON"));
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    };
    input.click();
  });
}

export function sanitizeModelForExport(model: RoleModelConfig): RoleModelConfig {
  return {
    ...model,
    apiKey: "",
  };
}

export function emptyRoleTagLibraries(): RoleTagLibraries {
  return { principles: [], capabilities: [], expressionStyles: [] };
}

export function selectedRoleTagLibraries(role: RoleConfig, libraries?: RoleTagLibraries): RoleTagLibraries {
  const source = { ...emptyRoleTagLibraries(), ...libraries };
  const selected = role.selectedTagIds ?? { principles: [], capabilities: [], expressionStyles: [] };
  return {
    principles: source.principles.filter((item) => selected.principles.includes(item.id)),
    capabilities: source.capabilities.filter((item) => selected.capabilities.includes(item.id)),
    expressionStyles: source.expressionStyles.filter((item) => selected.expressionStyles.includes(item.id)),
  };
}

function makeUniqueTagId(type: keyof RoleTagLibraries, name: string, existing: RoleTagItem[]): string {
  const slug =
    name
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

export function mergeRoleTagLibraries(
  current?: RoleTagLibraries,
  incoming?: RoleTagLibraries
): { libraries: RoleTagLibraries; idMap: RoleSelectedTagIds } {
  const result = { ...emptyRoleTagLibraries(), ...current };
  const source = { ...emptyRoleTagLibraries(), ...incoming };
  const idMap: RoleSelectedTagIds = { principles: [], capabilities: [], expressionStyles: [] };

  for (const key of libraryKeys) {
    const next = [...result[key]];
    const mapped: string[] = [];

    for (const item of source[key]) {
      const sameId = next.find((existing) => existing.id === item.id);
      if (sameId && sameId.name === item.name) {
        mapped.push(sameId.id);
        continue;
      }

      const sameName = next.find(
        (existing) => existing.name.trim().toLowerCase() === item.name.trim().toLowerCase()
      );
      if (sameName) {
        mapped.push(sameName.id);
        continue;
      }

      const id = sameId ? makeUniqueTagId(key, item.name, next) : item.id || makeUniqueTagId(key, item.name, next);
      next.unshift({ ...item, id });
      mapped.push(id);
    }

    result[key] = next;
    idMap[key] = mapped;
  }

  return { libraries: result, idMap };
}

export function remapSelectedTagIds(
  selected: RoleSelectedTagIds | undefined,
  importedLibraries: RoleTagLibraries | undefined,
  mergedLibraries: RoleTagLibraries
): RoleSelectedTagIds {
  const imported = { ...emptyRoleTagLibraries(), ...importedLibraries };
  const selectedIds = selected ?? { principles: [], capabilities: [], expressionStyles: [] };

  const mapOne = (key: keyof RoleTagLibraries): string[] =>
    selectedIds[key]
      .map((id) => {
        const importedItem = imported[key].find((item) => item.id === id);
        if (!importedItem) return mergedLibraries[key].some((item) => item.id === id) ? id : undefined;
        return mergedLibraries[key].find((item) => item.name === importedItem.name)?.id;
      })
      .filter((id): id is string => Boolean(id));

  return {
    principles: mapOne("principles"),
    capabilities: mapOne("capabilities"),
    expressionStyles: mapOne("expressionStyles"),
  };
}

export function roleListsFromSelectedTags(
  libraries: RoleTagLibraries,
  selected: RoleSelectedTagIds
): Pick<RoleConfig, "principles" | "generalSkills" | "specializedSkills" | "styleTraits"> {
  const label = (item: RoleTagItem) => `${item.name}：${item.definition}`;
  return {
    principles: libraries.principles.filter((item) => selected.principles.includes(item.id)).map(label),
    generalSkills: libraries.capabilities.filter((item) => selected.capabilities.includes(item.id)).map(label),
    specializedSkills: [],
    styleTraits: libraries.expressionStyles.filter((item) => selected.expressionStyles.includes(item.id)).map(label),
  };
}

export function upsertById<T extends { id: string }>(items: T[], incoming: T): T[] {
  return items.some((item) => item.id === incoming.id)
    ? items.map((item) => (item.id === incoming.id ? incoming : item))
    : [incoming, ...items];
}

export function upsertRoleById(roles: RoleConfig[], incoming: RoleConfig): RoleConfig[] {
  return roles.some((role) => role.roleId === incoming.roleId)
    ? roles.map((role) => (role.roleId === incoming.roleId ? incoming : role))
    : [...roles, incoming];
}

export function upsertReviewRuleById(rules: ReviewWeightedRule[], incoming: ReviewWeightedRule): ReviewWeightedRule[] {
  return rules.some((rule) => rule.id === incoming.id)
    ? rules.map((rule) => (rule.id === incoming.id ? incoming : rule))
    : [...rules, incoming];
}

export function configExportSummary(config: AppConfig) {
  return {
    roles: config.roles.length,
    models: config.roles.length,
    reviewRules: config.review.weightedRules?.length ?? 0,
    flowTemplates: config.flowTemplates.length,
  };
}
