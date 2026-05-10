import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { OkrCase, CaseLogEntry, FlowNodeRun, CaseStatus, AppConfig, OkrDraftSet, OkrDraftVersion, FactPack, FlowLoopSettings, ReviewReport, ReviewObjectiveResult, CaseRunEvent, CaseRunStage, CandidateKr, UserAccount, Tenant, TenantMembership, AccountRole, Permission, RoleConfig } from "@/types";
import { canReadCaseForAccount, CaseStatus as CS, roleHasPermission } from "@/types";
import { mockCases } from "@/data/mock-cases";
import { mockConfig } from "@/data/mock-config";
import { DEFAULT_TENANT_ID, DEFAULT_USER_ID, PLATFORM_TENANT_ID, mockMemberships, mockTenants, mockUsers } from "@/data/mock-accounts";
import { transition } from "@/lib/state-machine";
import { runInformationStructuringAgent, runDecompositionAgent, runReviewerAgent, describeRoleRuntimeConfig } from "@/lib/ai/agents";

// ---- Helpers ----

const IGNORED_MISSING_PREFIX = "ignoredMissing:";

const DEFAULT_LOOP_SETTINGS: FlowLoopSettings = {
  outerLoop: { enabled: true, maxIterations: 5 },
  infoCheckLoop: { enabled: true, maxIterations: 3 },
  okrReviewLoop: {
    enabled: true,
    passThreshold: 85,
    stopConditionMode: "or",
    maxIterationsEnabled: true,
    maxIterations: 3,
    maxTokensEnabled: true,
    maxTokens: 24000,
    timeoutEnabled: true,
    timeoutSeconds: 180,
  },
};

function cloneConfig(config: AppConfig): AppConfig {
  return JSON.parse(JSON.stringify(config)) as AppConfig;
}

function ensureRoleModel(role: RoleConfig, config: AppConfig): RoleConfig {
  if (role.model) return role;
  const fallbackModel =
    config.roles.find((item) => item.roleId === "coordinator")?.model ??
    config.roles[0]?.model ??
    mockConfig.roles[0].model;
  return {
    ...role,
    model: JSON.parse(JSON.stringify(fallbackModel)) as RoleConfig["model"],
  };
}

function createDefaultTenantConfigs(config: AppConfig = mockConfig): Record<string, AppConfig> {
  return Object.fromEntries(mockTenants.map((tenant) => [tenant.id, cloneConfig(config)]));
}

function normalizeCasesForTenant(cases: OkrCase[]): OkrCase[] {
  return cases.map((item) => ({
    ...item,
    tenantId: item.tenantId ?? DEFAULT_TENANT_ID,
    createdByUserId: item.createdByUserId ?? DEFAULT_USER_ID,
  }));
}

function getActiveMembership(
  memberships: TenantMembership[],
  userId: string | undefined,
  tenantId: string | undefined
): TenantMembership | undefined {
  if (!userId) return undefined;
  const exact = memberships.find(
    (item) =>
      item.userId === userId &&
      item.status === "active" &&
      item.tenantId === tenantId
  );
  if (exact) return exact;
  return memberships.find(
    (item) =>
      item.userId === userId &&
      item.status === "active" &&
      item.tenantId === PLATFORM_TENANT_ID &&
      item.role === "platform_owner"
  );
}

function mkId() {
  return `case-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function mkLog(action: string, actor: string, detail?: string): CaseLogEntry {
  return {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    action,
    actor,
    detail,
  };
}

function mkRunId() {
  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function mkRunEvent(runId: string, event: Omit<CaseRunEvent, "id" | "runId" | "timestamp">): CaseRunEvent {
  return {
    id: `event-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    runId,
    timestamp: new Date().toISOString(),
    ...event,
  };
}

function updateNodeRun(runs: FlowNodeRun[], nodeId: string, status: FlowNodeRun["status"]): FlowNodeRun[] {
  const now = new Date().toISOString();
  const existing = runs.find((r) => r.nodeId === nodeId);
  if (existing) {
    return runs.map((r) =>
      r.nodeId === nodeId
        ? {
            ...r,
            status,
            ...(status === "running" ? { startedAt: now } : {}),
            ...(status === "success" || status === "failed" ? { completedAt: now } : {}),
          }
        : r
    );
  }
  return [
    ...runs,
    {
      nodeId,
      roleName: nodeId,
      status,
      ...(status === "running" ? { startedAt: now } : {}),
    },
  ];
}

function withDefaultOwners(drafts: OkrDraftSet, owner: string): OkrDraftSet {
  const patchVersion = <T extends OkrDraftSet[keyof OkrDraftSet]>(version: T): T => ({
    ...version,
    objectives: version.objectives.map((objective) => ({
      ...objective,
      keyResults: objective.keyResults.map((kr) => ({
        ...kr,
        owner: kr.owner?.trim() ? kr.owner : owner,
      })),
    })),
  });

  return {
    conservative: patchVersion(drafts.conservative),
    balanced: patchVersion(drafts.balanced),
    aggressive: patchVersion(drafts.aggressive),
  };
}

function hasHighPriorityMissing(missingInfo: OkrCase["missingInfo"] | null): boolean {
  return missingInfo?.missingFields.some((field) => field.priority === "high") ?? false;
}

function ignoredMissingFields(c: OkrCase): Set<string> {
  return new Set(
    c.tags
      .filter((tag) => tag.startsWith(IGNORED_MISSING_PREFIX))
      .map((tag) => {
        try {
          return decodeURIComponent(tag.slice(IGNORED_MISSING_PREFIX.length));
        } catch {
          return tag.slice(IGNORED_MISSING_PREFIX.length);
        }
      })
  );
}

function filterIgnoredMissingInfo(missingInfo: OkrCase["missingInfo"] | null, c: OkrCase): OkrCase["missingInfo"] | null {
  if (!missingInfo) return missingInfo;
  const ignored = ignoredMissingFields(c);
  if (ignored.size === 0) return missingInfo;
  return {
    ...missingInfo,
    missingFields: missingInfo.missingFields.filter((field) => !ignored.has(field.field)),
  };
}

function summarizeList(items: string[] | undefined, fallback = "暂未识别"): string {
  const values = (items ?? []).map((item) => item.trim()).filter(Boolean);
  return values.length ? values.slice(0, 4).join("；") : fallback;
}

function summarizeFactPack(factPack: NonNullable<OkrCase["factPack"]>): string {
  const d = factPack.structuredDimensions;
  if (d) {
    return [
      `业务背景：${factPack.businessContext || "暂未识别"}`,
      `战略背景：${summarizeList(d.strategicBackground)}`,
      `业务现状：${summarizeList(d.businessStatus)}`,
      `业务链路：${summarizeList(d.businessChain)}`,
      `问题瓶颈：${summarizeList(d.bottlenecks)}`,
      `资源与约束：${summarizeList(d.resourcesConstraints)}`,
      `组织分工：${summarizeList(d.organization)}`,
      `客户市场：${summarizeList(d.customerMarket)}`,
      `时间与成功标准：${summarizeList(d.timeSuccessCriteria)}`,
      `其他补充：${summarizeList(d.other)}`,
    ].join("\n");
  }
  return [
    `业务背景：${factPack.businessContext || "暂未识别"}`,
    `战略目标：${summarizeList(factPack.strategicGoals)}`,
    `当前挑战：${summarizeList(factPack.currentChallenges)}`,
    `基线：${summarizeList(factPack.baselines)}`,
    `候选指标：${summarizeList(factPack.candidateMetrics)}`,
    `约束条件：${summarizeList(factPack.constraints)}`,
    `Owner/干系人：${summarizeList(factPack.stakeholders)}`,
  ].join("\n");
}

function summarizeMissingInfo(missingInfo: OkrCase["missingInfo"] | null): string {
  const fields = missingInfo?.missingFields ?? [];
  if (fields.length === 0) return "未发现需要补充的信息。";
  return fields
    .map((field) => {
      const priority = field.priority === "high" ? "必要/阻塞" : field.priority === "medium" ? "建议补充" : "可选补充";
      return `- [${priority}] ${field.field}：${field.reason}${field.suggestion ? ` 建议：${field.suggestion}` : ""}`;
    })
    .join("\n");
}

function summarizeDraftsForRunEvent(drafts: OkrDraftSet): string {
  return draftVersions(drafts)
    .map((draft) => {
      const objectives = draft.objectives
        .map((objective, objectiveIndex) => {
          const krs = objective.keyResults
            .map((kr, krIndex) => {
              const meta = [
                kr.metric ? `指标：${kr.metric}` : "",
                kr.currentValue ? `基线：${kr.currentValue}` : "",
                kr.targetValue ? `目标：${kr.targetValue}` : "",
                kr.reasoning ? `拆解理由：${kr.reasoning}` : "",
              ].filter(Boolean).join("；");
              return `  ${krIndex + 1}. ${kr.title}${meta ? `\n     ${meta}` : ""}`;
            })
            .join("\n");
          return `O${objectiveIndex + 1}：${objective.title}\n${krs || "  暂无 KR"}`;
        })
        .join("\n\n");
      return `【${draft.variant}】\n${objectives || "暂无 Objective"}\n版本理由：${draft.reasoning || "暂无"}`;
    })
    .join("\n\n");
}

