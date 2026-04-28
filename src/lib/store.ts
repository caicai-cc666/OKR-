import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { OkrCase, CaseLogEntry, FlowNodeRun, CaseStatus, AppConfig } from "@/types";
import { CaseStatus as CS } from "@/types";
import { mockCases } from "@/data/mock-cases";
import { mockConfig } from "@/data/mock-config";
import { transition } from "@/lib/state-machine";
import { runInformationStructuringAgent, runDecompositionAgent, runReviewerAgent } from "@/lib/ai/agents";

// ---- Helpers ----

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

// ---- Store interface ----

interface AppStore {
  // --- State ---
  cases: OkrCase[];
  config: AppConfig;

  // --- Case reads ---
  getCase: (id: string) => OkrCase | undefined;

  // --- Case actions ---
  createCase: (title: string, team: string, cycle: string, rawText: string) => string;
  updateCase: (id: string, partial: Partial<OkrCase>) => void;
  startAnalysis: (caseId: string) => void;
  startDecomposition: (caseId: string) => void;
  retryDecomposition: (caseId: string) => void;
  transitionStatus: (caseId: string, to: CaseStatus) => void;
  addLog: (caseId: string, action: string, actor: string, detail?: string) => void;
  updateFlowNode: (caseId: string, nodeId: string, status: FlowNodeRun["status"], error?: string) => void;
  switchFlowTemplate: (caseId: string, templateId: string) => void;
  supplementInfo: (caseId: string, field: string, value: string) => void;
  rerunNode: (caseId: string, nodeId: string) => void;

  // --- Config actions ---
  saveConfig: (partial: Partial<AppConfig>) => void;
  resetConfig: () => void;
  updateRoleConfig: (roleId: string, partial: Record<string, unknown>) => void;
  updateModelConfig: (roleId: string, partial: Record<string, unknown>) => void;
  updateReviewConfig: (partial: Record<string, unknown>) => void;
  addFlowTemplate: (template: import("@/types").FlowTemplate) => void;
  updateFlowTemplate: (id: string, partial: Partial<import("@/types").FlowTemplate>) => void;
  deleteFlowTemplate: (id: string) => void;
  setDefaultFlowTemplate: (id: string) => void;
}

