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

/** 结构化后的事实包 */
export interface FactPack {
  businessContext: string;
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
  prerequisites: ReviewPrerequisite[];
  coreDimensions: ReviewDimension[];
  auxDimensions: ReviewDimension[];
  fatalIssues: string[];
  suggestions: string[];
  reviewedAt: string;
  reviewedBy: string;
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

export interface OkrCase {
  id: string;
  title: string;
  status: CaseStatus;
  team: string;
  cycle: string;
  flowTemplateId: string;
  flowNodeRuns: FlowNodeRun[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  intake?: IntakeInput;
  factPack?: FactPack;
  missingInfo?: MissingInfoPack;
  okrDrafts?: OkrDraftSet;
  reviewReport?: ReviewReport;
  finalOkr?: FinalOkr;
  logs: CaseLogEntry[];
  tags: string[];
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
  /** 最大 Token 数 */
  maxTokens: number;
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
  principles: string[];
  generalSkills: string[];
  specializedSkills: string[];
  styleTraits: string[];
  systemPrompt: string;
  stylePrompt: string;
  maxRetries: number;
  operationalNotes: string;
  model: RoleModelConfig;
  enabled: boolean;
}

export interface ReviewConfig {
  passThreshold: number;
  humanReviewEnabled: boolean;
  humanReviewThreshold: number;
  maxRetries: number;
  prerequisites: string[];
  coreDimensions: string[];
  auxDimensions: string[];
  failAction: "retry" | "human_review" | "halt";
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
  createdAt: string;
  updatedAt: string;
}

export type RunMode = "mock" | "live";

export interface AppConfig {
  runMode: RunMode;
  roles: RoleConfig[];
  review: ReviewConfig;
  flowTemplates: FlowTemplate[];
}