function summarizeReviewForRunEvent(review: ReviewReport, passThreshold: number): string {
  const objectiveLines = review.objectiveResults?.length
    ? review.objectiveResults.map((item) =>
        `- O${item.objectiveIndex + 1}：${item.passed ? "通过" : "未通过"}，${item.passedKrCount}/${item.totalKrCount} 条 KR 达到阈值，均分 ${item.score}/100`
      ).join("\n")
    : "暂无 Objective 级审核结果";
  const krLines = review.krReviews?.length
    ? review.krReviews.map((item) =>
        `- ${item.objectiveTitle ? `${item.objectiveTitle} / ` : ""}${item.krId}：${item.score}/100，${item.passed ? "通过" : "未通过"}${item.summary ? `；${item.summary}` : ""}`
      ).join("\n")
    : "暂无逐条 KR 审核结果";

  return [
    `整体结论：${review.passed ? "通过" : "未通过"}，判定依据为每个 Objective 至少 4 条 KR 达到 ${passThreshold} 分；整体均分 ${review.overallScore}/100 仅作质量参考`,
    `Objective 审核：\n${objectiveLines}`,
    `逐条 KR 审核：\n${krLines}`,
    review.fatalIssues.length ? `主要问题：\n${review.fatalIssues.map((item) => `- ${item}`).join("\n")}` : "",
    review.suggestions.length ? `改进建议：\n${review.suggestions.map((item) => `- ${item}`).join("\n")}` : "",
  ].filter(Boolean).join("\n\n");
}

function finalFromDrafts(drafts: OkrDraftSet, version: number) {
  return {
    objectives: drafts.balanced.objectives,
    finalizedAt: new Date().toISOString(),
    finalizedBy: "协调器",
    version,
  };
}

function flowLoopSettings(config: AppConfig, c?: OkrCase): FlowLoopSettings {
  const template = config.flowTemplates.find((item) => item.id === c?.flowTemplateId)
    ?? config.flowTemplates.find((item) => item.isDefault);
  return {
    ...DEFAULT_LOOP_SETTINGS,
    ...template?.loopSettings,
    outerLoop: { ...DEFAULT_LOOP_SETTINGS.outerLoop, ...template?.loopSettings?.outerLoop },
    infoCheckLoop: { ...DEFAULT_LOOP_SETTINGS.infoCheckLoop, ...template?.loopSettings?.infoCheckLoop },
    okrReviewLoop: { ...DEFAULT_LOOP_SETTINGS.okrReviewLoop, ...template?.loopSettings?.okrReviewLoop },
  };
}

function estimateTokens(value: unknown): number {
  return Math.ceil(JSON.stringify(value).length / 4);
}

function shouldStopReviewLoop(settings: FlowLoopSettings, iteration: number, startedAt: number, tokenCount: number): boolean {
  const loop = settings.okrReviewLoop;
  const checks = [
    loop.maxIterationsEnabled ? iteration >= loop.maxIterations : undefined,
    loop.maxTokensEnabled ? tokenCount >= loop.maxTokens : undefined,
    loop.timeoutEnabled ? (Date.now() - startedAt) / 1000 >= loop.timeoutSeconds : undefined,
  ].filter((item): item is boolean => item !== undefined);
  if (checks.length === 0) return iteration >= settings.outerLoop.maxIterations;
  return loop.stopConditionMode === "and" ? checks.every(Boolean) : checks.some(Boolean);
}

function reviewLoopStopReason(settings: FlowLoopSettings, iteration: number, startedAt: number, tokenCount: number): string {
  const loop = settings.okrReviewLoop;
  const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
  const reasons = [
    loop.maxIterationsEnabled && iteration >= loop.maxIterations ? `达到最大循环次数 ${loop.maxIterations}` : "",
    loop.maxTokensEnabled && tokenCount >= loop.maxTokens ? `达到最大 Token 数 ${loop.maxTokens}` : "",
    loop.timeoutEnabled && elapsedSeconds >= loop.timeoutSeconds ? `达到超时时间 ${loop.timeoutSeconds}s` : "",
  ].filter(Boolean);
  return reasons.length ? reasons.join("；") : `达到外层安全循环上限 ${settings.outerLoop.maxIterations}`;
}

function hasCompleteReviewerScores(review: ReviewReport): boolean {
  return Boolean(review.krReviews?.length) && review.krReviews!.every((item) => item.source === "reviewer");
}

function draftVersions(drafts: OkrDraftSet): OkrDraftVersion[] {
  return [drafts.conservative, drafts.balanced, drafts.aggressive];
}

function objectiveCount(drafts: OkrDraftSet): number {
  return Math.max(...draftVersions(drafts).map((version) => version.objectives.length), 0);
}

function draftSubsetForObjective(drafts: OkrDraftSet, objectiveIndex: number): OkrDraftSet {
  const pick = (version: OkrDraftVersion): OkrDraftVersion => ({
    ...version,
    objectives: version.objectives[objectiveIndex] ? [version.objectives[objectiveIndex]] : [],
  });
  return {
    conservative: pick(drafts.conservative),
    balanced: pick(drafts.balanced),
    aggressive: pick(drafts.aggressive),
  };
}

function mergeLockedObjectives(nextDrafts: OkrDraftSet, lockedDrafts: OkrDraftSet | undefined, lockedIndexes: Set<number>): OkrDraftSet {
  if (!lockedDrafts || lockedIndexes.size === 0) return nextDrafts;
  const mergeVersion = (next: OkrDraftVersion, locked: OkrDraftVersion): OkrDraftVersion => {
    const objectives = [...next.objectives];
    lockedIndexes.forEach((objectiveIndex) => {
      if (locked.objectives[objectiveIndex]) {
        objectives[objectiveIndex] = locked.objectives[objectiveIndex];
      }
    });
    return { ...next, objectives };
  };
  return {
    conservative: mergeVersion(nextDrafts.conservative, lockedDrafts.conservative),
    balanced: mergeVersion(nextDrafts.balanced, lockedDrafts.balanced),
    aggressive: mergeVersion(nextDrafts.aggressive, lockedDrafts.aggressive),
  };
}

function objectiveResultsFromKrReviews(krReviews: NonNullable<ReviewReport["krReviews"]>, passThreshold: number): ReviewObjectiveResult[] {
  const objectiveIndexes = [...new Set(krReviews.map((item) => item.objectiveIndex ?? 0))].sort((a, b) => a - b);
  return objectiveIndexes.map((objectiveIndex) => {
    const items = krReviews.filter((item) => (item.objectiveIndex ?? 0) === objectiveIndex);
    const officialItems = items.filter((item) => item.source === "reviewer");
    const score = items.length
      ? Math.round(items.reduce((sum, item) => sum + (item.source === "reviewer" ? item.score : 0), 0) / items.length)
      : 0;
    const passedKrCount = officialItems.filter((item) => item.score >= passThreshold || item.passed).length;
    return {
      objectiveIndex,
      objectiveTitle: items[0]?.objectiveTitle ?? `Objective ${objectiveIndex + 1}`,
      score,
      passed: officialItems.length === items.length && items.length > 0 && passedKrCount >= Math.min(4, items.length),
      passedKrCount,
      totalKrCount: items.length,
      reason: `${passedKrCount}/${items.length} 条 KR 达到阈值`,
    };
  });
}

function combineObjectiveReviewReports(
  reports: ReviewReport[],
  passThreshold: number,
  reviewerName: string,
  config: AppConfig
): ReviewReport {
  const krReviews = reports.flatMap((report) => report.krReviews ?? []);
  const objectiveResults = objectiveResultsFromKrReviews(krReviews, passThreshold);
  const overallScore = krReviews.length
    ? Math.round(krReviews.reduce((sum, item) => sum + (item.source === "reviewer" ? item.score : 0), 0) / krReviews.length)
    : 0;
  const passed = objectiveResults.length > 0 && objectiveResults.every((item) => item.passed);
  const fatalIssues = reports.flatMap((report) => report.fatalIssues).filter(Boolean);
  return {
    overallScore,
    passed,
    needsHumanReview: config.review.humanReviewEnabled && !passed && overallScore >= config.review.humanReviewThreshold,
    objectiveResults,
    variantResults: reports.flatMap((report) => report.variantResults ?? []),
    krReviews,
    prerequisites: reports[0]?.prerequisites ?? [],
    coreDimensions: reports.flatMap((report) => report.coreDimensions ?? []),
    auxDimensions: reports.flatMap((report) => report.auxDimensions ?? []),
    fatalIssues: passed
      ? fatalIssues.filter((issue) => !issue.includes("未满足每个 Objective"))
      : [
          ...fatalIssues,
          `Objective 通过情况：${objectiveResults.map((item) => `O${item.objectiveIndex + 1} ${item.passedKrCount}/${item.totalKrCount}`).join("；")}`,
        ],
    suggestions: [...new Set(reports.flatMap((report) => report.suggestions))],
    reviewedAt: new Date().toISOString(),
    reviewedBy: reviewerName,
  };
}

function objectiveStatusLine(review: ReviewReport): string {
  const items = review.objectiveResults ?? [];
  if (!items.length) return "未获得 Objective 级审核结果";
  return items.map((item) =>
    `O${item.objectiveIndex + 1} ${item.passedKrCount}/${item.totalKrCount}${item.passed ? " 通过" : " 未通过"}`
  ).join("，");
}

function reviewDecisionLine(review: ReviewReport, passThreshold: number, mode: "live" | "mock"): string {
  const items = review.objectiveResults ?? [];
  const objectiveLine = items.length
    ? items.map((item) =>
        `O${item.objectiveIndex + 1} ${item.passed ? "通过" : "未通过"}（${item.passedKrCount}/${item.totalKrCount} KR 达到 ${passThreshold} 分）`
      ).join("；")
    : "未获得 Objective 级审核结果";
  return `${objectiveLine}；整体均分 ${review.overallScore}/100，仅作质量参考（${mode}）`;
}

function flowError(err: unknown): string {
  return err instanceof Error ? err.message : "未知错误";
}

// ---- Store interface ----

