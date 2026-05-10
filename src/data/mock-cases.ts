import { OkrCase, CaseStatus, OkrDraftSet } from "@/types";

// ---- Helper: build a 3-version draft set from a balanced base ----

function makeDraftSet(
  balanced: OkrDraftSet["balanced"],
  conservativeOverrides: Partial<OkrDraftSet["conservative"]>,
  aggressiveOverrides: Partial<OkrDraftSet["aggressive"]>
): OkrDraftSet {
  return {
    conservative: {
      ...balanced,
      variant: "conservative",
      ...conservativeOverrides,
    },
    balanced,
    aggressive: {
      ...balanced,
      variant: "aggressive",
      ...aggressiveOverrides,
    },
  };
}

export const mockCases: OkrCase[] = [
  // ---- Case 1: 信息不足 ----
  {
    id: "case-001",
    title: "Q3 用户增长战略规划",
    status: CaseStatus.INFO_INSUFFICIENT,
    team: "增长团队",
    cycle: "Q3 2026",
    flowTemplateId: "flow-standard",
    flowNodeRuns: [
      { nodeId: "intake", roleName: "信息整理官", status: "success", startedAt: "2026-04-15T10:30:00Z", completedAt: "2026-04-15T10:35:00Z" },
      { nodeId: "structuring", roleName: "信息整理官", status: "success", startedAt: "2026-04-16T09:00:00Z", completedAt: "2026-04-16T09:05:00Z" },
      { nodeId: "info-check", roleName: "协调器", status: "failed", startedAt: "2026-04-16T09:10:00Z", completedAt: "2026-04-16T09:15:00Z", error: "信息不足：缺少预算范围等 3 项" },
    ],
    createdAt: "2026-04-15T10:30:00Z",
    updatedAt: "2026-04-16T09:15:00Z",
    createdBy: "张明",
    intake: {
      rawText:
        "我们想在 Q3 做用户增长，目前 DAU 大概 50 万，希望能翻倍。我们有一些预算，但具体多少还没确定。团队大概 20 人。",
      submittedAt: "2026-04-15T10:30:00Z",
      submittedBy: "张明",
    },
    factPack: {
      businessContext: "移动端产品，当前 DAU 50 万，目标 Q3 翻倍至 100 万",
      currentChallenges: ["获客成本上升", "留存率待提高"],
      strategicGoals: ["DAU 翻倍"],
      constraints: ["团队 20 人"],
      stakeholders: ["张明（业务负责人）"],
      timeframe: "Q3 2026",
      baselines: ["当前 DAU 50 万", "获客成本未知"],
      candidateMetrics: ["DAU", "新增用户数", "7 日留存率", "获客成本 (CAC)"],
      risks: ["预算未确定可能导致策略无法落地", "市场竞争加剧"],
      dependencies: ["预算审批", "渠道合作谈判"],
      nonGoals: ["品牌建设", "产品功能迭代"],
      structuredAt: "2026-04-16T09:00:00Z",
    },
    missingInfo: {
      missingFields: [
        {
          field: "预算范围",
          reason: "用户提到有预算但未明确具体金额，无法评估增长策略可行性",
          priority: "high",
          suggestion: "请提供 Q3 可用的增长预算范围（如 50-100 万元）",
        },
        {
          field: "当前获客渠道",
          reason: "不了解现有渠道分布，无法制定针对性增长策略",
          priority: "high",
          suggestion: "请列出当前主要获客渠道及其占比",
        },
        {
          field: "竞品情况",
          reason: "缺乏市场竞争环境信息",
          priority: "medium",
          suggestion: "请提供主要竞品名称及其大致规模",
        },
      ],
      generatedAt: "2026-04-16T09:15:00Z",
    },
    logs: [
      { id: "log-001-1", timestamp: "2026-04-15T10:30:00Z", action: "案例创建", actor: "张明", detail: "用户提交自然语言输入" },
      { id: "log-001-2", timestamp: "2026-04-16T09:00:00Z", action: "信息结构化", actor: "访谈官", detail: "完成 FactPack 生成" },
      { id: "log-001-3", timestamp: "2026-04-16T09:15:00Z", action: "信息不足判定", actor: "访谈官", detail: "缺少预算范围、获客渠道、竞品信息" },
    ],
    tags: ["用户增长", "Q3"],
  },

  // ---- Case 2: 信息不足（另一个） ----
  {
    id: "case-002",
    title: "电商平台转化率优化",
    status: CaseStatus.READY_FOR_DECOMPOSITION,
    team: "产品团队",
    cycle: "Q3 2026",
    flowTemplateId: "flow-standard",
    flowNodeRuns: [
      { nodeId: "intake", roleName: "信息整理官", status: "success", startedAt: "2026-04-10T14:00:00Z", completedAt: "2026-04-10T14:05:00Z" },
      { nodeId: "structuring", roleName: "信息整理官", status: "success", startedAt: "2026-04-12T16:20:00Z", completedAt: "2026-04-12T16:30:00Z" },
      { nodeId: "info-check", roleName: "协调器", status: "success", startedAt: "2026-04-12T16:31:00Z", completedAt: "2026-04-12T16:32:00Z" },
      { nodeId: "decompose", roleName: "OKR 拆解专家", status: "success", startedAt: "2026-04-13T10:00:00Z", completedAt: "2026-04-13T10:05:00Z" },
    ],
    createdAt: "2026-04-10T14:00:00Z",
    updatedAt: "2026-04-12T16:30:00Z",
    createdBy: "李婷",
    intake: {
      rawText:
        "我们是一个垂直电商平台，主营家居用品。当前月 GMV 约 3000 万，转化率 2.1%，行业平均 3.5%。我们已经完成了首页改版，但详情页和结算流程还比较老。团队有 15 名开发、3 名产品、5 名设计。Q3 预算 200 万用于产品优化。核心竞品是「好家居」和「宜品」，他们的转化率都在 3% 以上。",
      submittedAt: "2026-04-10T14:00:00Z",
      submittedBy: "李婷",
    },
    factPack: {
      businessContext:
        "垂直家居电商平台，月 GMV 3000 万，转化率 2.1%（行业均值 3.5%）",
      currentChallenges: [
        "转化率低于行业平均",
        "详情页和结算流程老旧",
        "竞品转化率均 > 3%",
      ],
      strategicGoals: ["转化率提升至 3.5%", "GMV 增长"],
      constraints: [
        "Q3 预算 200 万",
        "开发 15 人 / 产品 3 人 / 设计 5 人",
      ],
      stakeholders: ["李婷（产品总监）"],
      timeframe: "Q3 2026",
      baselines: ["当前转化率 2.1%", "详情页跳出率 65%", "结算流程完成率 60%"],
      candidateMetrics: ["购买转化率", "详情页跳出率", "结算完成率", "客单价", "加购率"],
      risks: ["改版可能短期影响现有用户习惯", "A/B 测试周期可能延长"],
      dependencies: ["设计团队交付详情页设计稿", "支付网关接口升级"],
      nonGoals: ["供应链优化", "物流体验提升", "品类扩展"],
      structuredAt: "2026-04-12T16:30:00Z",
    },
    okrDrafts: makeDraftSet(
      {
        variant: "balanced",
        objectives: [
          {
            id: "c2-b-obj-1",
            title: "提升电商平台购买转化率至行业平均水平",
            description: "通过详情页和结算流程优化，将转化率从 2.1% 提升至 3.2%",
            keyResults: [
              { id: "c2-b-kr-1", title: "购买转化率从 2.1% 提升至 3.2%", metric: "转化率", currentValue: "2.1%", targetValue: "3.2%", owner: "李婷", deadline: "2026-09-30", confidence: 0.7 },
              { id: "c2-b-kr-2", title: "详情页跳出率降低 25%", metric: "跳出率", currentValue: "65%", targetValue: "48%", owner: "设计组长-刘洋", deadline: "2026-08-15", assumptions: ["新设计稿 7 月中完成"], confidence: 0.75 },
              { id: "c2-b-kr-3", title: "结算流程完成率从 60% 提升至 78%", metric: "结算完成率", currentValue: "60%", targetValue: "78%", dependencies: ["支付网关接口升级完成"], risks: ["第三方支付 SDK 兼容性问题"], confidence: 0.7 },
            ],
          },
        ],
        reasoning: "【平衡型】在现有团队和预算条件下，聚焦详情页和结算流程两个核心转化环节。目标设定接近但略低于行业均值 3.5%，兼顾挑战性与可达成性。选择跳出率和结算完成率作为过程 KR，因为这两个指标直接驱动最终转化率。",
        generatedAt: "2026-04-13T10:00:00Z",
        generatedBy: "OKR 拆解专家",
      },
      {
        objectives: [
          {
            id: "c2-c-obj-1",
            title: "稳步优化电商核心转化链路",
            description: "优先改造结算流程这一确定性最高的环节",
            keyResults: [
              { id: "c2-c-kr-1", title: "购买转化率从 2.1% 提升至 2.8%", metric: "转化率", currentValue: "2.1%", targetValue: "2.8%", confidence: 0.85 },
              { id: "c2-c-kr-2", title: "结算流程完成率从 60% 提升至 72%", metric: "结算完成率", currentValue: "60%", targetValue: "72%", confidence: 0.85 },
            ],
          },
        ],
        reasoning: "【保守型】聚焦结算流程单一环节，这是投入产出比最确定的优化方向。转化率目标 2.8% 虽低于行业均值，但基于当前团队首次做此类优化，保守目标可确保团队信心和执行质量。",
      },
      {
        objectives: [
          {
            id: "c2-a-obj-1",
            title: "全链路转化率优化，达到行业领先水平",
            description: "详情页、结算流程、推荐系统三管齐下",
            keyResults: [
              { id: "c2-a-kr-1", title: "购买转化率从 2.1% 提升至 3.8%", metric: "转化率", currentValue: "2.1%", targetValue: "3.8%", confidence: 0.45 },
              { id: "c2-a-kr-2", title: "详情页跳出率降低 40%", metric: "跳出率", currentValue: "65%", targetValue: "39%", confidence: 0.5 },
              { id: "c2-a-kr-3", title: "结算流程完成率提升至 85%", metric: "结算完成率", currentValue: "60%", targetValue: "85%", confidence: 0.5 },
              { id: "c2-a-kr-4", title: "上线个性化推荐系统，点击率 > 15%", metric: "推荐点击率", currentValue: "0", targetValue: "15%", confidence: 0.4 },
            ],
          },
        ],
        reasoning: "【进取型】目标超越行业均值 3.5%，定位行业领先。除详情页和结算外，额外引入推荐系统作为增量杠杆。风险在于推荐系统需额外研发资源，且 200 万预算分三线可能吃紧。适合团队有余力且希望弯道超车的场景。",
      }
    ),
    logs: [
      { id: "log-002-1", timestamp: "2026-04-10T14:00:00Z", action: "案例创建", actor: "李婷" },
      { id: "log-002-2", timestamp: "2026-04-12T16:30:00Z", action: "信息结构化", actor: "访谈官", detail: "信息充分，可进入拆解" },
      { id: "log-002-3", timestamp: "2026-04-13T10:00:00Z", action: "OKR 草稿生成", actor: "OKR 拆解专家", detail: "生成保守/平衡/进取三版草稿" },
    ],
    tags: ["电商", "转化率", "Q3"],
  },

  // ---- Case 3: 审核未通过 ----
  {
    id: "case-003",
    title: "SaaS 产品客户成功体系建设",
    status: CaseStatus.REVIEW_FAILED,
    team: "客户成功部",
    cycle: "H2 2026",
    flowTemplateId: "flow-standard",
    flowNodeRuns: [
      { nodeId: "intake", roleName: "信息整理官", status: "success", startedAt: "2026-04-05T09:00:00Z", completedAt: "2026-04-05T09:05:00Z" },
      { nodeId: "structuring", roleName: "信息整理官", status: "success", startedAt: "2026-04-06T10:00:00Z", completedAt: "2026-04-06T10:05:00Z" },
      { nodeId: "info-check", roleName: "协调器", status: "success", startedAt: "2026-04-06T10:06:00Z", completedAt: "2026-04-06T10:07:00Z" },
      { nodeId: "decompose", roleName: "OKR 拆解专家", status: "success", startedAt: "2026-04-17T15:00:00Z", completedAt: "2026-04-17T15:05:00Z" },
      { nodeId: "review", roleName: "审核官", status: "failed", startedAt: "2026-04-18T11:00:00Z", completedAt: "2026-04-18T11:05:00Z", error: "评分 58/100，未达通过阈值" },
    ],
    createdAt: "2026-04-05T09:00:00Z",
    updatedAt: "2026-04-18T11:00:00Z",
    createdBy: "王强",
    intake: {
      rawText:
        "我们是一个 B2B SaaS 产品，年收入约 5000 万，客户 200 家。当前续费率 75%，NPS 35。希望在 H2 建立客户成功体系，目标续费率提升到 85%，NPS 到 50。团队计划扩招 5 名 CSM。",
      submittedAt: "2026-04-05T09:00:00Z",
      submittedBy: "王强",
    },
    factPack: {
      businessContext:
        "B2B SaaS，年收入 5000 万，200 家客户，续费率 75%，NPS 35",
      currentChallenges: [
        "续费率低于行业标杆（85%+）",
        "NPS 有提升空间",
        "缺乏系统化客户成功体系",
      ],
      strategicGoals: ["续费率提升至 85%", "NPS 提升至 50"],
      constraints: ["H2 周期", "计划扩招 5 名 CSM"],
      stakeholders: ["王强（VP Sales）", "客户成功团队"],
      timeframe: "H2 2026",
      baselines: ["当前续费率 75%", "NPS 35", "无系统化 CS 体系"],
      candidateMetrics: ["续费率", "NPS", "客户健康度评分", "月均互动频次", "Churn Rate"],
      risks: ["CSM 招聘周期可能超预期", "新团队磨合周期长"],
      dependencies: ["HR 完成 CSM 岗位发布", "客户数据平台 API 就绪"],
      nonGoals: ["新客户获取", "产品功能大改", "价格体系调整"],
      structuredAt: "2026-04-06T10:00:00Z",
    },
    okrDrafts: makeDraftSet(
      {
        variant: "balanced",
        objectives: [
          {
            id: "c3-b-obj-1",
            title: "建立系统化的客户成功运营体系",
            description: "从零搭建客户成功团队和流程，实现客户生命周期的主动管理",
            keyResults: [
              { id: "c3-b-kr-1", title: "客户续费率从 75% 提升至 82%", metric: "续费率", currentValue: "75%", targetValue: "82%", owner: "王强", deadline: "2026-12-31", confidence: 0.7 },
              { id: "c3-b-kr-2", title: "建立并上线客户健康度评分系统", metric: "系统上线", currentValue: "无", targetValue: "已上线并覆盖全部客户", owner: "技术负责人", deadline: "2026-09-30", dependencies: ["客户数据平台 API 就绪"], confidence: 0.85 },
              { id: "c3-b-kr-3", title: "完成 5 名 CSM 招聘并完成上岗培训", metric: "CSM 就位数", currentValue: "0", targetValue: "5", risks: ["招聘市场 CSM 人才稀缺"], confidence: 0.8 },
            ],
          },
          {
            id: "c3-b-obj-2",
            title: "提升客户满意度和产品粘性",
            description: "通过主动服务和产品优化，提升 NPS 和客户活跃度",
            keyResults: [
              { id: "c3-b-kr-4", title: "NPS 从 35 提升至 45", metric: "NPS", currentValue: "35", targetValue: "45", confidence: 0.65 },
              { id: "c3-b-kr-5", title: "月均客户互动频次从 2 次提升至 4 次", metric: "月均互动频次", currentValue: "2 次", targetValue: "4 次", confidence: 0.75 },
            ],
          },
        ],
        reasoning: "【平衡型】分为体系搭建和满意度提升两个 Objective。续费率目标设为 82% 而非 85%，因为从零搭建 CS 体系在半年内达到行业标杆有挑战。NPS 目标也适度下调到 45，留出渐进提升空间。",
        generatedAt: "2026-04-17T15:00:00Z",
        generatedBy: "OKR 拆解专家",
      },
      {
        objectives: [
          {
            id: "c3-c-obj-1",
            title: "搭建客户成功基础设施",
            description: "先建团队、建系统，确保基础能力就位",
            keyResults: [
              { id: "c3-c-kr-1", title: "客户续费率从 75% 提升至 79%", metric: "续费率", currentValue: "75%", targetValue: "79%", confidence: 0.85 },
              { id: "c3-c-kr-2", title: "完成 3 名 CSM 招聘并上岗", metric: "CSM 就位数", currentValue: "0", targetValue: "3", confidence: 0.9 },
            ],
          },
        ],
        reasoning: "【保守型】H2 从零建 CS 体系，保守方案聚焦基础建设：先招 3 人、先跑起来。续费率仅提 4 个点，确保新团队有足够时间磨合，不因过高目标导致动作变形。",
      },
      {
        objectives: [
          {
            id: "c3-a-obj-1",
            title: "全面建成客户成功体系并达到行业标杆",
            description: "团队、系统、流程、指标全面对齐行业最佳实践",
            keyResults: [
              { id: "c3-a-kr-1", title: "客户续费率从 75% 提升至 85%", metric: "续费率", currentValue: "75%", targetValue: "85%", confidence: 0.45 },
              { id: "c3-a-kr-2", title: "NPS 从 35 提升至 50", metric: "NPS", currentValue: "35", targetValue: "50", confidence: 0.4 },
              { id: "c3-a-kr-3", title: "客户流失预警准确率 > 80%", metric: "预警准确率", currentValue: "0", targetValue: "80%", confidence: 0.35 },
            ],
          },
        ],
        reasoning: "【进取型】直接对齐行业标杆续费率 85% 和 NPS 50，并额外引入流失预警系统。风险极高：新团队半年内同时做招聘、建系统、推指标，失败概率大。适合管理层有强烈决心且愿意追加资源的情况。",
      }
    ),
    reviewReport: {
      overallScore: 58,
      passed: false,
      needsHumanReview: false,
      prerequisites: [
        { label: "FactPack 完整性", met: true },
        { label: "KR 均有量化指标", met: true },
        { label: "草稿包含三版方案", met: true },
      ],
      coreDimensions: [
        { name: "目标明确性", score: 8, maxScore: 10, comment: "目标清晰" },
        { name: "可衡量性", score: 7, maxScore: 10, comment: "指标明确但部分 KR 难以精确追踪" },
        { name: "可达成性", score: 5, maxScore: 10, comment: "从零建 CS 体系，目标偏高" },
      ],
      auxDimensions: [
        { name: "相关性", score: 8, maxScore: 10, comment: "与业务续费诉求一致" },
        { name: "时限性", score: 5, maxScore: 10, comment: "H2 周期对全面建设而言偏紧" },
      ],
      fatalIssues: [
        "从零搭建客户成功体系的同时要求续费率提升 7 个点，风险集中度过高",
      ],
      suggestions: [
        "建议分阶段推进，Q3 聚焦基础建设，Q4 聚焦指标提升",
        "续费率目标建议下调至 80%，NPS 目标下调至 42",
        "CSM 招聘存在不确定性，建议设置 plan B",
      ],
      reviewedAt: "2026-04-18T11:00:00Z",
      reviewedBy: "审核专家",
    },
    logs: [
      { id: "log-003-1", timestamp: "2026-04-05T09:00:00Z", action: "案例创建", actor: "王强" },
      { id: "log-003-2", timestamp: "2026-04-06T10:00:00Z", action: "信息结构化", actor: "访谈官" },
      { id: "log-003-3", timestamp: "2026-04-17T15:00:00Z", action: "OKR 草稿生成", actor: "OKR 拆解专家", detail: "生成三版草稿" },
      { id: "log-003-4", timestamp: "2026-04-18T11:00:00Z", action: "审核未通过", actor: "审核专家", detail: "总分 58，可达成性和时限性得分偏低" },
    ],
    tags: ["SaaS", "客户成功", "H2"],
  },

  // ---- Case 4: 审核通过 ----
  {
    id: "case-004",
    title: "研发效能提升计划",
    status: CaseStatus.REVIEW_PASSED,
    team: "工程效能部",
    cycle: "Q3 2026",
    flowTemplateId: "flow-standard",
    flowNodeRuns: [
      { nodeId: "intake", roleName: "信息整理官", status: "success", startedAt: "2026-03-20T08:00:00Z", completedAt: "2026-03-20T08:05:00Z" },
      { nodeId: "structuring", roleName: "信息整理官", status: "success", startedAt: "2026-03-21T10:00:00Z", completedAt: "2026-03-21T10:05:00Z" },
      { nodeId: "info-check", roleName: "协调器", status: "success", startedAt: "2026-03-21T10:06:00Z", completedAt: "2026-03-21T10:07:00Z" },
      { nodeId: "decompose", roleName: "OKR 拆解专家", status: "success", startedAt: "2026-04-01T10:00:00Z", completedAt: "2026-04-01T10:05:00Z" },
      { nodeId: "review", roleName: "审核官", status: "success", startedAt: "2026-04-10T14:00:00Z", completedAt: "2026-04-10T14:05:00Z" },
      { nodeId: "finalize", roleName: "协调器", status: "success", startedAt: "2026-04-10T14:10:00Z", completedAt: "2026-04-10T14:11:00Z" },
    ],
    createdAt: "2026-03-20T08:00:00Z",
    updatedAt: "2026-04-10T14:00:00Z",
    createdBy: "赵磊",
    intake: {
      rawText:
        "我们研发团队有 60 人，当前迭代周期 4 周，上线频率每月 1 次，线上 Bug 率较高（每次发布约 15 个 P2 以上 Bug）。目标是 Q3 将迭代周期缩短到 2 周，上线频率提升到每周 1 次，Bug 率降低 60%。预算 300 万。",
      submittedAt: "2026-03-20T08:00:00Z",
      submittedBy: "赵磊",
    },
    factPack: {
      businessContext:
        "60 人研发团队，迭代周期 4 周，月上线 1 次，每次发布 15+ P2 Bug",
      currentChallenges: [
        "迭代周期过长",
        "上线频率低",
        "线上 Bug 率高",
        "缺乏自动化测试",
      ],
      strategicGoals: [
        "迭代周期缩至 2 周",
        "上线频率提至每周 1 次",
        "Bug 率降低 60%",
      ],
      constraints: ["Q3 周期", "预算 300 万", "团队 60 人"],
      stakeholders: ["赵磊（CTO）", "各研发 TL"],
      timeframe: "Q3 2026",
      baselines: ["迭代周期 4 周", "上线频率每月 1 次", "每次发布 15+ P2 Bug", "自动化测试覆盖率 < 20%"],
      candidateMetrics: ["迭代周期", "上线频率", "P2+ Bug 数", "自动化测试覆盖率", "CI/CD 耗时", "代码审查通过率"],
      risks: ["团队习惯转变需要时间", "CI/CD 基础设施建设可能延期"],
      dependencies: ["DevOps 工具链采购审批", "各团队 TL 配合推进流程改造"],
      nonGoals: ["编程语言迁移", "微服务架构重构", "团队扩招"],
      structuredAt: "2026-03-21T10:00:00Z",
    },
    okrDrafts: makeDraftSet(
      {
        variant: "balanced",
        objectives: [
          {
            id: "c4-b-obj-1",
            title: "大幅提升研发交付效率",
            description: "通过流程优化和工具建设，缩短交付周期",
            keyResults: [
              { id: "c4-b-kr-1", title: "迭代周期从 4 周缩短至 2 周", metric: "迭代周期", currentValue: "4 周", targetValue: "2 周", owner: "赵磊", deadline: "2026-09-30", confidence: 0.8 },
              { id: "c4-b-kr-2", title: "上线频率从每月 1 次提升至每两周 1 次", metric: "上线频率", currentValue: "1 次/月", targetValue: "2 次/月", confidence: 0.8 },
              { id: "c4-b-kr-3", title: "CI/CD 流水线平均耗时低于 30 分钟", metric: "CI/CD 耗时", currentValue: "未知", targetValue: "< 30 分钟", owner: "DevOps 负责人", deadline: "2026-08-31", assumptions: ["DevOps 工具链 7 月底前完成采购"], confidence: 0.85 },
            ],
          },
          {
            id: "c4-b-obj-2",
            title: "显著降低线上质量问题",
            description: "通过自动化测试和代码审查提升交付质量",
            keyResults: [
              { id: "c4-b-kr-4", title: "每次发布 P2+ Bug 从 15 个降至 6 个", metric: "P2+ Bug 数", currentValue: "15", targetValue: "6", confidence: 0.7 },
              { id: "c4-b-kr-5", title: "自动化测试覆盖率达到 60%", metric: "测试覆盖率", currentValue: "< 20%", targetValue: "60%", confidence: 0.7 },
            ],
          },
        ],
        reasoning: "【平衡型】效能提升分两条线：交付效率和交付质量，互不冲突且互相促进。CI/CD 建设同时服务两个目标。上线频率设为每两周而非每周，给团队适应期。测试覆盖率 60% 是从低基线大幅提升但仍属可行。",
        generatedAt: "2026-04-01T10:00:00Z",
        generatedBy: "OKR 拆解专家",
      },
      {
        objectives: [
          {
            id: "c4-c-obj-1",
            title: "建立研发效能基础设施",
            description: "优先建设 CI/CD 和基础测试体系",
            keyResults: [
              { id: "c4-c-kr-1", title: "迭代周期缩短至 3 周", metric: "迭代周期", currentValue: "4 周", targetValue: "3 周", confidence: 0.9 },
              { id: "c4-c-kr-2", title: "P2+ Bug 从 15 个降至 10 个", metric: "P2+ Bug 数", currentValue: "15", targetValue: "10", confidence: 0.85 },
              { id: "c4-c-kr-3", title: "自动化测试覆盖率达到 40%", metric: "测试覆盖率", currentValue: "< 20%", targetValue: "40%", confidence: 0.85 },
            ],
          },
        ],
        reasoning: "【保守型】从 4 周先缩到 3 周，Bug 先降 1/3 而非 60%。测试覆盖率只提到 40%。好处是每个目标置信度高，团队不会因为目标过激而放弃。适合首次做效能改进、团队信心不足的场景。",
      },
      {
        objectives: [
          {
            id: "c4-a-obj-1",
            title: "研发效能全面对齐业界标杆",
            description: "迭代周期、发布频率、质量指标全面追赶一线互联网",
            keyResults: [
              { id: "c4-a-kr-1", title: "迭代周期缩短至 1 周", metric: "迭代周期", currentValue: "4 周", targetValue: "1 周", confidence: 0.4 },
              { id: "c4-a-kr-2", title: "上线频率提升至每周 1 次", metric: "上线频率", currentValue: "1 次/月", targetValue: "1 次/周", confidence: 0.5 },
              { id: "c4-a-kr-3", title: "P2+ Bug 降至 3 个以下", metric: "P2+ Bug 数", currentValue: "15", targetValue: "3", confidence: 0.35 },
              { id: "c4-a-kr-4", title: "自动化测试覆盖率达到 80%", metric: "测试覆盖率", currentValue: "< 20%", targetValue: "80%", confidence: 0.4 },
            ],
          },
        ],
        reasoning: "【进取型】直接对标一线大厂标准。1 周迭代 + 每周发布 + 极低 Bug 率 + 高覆盖率。现实中这意味着需要大量基础设施投入和团队文化转变，300 万预算可能不够。但如果成功，将彻底改变团队面貌。",
      }
    ),
    reviewReport: {
      overallScore: 88,
      passed: true,
      needsHumanReview: false,
      prerequisites: [
        { label: "FactPack 完整性", met: true },
        { label: "KR 均有量化指标", met: true },
        { label: "草稿包含三版方案", met: true },
        { label: "基线数据已提供", met: true },
      ],
      coreDimensions: [
        { name: "目标明确性", score: 9, maxScore: 10, comment: "目标清晰，与业务痛点直接对应" },
        { name: "可衡量性", score: 9, maxScore: 10, comment: "所有 KR 都有明确的量化指标" },
        { name: "可达成性", score: 8, maxScore: 10, comment: "平衡型目标设定合理，挑战性适中" },
      ],
      auxDimensions: [
        { name: "相关性", score: 9, maxScore: 10, comment: "与 CTO 战略意图高度一致" },
        { name: "时限性", score: 9, maxScore: 10, comment: "Q3 时间窗口合理" },
      ],
      fatalIssues: [],
      suggestions: [
        "建议为自动化测试覆盖率设定阶段性里程碑",
        "CI/CD 耗时指标建议先基线测量",
      ],
      reviewedAt: "2026-04-10T14:00:00Z",
      reviewedBy: "审核专家",
    },
    logs: [
      { id: "log-004-1", timestamp: "2026-03-20T08:00:00Z", action: "案例创建", actor: "赵磊" },
      { id: "log-004-2", timestamp: "2026-03-21T10:00:00Z", action: "信息结构化", actor: "访谈官", detail: "信息充分" },
      { id: "log-004-3", timestamp: "2026-04-01T10:00:00Z", action: "OKR 草稿生成", actor: "OKR 拆解专家" },
      { id: "log-004-4", timestamp: "2026-04-10T14:00:00Z", action: "审核通过", actor: "审核专家", detail: "总分 88，各维度表现优秀" },
    ],
    tags: ["研发效能", "Q3", "工程文化"],
  },

  // ---- Case 5: 审核未通过（需人工介入） ----
  {
    id: "case-005",
    title: "海外市场拓展战略",
    status: CaseStatus.HUMAN_REVIEW_REQUIRED,
    team: "海外事业部",
    cycle: "H2 2026",
    flowTemplateId: "flow-expert",
    flowNodeRuns: [
      { nodeId: "intake", roleName: "信息整理官", status: "success", startedAt: "2026-04-01T11:00:00Z", completedAt: "2026-04-01T11:05:00Z" },
      { nodeId: "structuring", roleName: "信息整理官", status: "success", startedAt: "2026-04-02T14:00:00Z", completedAt: "2026-04-02T14:05:00Z" },
      { nodeId: "info-check", roleName: "协调器", status: "success", startedAt: "2026-04-02T14:06:00Z", completedAt: "2026-04-02T14:07:00Z" },
      { nodeId: "decompose", roleName: "OKR 拆解专家", status: "success", startedAt: "2026-04-15T10:00:00Z", completedAt: "2026-04-15T10:05:00Z" },
      { nodeId: "auto-review", roleName: "审核官", status: "success", startedAt: "2026-04-20T09:00:00Z", completedAt: "2026-04-20T09:05:00Z" },
      { nodeId: "human-review", roleName: "协调器", status: "running", startedAt: "2026-04-20T09:06:00Z" },
    ],
    createdAt: "2026-04-01T11:00:00Z",
    updatedAt: "2026-04-20T09:00:00Z",
    createdBy: "陈雪",
    intake: {
      rawText:
        "公司决定 2026 下半年进入东南亚市场，首站新加坡和印尼。当前产品仅支持中文，需要做国际化。团队还没有海外运营经验。年度海外预算 1000 万人民币。目标是年底前在两个市场各获取 1 万付费用户。",
      submittedAt: "2026-04-01T11:00:00Z",
      submittedBy: "陈雪",
    },
    factPack: {
      businessContext:
        "计划 H2 进入东南亚市场（新加坡、印尼），当前产品仅中文，无海外经验",
      currentChallenges: [
        "产品缺乏国际化支持",
        "团队无海外运营经验",
        "两个市场文化差异大",
        "合规和支付本地化需求",
      ],
      strategicGoals: [
        "新加坡获取 1 万付费用户",
        "印尼获取 1 万付费用户",
      ],
      constraints: ["H2 周期", "年度海外预算 1000 万 RMB", "需从零建立海外团队"],
      stakeholders: ["陈雪（VP 海外业务）", "产品团队", "法务"],
      timeframe: "H2 2026",
      baselines: ["产品仅支持中文", "海外付费用户 0", "无海外运营团队"],
      candidateMetrics: ["语言支持数", "本地化支付上线数", "付费用户数", "获客成本", "用户激活率"],
      risks: ["合规审批周期不可控", "印尼支付生态碎片化", "文化差异导致产品水土不服"],
      dependencies: ["法务完成新加坡和印尼合规调研", "产品国际化框架搭建完成", "海外支付服务商签约"],
      nonGoals: ["东南亚以外市场拓展", "产品 2.0 大版本迭代", "硬件或 IoT 方向"],
      structuredAt: "2026-04-02T14:00:00Z",
    },
    okrDrafts: makeDraftSet(
      {
        variant: "balanced",
        objectives: [
          {
            id: "c5-b-obj-1",
            title: "完成产品国际化并在两个目标市场上线",
            description: "产品支持英语和印尼语，完成支付和合规本地化",
            keyResults: [
              { id: "c5-b-kr-1", title: "产品支持英语和印尼语两种语言", metric: "语言支持数", currentValue: "1（仅中文）", targetValue: "3（中/英/印尼）", owner: "产品国际化组", deadline: "2026-09-15", confidence: 0.9 },
              { id: "c5-b-kr-2", title: "完成新加坡和印尼的支付本地化", metric: "本地化支付上线", currentValue: "0", targetValue: "2 个市场", dependencies: ["海外支付服务商签约"], confidence: 0.7 },
            ],
          },
          {
            id: "c5-b-obj-2",
            title: "在目标市场建立初始用户基础",
            description: "通过本地化运营获取首批付费用户",
            keyResults: [
              { id: "c5-b-kr-3", title: "新加坡市场获取 5000 付费用户", metric: "付费用户数", currentValue: "0", targetValue: "5,000", confidence: 0.5 },
              { id: "c5-b-kr-4", title: "印尼市场获取 3000 付费用户", metric: "付费用户数", currentValue: "0", targetValue: "3,000", confidence: 0.45 },
            ],
          },
        ],
        reasoning: "【平衡型】分为产品就绪和市场拓展两个维度。国际化是前置条件，用户获取依赖产品就绪。用户获取目标从各 1 万下调至新加坡 5000 / 印尼 3000，因为印尼虽人口多但付费习惯和基础设施更具挑战。先验证 PMF 再加量。",
        generatedAt: "2026-04-15T10:00:00Z",
        generatedBy: "OKR 拆解专家",
      },
      {
        objectives: [
          {
            id: "c5-c-obj-1",
            title: "完成产品国际化基础并在新加坡单市场试水",
            description: "聚焦新加坡单一市场，降低复杂度",
            keyResults: [
              { id: "c5-c-kr-1", title: "产品支持英语", metric: "语言支持数", currentValue: "1", targetValue: "2（中/英）", confidence: 0.95 },
              { id: "c5-c-kr-2", title: "新加坡市场获取 2000 付费用户", metric: "付费用户数", currentValue: "0", targetValue: "2,000", confidence: 0.65 },
            ],
          },
        ],
        reasoning: "【保守型】H2 只做新加坡，不做印尼。原因：团队零海外经验，同时开两个市场风险极高。新加坡英语环境、合规成熟度高，是更好的首站。目标仅 2000 用户，先验证商业模型。印尼留到 2027 H1。",
      },
      {
        objectives: [
          {
            id: "c5-a-obj-1",
            title: "产品国际化并双市场全面上线",
            description: "中英印尼三语 + 双市场同步推进",
            keyResults: [
              { id: "c5-a-kr-1", title: "三语言版本全部上线", metric: "语言支持数", currentValue: "1", targetValue: "3", confidence: 0.85 },
              { id: "c5-a-kr-2", title: "新加坡获取 1 万付费用户", metric: "付费用户数", currentValue: "0", targetValue: "10,000", confidence: 0.3 },
              { id: "c5-a-kr-3", title: "印尼获取 1 万付费用户", metric: "付费用户数", currentValue: "0", targetValue: "10,000", confidence: 0.25 },
            ],
          },
        ],
        reasoning: "【进取型】完全按照管理层原始目标执行。风险极高：零经验团队半年内双市场各 1 万用户，置信度仅 25-30%。1000 万预算分两个市场获客成本可能 500 元/用户，预算将被快速消耗。仅适合公司愿意追加资源且接受失败的情况。",
      }
    ),
    reviewReport: {
      overallScore: 62,
      passed: false,
      needsHumanReview: true,
      prerequisites: [
        { label: "FactPack 完整性", met: true },
        { label: "KR 均有量化指标", met: true },
        { label: "草稿包含三版方案", met: true },
        { label: "合规可行性确认", met: false, note: "新加坡和印尼的合规调研尚未完成" },
      ],
      coreDimensions: [
        { name: "目标明确性", score: 8, maxScore: 10, comment: "目标清晰" },
        { name: "可衡量性", score: 7, maxScore: 10, comment: "指标明确" },
        { name: "可达成性", score: 4, maxScore: 10, comment: "从零开始半年内双市场获客，置信度低，风险极高" },
      ],
      auxDimensions: [
        { name: "相关性", score: 8, maxScore: 10, comment: "与公司出海战略一致" },
        { name: "时限性", score: 5, maxScore: 10, comment: "H2 时间窗口对于产品国际化 + 市场拓展同步推进而言可能过于紧张" },
      ],
      fatalIssues: [
        "合规可行性未确认即设定用户获取目标，存在法律风险",
        "团队无海外经验，同时开辟两个文化差异较大的市场，失败概率极高",
      ],
      suggestions: [
        "建议拆分为两个阶段：先完成产品国际化（Q3），再推进用户获取（Q4）",
        "建议优先聚焦新加坡单市场，印尼推迟至 2027 H1",
        "需要补充海外团队组建计划",
        "需评估 1000 万预算在两个市场的分配方案",
      ],
      reviewedAt: "2026-04-20T09:00:00Z",
      reviewedBy: "审核专家",
    },
    logs: [
      { id: "log-005-1", timestamp: "2026-04-01T11:00:00Z", action: "案例创建", actor: "陈雪" },
      { id: "log-005-2", timestamp: "2026-04-02T14:00:00Z", action: "信息结构化", actor: "访谈官", detail: "信息充分" },
      { id: "log-005-3", timestamp: "2026-04-15T10:00:00Z", action: "OKR 草稿生成", actor: "OKR 拆解专家", detail: "生成三版草稿" },
      { id: "log-005-4", timestamp: "2026-04-20T09:00:00Z", action: "需人工审核", actor: "审核专家", detail: "总分 62，可达成性存疑，建议人工介入评估" },
    ],
    tags: ["出海", "东南亚", "国际化", "H2"],
  },
];