// ---- Store implementation ----

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // --- Initial state ---
      cases: mockCases,
      config: mockConfig,

      // --- Case reads ---
      getCase: (id) => get().cases.find((c) => c.id === id),

      // --- Case mutations ---

      createCase: (title, team, cycle, rawText) => {
        const id = mkId();
        const now = new Date().toISOString();
        const defaultTemplate = get().config.flowTemplates.find((t) => t.isDefault);
        const newCase: OkrCase = {
          id,
          title,
          status: CS.NEW,
          team,
          cycle,
          flowTemplateId: defaultTemplate?.id ?? "flow-standard",
          flowNodeRuns: [],
          createdAt: now,
          updatedAt: now,
          createdBy: "用户",
          intake: rawText ? { rawText, submittedAt: now, submittedBy: "用户" } : undefined,
          logs: [mkLog("创建案例", "用户", `案例「${title}」已创建`)],
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
        const config = store.config;

        store.addLog(caseId, "开始分析", "系统", `运行模式: ${config.runMode}`);
        store.updateFlowNode(caseId, "intake", "success");
        store.updateFlowNode(caseId, "structuring", "running");

        // Async pipeline using agents
        (async () => {
          try {
            const rawText = c.intake?.rawText ?? "";

            // Step 1: Information structuring
            const structResult = await runInformationStructuringAgent(rawText, config);
            store.updateFlowNode(caseId, "structuring", "success");
            store.addLog(caseId, "信息结构化完成", "信息整理官", `模式: ${structResult.mode}`);

            // Step 2: Info check
            store.updateFlowNode(caseId, "info-check", "running");
            if (structResult.missingInfo) {
              store.updateFlowNode(caseId, "info-check", "failed", "信息不足");
              store.updateCase(caseId, {
                status: CS.INFO_INSUFFICIENT,
                factPack: structResult.factPack,
                missingInfo: structResult.missingInfo,
              });
              store.addLog(caseId, "信息检查", "协调器", "信息不足，需要补充");
              return;
            }

            store.updateFlowNode(caseId, "info-check", "success");
            store.updateCase(caseId, { factPack: structResult.factPack, status: CS.READY_FOR_DECOMPOSITION });
            store.addLog(caseId, "信息检查通过", "协调器", "信息充足，进入拆解");

            // Step 3: Decomposition
            store.updateFlowNode(caseId, "decompose", "running");
            const draftResult = await runDecompositionAgent(structResult.factPack, c.title, config);
            store.updateFlowNode(caseId, "decompose", "success");
            store.updateCase(caseId, { okrDrafts: draftResult.drafts, status: CS.OKR_DRAFT_GENERATED });
            store.addLog(caseId, "拆解完成", "OKR 拆解专家", `三版草稿已生成 (${draftResult.mode})`);

            // Step 4: Review
            store.updateFlowNode(caseId, "review", "running");
            const reviewResult = await runReviewerAgent(draftResult.drafts, config);
            const newStatus = reviewResult.review.passed ? CS.REVIEW_PASSED : reviewResult.review.needsHumanReview ? CS.HUMAN_REVIEW_REQUIRED : CS.REVIEW_FAILED;
            store.updateFlowNode(caseId, "review", reviewResult.review.passed ? "success" : "failed");
            store.updateCase(caseId, { reviewReport: reviewResult.review, status: newStatus });
            store.addLog(caseId, reviewResult.review.passed ? "审核通过" : "审核未通过", "审核官", `评分 ${reviewResult.review.overallScore}/100 (${reviewResult.mode})`);

            if (reviewResult.review.passed) {
              store.updateFlowNode(caseId, "finalize", "success");
              store.addLog(caseId, "自动定稿", "协调器", "审核通过，已自动定稿");
            }
          } catch (err) {
            store.addLog(caseId, "分析失败", "系统", `错误: ${err instanceof Error ? err.message : "未知错误"}`);
          }
        })();
      },

      startDecomposition: (caseId) => {
        const store = get();
        const c = store.getCase(caseId);
        if (!c) return;
        const config = store.config;

        store.addLog(caseId, "开始拆解", "用户", `运行模式: ${config.runMode}`);
        store.updateFlowNode(caseId, "decompose", "running");
        store.updateCase(caseId, { status: CS.READY_FOR_DECOMPOSITION, missingInfo: undefined });

        (async () => {
          try {
            const factPack = c.factPack ?? { businessContext: c.intake?.rawText ?? "", currentChallenges: [], strategicGoals: [], constraints: [], stakeholders: [], timeframe: c.cycle, baselines: [], candidateMetrics: [], risks: [], dependencies: [], nonGoals: [], structuredAt: new Date().toISOString() };
            const draftResult = await runDecompositionAgent(factPack, c.title, config);
            store.updateFlowNode(caseId, "decompose", "success");
            store.updateCase(caseId, { okrDrafts: draftResult.drafts, status: CS.OKR_DRAFT_GENERATED });
            store.addLog(caseId, "拆解完成", "OKR 拆解专家", `三版草稿已生成 (${draftResult.mode})`);

            store.updateFlowNode(caseId, "review", "running");
            const reviewResult = await runReviewerAgent(draftResult.drafts, config);
            const newStatus = reviewResult.review.passed ? CS.REVIEW_PASSED : reviewResult.review.needsHumanReview ? CS.HUMAN_REVIEW_REQUIRED : CS.REVIEW_FAILED;
            store.updateFlowNode(caseId, "review", reviewResult.review.passed ? "success" : "failed");
            store.updateCase(caseId, { reviewReport: reviewResult.review, status: newStatus });
            store.addLog(caseId, reviewResult.review.passed ? "审核通过" : "审核未通过", "审核官", `评分 ${reviewResult.review.overallScore}/100 (${reviewResult.mode})`);
          } catch (err) {
            store.addLog(caseId, "拆解失败", "系统", `错误: ${err instanceof Error ? err.message : "未知错误"}`);
          }
        })();
      },

      retryDecomposition: (caseId) => {
        const store = get();
        const c = store.getCase(caseId);
        if (!c) return;
        const config = store.config;

        store.addLog(caseId, "重新拆解", "用户", `运行模式: ${config.runMode}`);
        store.updateFlowNode(caseId, "decompose", "running");
        store.updateFlowNode(caseId, "review", "pending");

        (async () => {
          try {
            const factPack = c.factPack ?? { businessContext: c.intake?.rawText ?? "", currentChallenges: [], strategicGoals: [], constraints: [], stakeholders: [], timeframe: c.cycle, baselines: [], candidateMetrics: [], risks: [], dependencies: [], nonGoals: [], structuredAt: new Date().toISOString() };
            const draftResult = await runDecompositionAgent(factPack, c.title, config);
            store.updateFlowNode(caseId, "decompose", "success");
            store.updateCase(caseId, { okrDrafts: draftResult.drafts });
            store.addLog(caseId, "重新拆解完成", "OKR 拆解专家", `新三版草稿已生成 (${draftResult.mode})`);

            store.updateFlowNode(caseId, "review", "running");
            const reviewResult = await runReviewerAgent(draftResult.drafts, config);
            const newStatus = reviewResult.review.passed ? CS.REVIEW_PASSED : CS.REVIEW_FAILED;
            store.updateFlowNode(caseId, "review", reviewResult.review.passed ? "success" : "failed");
            store.updateCase(caseId, { reviewReport: reviewResult.review, status: newStatus });
            store.addLog(caseId, reviewResult.review.passed ? "审核通过" : "审核未通过", "审核官", `评分 ${reviewResult.review.overallScore}/100 (${reviewResult.mode})`);
          } catch (err) {
            store.addLog(caseId, "重新拆解失败", "系统", `错误: ${err instanceof Error ? err.message : "未知错误"}`);
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
          cases: state.cases.map((c) =>
            c.id === caseId
              ? {
                  ...c,
                  updatedAt: new Date().toISOString(),
                  logs: [...c.logs, mkLog("补充信息", "用户", `补充字段「${field}」: ${value}`)],
                }
              : c
          ),
        }));
      },

      rerunNode: (caseId, nodeId) => {
        const store = get();
        store.addLog(caseId, "节点重跑", "用户", `手动触发节点「${nodeId}」重新执行`);
        store.updateFlowNode(caseId, nodeId, "running");
        setTimeout(() => {
          store.updateFlowNode(caseId, nodeId, "success");
          store.addLog(caseId, "节点重跑完成", "系统", `节点「${nodeId}」执行成功`);
        }, 1500);
      },

      // --- Config actions ---

      saveConfig: (partial) => {
        set((s) => ({ config: { ...s.config, ...partial } }));
      },

      resetConfig: () => {
        set({ config: mockConfig });
      },

      updateRoleConfig: (roleId, partial) => {
        set((s) => ({
          config: {
            ...s.config,
            roles: s.config.roles.map((r) =>
              r.roleId === roleId ? { ...r, ...partial } : r
            ),
          },
        }));
      },

      updateModelConfig: (roleId, partial) => {
        set((s) => ({
          config: {
            ...s.config,
            roles: s.config.roles.map((r) =>
              r.roleId === roleId ? { ...r, model: { ...r.model, ...partial } } : r
            ),
          },
        }));
      },

      updateReviewConfig: (partial) => {
        set((s) => ({
          config: {
            ...s.config,
            review: { ...s.config.review, ...partial },
          },
        }));
      },

      addFlowTemplate: (template) => {
        set((s) => ({
          config: {
            ...s.config,
            flowTemplates: [...s.config.flowTemplates, template],
          },
        }));
      },

      updateFlowTemplate: (id, partial) => {
        set((s) => ({
          config: {
            ...s.config,
            flowTemplates: s.config.flowTemplates.map((t) =>
              t.id === id ? { ...t, ...partial, updatedAt: new Date().toISOString() } : t
            ),
          },
        }));
      },

      deleteFlowTemplate: (id) => {
        set((s) => ({
          config: {
            ...s.config,
            flowTemplates: s.config.flowTemplates.filter((t) => t.id !== id),
          },
        }));
      },

      setDefaultFlowTemplate: (id) => {
        set((s) => ({
          config: {
            ...s.config,
            flowTemplates: s.config.flowTemplates.map((t) => ({
              ...t,
              isDefault: t.id === id,
            })),
          },
        }));
      },
    }),
    {
      name: "okr-harness-store",
    }
  )
);

// Backward compat alias
export const useCaseStore = useAppStore;