interface AppStore {
  // --- State ---
  cases: OkrCase[];
  config: AppConfig;
  tenantConfigs: Record<string, AppConfig>;
  users: UserAccount[];
  tenants: Tenant[];
  memberships: TenantMembership[];
  currentUserId: string;
  currentTenantId: string;

  // --- Account reads/actions ---
  getCurrentUser: () => UserAccount | undefined;
  getCurrentTenant: () => Tenant | undefined;
  getCurrentMembership: () => TenantMembership | undefined;
  getCurrentRole: () => AccountRole | undefined;
  hasPermission: (permission: Permission) => boolean;
  getVisibleCases: () => OkrCase[];
  loginAs: (userId: string, tenantId?: string) => void;
  applyServerSession: (session: {
    user: UserAccount;
    tenants: Tenant[];
    memberships: TenantMembership[];
    currentTenantId: string;
  }) => void;
  logoutLocal: () => void;
  switchTenant: (tenantId: string) => void;

  // --- Case reads ---
  getCase: (id: string) => OkrCase | undefined;

  // --- Case actions ---
  createCase: (title: string, team: string, cycle: string, rawText: string, flowTemplateId?: string) => string;
  updateCase: (id: string, partial: Partial<OkrCase>) => void;
  startAnalysis: (caseId: string) => void;
  startDecomposition: (caseId: string) => void;
  retryDecomposition: (caseId: string, supplement?: string) => void;
  transitionStatus: (caseId: string, to: CaseStatus) => void;
  addLog: (caseId: string, action: string, actor: string, detail?: string) => void;
  addRunEvent: (caseId: string, event: CaseRunEvent) => void;
  updateFlowNode: (caseId: string, nodeId: string, status: FlowNodeRun["status"], error?: string) => void;
  switchFlowTemplate: (caseId: string, templateId: string) => void;
  supplementInfo: (caseId: string, field: string, value: string) => void;
  ignoreMissingField: (caseId: string, field: string, reason?: string) => void;
  toggleCandidateKr: (caseId: string, candidate: CandidateKr) => void;
  rerunNode: (caseId: string, nodeId: string) => "started" | "unsupported" | "no-data" | "error";

  // --- Config actions ---
  saveConfig: (partial: Partial<AppConfig>) => void;
  resetConfig: () => void;
  updateRoleConfig: (roleId: string, partial: Record<string, unknown>) => void;
  addRoleConfig: (role: import("@/types").RoleConfig) => void;
  deleteRoleConfig: (roleId: string) => void;
  updateModelConfig: (roleId: string, partial: Record<string, unknown>) => void;
  updateReviewConfig: (partial: Record<string, unknown>) => void;
  addFlowTemplate: (template: import("@/types").FlowTemplate) => void;
  updateFlowTemplate: (id: string, partial: Partial<import("@/types").FlowTemplate>) => void;
  deleteFlowTemplate: (id: string) => void;
  setDefaultFlowTemplate: (id: string) => void;
}

function withCurrentTenantConfig(s: AppStore, config: AppConfig): Partial<AppStore> {
  return {
    config,
    tenantConfigs: {
      ...s.tenantConfigs,
      [s.currentTenantId || DEFAULT_TENANT_ID]: config,
    },
  };
}

function isActiveRun(store: AppStore, caseId: string, runId?: string): boolean {
  if (!runId) return true;
  return store.getCase(caseId)?.activeRunId === runId;
}

function guardedUpdateCase(store: AppStore, caseId: string, runId: string | undefined, partial: Partial<OkrCase>): boolean {
  if (!isActiveRun(store, caseId, runId)) return false;
  store.updateCase(caseId, partial);
  return true;
}

function guardedAddLog(store: AppStore, caseId: string, runId: string | undefined, action: string, actor: string, detail?: string): boolean {
  if (!isActiveRun(store, caseId, runId)) return false;
  store.addLog(caseId, action, actor, detail);
  return true;
}

function guardedUpdateFlowNode(store: AppStore, caseId: string, runId: string | undefined, nodeId: string, status: FlowNodeRun["status"], error?: string): boolean {
  if (!isActiveRun(store, caseId, runId)) return false;
  store.updateFlowNode(caseId, nodeId, status, error);
  return true;
}

function guardedAddRunEvent(
  store: AppStore,
  caseId: string,
  runId: string | undefined,
  event: Omit<CaseRunEvent, "id" | "runId" | "timestamp">
): boolean {
  if (!runId || !isActiveRun(store, caseId, runId)) return false;
  store.addRunEvent(caseId, mkRunEvent(runId, event));
  return true;
}

function beginCaseRun(store: AppStore, caseId: string, stage: CaseRunStage, message: string): string | null {
  const c = store.getCase(caseId);
  if (!c) return null;
  if (c.runStatus === "running" && c.runStage !== "waiting_for_info") {
    store.addLog(caseId, "流程进行中", "系统", "当前案例已有拆解流程正在执行，请等待本轮结束后再操作。");
    return null;
  }
  const runId = mkRunId();
  store.updateCase(caseId, {
    activeRunId: runId,
    runStatus: "running",
    runStage: stage,
    runStatusMessage: message,
  });
  store.addRunEvent(caseId, mkRunEvent(runId, {
    kind: "system",
    actor: "系统",
    title: "流程启动",
    summary: message,
  }));
  return runId;
}

function setRunStage(store: AppStore, caseId: string, runId: string, stage: CaseRunStage, message: string): boolean {
  return guardedUpdateCase(store, caseId, runId, {
    runStage: stage,
    runStatusMessage: message,
  });
}

function finishCaseRun(
  store: AppStore,
  caseId: string,
  runId: string | undefined,
  status: NonNullable<OkrCase["runStatus"]>,
  message: string
): boolean {
  return guardedUpdateCase(store, caseId, runId, {
    activeRunId: undefined,
    runStatus: status,
    runStage: status === "running" ? "idle" : status === "failed_no_result" ? "failed" : "completed",
    runStatusMessage: message,
  });
}

