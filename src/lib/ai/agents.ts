import type { FactPack, MissingInfoPack, OkrDraftSet, ReviewReport, AppConfig, RoleConfig, RunMode } from "@/types";
import { runAgent } from "./provider";
import type { AICallResult } from "./provider";

function getRole(roleId: string, config: AppConfig): RoleConfig {
  const role = config.roles.find((r) => r.roleId === roleId);
  if (!role) throw new Error(`Role not found: ${roleId}`);
  return role;
}

function tryParseJson<T>(content: string): T | null {
  // Try to extract JSON from markdown code blocks or raw JSON
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || content.match(/(\{[\s\S]*\})/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[1]) as T;
  } catch {
    return null;
  }
}

// ---- Mock fallback generators ----

function mockFactPack(rawText: string, cycle: string): FactPack {
  return {
    businessContext: rawText.slice(0, 100) + (rawText.length > 100 ? "..." : ""),
    currentChallenges: ["从输入中提取的挑战 1", "从输入中提取的挑战 2"],
    strategicGoals: ["从输入中提取的目标 1"],
    constraints: ["从输入中提取的约束"],
    stakeholders: ["提交者"],
    timeframe: cycle || "Q3 2026",
    baselines: ["待确认"],
    candidateMetrics: ["待确认"],
    risks: ["信息可能不完整"],
    dependencies: [],
    nonGoals: [],
    structuredAt: new Date().toISOString(),
  };
}

function mockDraftSet(title: string, expertName: string): OkrDraftSet {
  const now = new Date().toISOString();
  const mk = (variant: "conservative" | "balanced" | "aggressive", conf: number) => ({
    variant,
    objectives: [{
      id: `${variant}-obj-${Date.now()}`,
      title: `[${variant === "conservative" ? "保守" : variant === "balanced" ? "平衡" : "进取"}] ${title}`,
      description: `由${expertName}拆解生成`,
      keyResults: [
        { id: `${variant}-kr1-${Date.now()}`, title: "关键结果 1", metric: "核心指标", currentValue: "待填", targetValue: "待填", confidence: conf },
        { id: `${variant}-kr2-${Date.now()}`, title: "关键结果 2", metric: "辅助指标", currentValue: "待填", targetValue: "待填", confidence: conf - 0.1 },
      ],
    }],
    reasoning: `【${variant === "conservative" ? "保守型" : variant === "balanced" ? "平衡型" : "进取型"}】基于业务背景自动生成的拆解思路...`,
    generatedAt: now,
    generatedBy: expertName,
  });
  return {
    conservative: { ...mk("conservative", 0.85), variant: "conservative" as const },
    balanced: { ...mk("balanced", 0.7), variant: "balanced" as const },
    aggressive: { ...mk("aggressive", 0.45), variant: "aggressive" as const },
  };
}

// ---- Agent functions ----

export async function runInformationStructuringAgent(
  rawText: string,
  config: AppConfig
): Promise<{ factPack: FactPack; missingInfo: MissingInfoPack | null; mode: "live" | "mock" }> {
  const role = getRole("interviewer", config);
  const prompt = `请将以下业务背景结构化为 JSON，包含字段：businessContext, currentChallenges[], strategicGoals[], constraints[], stakeholders[], timeframe, baselines[], candidateMetrics[], risks[], dependencies[], nonGoals[]。同时判断信息是否充足，如果不足请输出 missingFields 数组（每项含 field, reason, priority, suggestion）。\n\n输入：\n${rawText}`;

  const result = await runAgent(role, prompt, config.runMode);

  if (result.mode === "live" && result.content) {
    const parsed = tryParseJson<{ factPack?: FactPack; missingFields?: Array<{ field: string; reason: string; priority: string; suggestion?: string }> }>(result.content);
    if (parsed?.factPack) {
      const missingInfo = parsed.missingFields?.length
        ? { missingFields: parsed.missingFields.map(f => ({ ...f, priority: f.priority as "high" | "medium" | "low" })), generatedAt: new Date().toISOString() }
        : null;
      return { factPack: { ...parsed.factPack, structuredAt: new Date().toISOString() }, missingInfo, mode: "live" };
    }
  }

  // Mock fallback
  const factPack = mockFactPack(rawText, "");
  const isShort = rawText.length < 100;
  const missingInfo = isShort ? {
    missingFields: [{ field: "详细业务背景", reason: "输入信息过于简略", priority: "high" as const, suggestion: "请补充更详细的业务现状、目标和约束条件" }],
    generatedAt: new Date().toISOString(),
  } : null;

  return { factPack, missingInfo, mode: result.mode };
}

