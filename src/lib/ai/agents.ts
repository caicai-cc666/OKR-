import type { FactPack, FactPackStructuredDimensions, MissingInfoPack, OkrDraftSet, ReviewReport, ReviewKrResult, ReviewObjectiveResult, AppConfig, RoleConfig, DraftVariant, Objective, KeyResult, FlowLoopSettings, OkrDraftVersion, ReviewWeightedRule, RoleTagItem } from "@/types";
import { runAgent } from "./provider";

function tagDefinitions(items: RoleTagItem[] | undefined, ids: string[] | undefined): string[] {
  if (!items?.length || !ids?.length) return [];
  return ids
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is RoleTagItem => Boolean(item))
    .map((item) => `${item.name}：${item.definition}`);
}

export function resolveRoleConfig(role: RoleConfig, config: AppConfig): RoleConfig {
  const selected = role.selectedTagIds;
  if (!selected || !config.tagLibraries) return role;
  const principles = tagDefinitions(config.tagLibraries.principles, selected.principles);
  const capabilities = tagDefinitions(config.tagLibraries.capabilities, selected.capabilities);
  const expressionStyles = tagDefinitions(config.tagLibraries.expressionStyles, selected.expressionStyles);
  return {
    ...role,
    principles: principles.length ? principles : role.principles,
    generalSkills: capabilities.length ? capabilities : role.generalSkills,
    specializedSkills: [],
    styleTraits: expressionStyles.length ? expressionStyles : role.styleTraits,
  };
}

export function describeRoleRuntimeConfig(roleId: string, config: AppConfig): string {
  const role = getRole(roleId, config);
  return [
    `角色定义：${role.systemPrompt.slice(0, 120)}${role.systemPrompt.length > 120 ? "..." : ""}`,
    role.principles.length ? `宪法性原则：${role.principles.slice(0, 4).join("；")}` : "",
    [...role.generalSkills, ...role.specializedSkills].length ? `专业能力：${[...role.generalSkills, ...role.specializedSkills].slice(0, 4).join("；")}` : "",
    role.styleTraits.length ? `表达方式：${role.styleTraits.slice(0, 4).join("；")}` : "",
  ].filter(Boolean).join("\n");
}

function getRole(roleId: string, config: AppConfig): RoleConfig {
  const role = config.roles.find((r) => r.roleId === roleId);
  if (!role) throw new Error(`Role not found: ${roleId}`);
  return resolveRoleConfig(role, config);
}

function getStrictLive(config: AppConfig): boolean {
  return config.strictLive ?? false;
}

const DEFAULT_AGENT_MAX_TOKENS = 8000;
const DEFAULT_AGENT_TIMEOUT_MS = 180000;

function withFlowRuntimeSettings(role: RoleConfig, loopSettings?: FlowLoopSettings): RoleConfig {
  const loop = loopSettings?.okrReviewLoop;
  const maxTokens = loop?.maxTokensEnabled === false
    ? role.model.maxTokens ?? DEFAULT_AGENT_MAX_TOKENS
    : loop?.maxTokens && loop.maxTokens > 0
      ? loop.maxTokens
      : role.model.maxTokens ?? DEFAULT_AGENT_MAX_TOKENS;
  const timeout = loop?.timeoutEnabled === false
    ? role.model.timeout ?? DEFAULT_AGENT_TIMEOUT_MS
    : loop?.timeoutSeconds && loop.timeoutSeconds > 0
      ? loop.timeoutSeconds * 1000
      : role.model.timeout ?? DEFAULT_AGENT_TIMEOUT_MS;

  return {
    ...role,
    model: {
      ...role.model,
      maxTokens,
      timeout,
    },
  };
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

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }
  return [];
}

function looksMissing(value: string): boolean {
  return /^(待确认|待补充|待明确|待填|待定|未知|暂无|无|占位|placeholder|tbd|n\/a)$/i.test(value.trim());
}

function hasUsefulItems(items: string[]): boolean {
  return items.length > 0 && items.some((item) => !looksMissing(item));
}