async function runOkrReviewLoop({
  caseId,
  factPack,
  title,
  team,
  config,
  store,
  runId,
  initialDrafts,
  initialDraftMode,
}: {
  caseId: string;
  factPack: FactPack;
  title: string;
  team: string;
  config: AppConfig;
  store: AppStore;
  runId?: string;
  initialDrafts?: OkrDraftSet;
  initialDraftMode?: "live" | "mock";
}) {
  const settings = flowLoopSettings(config, store.getCase(caseId));
  const expertName = config.roles.find((r) => r.roleId === "okr-expert")?.roleName ?? "OKR 拆解专家";
  const reviewerName = config.roles.find((r) => r.roleId === "reviewer")?.roleName ?? "审核官";
  const startedAt = Date.now();
  let tokenCount = 0;
  let iteration = 0;
  let drafts = initialDrafts;
  let draftMode = initialDraftMode;
  let bestFailedDrafts: OkrDraftSet | undefined;
  let bestFailedReview: ReviewReport | undefined;
  let bestFailedScore = -1;
  let bestFailedIteration = 0;
  let lockedDrafts: OkrDraftSet | undefined;
  const lockedObjectiveIndexes = new Set<number>();
  const lockedObjectiveReviews = new Map<number, ReviewReport>();

  while (true) {
    if (!isActiveRun(store, caseId, runId)) return;
    iteration += 1;
    if (!drafts) {
      setRunStage(store, caseId, runId ?? "", iteration > 1 ? "looping" : "decomposing", iteration > 1 ? `第 ${iteration} 轮自动重拆中` : "OKR 拆解中");
      guardedUpdateFlowNode(store, caseId, runId, "decompose", "running");
      try {
        const draftResult = await runDecompositionAgent(factPack, title, config, settings);
        if (!isActiveRun(store, caseId, runId)) return;
        const generatedDrafts = withDefaultOwners(draftResult.drafts, team);
        drafts = mergeLockedObjectives(generatedDrafts, lockedDrafts, lockedObjectiveIndexes);
        draftMode = draftResult.mode;
      } catch (err) {
        const message = flowError(err);
        if (!isActiveRun(store, caseId, runId)) return;
        guardedUpdateFlowNode(store, caseId, runId, "decompose", "failed", message);
        guardedUpdateFlowNode(store, caseId, runId, "review", "skipped");
        guardedUpdateFlowNode(store, caseId, runId, "finalize", "skipped");
        guardedUpdateCase(store, caseId, runId, {
          okrDrafts: undefined,
          reviewReport: undefined,
          status: CS.REVIEW_FAILED,
        });
        guardedAddLog(store, caseId, runId, "OKR 拆解失败", expertName, message);
        guardedAddRunEvent(store, caseId, runId, {
          kind: "okr-expert",
          actor: expertName,
          title: "OKR 拆解失败",
          summary: "未生成可用 OKR 草稿",
          detail: message,
          iteration,
        });
        guardedAddLog(store, caseId, runId, "审核跳过", "协调器", "拆解输出不可用，未进入质量审核。请检查模型配置、补充业务背景或重新生成。");
        finishCaseRun(store, caseId, runId, "failed_no_result", "运行失败 · 无任何结果");
        return;
      }
    }

    tokenCount += estimateTokens(drafts);
    guardedUpdateFlowNode(store, caseId, runId, "decompose", "success");
    guardedUpdateCase(store, caseId, runId, { okrDrafts: drafts, status: CS.OKR_DRAFT_GENERATED });
    guardedAddLog(
      store,
      caseId,
      runId,
      iteration === 1 ? "拆解完成" : "循环拆解完成",
      expertName,
      `第 ${iteration} 轮 OKR 草稿已生成 (${draftMode ?? "mock"})${lockedObjectiveIndexes.size ? `；已保留通过的 Objective：${[...lockedObjectiveIndexes].map((idx) => `O${idx + 1}`).join("、")}` : ""}`
    );
    guardedAddRunEvent(store, caseId, runId, {
      kind: "okr-expert",
      actor: expertName,
      title: iteration === 1 ? "生成 OKR 草稿" : "循环重拆 OKR 草稿",
      summary: `第 ${iteration} 轮 OKR 草稿已生成`,
      detail: [
        `Objective 数量：${objectiveCount(drafts)}；${lockedObjectiveIndexes.size ? `已保留通过的 Objective：${[...lockedObjectiveIndexes].map((idx) => `O${idx + 1}`).join("、")}` : "暂无锁定 Objective"}`,
        summarizeDraftsForRunEvent(drafts),
      ].join("\n\n"),
      iteration,
    });

    setRunStage(store, caseId, runId ?? "", "reviewing", "质量审核中");
    guardedUpdateFlowNode(store, caseId, runId, "review", "running");
    let reviewResult: Awaited<ReturnType<typeof runReviewerAgent>>;
    const objectiveReviewReports = new Map<number, ReviewReport>();
    try {
      const reports: ReviewReport[] = [];
      const modes = new Set<"live" | "mock">();
      const count = objectiveCount(drafts);
      for (let objectiveIndex = 0; objectiveIndex < count; objectiveIndex += 1) {
        const lockedReview = lockedObjectiveReviews.get(objectiveIndex);
        if (lockedObjectiveIndexes.has(objectiveIndex) && lockedReview) {
          reports.push(lockedReview);
          objectiveReviewReports.set(objectiveIndex, lockedReview);
          continue;
        }
        const singleObjectiveDrafts = draftSubsetForObjective(drafts, objectiveIndex);
        const singleReview = await runReviewerAgent(singleObjectiveDrafts, config, settings, objectiveIndex);
        if (!isActiveRun(store, caseId, runId)) return;
        reports.push(singleReview.review);
        modes.add(singleReview.mode);
        objectiveReviewReports.set(objectiveIndex, singleReview.review);
      }
      reviewResult = {
        review: combineObjectiveReviewReports(reports, settings.okrReviewLoop.passThreshold, reviewerName, config),
        mode: modes.has("mock") ? "mock" : "live",
      };
    } catch (err) {
      const message = flowError(err);
      if (!isActiveRun(store, caseId, runId)) return;
      guardedUpdateFlowNode(store, caseId, runId, "review", "failed", message);
      guardedUpdateFlowNode(store, caseId, runId, "finalize", "skipped");
      if (bestFailedDrafts && bestFailedReview) {
        guardedUpdateCase(store, caseId, runId, {
          okrDrafts: bestFailedDrafts,
          reviewReport: bestFailedReview,
          status: CS.REVIEW_FAILED,
        });
        guardedAddLog(
          store,
          caseId,
          runId,
          "保留最高分草稿",
          "协调器",
          `审核调用失败前已有正式审核结果，已回填第 ${bestFailedIteration} 轮最高分草稿用于展示：${bestFailedScore}/100`
        );
      } else {
        guardedUpdateCase(store, caseId, runId, {
          okrDrafts: drafts,
          reviewReport: undefined,
          status: CS.REVIEW_FAILED,
        });
      }
      guardedAddLog(store, caseId, runId, "审核失败", reviewerName, `审核官 live 调用失败，未回退 mock：${message}`);
      guardedAddRunEvent(store, caseId, runId, {
        kind: "reviewer",
        actor: reviewerName,
        title: "质量审核失败",
        summary: "审核官调用失败，未获得可信审核结果",
        detail: message,
        iteration,
      });
      finishCaseRun(store, caseId, runId, bestFailedDrafts ? "completed_quality_failed" : "failed_no_result", bestFailedDrafts ? "已结束 · 质量未达标" : "运行失败 · 无任何结果");
      return;
    }
    const formalReview = reviewResult.mode === "live" && hasCompleteReviewerScores(reviewResult.review);
    if (formalReview && !reviewResult.review.passed && reviewResult.review.overallScore > bestFailedScore) {
      bestFailedDrafts = drafts;
      bestFailedReview = reviewResult.review;
      bestFailedScore = reviewResult.review.overallScore;
      bestFailedIteration = iteration;
    }
    const newStatus = reviewResult.review.passed ? CS.REVIEW_PASSED : CS.REVIEW_FAILED;
    guardedUpdateFlowNode(store, caseId, runId, "review", reviewResult.review.passed ? "success" : "failed");
    guardedUpdateCase(store, caseId, runId, {
      reviewReport: reviewResult.review,
      status: newStatus,
      ...(reviewResult.review.passed ? { finalOkr: finalFromDrafts(drafts, (store.getCase(caseId)?.finalOkr?.version ?? 0) + 1) } : {}),
    });
    guardedAddLog(
      store,
      caseId,
      runId,
      reviewResult.review.passed ? "审核通过" : "审核未通过",
      reviewerName,
      [
        `第 ${iteration} 轮审核：${reviewDecisionLine(reviewResult.review, settings.okrReviewLoop.passThreshold, reviewResult.mode)}`,
        reviewResult.review.fatalIssues.some((issue) => issue.includes("协议") || issue.includes("逐条"))
          ? `协议校验：${reviewResult.review.fatalIssues.filter((issue) => issue.includes("协议") || issue.includes("逐条")).join("；")}`
          : "",
      ].filter(Boolean).join("\n")
    );
    guardedAddRunEvent(store, caseId, runId, {
      kind: "reviewer",
      actor: reviewerName,
      title: reviewResult.review.passed ? "质量审核通过" : "质量审核未达标",
      summary: objectiveStatusLine(reviewResult.review),
      detail: summarizeReviewForRunEvent(reviewResult.review, settings.okrReviewLoop.passThreshold),
      iteration,
    });

    if (formalReview) {
      const newlyLocked = (reviewResult.review.objectiveResults ?? [])
        .filter((item) => item.passed && !lockedObjectiveIndexes.has(item.objectiveIndex));
      newlyLocked.forEach((item) => {
        lockedObjectiveIndexes.add(item.objectiveIndex);
        const objectiveReview = objectiveReviewReports.get(item.objectiveIndex);
        if (objectiveReview) lockedObjectiveReviews.set(item.objectiveIndex, objectiveReview);
      });
      if (newlyLocked.length > 0) {
        lockedDrafts = drafts;
        guardedAddLog(
          store,
          caseId,
          runId,
          "锁定通过 Objective",
          "协调器",
          `已锁定 ${newlyLocked.map((item) => `O${item.objectiveIndex + 1} (${item.passedKrCount}/${item.totalKrCount})`).join("、")}，后续自动循环只重拆未通过 Objective。`
        );
        guardedAddRunEvent(store, caseId, runId, {
          kind: "coordinator",
          actor: "协调器",
          title: "锁定通过 Objective",
          summary: newlyLocked.map((item) => `O${item.objectiveIndex + 1} ${item.passedKrCount}/${item.totalKrCount}`).join("、"),
          detail: "后续自动循环只重拆未通过 Objective。",
          iteration,
        });
      }
    }

    if (reviewResult.review.passed) {
      guardedUpdateFlowNode(store, caseId, runId, "finalize", "success");
      guardedAddLog(store, caseId, runId, "自动定稿", "协调器", "所有 Objective 均满足 4/6 KR 达到流程阈值，流程结束");
      guardedAddRunEvent(store, caseId, runId, {
        kind: "coordinator",
        actor: "协调器",
        title: "流程结束",
        summary: "所有 Objective 质量达标",
        detail: "所有 Objective 均满足 4/6 KR 达到流程阈值。",
        iteration,
      });
      finishCaseRun(store, caseId, runId, "completed_passed", "已结束 · 质量达标");
      return;
    }

    if (!settings.okrReviewLoop.enabled || shouldStopReviewLoop(settings, iteration, startedAt, tokenCount)) {
      if (bestFailedDrafts && bestFailedReview) {
        guardedUpdateCase(store, caseId, runId, {
          okrDrafts: bestFailedDrafts,
          reviewReport: bestFailedReview,
          status: CS.REVIEW_FAILED,
        });
        guardedAddLog(
          store,
          caseId,
          runId,
          "保留最高分草稿",
          "协调器",
          `自动循环未让所有 Objective 通过，已回填第 ${bestFailedIteration} 轮最高分草稿用于展示：${bestFailedScore}/100；${objectiveStatusLine(bestFailedReview)}`
        );
      }
      guardedAddLog(store, caseId, runId, "审核循环停止", "协调器", `仍有 Objective 未满足 4/6 KR 达标规则，已停止自动循环。原因：${reviewLoopStopReason(settings, iteration, startedAt, tokenCount)}`);
      guardedAddRunEvent(store, caseId, runId, {
        kind: "coordinator",
        actor: "协调器",
        title: "流程结束",
        summary: "质量未达标",
        detail: `仍有 Objective 未满足 4/6 KR 达标规则。原因：${reviewLoopStopReason(settings, iteration, startedAt, tokenCount)}`,
        iteration,
      });
      finishCaseRun(store, caseId, runId, "completed_quality_failed", "已结束 · 质量未达标");
      return;
    }

    const failedObjectives = (reviewResult.review.objectiveResults ?? []).filter((item) => !item.passed);
    guardedAddLog(
      store,
      caseId,
      runId,
      "审核未通过，自动重拆",
      "协调器",
      `未通过 Objective：${failedObjectives.map((item) => `O${item.objectiveIndex + 1} (${item.passedKrCount}/${item.totalKrCount})`).join("、") || "未识别"}；进入第 ${iteration + 1} 轮 OKR 拆解`
    );
    guardedAddRunEvent(store, caseId, runId, {
      kind: "coordinator",
      actor: "协调器",
      title: "进入下一轮重拆",
      summary: failedObjectives.map((item) => `O${item.objectiveIndex + 1} ${item.passedKrCount}/${item.totalKrCount}`).join("、") || "未识别未通过 Objective",
      detail: `进入第 ${iteration + 1} 轮 OKR 拆解。`,
      iteration,
    });
    drafts = undefined;
    draftMode = undefined;
  }
}

