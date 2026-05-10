// =============================================
// OKR拆解 - Core Type Definitions
// =============================================

// ---- Internal Status Enum (state machine) ----

export enum CaseStatus {
  /** 新建，用户刚创建 */
  NEW = "NEW",
  /** 已收到用户的自然语言输入 */
  INTAKE_RECEIVED = "INTAKE_RECEIVED",
  /** 访谈官已完成信息结构化 */
  INTERVIEW_STRUCTURED = "INTERVIEW_STRUCTURED",
  /** 信息不足，需要补充 */
  INFO_INSUFFICIENT = "INFO_INSUFFICIENT",
  /** 信息充分，可以拆解 */
  READY_FOR_DECOMPOSITION = "READY_FOR_DECOMPOSITION",
  /** OKR 草稿已生成 */
  OKR_DRAFT_GENERATED = "OKR_DRAFT_GENERATED",
  /** 正在审核中 */
  UNDER_REVIEW = "UNDER_REVIEW",
  /** 审核未通过 */
  REVIEW_FAILED = "REVIEW_FAILED",
  /** 需要人工审核 */
  HUMAN_REVIEW_REQUIRED = "HUMAN_REVIEW_REQUIRED",
  /** 审核通过 */
  REVIEW_PASSED = "REVIEW_PASSED",
  /** 已定稿 */
  FINALIZED = "FINALIZED",
}

// ---- Front-end Display Status (only 3 types shown to user) ----

export type DisplayStatus = "info_insufficient" | "review_failed" | "review_passed";

export const DisplayStatusLabel: Record<DisplayStatus, string> = {
  info_insufficient: "信息不足",
  review_failed: "审核未通过",
  review_passed: "审核通过",
};

export const DisplayStatusColor: Record<DisplayStatus, string> = {
  info_insufficient: "bg-amber-50 text-amber-700",
  review_failed: "bg-red-50 text-red-700",
  review_passed: "bg-emerald-50 text-emerald-700",
};

/** Map internal CaseStatus to front-end DisplayStatus */
export function getDisplayStatus(status: CaseStatus): DisplayStatus {
  switch (status) {
    case CaseStatus.REVIEW_PASSED:
    case CaseStatus.FINALIZED:
      return "review_passed";
    case CaseStatus.REVIEW_FAILED:
    case CaseStatus.HUMAN_REVIEW_REQUIRED:
      return "review_failed";
    default:
      return "info_insufficient";
  }
}

// ---- Account & Tenant Models ----

export type AccountRole = "platform_owner" | "tenant_owner" | "tenant_admin" | "member";

export const AccountRoleLabel: Record<AccountRole, string> = {
  platform_owner: "平台超级管理员",
  tenant_owner: "企业超级管理员",
  tenant_admin: "企业普通管理员",
  member: "企业普通用户",
};

export interface UserAccount {
  id: string;
  name: string;
  email: string;
}

export interface Tenant {
  id: string;
  name: string;
  status: "active" | "inactive";
  ownerUserId: string;
  createdAt: string;
}

export interface TenantMembership {
  id: string;
  tenantId: string;
  userId: string;
  role: AccountRole;
  status: "active" | "inactive";
}

export type Permission =
  | "platform.manageTenants"
  | "tenant.manageMembers"
  | "tenant.manageConfig"
  | "case.create"
  | "case.readTenant"
  | "case.readOwn";

export const RolePermissions: Record<AccountRole, Permission[]> = {
  platform_owner: [
    "platform.manageTenants",
    "tenant.manageMembers",
    "tenant.manageConfig",
    "case.create",
    "case.readTenant",
  ],
  tenant_owner: [
    "tenant.manageMembers",
    "tenant.manageConfig",
    "case.create",
    "case.readTenant",
  ],
  tenant_admin: ["tenant.manageConfig", "case.create", "case.readTenant"],
  member: ["case.create", "case.readOwn"],
};