export async function runDecompositionAgent(
  factPack: FactPack,
  title: string,
  config: AppConfig
): Promise<{ drafts: OkrDraftSet; mode: "live" | "mock" }> {
  const role = getRole("okr-expert", config);
  const prompt = `基于以下结构化业务信息，请生成三个版本的 OKR 方案（conservative/balanced/aggressive），每版包含 objectives 数组（每个 objective 含 title, description, keyResults 数组），以及 reasoning 字段解释拆解思路。请以 JSON 格式输出 {conservative: {...}, balanced: {...}, aggressive: {...}}。\n\n业务信息：\n${JSON.stringify(factPack, null, 2)}`;

  const result = await runAgent(role, prompt, config.runMode);

  if (result.mode === "live" && result.content) {
    const parsed = tryParseJson<Record<string, unknown>>(result.content);
    if (parsed?.conservative && parsed?.balanced && parsed?.aggressive) {
      // Validate minimal structure
      const now = new Date().toISOString();
      const wrap = (v: Record<string, unknown>, variant: string) => ({
        variant,
        objectives: Array.isArray(v.objectives) ? v.objectives : [],
        reasoning: (v.reasoning as string) || "由模型生成",
        generatedAt: now,
        generatedBy: role.roleName,
      });
      return {
        drafts: {
          conservative: wrap(parsed.conservative as Record<string, unknown>, "conservative"),
          balanced: wrap(parsed.balanced as Record<string, unknown>, "balanced"),
          aggressive: wrap(parsed.aggressive as Record<string, unknown>, "aggressive"),
        } as OkrDraftSet,
        mode: "live",
      };
    }
  }

  return { drafts: mockDraftSet(title, role.roleName), mode: result.mode };
}

export async function runReviewerAgent(
  drafts: OkrDraftSet,
  config: AppConfig
): Promise<{ review: ReviewReport; mode: "live" | "mock" }> {
  const role = getRole("reviewer", config);
  const rc = config.review;
  const prompt = `请审核以下 OKR 草稿（平衡型版本），按以下维度评分（1-10）：${rc.coreDimensions.join("、")}。辅助维度：${rc.auxDimensions.join("、")}。通过阈值 ${rc.passThreshold}/100。请以 JSON 输出 {overallScore, passed, prerequisites[], coreDimensions[], auxDimensions[], fatalIssues[], suggestions[]}。\n\n草稿：\n${JSON.stringify(drafts.balanced, null, 2)}`;

  const result = await runAgent(role, prompt, config.runMode);

  if (result.mode === "live" && result.content) {
    const parsed = tryParseJson<Partial<ReviewReport>>(result.content);
    if (parsed?.overallScore !== undefined) {
      return {
        review: {
          overallScore: parsed.overallScore,
          passed: parsed.passed ?? parsed.overallScore >= rc.passThreshold,
          needsHumanReview: rc.humanReviewEnabled && !(parsed.passed ?? parsed.overallScore >= rc.passThreshold) && parsed.overallScore >= rc.humanReviewThreshold,
          prerequisites: parsed.prerequisites ?? rc.prerequisites.map(l => ({ label: l, met: true })),
          coreDimensions: parsed.coreDimensions ?? [],
          auxDimensions: parsed.auxDimensions ?? [],
          fatalIssues: parsed.fatalIssues ?? [],
          suggestions: parsed.suggestions ?? [],
          reviewedAt: new Date().toISOString(),
          reviewedBy: role.roleName,
        },
        mode: "live",
      };
    }
  }

  // Mock fallback using config
  const score = 65 + Math.floor(Math.random() * 30);
  const passed = score >= rc.passThreshold;
  return {
    review: {
      overallScore: score,
      passed,
      needsHumanReview: rc.humanReviewEnabled && !passed && score >= rc.humanReviewThreshold,
      prerequisites: rc.prerequisites.map((label, i) => ({ label, met: i === 2 ? score > 70 : true })),
      coreDimensions: rc.coreDimensions.map((name, i) => ({ name, score: Math.min(10, Math.max(3, Math.round(score / (10 + i)))), maxScore: 10, comment: "自动评估" })),
      auxDimensions: rc.auxDimensions.map((name) => ({ name, score: 5 + Math.floor(Math.random() * 4), maxScore: 10, comment: "自动评估" })),
      fatalIssues: passed ? [] : ["部分 KR 缺乏明确基线数据"],
      suggestions: passed ? ["建议补充阶段性里程碑"] : ["建议补充基线数据", "建议细化目标"],
      reviewedAt: new Date().toISOString(),
      reviewedBy: role.roleName,
    },
    mode: result.mode,
  };
}

export async function runOrchestrator(
  rawText: string,
  config: AppConfig,
  callbacks?: { onStep?: (step: string, mode: "live" | "mock") => void }
) {
  const structResult = await runInformationStructuringAgent(rawText, config);
  callbacks?.onStep?.("信息结构化", structResult.mode);

  if (structResult.missingInfo) {
    return { factPack: structResult.factPack, missingInfo: structResult.missingInfo, mode: structResult.mode };
  }

  const draftResult = await runDecompositionAgent(structResult.factPack, rawText.slice(0, 30), config);
  callbacks?.onStep?.("OKR 拆解", draftResult.mode);

  const reviewResult = await runReviewerAgent(draftResult.drafts, config);
  callbacks?.onStep?.("质量审核", reviewResult.mode);

  return {
    factPack: structResult.factPack,
    missingInfo: null,
    drafts: draftResult.drafts,
    review: reviewResult.review,
    mode: reviewResult.mode,
  };
}