// ---- Store implementation ----

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // --- Initial state ---
      cases: normalizeCasesForTenant(mockCases),
      config: cloneConfig(mockConfig),
      tenantConfigs: createDefaultTenantConfigs(),
      users: mockUsers,
      tenants: mockTenants,
      memberships: mockMemberships,
      currentUserId: DEFAULT_USER_ID,
      currentTenantId: DEFAULT_TENANT_ID,

      // --- Account reads/actions ---
      getCurrentUser: () => get().users.find((user) => user.id === get().currentUserId),
      getCurrentTenant: () => get().tenants.find((tenant) => tenant.id === get().currentTenantId),
      getCurrentMembership: () => getActiveMembership(get().memberships, get().currentUserId, get().currentTenantId),
      getCurrentRole: () => get().getCurrentMembership()?.role,
      hasPermission: (permission) => roleHasPermission(get().getCurrentRole(), permission),
      getVisibleCases: () => {
        const state = get();
        const role = state.getCurrentRole();
        return state.cases.filter((item) =>
          canReadCaseForAccount(item, role, state.currentTenantId, state.currentUserId)
        );
      },
      loginAs: (userId, tenantId) => {
        set((s) => {
          const activeMemberships = s.memberships.filter(
            (item) => item.userId === userId && item.status === "active"
          );
          const platformMembership = activeMemberships.find((item) => item.role === "platform_owner");
          const tenantMembership =
            activeMemberships.find((item) => item.tenantId === tenantId) ??
            activeMemberships.find((item) => item.tenantId !== PLATFORM_TENANT_ID);
          const requestedTenantId = tenantId && s.tenants.some((tenant) => tenant.id === tenantId)
            ? tenantId
            : undefined;
          const targetTenantId: string = platformMembership
            ? (requestedTenantId ?? s.currentTenantId ?? DEFAULT_TENANT_ID)
            : tenantMembership?.tenantId ?? s.currentTenantId ?? DEFAULT_TENANT_ID;
          const nextConfig = s.tenantConfigs[targetTenantId] ?? cloneConfig(s.config);

          return {
            currentUserId: userId,
            currentTenantId: targetTenantId,
            config: nextConfig,
            tenantConfigs: {
              ...s.tenantConfigs,
              [targetTenantId]: nextConfig,
            },
          };
        });
      },
      applyServerSession: (session) => {
        set((s) => {
          const targetTenantId = session.tenants.some((tenant) => tenant.id === session.currentTenantId)
            ? session.currentTenantId
            : session.tenants[0]?.id ?? session.currentTenantId;
          const nextConfig = s.tenantConfigs[targetTenantId] ?? cloneConfig(s.config);

          return {
            users: [session.user],
            tenants: session.tenants,
            memberships: session.memberships,
            currentUserId: session.user.id,
            currentTenantId: targetTenantId,
            config: nextConfig,
            tenantConfigs: {
              ...s.tenantConfigs,
              [targetTenantId]: nextConfig,
            },
          };
        });
      },
      logoutLocal: () => {
        set({
          users: [],
          tenants: [],
          memberships: [],
          currentUserId: "",
          currentTenantId: "",
        });
      },
      switchTenant: (tenantId) => {
        set((s) => {
          const canSwitch =
            getActiveMembership(s.memberships, s.currentUserId, s.currentTenantId)?.role === "platform_owner" ||
            s.memberships.some(
              (item) =>
                item.userId === s.currentUserId &&
                item.tenantId === tenantId &&
                item.status === "active"
            );
          if (!canSwitch || !s.tenants.some((tenant) => tenant.id === tenantId)) return {};
          const nextConfig = s.tenantConfigs[tenantId] ?? cloneConfig(s.config);
          return {
            currentTenantId: tenantId,
            config: nextConfig,
            tenantConfigs: {
              ...s.tenantConfigs,
              [tenantId]: nextConfig,
            },
          };
        });
      },

      // --- Case reads ---
      getCase: (id) => get().cases.find((c) => c.id === id),

      // --- Case mutations ---

      createCase: (title, team, cycle, rawText, flowTemplateId) => {
        const id = mkId();
        const now = new Date().toISOString();
        const state = get();
        const currentUser = state.getCurrentUser();
        const currentTenantId = state.currentTenantId || DEFAULT_TENANT_ID;
        const actorName = currentUser?.name ?? "用户";
        const defaultTemplate = state.config.flowTemplates.find((t) => t.isDefault);
        const newCase: OkrCase = {
          id,
          tenantId: currentTenantId,
          title,
          status: CS.NEW,
          team,
          cycle,
          flowTemplateId: flowTemplateId || defaultTemplate?.id || "flow-standard",
          flowNodeRuns: [],
          runStatus: "idle",
          runStage: "idle",
          runStatusMessage: "尚未开始",
          runEvents: [],
          candidateKrs: [],
          createdAt: now,
          updatedAt: now,
          createdBy: actorName,
          createdByUserId: currentUser?.id ?? state.currentUserId,
          intake: rawText ? { rawText, submittedAt: now, submittedBy: actorName } : undefined,
          logs: [mkLog("创建案例", actorName, `案例「${title}」已创建`)],
          tags: [],
        };
        set((s) => ({ cases: [newCase, ...s.cases] }));
        return id;
      },

      updateCase: (id, partial) => {
        set((s) => ({
          cases: s.cases.map((c) =>
            c.id === id ? { ...c, ...partial, updatedAt: new Date().toISOString() } : c
          ),
        }));
      },

      startAnalysis: (caseId) => {
        const store = get();
        const c = store.getCase(caseId);
        if (!c) return;
        const runId = beginCaseRun(store, caseId, "structuring", "拆解&审核中");
        if (!runId) return;
        const config = store.config;
        const interviewer = config.roles.find((r) => r.roleId === "interviewer");
        const expert = config.roles.find((r) => r.roleId === "okr-expert");
        const reviewer = config.roles.find((r) => r.roleId === "reviewer");
        const loopSettings = flowLoopSettings(config, c);

        guardedAddLog(store, caseId, runId, "开始分析", "系统", `运行模式: ${config.runMode} | 信息整理: ${interviewer?.roleName ?? "?"}/${interviewer?.model.modelId ?? "?"} | 拆解: ${expert?.roleName ?? "?"}/${expert?.model.modelId ?? "?"} | 审核: ${reviewer?.roleName ?? "?"}/${reviewer?.model.modelId ?? "?"} | 流程阈值: ${loopSettings.okrReviewLoop.passThreshold}`);
        guardedUpdateFlowNode(store, caseId, runId, "intake", "success");
        guardedUpdateFlowNode(store, caseId, runId, "structuring", "running");

        // Async pipeline using agents
        (async () => {
          try {
            const rawText = c.intake?.rawText ?? "";

            // Step 1: Information structuring
            const structResult = await runInformationStructuringAgent(rawText, config, loopSettings);
            if (!isActiveRun(store, caseId, runId)) return;
            const interviewerName = config.roles.find((r) => r.roleId === "interviewer")?.roleName ?? "信息整理官";
            const latestAfterStruct = get().getCase(caseId) ?? c;
            const missingInfo = filterIgnoredMissingInfo(structResult.missingInfo, latestAfterStruct);
            guardedUpdateFlowNode(store, caseId, runId, "structuring", "success");
            guardedAddLog(store, caseId, runId, "信息结构化完成", interviewerName, `模式: ${structResult.mode}\n本轮使用的角色配置：\n${describeRoleRuntimeConfig("interviewer", config)}\n\n${summarizeFactPack(structResult.factPack)}`);
            guardedAddRunEvent(store, caseId, runId, {
              kind: "interviewer",
              actor: interviewerName,
              title: "结构化用户背景",
              summary: missingInfo?.missingFields.length ? `发现 ${missingInfo.missingFields.length} 项信息缺口` : "信息结构化完成，未发现阻塞缺口",
              detail: summarizeFactPack(structResult.factPack),
            });

            // Step 2: Info check
            guardedUpdateFlowNode(store, caseId, runId, "info-check", "running");
            if (hasHighPriorityMissing(missingInfo)) {
              guardedUpdateFlowNode(store, caseId, runId, "info-check", "failed", "信息不足");
              guardedUpdateCase(store, caseId, runId, {
                status: CS.INFO_INSUFFICIENT,
                factPack: structResult.factPack,
                missingInfo: missingInfo ?? undefined,
                runStatus: "running",
                runStage: "waiting_for_info",
                runStatusMessage: "等待用户补充信息",
              });
              guardedAddLog(store, caseId, runId, "信息检查", interviewerName, `基于信息审核角色配置判定信息不足，需要补充：\n${summarizeMissingInfo(missingInfo)}`);
              guardedAddRunEvent(store, caseId, runId, {
                kind: "interviewer",
                actor: interviewerName,
                title: "判定信息不足",
                summary: "等待用户补充信息",
                detail: summarizeMissingInfo(missingInfo),
              });
              return;
            }

            guardedUpdateFlowNode(store, caseId, runId, "info-check", "success");
            guardedUpdateCase(store, caseId, runId, {
              factPack: structResult.factPack,
              missingInfo: missingInfo ?? undefined,
              status: CS.READY_FOR_DECOMPOSITION,
            });
            guardedAddLog(store, caseId, runId, "信息检查通过", interviewerName, `基于信息审核角色配置判定信息充足，进入拆解。\n${summarizeMissingInfo(missingInfo)}`);

            await runOkrReviewLoop({
              caseId,
              factPack: structResult.factPack,
              title: c.title,
              team: c.team,
              config,
              store,
              runId,
            });
          } catch (err) {
            const message = flowError(err);
            if (!isActiveRun(store, caseId, runId)) return;
            const latest = get().getCase(caseId);
            for (const nodeId of ["structuring", "info-check", "decompose", "review"]) {
              if (latest?.flowNodeRuns.find((run) => run.nodeId === nodeId)?.status === "running") {
                guardedUpdateFlowNode(store, caseId, runId, nodeId, "failed", message);
              }
            }
            guardedAddLog(store, caseId, runId, "分析失败", "系统", `错误: ${message}`);
            guardedAddRunEvent(store, caseId, runId, {
              kind: "system",
              actor: "系统",
              title: "流程失败",
              summary: "未生成可用结果",
              detail: message,
            });
            finishCaseRun(store, caseId, runId, "failed_no_result", "运行失败 · 无任何结果");
          }
        })();
      },

      startDecomposition: (caseId) => {
        const store = get();
        const c = store.getCase(caseId);
        if (!c) return;
        const runId = beginCaseRun(store, caseId, "structuring", "拆解&审核中");
        if (!runId) return;
        const config = store.config;
        const expert = config.roles.find((r) => r.roleId === "okr-expert");
        const loopSettings = flowLoopSettings(config, c);

        guardedAddLog(store, caseId, runId, "开始拆解", "用户", `运行模式: ${config.runMode} | 拆解: ${expert?.roleName ?? "?"}/${expert?.model.modelId ?? "?"} | 流程阈值: ${loopSettings.okrReviewLoop.passThreshold}`);
        guardedUpdateFlowNode(store, caseId, runId, "structuring", "running");
        guardedUpdateFlowNode(store, caseId, runId, "info-check", "pending");
        guardedUpdateFlowNode(store, caseId, runId, "decompose", "pending");
        guardedUpdateFlowNode(store, caseId, runId, "review", "pending");
        guardedUpdateCase(store, caseId, runId, { status: CS.READY_FOR_DECOMPOSITION });

        (async () => {
          try {
            // Re-read latest case to pick up any supplements
            const latest = get().getCase(caseId);
            const rawText = latest?.intake?.rawText ?? c.intake?.rawText ?? "";
            const structResult = await runInformationStructuringAgent(rawText, config, loopSettings);
            if (!isActiveRun(store, caseId, runId)) return;
            const interviewerName = config.roles.find((r) => r.roleId === "interviewer")?.roleName ?? "信息整理官";
            const latestAfterStruct = get().getCase(caseId) ?? c;
            const missingInfo = filterIgnoredMissingInfo(structResult.missingInfo, latestAfterStruct);
            guardedUpdateFlowNode(store, caseId, runId, "structuring", "success");
            guardedAddLog(store, caseId, runId, "信息结构化完成", interviewerName, `补充后重新结构化。\n本轮使用的角色配置：\n${describeRoleRuntimeConfig("interviewer", config)}\n\n${summarizeFactPack(structResult.factPack)}`);
            guardedAddRunEvent(store, caseId, runId, {
              kind: "interviewer",
              actor: interviewerName,
              title: "补充后重新结构化",
              summary: missingInfo?.missingFields.length ? `仍有 ${missingInfo.missingFields.length} 项信息缺口` : "补充后信息可进入拆解",
              detail: summarizeFactPack(structResult.factPack),
            });
            guardedUpdateCase(store, caseId, runId, {
              factPack: structResult.factPack,
              missingInfo: missingInfo ?? undefined,
            });
            guardedUpdateFlowNode(store, caseId, runId, "info-check", "running");
            if (hasHighPriorityMissing(missingInfo)) {
              guardedUpdateFlowNode(store, caseId, runId, "info-check", "failed", "仍有关键缺失信息");
              guardedUpdateFlowNode(store, caseId, runId, "decompose", "failed", "信息不足，未进入拆解");
              guardedUpdateCase(store, caseId, runId, {
                status: CS.INFO_INSUFFICIENT,
                runStatus: "running",
                runStage: "waiting_for_info",
                runStatusMessage: "等待用户补充信息",
              });
              guardedAddLog(store, caseId, runId, "信息检查", interviewerName, `基于信息审核角色配置判定补充后仍缺少关键结构化信息：\n${summarizeMissingInfo(missingInfo)}`);
              guardedAddRunEvent(store, caseId, runId, {
                kind: "interviewer",
                actor: interviewerName,
                title: "补充后仍需信息",
                summary: "等待用户补充信息",
                detail: summarizeMissingInfo(missingInfo),
              });
              guardedAddLog(store, caseId, runId, "拆解暂停", "协调器", "补充后仍缺少关键结构化信息，请继续补充");
              return;
            }
            guardedUpdateFlowNode(store, caseId, runId, "info-check", "success");
            guardedAddLog(store, caseId, runId, "信息检查通过", interviewerName, `基于信息审核角色配置判定补充后信息已满足拆解条件。\n${summarizeMissingInfo(missingInfo)}`);
            await runOkrReviewLoop({
              caseId,
              factPack: structResult.factPack,
              title: c.title,
              team: c.team,
              config,
              store,
              runId,
            });
          } catch (err) {
            const message = flowError(err);
            if (!isActiveRun(store, caseId, runId)) return;
            const latest = get().getCase(caseId);
            for (const nodeId of ["structuring", "info-check", "decompose", "review"]) {
              if (latest?.flowNodeRuns.find((run) => run.nodeId === nodeId)?.status === "running") {
                guardedUpdateFlowNode(store, caseId, runId, nodeId, "failed", message);
              }
            }
            guardedAddLog(store, caseId, runId, "拆解失败", "系统", `错误: ${message}`);
            guardedAddRunEvent(store, caseId, runId, {
              kind: "system",
              actor: "系统",
              title: "流程失败",
              summary: "未生成可用结果",
              detail: message,
            });
            finishCaseRun(store, caseId, runId, "failed_no_result", "运行失败 · 无任何结果");
          }
        })();
      },

      retryDecomposition: (caseId, supplement) => {
        const store = get();
        const c = store.getCase(caseId);
        if (!c) return;
        const runId = beginCaseRun(store, caseId, "structuring", "拆解&审核中");
        if (!runId) return;
        const config = store.config;
        const expert = config.roles.find((r) => r.roleId === "okr-expert");
        const supplementText = supplement?.trim();
        const loopSettings = flowLoopSettings(config, c);

        if (supplementText) {
          const currentRaw = c.intake?.rawText ?? "";
          guardedUpdateCase(store, caseId, runId, {
            intake: {
              rawText: `${currentRaw}\n\n【重新拆解补充】${supplementText}`,
              submittedAt: new Date().toISOString(),
              submittedBy: c.intake?.submittedBy ?? "用户",
            },
          });
          guardedAddRunEvent(store, caseId, runId, {
            kind: "user",
            actor: "用户",
            title: "补充重新拆解说明",
            summary: supplementText.slice(0, 80),
            detail: supplementText,
          });
        }

        guardedAddLog(store, caseId, runId, "重新拆解", "用户", `运行模式: ${config.runMode} | 拆解: ${expert?.roleName ?? "?"}/${expert?.model.modelId ?? "?"} | 流程阈值: ${loopSettings.okrReviewLoop.passThreshold}${supplementText ? " | 已附加用户补充说明" : ""}`);
        guardedUpdateFlowNode(store, caseId, runId, "structuring", "running");
        guardedUpdateFlowNode(store, caseId, runId, "info-check", "pending");
        guardedUpdateFlowNode(store, caseId, runId, "decompose", "pending");
        guardedUpdateFlowNode(store, caseId, runId, "review", "pending");

        (async () => {
          try {
            // Re-read latest case to pick up any supplements
            const latest = get().getCase(caseId);
            const rawText = latest?.intake?.rawText ?? c.intake?.rawText ?? "";
            const structResult = await runInformationStructuringAgent(rawText, config, loopSettings);
            if (!isActiveRun(store, caseId, runId)) return;
            const interviewerName = config.roles.find((r) => r.roleId === "interviewer")?.roleName ?? "信息整理官";
            const latestAfterStruct = get().getCase(caseId) ?? c;
            const missingInfo = filterIgnoredMissingInfo(structResult.missingInfo, latestAfterStruct);
            guardedUpdateFlowNode(store, caseId, runId, "structuring", "success");
            guardedAddLog(store, caseId, runId, "信息结构化完成", interviewerName, `重新生成前结构化。\n本轮使用的角色配置：\n${describeRoleRuntimeConfig("interviewer", config)}\n\n${summarizeFactPack(structResult.factPack)}`);
            guardedAddRunEvent(store, caseId, runId, {
              kind: "interviewer",
              actor: interviewerName,
              title: "重新生成前结构化",
              summary: missingInfo?.missingFields.length ? `仍有 ${missingInfo.missingFields.length} 项信息缺口` : "信息可进入重新拆解",
              detail: summarizeFactPack(structResult.factPack),
            });
            guardedUpdateCase(store, caseId, runId, {
              factPack: structResult.factPack,
              missingInfo: missingInfo ?? undefined,
            });
            guardedUpdateFlowNode(store, caseId, runId, "info-check", "running");
            if (hasHighPriorityMissing(missingInfo)) {
              guardedUpdateFlowNode(store, caseId, runId, "info-check", "failed", "仍有关键缺失信息");
              guardedUpdateFlowNode(store, caseId, runId, "decompose", "failed", "信息不足，未进入拆解");
              guardedUpdateCase(store, caseId, runId, {
                status: CS.INFO_INSUFFICIENT,
                runStatus: "running",
                runStage: "waiting_for_info",
                runStatusMessage: "等待用户补充信息",
              });
              guardedAddLog(store, caseId, runId, "信息检查", interviewerName, `基于信息审核角色配置判定重新生成前仍缺少关键结构化信息：\n${summarizeMissingInfo(missingInfo)}`);
              guardedAddRunEvent(store, caseId, runId, {
                kind: "interviewer",
                actor: interviewerName,
                title: "重新生成前仍需信息",
                summary: "等待用户补充信息",
                detail: summarizeMissingInfo(missingInfo),
              });
              guardedAddLog(store, caseId, runId, "重新拆解暂停", "协调器", "补充后仍缺少关键结构化信息，请继续补充");
              return;
            }
            guardedUpdateFlowNode(store, caseId, runId, "info-check", "success");
            guardedAddLog(store, caseId, runId, "信息检查通过", interviewerName, `基于信息审核角色配置判定重新生成前信息已满足拆解条件。\n${summarizeMissingInfo(missingInfo)}`);
            const factPack = supplementText
              ? {
                  ...structResult.factPack,
                  businessContext: `${structResult.factPack.businessContext}\n\n重新拆解补充：${supplementText}`,
                }
              : structResult.factPack;
            await runOkrReviewLoop({
              caseId,
              factPack,
              title: c.title,
              team: c.team,
              config,
              store,
              runId,
            });
          } catch (err) {
            const message = flowError(err);
            if (!isActiveRun(store, caseId, runId)) return;
            const latest = get().getCase(caseId);
            for (const nodeId of ["structuring", "info-check", "decompose", "review"]) {
              if (latest?.flowNodeRuns.find((run) => run.nodeId === nodeId)?.status === "running") {
                guardedUpdateFlowNode(store, caseId, runId, nodeId, "failed", message);
              }
            }
            guardedAddLog(store, caseId, runId, "重新拆解失败", "系统", `错误: ${message}`);
            guardedAddRunEvent(store, caseId, runId, {
              kind: "system",
              actor: "系统",
              title: "流程失败",
              summary: "未生成可用结果",
              detail: message,
            });
            finishCaseRun(store, caseId, runId, "failed_no_result", "运行失败 · 无任何结果");
          }
        })();
      },

      transitionStatus: (caseId, to) => {
        set((state) => ({
          cases: state.cases.map((c) => {
            if (c.id !== caseId) return c;
            const newStatus = transition(c.status, to);
            return {
              ...c,
              status: newStatus,
              updatedAt: new Date().toISOString(),
              logs: [...c.logs, mkLog(`状态变更: ${c.status} → ${newStatus}`, "系统")],
            };
          }),
        }));
      },

      addLog: (caseId, action, actor, detail) => {
        set((state) => ({
          cases: state.cases.map((c) =>
            c.id === caseId
              ? { ...c, logs: [...c.logs, mkLog(action, actor, detail)], updatedAt: new Date().toISOString() }
              : c
          ),
        }));
      },

      addRunEvent: (caseId, event) => {
        set((state) => ({
          cases: state.cases.map((c) =>
            c.id === caseId
              ? { ...c, runEvents: [...(c.runEvents ?? []), event], updatedAt: new Date().toISOString() }
              : c
          ),
        }));
      },

      updateFlowNode: (caseId, nodeId, status, error) => {
        set((state) => ({
          cases: state.cases.map((c) => {
            if (c.id !== caseId) return c;
            let runs = updateNodeRun(c.flowNodeRuns, nodeId, status);
            if (error) {
              runs = runs.map((r) => (r.nodeId === nodeId ? { ...r, error } : r));
            }
            return { ...c, flowNodeRuns: runs, updatedAt: new Date().toISOString() };
          }),
        }));
      },

      switchFlowTemplate: (caseId, templateId) => {
        set((state) => ({
          cases: state.cases.map((c) =>
            c.id === caseId
              ? {
                  ...c,
                  flowTemplateId: templateId,
                  updatedAt: new Date().toISOString(),
                  logs: [...c.logs, mkLog("流程模板切换", "用户", `切换至模板: ${templateId}`)],
                }
              : c
          ),
        }));
      },

      supplementInfo: (caseId, field, value) => {
        set((state) => ({
          cases: state.cases.map((c) => {
            if (c.id !== caseId) return c;
            if (c.runStatus === "running" && c.runStage !== "waiting_for_info") return c;
            // Append supplement to intake rawText so it's visible and used by subsequent analysis
            const currentRaw = c.intake?.rawText ?? "";
            const appendedRaw = currentRaw + `\n\n【补充 - ${field}】${value}`;
            const newIntake = {
              rawText: appendedRaw,
              submittedAt: new Date().toISOString(),
              submittedBy: c.intake?.submittedBy ?? "用户",
            };
            // Mark the field as resolved in missingInfo (remove it from the list)
            const newMissingInfo = c.missingInfo ? {
              ...c.missingInfo,
              missingFields: c.missingInfo.missingFields.filter((f) => f.field !== field),
            } : undefined;
            const runEvents = c.activeRunId
              ? [
                  ...(c.runEvents ?? []),
                  mkRunEvent(c.activeRunId, {
                    kind: "user",
                    actor: "用户",
                    title: "补充信息",
                    summary: `补充字段「${field}」`,
                    detail: value,
                  }),
                ]
              : c.runEvents;
            return {
              ...c,
              intake: newIntake,
              missingInfo: newMissingInfo,
              runEvents,
              updatedAt: new Date().toISOString(),
              logs: [...c.logs, mkLog("补充信息", "用户", `补充字段「${field}」: ${value}`)],
            };
          }),
        }));
      },

      ignoreMissingField: (caseId, field, reason) => {
        set((state) => ({
          cases: state.cases.map((c) => {
            if (c.id !== caseId) return c;
            if (c.runStatus === "running" && c.runStage !== "waiting_for_info") return c;
            const tag = `${IGNORED_MISSING_PREFIX}${encodeURIComponent(field)}`;
            const tags = c.tags.includes(tag) ? c.tags : [...c.tags, tag];
            const missingInfo = c.missingInfo
              ? {
                  ...c.missingInfo,
                  missingFields: c.missingInfo.missingFields.filter((item) => item.field !== field),
                }
              : undefined;
            const runEvents = c.activeRunId
              ? [
                  ...(c.runEvents ?? []),
                  mkRunEvent(c.activeRunId, {
                    kind: "user",
                    actor: "用户",
                    title: "忽略关键缺口",
                    summary: `忽略「${field}」并继续拆解`,
                    detail: reason ?? "用户选择继续，不再强制补充该缺口。",
                  }),
                ]
              : c.runEvents;
            return {
              ...c,
              tags,
              missingInfo,
              runEvents,
              updatedAt: new Date().toISOString(),
              logs: [
                ...c.logs,
                mkLog(
                  "忽略关键缺口",
                  "用户",
                  `用户选择忽略「${field}」，继续拆解。${reason ? `原缺口原因：${reason}` : "系统仍建议后续补充该信息。"}`
                ),
              ],
            };
          }),
        }));
      },

      toggleCandidateKr: (caseId, candidate) => {
        set((state) => ({
          cases: state.cases.map((c) => {
            if (c.id !== caseId) return c;
            const candidates = c.candidateKrs ?? [];
            const exists = candidates.some((item) => item.kr.id === candidate.kr.id);
            const next = exists
              ? candidates.filter((item) => item.kr.id !== candidate.kr.id)
              : [{ ...candidate, id: candidate.id || `candidate-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }, ...candidates];
            return {
              ...c,
              candidateKrs: next,
              updatedAt: new Date().toISOString(),
              logs: [
                ...c.logs,
                mkLog(
                  exists ? "取消候选 KR" : "列为候选 KR",
                  "用户",
                  `${candidate.objectiveTitle} / ${candidate.kr.title}`
                ),
              ],
            };
          }),
        }));
      },

      rerunNode: (caseId, nodeId) => {
        const store = get();
        const c = store.getCase(caseId);
        if (!c) return "error";
        if (c.runStatus === "running" && c.runStage !== "waiting_for_info") {
          store.addLog(caseId, "流程进行中", "系统", "当前案例已有拆解流程正在执行，请等待本轮结束后再操作。");
          return "unsupported";
        }
        const config = store.config;

        // Find the node in the flow template
        const template = config.flowTemplates.find((t) => t.id === c.flowTemplateId)
          ?? config.flowTemplates.find((t) => t.isDefault);
        const node = template?.nodes.find((n) => n.id === nodeId);
        if (!node) {
          store.addLog(caseId, "重跑失败", "系统", `未找到节点「${nodeId}」`);
          return "error";
        }

        const role = config.roles.find((r) => r.roleId === node.roleId);
        const roleName = role?.roleName ?? node.roleId;
        const modelId = role?.model.modelId ?? "unknown";

        // --- Unsupported nodes ---
        if (nodeId === "finalize" || nodeId === "human-review") {
          store.addLog(caseId, "重跑不支持", "系统", `节点「${node.label}」(${nodeId}) 不支持自动重跑`);
          return "unsupported";
        }

        // --- Early nodes: intake / structuring / info-check → restart full analysis ---
        if (nodeId === "intake" || nodeId === "structuring" || nodeId === "info-check") {
          if (!c.intake?.rawText) {
            store.addLog(caseId, "重跑失败", "系统", `节点「${node.label}」重跑需要原始输入，但当前案例无输入数据`);
            return "no-data";
          }
          store.addLog(caseId, "节点重跑", "用户", `从「${node.label}」重跑全流程 | ${roleName}/${modelId} | 模式: ${config.runMode}`);
          // Reset downstream nodes
          store.updateFlowNode(caseId, "structuring", "pending");
          store.updateFlowNode(caseId, "info-check", "pending");
          store.updateFlowNode(caseId, "decompose", "pending");
          store.updateFlowNode(caseId, "review", "pending");
          store.updateFlowNode(caseId, "finalize", "pending");
          store.startAnalysis(caseId);
          return "started";
        }

        // --- Decompose node → retry decomposition + review ---
        if (nodeId === "decompose") {
          if (!c.factPack && !c.intake?.rawText) {
            store.addLog(caseId, "重跑失败", "系统", `节点「${node.label}」重跑需要事实包或原始输入`);
            return "no-data";
          }
          store.addLog(caseId, "节点重跑", "用户", `从「${node.label}」重跑拆解+审核 | ${roleName}/${modelId} | 模式: ${config.runMode}`);
          store.updateFlowNode(caseId, "review", "pending");
          store.updateFlowNode(caseId, "finalize", "pending");
          store.retryDecomposition(caseId);
          return "started";
        }

        // --- Review / auto-review node → rerun just the review step ---
        if (nodeId === "review" || nodeId === "auto-review") {
          if (!c.okrDrafts) {
            store.addLog(caseId, "重跑失败", "系统", `节点「${node.label}」重跑需要 OKR 草稿，但当前案例无草稿数据`);
            return "no-data";
          }
          const loopSettings = flowLoopSettings(config, c);
          const runId = beginCaseRun(store, caseId, "reviewing", "拆解&审核中");
          if (!runId) return "unsupported";
          guardedAddLog(store, caseId, runId, "节点重跑", "用户", `从「${node.label}」重跑审核 | ${roleName}/${modelId} | 模式: ${config.runMode} | 流程阈值: ${loopSettings.okrReviewLoop.passThreshold}`);
          guardedAddRunEvent(store, caseId, runId, {
            kind: "user",
            actor: "用户",
            title: "重跑审核节点",
            summary: `从「${node.label}」重新审核当前 OKR 草稿`,
          });
          guardedUpdateFlowNode(store, caseId, runId, nodeId, "running");
          guardedUpdateFlowNode(store, caseId, runId, "finalize", "pending");

          (async () => {
            try {
              const drafts = withDefaultOwners(c.okrDrafts!, c.team);
              const reviewResult = await runReviewerAgent(drafts, config, loopSettings);
              if (!isActiveRun(store, caseId, runId)) return;
              const reviewerName = config.roles.find((r) => r.roleId === "reviewer")?.roleName ?? "审核官";
              const newStatus = reviewResult.review.passed ? CS.REVIEW_PASSED
                : reviewResult.review.needsHumanReview ? CS.HUMAN_REVIEW_REQUIRED
                : CS.REVIEW_FAILED;
              guardedUpdateFlowNode(store, caseId, runId, nodeId, reviewResult.review.passed ? "success" : "failed");
              guardedUpdateCase(store, caseId, runId, {
                okrDrafts: drafts,
                reviewReport: reviewResult.review,
                status: newStatus,
                ...(reviewResult.review.passed ? { finalOkr: finalFromDrafts(drafts, (get().getCase(caseId)?.finalOkr?.version ?? 0) + 1) } : {}),
              });
              guardedAddLog(store, caseId, runId, reviewResult.review.passed ? "审核通过" : "审核未通过", reviewerName,
                [
                  `重跑审核：${reviewDecisionLine(reviewResult.review, loopSettings.okrReviewLoop.passThreshold, reviewResult.mode)}`,
                  reviewResult.review.fatalIssues.some((issue) => issue.includes("协议") || issue.includes("逐条"))
                    ? `协议校验：${reviewResult.review.fatalIssues.filter((issue) => issue.includes("协议") || issue.includes("逐条")).join("；")}`
                    : "",
                ].filter(Boolean).join("\n"));
              guardedAddRunEvent(store, caseId, runId, {
                kind: "reviewer",
                actor: reviewerName,
                title: reviewResult.review.passed ? "重跑审核通过" : "重跑审核未达标",
                summary: reviewDecisionLine(reviewResult.review, loopSettings.okrReviewLoop.passThreshold, reviewResult.mode),
                detail: summarizeReviewForRunEvent(reviewResult.review, loopSettings.okrReviewLoop.passThreshold),
              });

              if (reviewResult.review.passed) {
                guardedUpdateFlowNode(store, caseId, runId, "finalize", "success");
                guardedAddLog(store, caseId, runId, "自动定稿", "协调器", "审核通过，已自动定稿");
                finishCaseRun(store, caseId, runId, "completed_passed", "已结束 · 质量达标");
              } else {
                finishCaseRun(store, caseId, runId, "completed_quality_failed", "已结束 · 质量未达标");
              }
            } catch (err) {
              guardedUpdateFlowNode(store, caseId, runId, nodeId, "failed", err instanceof Error ? err.message : "未知错误");
              guardedAddLog(store, caseId, runId, "重跑失败", "系统", `节点「${node.label}」重跑失败: ${err instanceof Error ? err.message : "未知错误"}`);
              guardedAddRunEvent(store, caseId, runId, {
                kind: "system",
                actor: "系统",
                title: "重跑审核失败",
                summary: "未获得可信审核结果",
                detail: err instanceof Error ? err.message : "未知错误",
              });
              finishCaseRun(store, caseId, runId, "failed_no_result", "运行失败 · 无任何结果");
            }
          })();
          return "started";
        }

        // --- Unknown node ---
        store.addLog(caseId, "重跑不支持", "系统", `未知节点「${nodeId}」不支持重跑`);
        return "unsupported";
      },

      // --- Config actions ---

      saveConfig: (partial) => {
        set((s) => withCurrentTenantConfig(s, { ...s.config, ...partial }));
      },

      resetConfig: () => {
        set((s) => withCurrentTenantConfig(s, cloneConfig(mockConfig)));
      },

      updateRoleConfig: (roleId, partial) => {
        set((s) => withCurrentTenantConfig(s, {
            ...s.config,
            roles: s.config.roles.map((r) =>
              r.roleId === roleId ? { ...r, ...partial } : r
            ),
          }));
      },

      addRoleConfig: (role) => {
        set((s) => withCurrentTenantConfig(s, {
            ...s.config,
            roles: [...s.config.roles, ensureRoleModel(role, s.config)],
          }));
      },

      deleteRoleConfig: (roleId) => {
        set((s) => {
          if (mockConfig.roles.some((role) => role.roleId === roleId)) return {};
          const roles = s.config.roles.filter((role) => role.roleId !== roleId);
          const fallbackRoleId = roles.some((role) => role.roleId === "coordinator")
            ? "coordinator"
            : roles[0]?.roleId ?? "coordinator";

          return withCurrentTenantConfig(s, {
            ...s.config,
            roles,
            flowTemplates: s.config.flowTemplates.map((template) => {
              const shouldUpdate = template.nodes.some((node) => node.roleId === roleId);
              if (!shouldUpdate) return template;
              return {
                ...template,
                nodes: template.nodes.map((node) =>
                  node.roleId === roleId ? { ...node, roleId: fallbackRoleId } : node
                ),
                updatedAt: new Date().toISOString(),
              };
            }),
          });
        });
      },

      updateModelConfig: (roleId, partial) => {
        set((s) => withCurrentTenantConfig(s, {
            ...s.config,
            roles: s.config.roles.map((r) =>
              r.roleId === roleId ? { ...r, model: { ...r.model, ...partial } } : r
            ),
          }));
      },

      updateReviewConfig: (partial) => {
        set((s) => withCurrentTenantConfig(s, {
            ...s.config,
            review: { ...s.config.review, ...partial },
          }));
      },

      addFlowTemplate: (template) => {
        set((s) => withCurrentTenantConfig(s, {
            ...s.config,
            flowTemplates: [...s.config.flowTemplates, template],
          }));
      },

      updateFlowTemplate: (id, partial) => {
        set((s) => withCurrentTenantConfig(s, {
            ...s.config,
            flowTemplates: s.config.flowTemplates.map((t) =>
              t.id === id ? { ...t, ...partial, updatedAt: new Date().toISOString() } : t
            ),
          }));
      },

      deleteFlowTemplate: (id) => {
        set((s) => withCurrentTenantConfig(s, {
            ...s.config,
            flowTemplates: s.config.flowTemplates.filter((t) => t.id !== id),
          }));
      },

      setDefaultFlowTemplate: (id) => {
        set((s) => withCurrentTenantConfig(s, {
            ...s.config,
            flowTemplates: s.config.flowTemplates.map((t) => ({
              ...t,
              isDefault: t.id === id,
            })),
          }));
      },
    }),
    {
      name: "okr-harness-store",
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<AppStore> | undefined;
        if (!persisted) return currentState;

        const tenants = persisted.tenants?.length ? persisted.tenants : mockTenants;
        const currentTenantId = tenants.some((tenant) => tenant.id === persisted.currentTenantId)
          ? persisted.currentTenantId!
          : DEFAULT_TENANT_ID;
        const tenantConfigs = {
          ...createDefaultTenantConfigs(persisted.config ?? currentState.config),
          ...(persisted.tenantConfigs ?? {}),
        };
        const config = tenantConfigs[currentTenantId] ?? persisted.config ?? currentState.config;

        return {
          ...currentState,
          ...persisted,
          cases: normalizeCasesForTenant(persisted.cases ?? currentState.cases),
          config,
          tenantConfigs: {
            ...tenantConfigs,
            [currentTenantId]: config,
          },
          users: persisted.users?.length ? persisted.users : mockUsers,
          tenants,
          memberships: persisted.memberships?.length ? persisted.memberships : mockMemberships,
          currentUserId: persisted.currentUserId ?? DEFAULT_USER_ID,
          currentTenantId,
        };
      },
    }
  )
);

// Backward compat alias
export const useCaseStore = useAppStore;