export function roleHasPermission(role: AccountRole | undefined, permission: Permission): boolean {
  return role ? RolePermissions[role].includes(permission) : false;
}

// Keep internal labels/colors for detail pages and state machine usage
export const CaseStatusLabel: Record<CaseStatus, string> = {
  [CaseStatus.NEW]: "新建",
  [CaseStatus.INTAKE_RECEIVED]: "已接收",
  [CaseStatus.INTERVIEW_STRUCTURED]: "已结构化",
  [CaseStatus.INFO_INSUFFICIENT]: "信息不足",
  [CaseStatus.READY_FOR_DECOMPOSITION]: "可拆解",
  [CaseStatus.OKR_DRAFT_GENERATED]: "草稿已生成",
  [CaseStatus.UNDER_REVIEW]: "审核中",
  [CaseStatus.REVIEW_FAILED]: "审核未通过",
  [CaseStatus.HUMAN_REVIEW_REQUIRED]: "需人工审核",
  [CaseStatus.REVIEW_PASSED]: "审核通过",
  [CaseStatus.FINALIZED]: "已定稿",
};

export const CaseStatusColor: Record<CaseStatus, string> = {
  [CaseStatus.NEW]: "bg-slate-100 text-slate-700",
  [CaseStatus.INTAKE_RECEIVED]: "bg-blue-50 text-blue-700",
  [CaseStatus.INTERVIEW_STRUCTURED]: "bg-indigo-50 text-indigo-700",
  [CaseStatus.INFO_INSUFFICIENT]: "bg-amber-50 text-amber-700",
  [CaseStatus.READY_FOR_DECOMPOSITION]: "bg-cyan-50 text-cyan-700",
  [CaseStatus.OKR_DRAFT_GENERATED]: "bg-purple-50 text-purple-700",
  [CaseStatus.UNDER_REVIEW]: "bg-orange-50 text-orange-700",
  [CaseStatus.REVIEW_FAILED]: "bg-red-50 text-red-700",
  [CaseStatus.HUMAN_REVIEW_REQUIRED]: "bg-yellow-50 text-yellow-700",
  [CaseStatus.REVIEW_PASSED]: "bg-emerald-50 text-emerald-700",
  [CaseStatus.FINALIZED]: "bg-green-50 text-green-700",
};

// ---- Intake & Fact Models ----

/** 用户自然语言输入 */
export interface IntakeInput {
  rawText: string;
  submittedAt: string;
  submittedBy: string;
}

/** Fact Pack 面向用户展示的结构化维度 */
export interface FactPackStructuredDimensions {
  strategicBackground: string[];
  businessStatus: string[];
  businessChain: string[];
  bottlenecks: string[];
  resourcesConstraints: string[];
  organization: string[];
  customerMarket: string[];
  timeSuccessCriteria: string[];
  other: string[];
}

/** 结构化后的事实包 */
export interface FactPack {
  businessContext: string;
  structuredDimensions?: FactPackStructuredDimensions;
  currentChallenges: string[];
  strategicGoals: string[];
  constraints: string[];
  stakeholders: string[];
  timeframe: string;
  baselines: string[];
  candidateMetrics: string[];
  risks: string[];
  dependencies: string[];
  nonGoals: string[];
  structuredAt: string;
}

/** 缺失信息包 */
export interface MissingInfoPack {
  missingFields: MissingField[];
  generatedAt: string;
}

export interface MissingField {
  field: string;
  reason: string;
  priority: "high" | "medium" | "low";
  suggestion?: string;
}

// ---- OKR Models ----

export interface Objective {
  id: string;
  title: string;
  description: string;
  keyResults: KeyResult[];
}

export interface KeyResult {
  id: string;
  title: string;
  metric: string;
  currentValue: string;
  targetValue: string;
  owner?: string;
  deadline?: string;
  assumptions?: string[];
  dependencies?: string[];
  risks?: string[];
  reasoning?: string;
  confidence: number;
}