function splitSentences(rawText: string): string[] {
  return rawText
    .split(/[。；;！!\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function uniqueUseful(items: string[], limit = 5): string[] {
  return [...new Set(items.map((item) => item.trim()).filter((item) => item && !looksMissing(item)))].slice(0, limit);
}

function sentenceMatches(sentences: string[], pattern: RegExp, limit = 5): string[] {
  return uniqueUseful(sentences.filter((sentence) => pattern.test(sentence)), limit);
}

function inferStructuredDimensions(rawText: string, factPack?: Partial<FactPack>): FactPackStructuredDimensions {
  const sentences = splitSentences(rawText);
  const strategicBackground = uniqueUseful([
    ...sentenceMatches(sentences, /(为什么|背景|目标|希望|想|计划|优先级|战略|达成|提升|增长|降低|承接)/),
    ...(factPack?.strategicGoals ?? []),
  ]);
  const businessStatus = uniqueUseful([
    ...sentenceMatches(sentences, /(当前|目前|现在|已经|过去|现状|效果|做到|基线|从|达到|提升到|降低到)/),
    ...(factPack?.baselines ?? []),
  ]);
  const businessChain = uniqueUseful([
    ...sentenceMatches(sentences, /(链路|流程|转化|漏斗|指标|衡量|完播|播放|观看|留存|成交|订单|GMV|DAU|MAU|NPS)/),
    ...(factPack?.candidateMetrics ?? []),
  ]);
  const bottlenecks = uniqueUseful([
    ...sentenceMatches(sentences, /(问题|瓶颈|挑战|卡|困难|矛盾|风险|痛点|不确定|担心)/),
    ...(factPack?.currentChallenges ?? []),
    ...(factPack?.risks ?? []),
  ]);
  const resourcesConstraints = uniqueUseful([
    ...sentenceMatches(sentences, /(资源|预算|人力|团队|时间|周期|限制|约束|不能|只有|依赖|需要|审批)/),
    ...(factPack?.constraints ?? []),
    ...(factPack?.dependencies ?? []),
  ]);
  const organization = uniqueUseful([
    ...sentenceMatches(sentences, /(负责|owner|Owner|团队|部门|事业部|中心|小组|协同|协作|分工|承接)/),
    ...(factPack?.stakeholders ?? []),
  ]);
  const customerMarket = sentenceMatches(sentences, /(客户|用户|市场|竞争|竞品|人群|渠道|行业|需求)/);
  const timeSuccessCriteria = uniqueUseful([
    ...sentenceMatches(sentences, /(时间|周期|节奏|本月|本季度|今年|Q[1-4]|H[12]|成功|验收|标准|达到|完成|提升到|降低到)/i),
    factPack?.timeframe ?? "",
  ]);
  const used = new Set([
    ...strategicBackground,
    ...businessStatus,
    ...businessChain,
    ...bottlenecks,
    ...resourcesConstraints,
    ...organization,
    ...customerMarket,
    ...timeSuccessCriteria,
  ]);
  const other = uniqueUseful(sentences.filter((sentence) => !used.has(sentence)), 5);

  return {
    strategicBackground,
    businessStatus,
    businessChain,
    bottlenecks,
    resourcesConstraints,
    organization,
    customerMarket,
    timeSuccessCriteria,
    other,
  };
}

function normalizeStructuredDimensions(
  value: unknown,
  fallbackRawText: string,
  inferredFactPack: FactPack
): FactPackStructuredDimensions {
  const inferred = inferStructuredDimensions(fallbackRawText, inferredFactPack);
  if (!value || typeof value !== "object") return inferred;
  const raw = value as Partial<Record<keyof FactPackStructuredDimensions, unknown>>;
  const pick = (key: keyof FactPackStructuredDimensions) => {
    const items = toStringArray(raw[key]);
    return hasUsefulItems(items) ? items : inferred[key];
  };
  return {
    strategicBackground: pick("strategicBackground"),
    businessStatus: pick("businessStatus"),
    businessChain: pick("businessChain"),
    bottlenecks: pick("bottlenecks"),
    resourcesConstraints: pick("resourcesConstraints"),
    organization: pick("organization"),
    customerMarket: pick("customerMarket"),
    timeSuccessCriteria: pick("timeSuccessCriteria"),
    other: pick("other"),
  };
}

function inferCandidateMetrics(rawText: string): string[] {
  const metrics = new Set<string>();
  const metricMatches = rawText.match(/[\u4e00-\u9fa5A-Za-z0-9]*(?:率|数|额|时长|成本|收入|利润|GMV|DAU|MAU|NPS)/g) ?? [];
  metricMatches
    .map((item) => item.trim())
    .filter((item) => item.length >= 2 && !looksMissing(item))
    .slice(0, 8)
    .forEach((item) => metrics.add(item));
  const rules: Array<[RegExp, string[]]> = [
    [/增长|用户|DAU|MAU|活跃|获客|留存/i, ["活跃用户数", "新增用户数", "留存率", "获客成本"]],
    [/转化|电商|购买|GMV|订单/i, ["购买转化率", "GMV", "订单数", "客单价"]],
    [/续费|客户成功|NPS|流失|满意/i, ["续费率", "NPS", "流失率", "客户健康度"]],
    [/研发|迭代|上线|bug|缺陷|测试/i, ["迭代周期", "上线频率", "线上缺陷数", "测试覆盖率"]],
    [/视频|播放|完播|观看|内容/i, ["视频完播率", "播放量", "观看时长", "互动率"]],
    [/收入|营收|利润|成本|降本/i, ["收入", "利润率", "成本", "ROI"]],
  ];
  for (const [pattern, values] of rules) {
    if (pattern.test(rawText)) values.forEach((value) => metrics.add(value));
  }
  return [...metrics];
}

function inferFactPackFromRawText(rawText: string, cycle = ""): FactPack {
  const numbers = rawText.match(/(?:\d+(?:\.\d+)?\s*(?:万|亿|%|人|次|天|周|月|元|分)?)|(?:Q[1-4]\s*\d{4})|(?:H[12]\s*\d{4})/gi) ?? [];
  const sentences = splitSentences(rawText);
  const goalSentences = sentences
    .filter((part) => /(目标|希望|想|计划|提升|降低|增长|达到|完成|进入|建设)/.test(part))
    .slice(0, 4);
  const constraintSentences = sentences
    .filter((part) => /(预算|团队|人|周期|时间|资源|限制|约束|只有|需要)/.test(part))
    .slice(0, 4);
  const stakeholderMatches = rawText.match(/[\u4e00-\u9fa5A-Za-z0-9]+(?:团队|部门|事业部|中心|小组|负责人|Owner|owner|TL|PM|CTO|CEO|VP)/g) ?? [];

  const factPack: FactPack = {
    businessContext: rawText.trim(),
    currentChallenges: rawText.match(/(挑战|问题|困难|风险|痛点)[^。；;！!\n]*/g)?.slice(0, 4) ?? [],
    strategicGoals: goalSentences,
    constraints: constraintSentences,
    stakeholders: [...new Set(stakeholderMatches)].slice(0, 5),
    timeframe: cycle || rawText.match(/Q[1-4]\s*\d{4}|H[12]\s*\d{4}|上半年|下半年|本季度|本月|今年/gi)?.[0] || "",
    baselines: numbers.slice(0, 8),
    candidateMetrics: inferCandidateMetrics(rawText),
    risks: rawText.match(/[^。；;！!\n]*(?:风险|不确定|依赖|可能|担心)[^。；;！!\n]*/g)?.slice(0, 4) ?? [],
    dependencies: rawText.match(/[^。；;！!\n]*(?:依赖|需要|等待|配合|审批)[^。；;！!\n]*/g)?.slice(0, 4) ?? [],
    nonGoals: [],
    structuredAt: new Date().toISOString(),
  };
  return {
    ...factPack,
    structuredDimensions: inferStructuredDimensions(rawText, factPack),
  };
}

function normalizeFactPack(raw: Partial<FactPack>, fallbackRawText: string): FactPack {
  const inferred = inferFactPackFromRawText(fallbackRawText);
  const normalized: FactPack = {
    businessContext: raw.businessContext || inferred.businessContext,
    currentChallenges: hasUsefulItems(toStringArray(raw.currentChallenges)) ? toStringArray(raw.currentChallenges) : inferred.currentChallenges,
    strategicGoals: hasUsefulItems(toStringArray(raw.strategicGoals)) ? toStringArray(raw.strategicGoals) : inferred.strategicGoals,
    constraints: hasUsefulItems(toStringArray(raw.constraints)) ? toStringArray(raw.constraints) : inferred.constraints,
    stakeholders: hasUsefulItems(toStringArray(raw.stakeholders)) ? toStringArray(raw.stakeholders) : inferred.stakeholders,
    timeframe: raw.timeframe || inferred.timeframe,
    baselines: hasUsefulItems(toStringArray(raw.baselines)) ? toStringArray(raw.baselines) : inferred.baselines,
    candidateMetrics: hasUsefulItems(toStringArray(raw.candidateMetrics)) ? toStringArray(raw.candidateMetrics) : inferred.candidateMetrics,
    risks: hasUsefulItems(toStringArray(raw.risks)) ? toStringArray(raw.risks) : inferred.risks,
    dependencies: hasUsefulItems(toStringArray(raw.dependencies)) ? toStringArray(raw.dependencies) : inferred.dependencies,
    nonGoals: toStringArray(raw.nonGoals),
    structuredAt: new Date().toISOString(),
  };
  return {
    ...normalized,
    structuredDimensions: normalizeStructuredDimensions(raw.structuredDimensions, fallbackRawText, normalized),
  };
}

function inferMissingInfo(factPack: FactPack): MissingInfoPack | null {
  const missingFields: MissingInfoPack["missingFields"] = [];
  const add = (field: string, reason: string, priority: "high" | "medium" | "low", suggestion: string) => {
    missingFields.push({ field, reason, priority, suggestion });
  };

  if (!hasUsefulItems(factPack.strategicGoals)) {
    add("战略目标", "没有明确本周期要达成的业务结果，无法形成有效 Objective。", "high", "请补充 1-3 个最重要的业务结果。");
  }
  if (!hasUsefulItems(factPack.baselines)) {
    add("当前基线", "缺少现状数据，KR 的目标值无法判断是否合理。", "high", "请补充当前规模、转化率、收入、效率或质量数据。");
  }
  if (!hasUsefulItems(factPack.candidateMetrics)) {
    add("候选指标", "缺少可衡量指标，KR 容易变成任务描述。", "high", "请补充能衡量目标是否达成的指标。");
  }
  if (!hasUsefulItems(factPack.constraints)) {
    add("约束条件", "缺少资源、预算、周期或团队约束，方案可行性难以评估。", "medium", "请补充预算、人力、周期、技术限制或业务边界。");
  }
  if (!hasUsefulItems(factPack.stakeholders)) {
    add("承接团队 / Owner", "缺少责任归属，后续下级拆解也缺少承接对象。", "medium", "请补充负责团队即可，不一定要具体到个人。");
  }

  return missingFields.length ? { missingFields, generatedAt: new Date().toISOString() } : null;
}

// ---- Mock fallback generators ----

function mockFactPack(rawText: string, cycle: string): FactPack {
  return inferFactPackFromRawText(rawText, cycle);
}

let _mockIdCounter = 0;
function nextMockId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++_mockIdCounter}`;
}

function mockDraftSet(title: string, expertName: string): OkrDraftSet {
  const now = new Date().toISOString();
  const labels: Record<DraftVariant, string> = { conservative: "保守型", balanced: "平衡型", aggressive: "进取型" };
  const variantNotes: Record<DraftVariant, string> = {
    conservative: "保守型优先保证可达成性，选择确定性更高、资源要求更低的结果维度。",
    balanced: "平衡型兼顾业务牵引和资源可行性，选择最适合作为默认推进的结果维度。",
    aggressive: "进取型强调突破和拉升空间，选择更能牵引增长但风险更高的结果维度。",
  };
  const mk = (variant: "conservative" | "balanced" | "aggressive", conf: number) => ({
    variant,
    objectives: [{
      id: nextMockId(`${variant}-obj`),
      title,
      description: `由${expertName}拆解生成`,
      keyResults: [
        { id: nextMockId(`${variant}-kr1`), title: `${labels[variant]} KR 1：提升核心业务结果`, metric: "核心结果指标", currentValue: "待填", targetValue: "待填", reasoning: `${variantNotes[variant]} 这条 KR 用来承接最直接的业务结果变化。`, confidence: conf },
        { id: nextMockId(`${variant}-kr2`), title: `${labels[variant]} KR 2：改善关键支撑指标`, metric: "支撑指标", currentValue: "待填", targetValue: "待填", reasoning: `${variantNotes[variant]} 这条 KR 从另一个维度补足主结果的可实现路径。`, confidence: conf - 0.1 },
      ],
    }],
    reasoning: `【演示模式】【${labels[variant]}】基于业务背景生成 2 条不同维度的 ${labels[variant]} KR。`,
    generatedAt: now,
    generatedBy: `${expertName}（演示模式）`,
  });
  return {
    conservative: { ...mk("conservative", 0.85), variant: "conservative" as const },
    balanced: { ...mk("balanced", 0.7), variant: "balanced" as const },
    aggressive: { ...mk("aggressive", 0.45), variant: "aggressive" as const },
  };
}

function isPlaceholderText(value?: string): boolean {
  if (!value?.trim()) return true;
  const text = value.trim();
  if (looksMissing(text)) return true;
  return [
    "提升核心业务结果",
    "改善关键支撑指标",
    "核心结果指标",
    "支撑指标",
    "核心指标",
    "关键指标",
    "核心业务结果",
    "关键支撑指标",
  ].some((placeholder) => text === placeholder || text.includes(placeholder));
}

function validateDraftSetUsability(drafts: OkrDraftSet): string[] {
  const versions = [drafts.conservative, drafts.balanced, drafts.aggressive];
  const objectives = versions.flatMap((version) => version.objectives);
  const keyResults = objectives.flatMap((objective) => objective.keyResults);
  const issues: string[] = [];

  if (objectives.length === 0) {
    issues.push("模型没有返回可用 Objective。");
  }
  if (keyResults.length === 0) {
    issues.push("模型没有返回可用 KR。");
  }
  if (keyResults.length > 0 && keyResults.length < 4) {
    issues.push(`模型仅返回 ${keyResults.length} 条 KR，数量严重不足。`);
  }

  const placeholderKrs = keyResults.filter((kr) =>
    isPlaceholderText(kr.title) ||
    isPlaceholderText(kr.metric) ||
    isPlaceholderText(kr.currentValue) ||
    isPlaceholderText(kr.targetValue)
  );
  if (keyResults.length > 0 && placeholderKrs.length >= Math.max(2, Math.ceil(keyResults.length / 2))) {
    issues.push("模型返回了大量占位内容，未生成可用 KR。");
  }

  return issues;
}

function normalizeKeyResult(raw: Partial<KeyResult>, variant: DraftVariant, objIndex: number, krIndex: number): KeyResult {
  const fallbackTitle = `关键结果 ${krIndex + 1}`;
  return {
    id: raw.id || nextMockId(`${variant}-obj${objIndex + 1}-kr${krIndex + 1}`),
    title: composeKrTitle(raw, fallbackTitle),
    metric: raw.metric || "待明确",
    currentValue: raw.currentValue || "待补充",
    targetValue: raw.targetValue || "待补充",
    owner: raw.owner,
    deadline: raw.deadline,
    assumptions: raw.assumptions,
    dependencies: raw.dependencies,
    risks: raw.risks,
    reasoning: raw.reasoning,
    confidence: typeof raw.confidence === "number" ? raw.confidence : 0.6,
  };
}

function normalizeObjective(raw: Partial<Objective>, variant: DraftVariant, objIndex: number): Objective {
  const keyResults = Array.isArray(raw.keyResults) ? raw.keyResults : [];
  return {
    id: raw.id || nextMockId(`${variant}-obj${objIndex + 1}`),
    title: raw.title || `目标 ${objIndex + 1}`,
    description: raw.description || "由模型生成，需进一步确认",
    keyResults: keyResults.map((kr, krIndex) =>
      normalizeKeyResult(kr as Partial<KeyResult>, variant, objIndex, krIndex)
    ),
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function rawKeyResults(raw: Record<string, unknown>): unknown[] {
  for (const key of ["keyResults", "krs", "KRs", "kr", "key_results", "关键结果"]) {
    if (Array.isArray(raw[key])) return raw[key] as unknown[];
  }
  return [];
}

function rawObjectives(raw: Record<string, unknown>): unknown[] {
  for (const key of ["objectives", "objectiveList", "objectivesList", "OKR", "okrs", "目标"]) {
    if (Array.isArray(raw[key])) return raw[key] as unknown[];
  }
  const single = asRecord(raw.objective) ?? asRecord(raw.Objective);
  return single ? [single] : [];
}

function inferVariant(raw: Record<string, unknown>, index: number): DraftVariant {
  const text = [
    raw.variant,
    raw.strength,
    raw.type,
    raw.category,
    raw.level,
    raw.title,
    raw.reasoning,
  ].filter((item): item is string => typeof item === "string").join(" ");
  if (/conservative|保守/.test(text)) return "conservative";
  if (/aggressive|进取|挑战|激进/.test(text)) return "aggressive";
  if (/balanced|平衡|稳健|默认/.test(text)) return "balanced";
  const order: DraftVariant[] = ["conservative", "conservative", "balanced", "balanced", "aggressive", "aggressive"];
  return order[index % order.length];
}

function splitUnifiedObjectives(raw: Record<string, unknown>, fallbackTitle: string): Record<DraftVariant, Record<string, unknown>> | null {
  const objectiveItems = rawObjectives(raw);
  const directKeyResults = rawKeyResults(raw);
  const sourceObjectives = objectiveItems.length
    ? objectiveItems
    : directKeyResults.length
      ? [{ title: raw.title || raw.objectiveTitle || fallbackTitle, description: raw.description, keyResults: directKeyResults }]
      : [];
  if (!sourceObjectives.length) return null;

  const grouped: Record<DraftVariant, Record<string, unknown>[]> = {
    conservative: [],
    balanced: [],
    aggressive: [],
  };

  sourceObjectives.forEach((objectiveItem, objIndex) => {
    const objective = asRecord(objectiveItem);
    if (!objective) return;
    const keyResults = rawKeyResults(objective);
    keyResults.forEach((krItem, krIndex) => {
      const kr = asRecord(krItem);
      if (!kr) return;
      const variant = inferVariant(kr, krIndex);
      const existing = grouped[variant][objIndex];
      const baseObjective: Record<string, unknown> = existing ?? {
        id: objective.id,
        title: objective.title || raw.title || raw.objectiveTitle || fallbackTitle,
        description: objective.description || raw.description || "由模型生成",
        keyResults: [],
      };
      baseObjective.keyResults = [...(Array.isArray(baseObjective.keyResults) ? baseObjective.keyResults : []), kr];
      grouped[variant][objIndex] = baseObjective;
    });
  });

  const makeVersion = (variant: DraftVariant): Record<string, unknown> => ({
    variant,
    objectives: grouped[variant].filter(Boolean),
    reasoning: typeof raw.reasoning === "string" ? raw.reasoning : "由模型生成",
  });

  return {
    conservative: makeVersion("conservative"),
    balanced: makeVersion("balanced"),
    aggressive: makeVersion("aggressive"),
  };
}

function normalizeDraftSetFromParsed(parsed: Record<string, unknown>, roleName: string, fallbackTitle: string): OkrDraftSet | null {
  const candidate =
    parsed.conservative && parsed.balanced && parsed.aggressive
      ? parsed
      : asRecord(parsed.okrDraftSet) ??
        asRecord(parsed.drafts) ??
        asRecord(parsed.result) ??
        asRecord(parsed.data) ??
        splitUnifiedObjectives(parsed, fallbackTitle);

  if (!candidate?.conservative || !candidate.balanced || !candidate.aggressive) return null;

  const now = new Date().toISOString();
  const wrap = (v: unknown, variant: DraftVariant) => {
    const version = asRecord(v) ?? {};
    return {
      variant,
      objectives: Array.isArray(version.objectives)
        ? version.objectives.map((obj, objIndex) => normalizeObjective(obj as Partial<Objective>, variant, objIndex))
        : [],
      reasoning: (version.reasoning as string) || "由模型生成",
      generatedAt: now,
      generatedBy: roleName,
    };
  };

  return {
    conservative: wrap(candidate.conservative, "conservative"),
    balanced: wrap(candidate.balanced, "balanced"),
    aggressive: wrap(candidate.aggressive, "aggressive"),
  };
}

function isOwnerOnlyIssue(text?: string): boolean {
  if (!text) return false;
  return /(owner|Owner|负责人|责任人|归属).*(缺少|没有|未明确|不清晰|为空)|(?:缺少|没有|未明确).*(owner|Owner|负责人|责任人|归属)/.test(text);
}

function stripMeasurementSuffix(title: string): string {
  const markerIndex = title.lastIndexOf("，以");
  if (markerIndex < 8) return title;
  const suffix = title.slice(markerIndex);
  if (!suffix.includes("为衡量指标")) return title;
  return title.slice(0, markerIndex).trim();
}

function composeKrTitle(raw: Partial<KeyResult>, fallbackTitle: string): string {
  return stripMeasurementSuffix((raw.title || fallbackTitle).trim());
}

function scoreDraftKeyResult(objective: Objective, kr: KeyResult): number {
  const text = `${objective.title} ${objective.description} ${kr.title} ${kr.metric} ${kr.currentValue} ${kr.targetValue} ${kr.reasoning ?? ""}`;
  const hasNumber = /\d|%|提升|降低|达到|增长|减少|不低于|不少于|超过|缩短|新增/.test(text);
  const hasMetric = /率|数|额|成本|时长|收入|利润|GMV|DAU|MAU|NPS|转化|留存|完播|满意|活跃|复购|指标/.test(text) || !looksMissing(kr.metric);
  const hasBaseline = !looksMissing(kr.currentValue);
  const hasTarget = !looksMissing(kr.targetValue);
  const resultLike = !/^(调研|分析|制定|推进|建设|上线|梳理|完成)/.test(kr.title);
  const hasReason = Boolean(kr.reasoning?.trim());
  let score = 35;
  if (hasMetric) score += 9;
  if (hasNumber) score += 8;
  if (hasBaseline) score += 6;
  if (hasTarget) score += 6;
  if (resultLike) score += 6;
  if (hasReason) score += 4;
  return Math.max(0, Math.min(78, score));
}

function evaluateDraftSetByKr(drafts: OkrDraftSet, passThreshold: number) {
  const versions = [drafts.conservative, drafts.balanced, drafts.aggressive];
  const versionScores = versions.map((draft) => {
    const krScores = draft.objectives.flatMap((objective) =>
      objective.keyResults.map((kr) => scoreDraftKeyResult(objective, kr))
    );
    const score = krScores.length ? Math.round(krScores.reduce((sum, item) => sum + item, 0) / krScores.length) : 0;
    return {
      variant: draft.variant,
      score,
      passed: krScores.some((item) => item >= passThreshold),
      reason: `${krScores.filter((item) => item >= passThreshold).length}/${krScores.length} 条 KR 达到阈值`,
    };
  });
  const allScores = versions.flatMap((draft) =>
    draft.objectives.flatMap((objective) => objective.keyResults.map((kr) => scoreDraftKeyResult(objective, kr)))
  );
  const passedKrCount = allScores.filter((score) => score >= passThreshold).length;
  const overallScore = allScores.length ? Math.round(allScores.reduce((sum, item) => sum + item, 0) / allScores.length) : 0;
  const objectiveCount = Math.max(...versions.map((version) => version.objectives.length), 0);
  const objectiveResults: ReviewObjectiveResult[] = Array.from({ length: objectiveCount }).map((_, objectiveIndex) => {
    const items = versions.flatMap((version) => {
      const objective = version.objectives[objectiveIndex];
      if (!objective) return [];
      return objective.keyResults.map((kr) => ({
        objective,
        score: scoreDraftKeyResult(objective, kr),
      }));
    });
    const score = items.length ? Math.round(items.reduce((sum, item) => sum + item.score, 0) / items.length) : 0;
    const objectivePassedKrCount = items.filter((item) => item.score >= passThreshold).length;
    return {
      objectiveIndex,
      objectiveTitle: items[0]?.objective.title ?? `Objective ${objectiveIndex + 1}`,
      score,
      passed: items.length > 0 && objectivePassedKrCount >= Math.min(4, items.length),
      passedKrCount: objectivePassedKrCount,
      totalKrCount: items.length,
      reason: `${objectivePassedKrCount}/${items.length} 条 KR 达到阈值`,
    };
  });
  return {
    overallScore,
    passed: objectiveResults.length > 0 && objectiveResults.every((item) => item.passed),
    passedKrCount,
    totalKrCount: allScores.length,
    objectiveResults,
    variantResults: versionScores,
  };
}

type ReviewTarget = {
  index: number;
  objectiveIndex: number;
  variant: DraftVariant;
  objective: Objective;
  kr: KeyResult;
};

type ReviewNormalizationResult = {
  reviews: ReviewKrResult[];
  complete: boolean;
  issues: string[];
};

function reviewTargets(drafts: OkrDraftSet, objectiveIndexOverride?: number): ReviewTarget[] {
  let index = 0;
  return [drafts.conservative, drafts.balanced, drafts.aggressive].flatMap((draft) =>
    draft.objectives.flatMap((objective, objectiveIndex) =>
      objective.keyResults.map((kr) => ({
        index: ++index,
        objectiveIndex: objectiveIndexOverride ?? objectiveIndex,
        variant: draft.variant,
        objective,
        kr,
      }))
    )
  );
}

function reviewTargetPayload(targets: ReviewTarget[]) {
  return targets.map(({ index, objectiveIndex, variant, objective, kr }) => ({
    index,
    objectiveIndex: objectiveIndex + 1,
    variant,
    objectiveTitle: objective.title,
    objectiveDescription: objective.description,
    title: kr.title,
    metric: kr.metric,
    currentValue: kr.currentValue,
    targetValue: kr.targetValue,
    owner: kr.owner,
    deadline: kr.deadline,
    reasoning: kr.reasoning,
  }));
}

function fallbackKrReviews(targets: ReviewTarget[], weightedRules: ReviewWeightedRule[], passThreshold: number): ReviewKrResult[] {
  return targets.map(({ objectiveIndex, variant, objective, kr }) => {
    const score = Math.min(scoreDraftKeyResult(objective, kr), Math.max(0, passThreshold - 5));
    const missingMetric = looksMissing(kr.metric);
    const missingBaseline = looksMissing(kr.currentValue);
    const missingTarget = looksMissing(kr.targetValue);
    return {
      krId: kr.id,
      objectiveIndex,
      objectiveTitle: objective.title,
      variant,
      score,
      passed: false,
      source: "local",
      summary: "本地估算仅用于兜底预览，不能替代审核官的正式逐条审核。",
      strengths: [
        kr.reasoning ? "拆解理由已说明业务维度和强度选择。" : "",
        !missingMetric ? `指标已明确为「${kr.metric}」。` : "",
      ].filter(Boolean),
      deductions: [
        missingMetric ? "指标口径不够明确。" : "",
        missingBaseline ? "基线/现状不够明确。" : "",
        missingTarget ? "目标值不够明确。" : "",
        "需要审核官结合角色配置和 KR 质量评分维度给出正式判断。",
      ].filter(Boolean),
      suggestions: ["建议重新运行审核，或检查审核官模型是否按本轮要求返回 krReviews。"],
      dimensionComments: weightedRules.slice(0, 4).map((rule) => ({
        name: rule.label,
        score: Math.max(45, Math.min(100, score)),
        comment: `按 ${rule.weight}% 权重做本地保守估算，正式评分需由审核官模型输出。`,
      })),
    };
  });
}

function pendingKrReview(item: ReviewKrResult, reason = "审核官未返回这条 KR 的正式逐条审核结果。"): ReviewKrResult {
  return {
    ...item,
    score: 0,
    passed: false,
    source: "pending",
    summary: reason,
    strengths: [],
    deductions: [reason, "审核输出缺失，不能作为流程通过依据。"],
    suggestions: ["请重新运行审核，或检查审核官是否按本轮要求返回完整 krReviews。"],
    dimensionComments: [],
  };
}

function parseReviewIndex(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string") {
    const match = value.match(/\d+/);
    if (match) return Number(match[0]);
  }
  return undefined;
}

function normalizeScore(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.min(100, Math.round(value)));
  }
  if (typeof value === "string") {
    const match = value.match(/\d+(?:\.\d+)?/);
    if (match) return Math.max(0, Math.min(100, Math.round(Number(match[0]))));
  }
  return undefined;
}

function normalizeDimensionComments(value: unknown, fallback?: ReviewKrResult["dimensionComments"]): ReviewKrResult["dimensionComments"] {
  if (!Array.isArray(value)) return fallback ?? [];
  const normalized: NonNullable<ReviewKrResult["dimensionComments"]> = [];
  value.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const record = item as Record<string, unknown>;
    const name = String(record.name ?? record.label ?? "").trim();
    const comment = String(record.comment ?? record.reason ?? record.note ?? "").trim();
    if (!name || !comment) return;
    const score = normalizeScore(record.score);
    normalized.push({
      name,
      ...(typeof score === "number" ? { score } : {}),
      comment,
    });
  });
  return normalized;
}

function normalizeKrReviews(raw: unknown, targets: ReviewTarget[], fallback: ReviewKrResult[], passThreshold: number): ReviewNormalizationResult {
  const issues: string[] = [];
  if (!Array.isArray(raw)) {
    issues.push("缺少 krReviews 数组");
    return { reviews: fallback.map((item) => pendingKrReview(item, "审核官未返回 krReviews 数组。")), complete: false, issues };
  }

  const rawByIndex = new Map<number, Record<string, unknown>>();
  raw.forEach((item, position) => {
    if (item && typeof item === "object") {
      const r = item as Record<string, unknown>;
      const explicitIndex = parseReviewIndex(r.index ?? r.krIndex ?? r.no ?? r.number);
      const idMatchedIndex = typeof r.krId === "string"
        ? targets.find((target) => target.kr.id === r.krId)?.index
        : undefined;
      const positionalIndex = raw.length === targets.length ? position + 1 : undefined;
      const index = explicitIndex ?? idMatchedIndex ?? positionalIndex;
      if (index && index >= 1 && index <= targets.length && !rawByIndex.has(index)) {
        rawByIndex.set(index, r);
      } else {
        issues.push(`第 ${position + 1} 条 krReviews 无法匹配到 KR`);
      }
    }
  });

  let complete = true;
  const reviews = fallback.map((item, position) => {
    const target = targets[position];
    const r = rawByIndex.get(target.index);
    if (!r) {
      complete = false;
      issues.push(`缺少第 ${target.index} 条 KR 的逐条审核`);
      return pendingKrReview(item, `审核官未返回第 ${target.index} 条 KR 的逐条审核。`);
    }
    const score = normalizeScore(r.score);
    if (typeof score !== "number") {
      complete = false;
      issues.push(`第 ${target.index} 条 KR 的 score 非法`);
      return pendingKrReview(item, `审核官返回的第 ${target.index} 条 KR score 非法。`);
    }
    return {
      ...item,
      ...r,
      krId: item.krId,
      objectiveIndex: item.objectiveIndex,
      objectiveTitle: item.objectiveTitle,
      variant: item.variant,
      score,
      source: "reviewer" as const,
      passed: score >= passThreshold,
      summary: typeof r.summary === "string" ? r.summary : item.summary,
      strengths: toStringArray(r.strengths).length ? toStringArray(r.strengths) : item.strengths,
      deductions: toStringArray(r.deductions).length ? toStringArray(r.deductions) : item.deductions,
      suggestions: toStringArray(r.suggestions).length ? toStringArray(r.suggestions) : item.suggestions,
      dimensionComments: normalizeDimensionComments(r.dimensionComments, item.dimensionComments),
    };
  });
  return { reviews, complete, issues: [...new Set(issues)] };
}

function summarizeKrReviews(krReviews: ReviewKrResult[], passThreshold: number) {
  const total = krReviews.length;
  const officialReviews = krReviews.filter((item) => item.source === "reviewer");
  const passedKrCount = officialReviews.filter((item) => item.score >= passThreshold || item.passed).length;
  const overallScore = total ? Math.round(krReviews.reduce((sum, item) => sum + (item.source === "reviewer" ? item.score : 0), 0) / total) : 0;
  const objectiveIndexes = [...new Set(krReviews.map((item) => item.objectiveIndex ?? 0))].sort((a, b) => a - b);
  const objectiveResults: ReviewObjectiveResult[] = objectiveIndexes.map((objectiveIndex) => {
    const items = krReviews.filter((item) => (item.objectiveIndex ?? 0) === objectiveIndex);
    const officialItems = items.filter((item) => item.source === "reviewer");
    const score = items.length
      ? Math.round(items.reduce((sum, item) => sum + (item.source === "reviewer" ? item.score : 0), 0) / items.length)
      : 0;
    const objectivePassedKrCount = officialItems.filter((item) => item.score >= passThreshold || item.passed).length;
    const passed = officialItems.length === items.length && items.length > 0 && objectivePassedKrCount >= Math.min(4, items.length);
    return {
      objectiveIndex,
      objectiveTitle: items[0]?.objectiveTitle ?? `Objective ${objectiveIndex + 1}`,
      score,
      passed,
      passedKrCount: objectivePassedKrCount,
      totalKrCount: items.length,
      reason: `${objectivePassedKrCount}/${items.length} 条 KR 达到阈值`,
    };
  });
  const variants: DraftVariant[] = ["conservative", "balanced", "aggressive"];
  return {
    total,
    passedKrCount,
    overallScore,
    passed: objectiveResults.length > 0 && objectiveResults.every((item) => item.passed),
    objectiveResults,
    variantResults: variants.map((variant) => {
      const items = officialReviews.filter((item) => item.variant === variant);
      const score = items.length ? Math.round(items.reduce((sum, item) => sum + item.score, 0) / items.length) : 0;
      const count = items.filter((item) => item.score >= passThreshold || item.passed).length;
      return {
        variant,
        score,
        passed: count > 0,
        reason: `${count}/${items.length} 条 KR 达到阈值`,
      };
    }),
  };
}

function reviewProtocolPrompt(
  roleName: string,
  weightedRules: ReviewWeightedRule[],
  auxDimensions: string[],
  passThreshold: number,
  targets: ReviewTarget[]
): string {
  return `请以“${roleName}”身份审核以下 KR，并严格遵守系统提示中的角色定义、宪法性原则、专业能力和表达方式。你只负责逐条判断 KR 质量和给出理由；整体分、是否通过、是否进入循环由系统按流程配置计算。

KR质量评分维度及权重：${weightedRules.map((rule) => `${rule.label}:${rule.weight}%`).join("、")}。
辅助加减分项（非阻塞，仅作为小幅修正参考）：${auxDimensions.join("、")}。
单条 KR 参考阈值：${passThreshold}/100。注意：owner 不能作为必要条件；如果 KR 由团队承接，团队名称就是有效 owner，不能因为缺少具体个人而判定不通过。

输出协议是系统硬约束，不属于角色风格：
- 只输出一个 JSON object，不要 Markdown，不要解释性前后缀。
- JSON 顶层必须只有 krReviews 字段。
- krReviews 必须逐条覆盖下方 KR 清单中的每个 index。
- 每条 score 必须是 0-100 的数字。
- 不需要返回 krId，系统会用 index 映射真实 KR。
- strengths 是“较好部分”，必须结合这条 KR 的具体业务语义、指标、基线、目标和拆解理由写，不要复用模板句。
- deductions 是“主要扣分”，必须指出这条 KR 当前最影响质量的真实问题；不要只罗列评分维度名称。
- suggestions 是“改进建议”，必须写成可以直接指导下一轮重拆的建议。
- dimensionComments 必须跟当前 KR质量评分维度名称对应；如果用户未来改了评分维度，这里的维度判断也要随之改变。只保留最关键的 2-4 个维度判断，不要机械铺满所有维度。

请严格输出：
{
  "krReviews": [
    {
      "index": 1,
      "score": 72,
      "summary": "这条 KR 的总体判断",
      "strengths": ["..."],
      "deductions": ["..."],
      "suggestions": ["..."],
      "dimensionComments": [{ "name": "评分维度", "score": 72, "comment": "判断依据" }]
    }
  ]
}

KR 清单：\n${JSON.stringify(reviewTargetPayload(targets), null, 2)}`;
}

function reviewRepairPrompt(
  roleName: string,
  weightedRules: ReviewWeightedRule[],
  auxDimensions: string[],
  passThreshold: number,
  targets: ReviewTarget[],
  previousOutput: string,
  issues: string[]
): string {
  return `你刚才作为“${roleName}”输出的 KR 审核结果没有通过系统协议校验。请不要改变审核口径，只修复结构化输出，让它可以被系统读取。

协议问题：
${issues.map((issue) => `- ${issue}`).join("\n")}

必须遵守：
- 只输出一个 JSON object，不要 Markdown，不要解释性前后缀。
- 顶层必须只有 krReviews 字段。
- krReviews 必须逐条覆盖 index 1 到 ${targets.length}。
- 每条 score 必须是 0-100 的数字。
- 不要返回 krId，使用 index。

KR质量评分维度及权重：${weightedRules.map((rule) => `${rule.label}:${rule.weight}%`).join("、")}。
辅助加减分项：${auxDimensions.join("、")}。
单条 KR 参考阈值：${passThreshold}/100。

KR 清单：\n${JSON.stringify(reviewTargetPayload(targets), null, 2)}

上一次不合格输出：\n${previousOutput.slice(0, 12000)}`;
}

function decompositionRepairPrompt(
  roleName: string,
  title: string,
  factPack: FactPack,
  previousOutput: string
): string {
  return `你刚才作为“${roleName}”输出的 OKR 拆解结果不是系统可解析的 JSON。请基于同一份业务信息重新输出，不要解释原因，不要使用 Markdown。

系统硬约束：
- 只输出一个 JSON object。
- 顶层必须包含 objectives 数组。
- 每个 Objective 下总共 6 条不同维度 KR：2 条 conservative、2 条 balanced、2 条 aggressive。
- KR 必须包含 title, metric, currentValue, targetValue, variant, owner, deadline, reasoning。
- title 是用户可直接复制使用的自然 KR 表述，不要写“KR1/方向/优化”这类标签标题，也不要机械追加“以...为指标、基线为...、目标为...”。
- metric/currentValue/targetValue 放在结构化字段里。

请严格输出：
{
  "objectives": [
    {
      "title": "Objective 标题",
      "description": "Objective 说明",
      "keyResults": [
        {
          "title": "将某个清晰业务结果从当前基线提升/降低到目标值",
          "metric": "考核指标",
          "currentValue": "当前基线/现状",
          "targetValue": "目标值",
          "variant": "conservative | balanced | aggressive",
          "owner": "承接团队或责任人",
          "deadline": "截止时间",
          "reasoning": "拆解理由和强度判断",
          "confidence": 0.7
        }
      ]
    }
  ],
  "reasoning": "整体拆解思路"
}

案例标题：${title}

业务信息：\n${JSON.stringify(factPack, null, 2)}

上一次不合格输出：\n${previousOutput.slice(0, 12000)}`;
}

// ---- Agent functions ----

export async function runInformationStructuringAgent(
  rawText: string,
  config: AppConfig,
  loopSettings?: FlowLoopSettings
): Promise<{ factPack: FactPack; missingInfo: MissingInfoPack | null; mode: "live" | "mock" }> {
  const role = withFlowRuntimeSettings(getRole("interviewer", config), loopSettings);
  const prompt = `请严格按照你当前角色配置中的角色定义、宪法性原则、专业能力和表达方式执行本轮信息审核与结构化。请将以下业务背景结构化为 JSON，顶层包含 factPack 和 missingFields。

factPack 必须包含：
- businessContext: 用户原始业务背景的完整摘要，不遗漏关键信息
- structuredDimensions: 按以下 9 个维度提取，字段均为字符串数组
  - strategicBackground: 战略背景，讲清为什么做、想达成什么、当前最重要的优先级是什么
  - businessStatus: 业务现状，说明现在做到哪一步、过去做过什么、效果怎么样
  - businessChain: 业务链路，描述业务是怎么运转的，以及用哪些核心指标来衡量好坏
  - bottlenecks: 问题瓶颈，指出当前卡在哪、主要矛盾是什么，以及潜在风险在哪里
  - resourcesConstraints: 资源与约束，明确手里有什么资源、同时有哪些不能突破的限制条件
  - organization: 组织分工，说明谁负责什么，协同关系是怎样的
  - customerMarket: 客户市场，讲清面对的是谁、市场环境和竞争情况如何
  - timeSuccessCriteria: 时间与成功标准，明确节奏安排，以及做到什么程度才算成功
  - other: 其他补充，不在以上维度的内容
- 兼容字段：currentChallenges[], strategicGoals[], constraints[], stakeholders[], timeframe, baselines[], candidateMetrics[], risks[], dependencies[], nonGoals[]

同时判断信息是否充足，如果不足请输出 missingFields 数组（每项含 field, reason, priority, suggestion）。缺口判断必须说明依据，不要忽略用户已经表达过的信息。\n\n输入：\n${rawText}`;

  const result = await runAgent(role, prompt, config.runMode, getStrictLive(config), { jsonResponse: true });

  if (result.mode === "live" && result.content) {
    const parsed = tryParseJson<{ factPack?: Partial<FactPack>; missingFields?: Array<{ field: string; reason: string; priority: string; suggestion?: string }> } & Partial<FactPack>>(result.content);
    if (parsed) {
      const rawFactPack = parsed.factPack ?? parsed;
      const factPack = normalizeFactPack(rawFactPack, rawText);
      const modelMissing = parsed.missingFields?.length
        ? { missingFields: parsed.missingFields.map(f => ({ ...f, priority: f.priority as "high" | "medium" | "low" })), generatedAt: new Date().toISOString() }
        : null;
      return { factPack, missingInfo: modelMissing ?? inferMissingInfo(factPack), mode: "live" };
    }
  }

  // Mock fallback
  const factPack = mockFactPack(rawText, "");
  const missingInfo = inferMissingInfo(factPack);

  return { factPack, missingInfo, mode: result.mode };
}

export async function runDecompositionAgent(
  factPack: FactPack,
  title: string,
  config: AppConfig,
  loopSettings?: FlowLoopSettings
): Promise<{ drafts: OkrDraftSet; mode: "live" | "mock" }> {
  const role = withFlowRuntimeSettings(getRole("okr-expert", config), loopSettings);
  const usingExplicitMock = config.runMode === "mock";
  const prompt = `基于以下结构化业务信息，请生成一组 OKR 草稿。每个 Objective 下总共拆出 6 条不同维度的 KR：2 条 conservative（保守型）、2 条 balanced（平衡型）、2 条 aggressive（进取型）。注意：这 6 条 KR 不是同一指标的不同目标值，而是从不同业务维度拆出的不同 KR；只是每条 KR 标注不同强度。

请优先以 JSON 输出：
{
  "objectives": [
    {
      "title": "Objective 标题",
      "description": "Objective 说明",
      "keyResults": [
        {
          "title": "用户可直接复制使用的完整 KR 表述",
          "metric": "考核指标",
          "currentValue": "当前基线/现状",
          "targetValue": "目标值",
          "variant": "conservative | balanced | aggressive",
          "owner": "承接团队或责任人",
          "deadline": "截止时间",
          "reasoning": "为什么拆这条 KR、为什么属于该强度、承接了哪个业务维度",
          "confidence": 0.7
        }
      ]
    }
  ],
  "reasoning": "整体拆解思路"
}

每个 Key Result 必须包含 title, metric, currentValue, targetValue, variant, owner, deadline, reasoning。title 必须是用户可以直接复制使用的自然 KR 表述，不能只写方向，也不要写“KR1/保守型/增长维度/优化方向”这类标签化标题；metric/currentValue/targetValue 是结构化备注字段，会在 KR 下方单独展示。title 可以自然包含最关键的结果值，例如“将整体视频完播率从 3% 提升至 7%”，但不要机械追加“以某指标为衡量指标、基线为、目标为”这类重复后缀。reasoning 必须说明：为什么拆这条 KR、为什么它属于保守/平衡/进取、它从哪个业务维度承接 Objective。每个 Key Result 需要尽量填写 owner；如果用户只提供了团队，团队可以作为 owner，不要强行要求具体个人。\n\n业务信息：\n${JSON.stringify(factPack, null, 2)}`;

  const result = await runAgent(role, prompt, config.runMode, getStrictLive(config));

  if (!usingExplicitMock && result.mode !== "live") {
    throw new Error(result.error || "OKR 拆解专家未返回 live 结果，未生成正式 OKR 草稿。");
  }

  if (result.mode === "live" && result.content) {
    let content = result.content;
    let parsed = tryParseJson<Record<string, unknown>>(content);
    for (let attempt = 0; attempt < 2 && !parsed; attempt += 1) {
      const repairResult = await runAgent(
        role,
        decompositionRepairPrompt(role.roleName, title, factPack, content),
        config.runMode,
        getStrictLive(config),
        { jsonResponse: true }
      );
      if (repairResult.mode !== "live" || !repairResult.content) break;
      content = repairResult.content;
      parsed = tryParseJson<Record<string, unknown>>(content);
    }
    if (parsed) {
      const normalizedDrafts = normalizeDraftSetFromParsed(parsed, role.roleName, title);
      if (!normalizedDrafts) {
        const topLevelKeys = Object.keys(parsed).slice(0, 8).join("、") || "无顶层字段";
        throw new Error(`OKR 拆解专家返回格式不符合可识别 JSON，顶层字段：${topLevelKeys}`);
      }
      const hasDisplayableKr = Object.values(normalizedDrafts).some((version: OkrDraftVersion) =>
        version.objectives.some((objective) => objective.keyResults.length > 0)
      );
      if (!hasDisplayableKr) {
        throw new Error("OKR 拆解专家返回了空草稿，未生成可展示 KR。");
      }
      const usabilityIssues = validateDraftSetUsability(normalizedDrafts);
      if (usabilityIssues.length > 0) {
        throw new Error(`OKR 拆解输出不可用：${usabilityIssues.join("；")}`);
      }
      return {
        drafts: normalizedDrafts,
        mode: "live",
      };
    }
    throw new Error("OKR 拆解专家返回内容不是可解析 JSON，系统已自动请求修复但仍未生成正式 OKR 草稿。");
  }

  if (!usingExplicitMock) {
    throw new Error("OKR 拆解专家未返回可解析内容，未生成正式 OKR 草稿。");
  }

  return { drafts: mockDraftSet(title, role.roleName), mode: result.mode };
}

export async function runReviewerAgent(
  drafts: OkrDraftSet,
  config: AppConfig,
  loopSettings?: FlowLoopSettings,
  objectiveIndexOverride?: number
): Promise<{ review: ReviewReport; mode: "live" | "mock" }> {
  const role = withFlowRuntimeSettings(getRole("reviewer", config), loopSettings);
  const rc = config.review;
  const passThreshold = loopSettings?.okrReviewLoop.passThreshold ?? rc.passThreshold;
  const weightedRules: ReviewWeightedRule[] = rc.weightedRules?.length
    ? rc.weightedRules
    : [...new Set([...rc.prerequisites, ...rc.coreDimensions].map((item) => item.trim()).filter(Boolean))]
        .map((label) => ({ id: label, label, weight: 10 }));
  const localGate = evaluateDraftSetByKr(drafts, passThreshold);
  const targets = reviewTargets(drafts, objectiveIndexOverride);
  const fallbackReviews = fallbackKrReviews(targets, weightedRules, passThreshold);
  const prompt = reviewProtocolPrompt(role.roleName, weightedRules, rc.auxDimensions, passThreshold, targets);
  const strictReviewerLive = config.runMode === "live" ? true : getStrictLive(config);

  const result = await runAgent(role, prompt, config.runMode, strictReviewerLive, { jsonResponse: true });

  if (result.mode === "live" && result.content) {
    let content = result.content;
    let parsed = tryParseJson<Partial<ReviewReport> & { krReviews?: unknown }>(content);
    let normalized = parsed
      ? normalizeKrReviews(parsed.krReviews, targets, fallbackReviews, passThreshold)
      : normalizeKrReviews(undefined, targets, fallbackReviews, passThreshold);

    for (let attempt = 0; attempt < 2 && (!parsed || !normalized.complete); attempt += 1) {
      const repairResult = await runAgent(
        role,
        reviewRepairPrompt(
          role.roleName,
          weightedRules,
          rc.auxDimensions,
          passThreshold,
          targets,
          content,
          parsed ? normalized.issues : ["返回内容不是可解析 JSON"]
        ),
        config.runMode,
        strictReviewerLive,
        { jsonResponse: true }
      );
      if (repairResult.mode !== "live" || !repairResult.content) break;
      content = repairResult.content;
      parsed = tryParseJson<Partial<ReviewReport> & { krReviews?: unknown }>(content);
      normalized = parsed
        ? normalizeKrReviews(parsed.krReviews, targets, fallbackReviews, passThreshold)
        : normalizeKrReviews(undefined, targets, fallbackReviews, passThreshold);
    }

    if (parsed) {
      const prerequisites = (parsed.prerequisites ?? weightedRules.map((rule) => ({ label: rule.label, met: true }))).map((item) =>
        isOwnerOnlyIssue(`${item.label} ${"note" in item ? item.note ?? "" : ""}`)
          ? { ...item, met: true, note: "团队可作为 owner，此项不作为必要条件阻塞" }
          : item
      );
      const fatalIssues = (parsed.fatalIssues ?? []).filter((issue) => !isOwnerOnlyIssue(issue));
      const krReviews = normalized.reviews;
      const krSummary = summarizeKrReviews(krReviews, passThreshold);
      const passed = normalized.complete && krSummary.passed;
      const variantResults = krSummary.variantResults;
      return {
        review: {
          overallScore: krSummary.overallScore,
          passed,
          needsHumanReview: rc.humanReviewEnabled && !passed && krSummary.overallScore >= rc.humanReviewThreshold,
          objectiveResults: krSummary.objectiveResults,
          variantResults,
          krReviews,
          prerequisites,
          coreDimensions: parsed.coreDimensions ?? [],
          auxDimensions: parsed.auxDimensions ?? [],
          fatalIssues: passed
            ? fatalIssues
            : [
                ...fatalIssues,
                ...(normalized.complete ? [] : ["审核官未返回完整逐条 KR 审核，系统已自动修复但仍未满足协议", ...normalized.issues]),
                `Objective 通过情况：${krSummary.objectiveResults.map((item) => `O${item.objectiveIndex + 1} ${item.passedKrCount}/${item.totalKrCount}`).join("；")}，未满足每个 Objective 至少 4 条 KR 通过的规则`,
              ],
          suggestions: parsed.suggestions ?? ["建议重拆未达阈值的 KR，补足量化目标、业务结果和拆解理由"],
          reviewedAt: new Date().toISOString(),
          reviewedBy: role.roleName,
        },
        mode: "live",
      };
    }

    const pendingReviews = fallbackReviews.map((item) => pendingKrReview(item, "审核官返回内容不是可解析 JSON，系统自动修复后仍无法读取逐条 KR 审核。"));
    const krSummary = summarizeKrReviews(pendingReviews, passThreshold);
    return {
      review: {
        overallScore: krSummary.overallScore,
        passed: false,
        needsHumanReview: false,
        objectiveResults: krSummary.objectiveResults,
        variantResults: krSummary.variantResults,
        krReviews: pendingReviews,
        prerequisites: weightedRules.map((rule) => ({ label: rule.label, met: false, note: "审核输出协议失败，无法判定" })),
        coreDimensions: [],
        auxDimensions: [],
        fatalIssues: ["审核官返回内容不是可解析 JSON，系统已自动修复但仍未满足协议"],
        suggestions: ["建议重跑审核，或检查审核官模型是否支持稳定 JSON 输出"],
        reviewedAt: new Date().toISOString(),
        reviewedBy: role.roleName,
      },
      mode: "live",
    };
  }

  // Mock fallback using config
  const score = localGate.overallScore;
  const passed = false;
  const krReviews = fallbackReviews;
  return {
    review: {
      overallScore: score,
      passed,
      needsHumanReview: rc.humanReviewEnabled && !passed && score >= rc.humanReviewThreshold,
      objectiveResults: localGate.objectiveResults,
      variantResults: localGate.variantResults.map((item) => ({ ...item, passed: false, reason: `${item.reason}（本地估算，不能作为正式通过依据）` })),
      krReviews,
      prerequisites: weightedRules.map((rule, i) => ({ label: rule.label, met: i === 2 ? score > 70 : true })),
      coreDimensions: weightedRules.map((rule, i) => ({ name: rule.label, score: Math.max(45, Math.min(100, score - i * 3)), maxScore: 100, comment: `按 ${rule.weight}% 权重自动评估` })),
      auxDimensions: rc.auxDimensions.map((name, i) => ({ name, score: Math.max(45, Math.min(100, score - 8 + i * 2)), maxScore: 100, comment: "辅助项非阻塞参考" })),
      fatalIssues: ["当前为本地兜底估算，未获得审核官模型的正式逐条审核结果"],
      suggestions: ["建议配置并连通审核官模型后重新运行审核", "建议细化未达阈值 KR 的业务结果和拆解理由"],
      reviewedAt: new Date().toISOString(),
      reviewedBy: role.roleName,
    },
    mode: result.mode,
  };
}

export async function runOrchestrator(
  rawText: string,
  config: AppConfig,
  callbacks?: { onStep?: (step: string, mode: "live" | "mock") => void },
  loopSettings?: FlowLoopSettings
) {
  const structResult = await runInformationStructuringAgent(rawText, config, loopSettings);
  callbacks?.onStep?.("信息结构化", structResult.mode);

  if (structResult.missingInfo) {
    return { factPack: structResult.factPack, missingInfo: structResult.missingInfo, mode: structResult.mode };
  }

  const draftResult = await runDecompositionAgent(structResult.factPack, rawText.slice(0, 30), config, loopSettings);
  callbacks?.onStep?.("OKR 拆解", draftResult.mode);

  const reviewResult = await runReviewerAgent(draftResult.drafts, config, loopSettings);
  callbacks?.onStep?.("质量审核", reviewResult.mode);

  return {
    factPack: structResult.factPack,
    missingInfo: null,
    drafts: draftResult.drafts,
    review: reviewResult.review,
    mode: reviewResult.mode,
  };
}