/** OKR 草稿版本类型 */
export type DraftVariant = "conservative" | "balanced" | "aggressive";

export const DraftVariantLabel: Record<DraftVariant, string> = {
  conservative: "保守型",
  balanced: "平衡型",
  aggressive: "进取型",
};

export const DraftVariantColor: Record<DraftVariant, string> = {
  conservative: "bg-blue-50 text-blue-700",
  balanced: "bg-indigo-50 text-indigo-700",
  aggressive: "bg-orange-50 text-orange-700",
};

/** 单版 OKR 草稿 */
export interface OkrDraftVersion {
  variant: DraftVariant;
  objectives: Objective[];
  /** 拆解思路 / 推导说明 */
  reasoning: string;
  generatedAt: string;
  generatedBy: string;
}

/** 一个案例的全部草稿（固定三版） */
export interface OkrDraftSet {
  conservative: OkrDraftVersion;
  balanced: OkrDraftVersion;
  aggressive: OkrDraftVersion;
}

/** 审核报告 */
export interface ReviewReport {
  overallScore: number;
  passed: boolean;
  needsHumanReview: boolean;
  objectiveResults?: ReviewObjectiveResult[];
  variantResults?: ReviewVariantResult[];
  krReviews?: ReviewKrResult[];
  prerequisites: ReviewPrerequisite[];
  coreDimensions: ReviewDimension[];
  auxDimensions: ReviewDimension[];
  fatalIssues: string[];
  suggestions: string[];
  reviewedAt: string;
  reviewedBy: string;
}

export interface ReviewObjectiveResult {
  objectiveIndex: number;
  objectiveTitle: string;
  score: number;
  passed: boolean;
  passedKrCount: number;
  totalKrCount: number;
  reason?: string;
}

export interface ReviewVariantResult {
  variant: DraftVariant;
  score: number;
  passed: boolean;
  reason?: string;
}

export interface ReviewKrDimensionComment {
  name: string;
  score?: number;
  comment: string;
}

export interface ReviewKrResult {
  krId: string;
  objectiveIndex?: number;
  objectiveTitle?: string;
  variant: DraftVariant;
  score: number;
  passed: boolean;
  source?: "reviewer" | "local" | "pending";
  summary?: string;
  strengths: string[];
  deductions: string[];
  suggestions: string[];
  dimensionComments?: ReviewKrDimensionComment[];
}

export interface CandidateKr {
  id: string;
  kr: KeyResult;
  objectiveTitle: string;
  objectiveDescription?: string;
  variant: DraftVariant;
  score?: number;
  sourceRunId?: string;
  sourceLabel?: string;
  selectedAt: string;
}

export interface ReviewPrerequisite {
  label: string;
  met: boolean;
  note?: string;
}

export interface ReviewDimension {
  name: string;
  score: number;
  maxScore: number;
  comment: string;
}

/** 最终 OKR */
export interface FinalOkr {
  objectives: Objective[];
  finalizedAt: string;
  finalizedBy: string;
  version: number;
}

// ---- Case Model ----

export type CaseRunStatus =
  | "idle"
  | "running"
  | "completed_passed"
  | "completed_quality_failed"
  | "failed_no_result";

export type CaseRunStage =
  | "idle"
  | "structuring"
  | "waiting_for_info"
  | "decomposing"
  | "reviewing"
  | "looping"
  | "completed"
  | "failed";

export interface CaseRunEvent {
  id: string;
  runId: string;
  timestamp: string;
  actor: string;
  title: string;
  summary: string;
  detail?: string;
  kind: "user" | "interviewer" | "okr-expert" | "reviewer" | "coordinator" | "system";
  iteration?: number;
}

export interface OkrCase {
  id: string;
  tenantId?: string;
  title: string;
  status: CaseStatus;
  team: string;
  cycle: string;
  flowTemplateId: string;
  flowNodeRuns: FlowNodeRun[];
  activeRunId?: string;
  runStatus?: CaseRunStatus;
  runStage?: CaseRunStage;
  runStatusMessage?: string;
  runEvents?: CaseRunEvent[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  createdByUserId?: string;
  intake?: IntakeInput;
  factPack?: FactPack;
  missingInfo?: MissingInfoPack;
  okrDrafts?: OkrDraftSet;
  reviewReport?: ReviewReport;
  finalOkr?: FinalOkr;
  candidateKrs?: CandidateKr[];
  logs: CaseLogEntry[];
  tags: string[];
}

export function canReadCaseForAccount(
  c: OkrCase,
  role: AccountRole | undefined,
  currentTenantId: string | undefined,
  currentUserId: string | undefined
): boolean {
  if (!role || !currentTenantId || !currentUserId) return false;
  const caseTenantId = c.tenantId ?? currentTenantId;
  if (caseTenantId !== currentTenantId) return false;
  if (roleHasPermission(role, "case.readTenant")) return true;
  return roleHasPermission(role, "case.readOwn") && c.createdByUserId === currentUserId;
}

export type CaseRunDisplayStatus =
  | "running_waiting_for_info"
  | "running_processing"
  | "completed_passed"
  | "completed_quality_failed"
  | "failed_no_result";

export const CaseRunDisplayLabel: Record<CaseRunDisplayStatus, string> = {
  running_waiting_for_info: "进行中 · 等待用户补充信息",
  running_processing: "进行中 · 拆解&审核中",
  completed_passed: "已结束 · 质量达标",
  completed_quality_failed: "已结束 · 质量未达标",
  failed_no_result: "运行失败 · 无任何结果",
};

export const CaseRunDisplayColor: Record<CaseRunDisplayStatus, string> = {
  running_waiting_for_info: "bg-amber-50 text-amber-700",
  running_processing: "bg-blue-50 text-blue-700",
  completed_passed: "bg-emerald-50 text-emerald-700",
  completed_quality_failed: "bg-orange-50 text-orange-700",
  failed_no_result: "bg-red-50 text-red-700",
};

export function getCaseRunDisplayStatus(c: OkrCase): CaseRunDisplayStatus {
  if (c.runStatus === "running") {
    return c.runStage === "waiting_for_info" ? "running_waiting_for_info" : "running_processing";
  }
  if (c.runStatus === "idle") return "running_waiting_for_info";
  if (c.runStatus === "completed_passed") return "completed_passed";
  if (c.runStatus === "completed_quality_failed") return "completed_quality_failed";
  if (c.runStatus === "failed_no_result") return "failed_no_result";

  if (c.status === CaseStatus.REVIEW_PASSED || c.status === CaseStatus.FINALIZED) return "completed_passed";
  if (c.status === CaseStatus.REVIEW_FAILED || c.status === CaseStatus.HUMAN_REVIEW_REQUIRED) {
    return c.okrDrafts ? "completed_quality_failed" : "failed_no_result";
  }
  if (c.status === CaseStatus.INFO_INSUFFICIENT) return "running_waiting_for_info";
  return "running_processing";
}

export function isCaseRunBusy(c: OkrCase): boolean {
  return c.runStatus === "running" && c.runStage !== "waiting_for_info";
}

export function canCaseAcceptUserInput(c: OkrCase): boolean {
  return !isCaseRunBusy(c);
}

/** 案例日志条目 */
export interface CaseLogEntry {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  detail?: string;
}

// ---- Config Models ----

export type ConnectionType = "official" | "thirdparty" | "custom";

export const ConnectionTypeLabel: Record<ConnectionType, string> = {
  official: "官方模型",
  thirdparty: "第三方平台",
  custom: "自定义接口",
};

export interface RoleModelConfig {
  /** 接入类型 */
  connectionType: ConnectionType;
  /** 服务提供方（如 anthropic / openai / deepseek） */
  provider: string;
  /** 服务方显示名（中文，如"Anthropic 官方"） */
  providerDisplayName?: string;
  /** 模型标识 */
  modelId: string;
  /** 温度 */
  temperature: number;
  /** 最大 Token 数（兼容旧配置；新配置入口在流程模板中） */
  maxTokens?: number;
  /** Top P */
  topP?: number;
  /** 超时时间（毫秒，UI 按分钟展示） */
  timeout?: number;
  /** 重试策略 */
  retryPolicy?: "none" | "fixed" | "exponential";
  /** 推理模式 */
  reasoningMode?: "standard" | "extended";
  /** 成本等级 */
  costTier?: "low" | "medium" | "high";
  /** API Base URL（第三方/自定义时使用） */
  apiBaseUrl?: string;
  /** API Key（掩码存储） */
  apiKey?: string;
  /** 组织标识 */
  organizationId?: string;
  /** 项目标识 */
  projectId?: string;
  /** 额外请求头（JSON 字符串） */
  customHeaders?: string;
  /** 额外参数（JSON 字符串） */
  customParams?: string;
}

export interface RoleConfig {
  roleId: string;
  roleName: string;
  description: string;
  selectedTagIds?: RoleSelectedTagIds;
  principles: string[];
  generalSkills: string[];
  specializedSkills: string[];
  styleTraits: string[];
  systemPrompt: string;
  stylePrompt: string;
  outputSchema?: string;
  maxRetries: number;
  operationalNotes: string;
  model: RoleModelConfig;
  enabled: boolean;
}

export interface RoleSelectedTagIds {
  principles: string[];
  capabilities: string[];
  expressionStyles: string[];
}

export interface RoleTagItem {
  id: string;
  name: string;
  definition: string;
}

export interface RoleTagLibraries {
  principles: RoleTagItem[];
  capabilities: RoleTagItem[];
  expressionStyles: RoleTagItem[];
}

export interface ReviewConfig {
  weightedRules?: ReviewWeightedRule[];
  passThreshold: number;
  humanReviewEnabled: boolean;
  humanReviewThreshold: number;
  maxRetries: number;
  prerequisites: string[];
  coreDimensions: string[];
  auxDimensions: string[];
  failAction: "retry" | "human_review" | "halt";
}

export interface ReviewWeightedRule {
  id: string;
  label: string;
  weight: number;
}

export interface FlowNodeRun {
  nodeId: string;
  roleName: string;
  status: "pending" | "running" | "success" | "failed" | "skipped";
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface FlowEdgeState {
  from: string;
  to: string;
  condition?: string;
  active: boolean;
}

export interface FlowNodeConfig {
  id: string;
  roleId: string;
  label: string;
  description?: string;
  nodeType: "start" | "process" | "decision" | "end";
  allowAutoTransition: boolean;
  allowFallback: boolean;
  position: { x: number; y: number };
}

export interface FlowEdgeConfig {
  id: string;
  source: string;
  target: string;
  label?: string;
  condition?: string;
}

export interface FlowTemplate {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  nodes: FlowNodeConfig[];
  edges: FlowEdgeConfig[];
  loopSettings?: FlowLoopSettings;
  createdAt: string;
  updatedAt: string;
}

export interface FlowLoopSettings {
  outerLoop: {
    enabled: boolean;
    maxIterations: number;
  };
  infoCheckLoop: {
    enabled: boolean;
    maxIterations: number;
  };
  okrReviewLoop: {
    enabled: boolean;
    passThreshold: number;
    stopConditionMode: "or" | "and";
    maxIterationsEnabled: boolean;
    maxIterations: number;
    maxTokensEnabled: boolean;
    maxTokens: number;
    timeoutEnabled: boolean;
    timeoutSeconds: number;
  };
}

export type RunMode = "mock" | "live";

export interface AppConfig {
  runMode: RunMode;
  /** When true, live mode failures throw instead of falling back to mock */
  strictLive: boolean;
  roles: RoleConfig[];
  tagLibraries?: RoleTagLibraries;
  review: ReviewConfig;
  flowTemplates: FlowTemplate[];
}
