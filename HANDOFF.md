# OKR Harness 交接文档

> 生成时间：2026-04-29 · 基于 commit `81170ff` 及其后的未提交改动

---

## 1. 项目目标

### 这个项目是做什么的

OKR Harness 是一个 **AI 驱动的 OKR 拆解 SaaS 工具**。用户输入业务背景文本，系统通过多 AI Agent 流水线自动完成：信息结构化 → 信息完整性检查 → OKR 三版方案拆解（保守/平衡/进取） → 质量审核 → 定稿。

### 当前主要功能

- **案例管理**：创建/查看/删除 OKR 案例，状态机驱动的生命周期
- **AI 流水线**：4 个 AI 角色（信息整理官 / OKR 拆解专家 / 审核官 / 协调器）协作完成拆解
- **多版草案**：自动生成保守、平衡、进取三版 OKR 方案，用户选择候选
- **质量审核**：按维度评分 + 必要条件检查 + 致命问题/建议，支持自动通过/人工审核阈值
- **配置中心**：角色模型、API Key、审核规则、流程模板全部可配置
- **Flow Graph**：可视化流水线节点状态，支持从单个节点重跑
- **Mock/Live 双模式**：开发阶段用 mock 数据，配置真实 API Key 后切 live

### 最终想实现什么

一个**真实可运行**的 OKR 拆解原型——不是高保真 demo，而是配置生效、数据真实流转、按钮全部接通的可运行系统。

---

## 2. 当前开发状态

### 已完成功能

| 功能 | 状态 | 备注 |
|------|------|------|
| 案例创建 & 列表 | ✅ | 完整可用 |
| 信息输入 (Intake) | ✅ | 完整可用 |
| 信息结构化 (Fact Pack) | ✅ | mock/live 均可 |
| 信息完整性检查 (Missing Info) | ✅ | 支持补充信息写回 |
| OKR 三版拆解 (Drafts) | ✅ | mock/live 均可 |
| 质量审核 (Review) | ✅ | mock/live 均可，含通过/未通过/人工审核 |
| 定稿 (Final) | ✅ | 基本可用 |
| 配置中心 | ✅ | 角色/模型/审核规则/流程 |
| 测试连接 | ✅ | 真实调用模型 API |
| Flow Graph 可视化 | ✅ | 含节点详情和重跑 |
| 操作按钮接通 | ✅ | 信息不足→Missing / 审核未通过→Drafts / 审核通过→Final |
| 数据回写 & UI 响应 | ✅ | Zustand selector 修复后数据正确显示 |

### 已修改文件清单（17 个，对比 `81170ff`）

| 文件 | 改动目的 |
|------|----------|
| `src/lib/store.ts` | **核心修复**：supplementInfo 真实写回数据；stale closure 修复（async 中重读最新 case）；rerunNode 真实重跑；日志记录配置上下文和动态角色名 |
| `src/lib/ai/agents.ts` | 添加 strictLive 透传；修复 mockDraftSet 中 Date.now() 导致的 React key 重复（引入递增 _mockIdCounter） |
| `src/lib/ai/provider.ts` | 添加 strictLive 参数，true 时拒绝 mock fallback 直接抛错；testConnection 返回结构化错误 |
| `src/lib/ai/index.ts` | 导出 TestConnectionResult 类型 |
| `src/app/api/ai/adapter.ts` | **新增**：服务端共享 AI 适配器，URL 规范化，provider 别名匹配，错误分类 |
| `src/app/api/ai/run/route.ts` | 重写为使用 adapter.ts 的 callModel()，返回结构化错误 |
| `src/app/api/ai/test/route.ts` | 重写为使用 adapter.ts 的 testModelConnection() |
| `src/types/index.ts` | AppConfig 添加 strictLive: boolean |
| `src/data/mock-config.ts` | 添加 strictLive: false 默认值 |
| `src/components/case-detail/case-detail-client.tsx` | **核心修复**：zustand selector 从 `s.getCase(id)` 改为 `s.cases.find()`；Tabs 改受控；添加 EmptyTabState |
| `src/components/case-detail/drafts-tab.tsx` | 同上 selector 修复 |
| `src/components/case-detail/review-tab.tsx` | 同上 selector 修复；添加 onNavigateTab；显示审核阈值 |
| `src/components/case-detail/overview-tab.tsx` | 添加 onNavigateTab；操作按钮接通；显示 runMode |
| `src/components/case-detail/flow-graph-tab.tsx` | rerunNode 真实重跑；节点详情显示输入/输出摘要和 runMode |
| `src/components/case-detail/missing-info-tab.tsx` | 补充信息后清除本地输入状态 |
| `src/components/config/models-tab.tsx` | React key 修复；测试连接显示错误码；添加 Strict Live 开关 |
| `src/components/shared/index.tsx` | CaseActionButton 审核通过链接从 `?tab=draft` 改为 `?tab=final` |
| `src/app/review/page.tsx` | "查看详情"链接包含 `?tab=review` |

### 当前代码是否能运行

**能**。`tsc --noEmit` 通过，`eslint` 通过（仅 warnings），`next build` 成功。

---

## 3. 未完成任务

### 明确未完成

1. **无测试**：项目没有任何单元测试或集成测试。所有验证靠手动运行。
2. **API Key 存储**：当前 API Key 明文存储在 Zustand + localStorage。无加密，无 .env 管理。
3. **Live 模式 JSON 解析脆弱**：AI 返回的 JSON 靠正则 + `JSON.parse` 提取，模型输出格式稍有不一致就会 fallback 到 mock。需要更健壮的解析（如流式 JSON 修复）。
4. **Live 模式下 objectives 内 keyResults 缺少 id 字段**：`runDecompositionAgent` 的 live 解析路径 `wrap()` 函数没有给 keyResults 生成 id，可能导致 React key 警告。
5. **mockDraftSet 的 `_mockIdCounter` 是模块级变量**：页面刷新后重置，但在同一会话中持续递增。如果未来需要持久化 ID，需要改为 UUID 或类似方案。
6. **无 .env.example**：缺少环境变量模板文件。

### 不确定的部分

1. **DeepSeek 等 provider 的 base URL 自动推断**：`resolveBaseUrl` 做了别名匹配，但未覆盖所有可能的 OpenAI 兼容 API。
2. **retryDecomposition 的 UX**：点击"重新拆解"会重新走整个流水线，但没有进度指示，只有 4 秒 setTimeout 占位。
3. **Final 标签页内容**：定稿后的展示较简单，没有导出/分享功能。
4. **多用户/并发**：当前是单用户 localStorage 方案，无后端持久化。

---

## 4. 最近的关键决策

### 为什么这样设计

| 决策 | 原因 |
|------|------|
| Zustand + persist middleware | 前端原型最快方案，无需后端。localStorage 持久化让刷新不丢数据 |
| Mock/Live 双模式 | 开发阶段不依赖外部 API，降低开发门槛；配置 API Key 后可切 live |
| 服务端 adapter.ts | 统一 `/api/ai/test` 和 `/api/ai/run` 的模型调用逻辑，避免重复代码 |
| `s.cases.find()` 替代 `s.getCase(id)` | Zustand selector 必须用 `s` 参数追踪依赖，`get()` 绕过了响应式追踪，这是数据不显示的根因 |
| strictLive 模式 | 调试时防止 silent fallback 到 mock 让人误以为 live 成功 |
| 递增 `_mockIdCounter` 替代 `Date.now()` | `Date.now()` 同一毫秒内多次调用返回相同值，导致 React key 重复 |

### 放弃过的方案

| 方案 | 为什么放弃 |
|------|-----------|
| `s.getCase(id)` 封装 | 虽然代码更简洁，但破坏了 Zustand selector 依赖追踪，导致 UI 不响应 store 更新 |
| 在 `supplementInfo` 中只写 log | 早期实现只写了日志没改 case 数据，导致补充信息"丢失" |
| Flow Graph 用 setTimeout 模拟重跑 | 已改为调用 `rerunNode()` 真实重跑 |

### 临时 Workaround

1. **`retryDecomposition` 中 `setTimeout(() => setRegenerating(false), 4000)`**：重新拆解的完成时间不确定，用 4 秒占位关闭 loading 状态。正确做法应该是监听 case 状态变化。
2. **`startDecomposition` 中同样的 setTimeout**：同上。
3. **`rerunNode` 中 review 节点的内联 runReviewerAgent 调用**：为避免循环依赖，直接在 store 中 import 了 agents，而不是走完整 pipeline。

---

## 5. 关键目录和文件

### 核心入口文件

| 文件 | 作用 |
|------|------|
| `src/app/layout.tsx` | 根布局，导航栏 |
| `src/app/page.tsx` | 首页 |
| `src/app/cases/page.tsx` | 案例列表（仪表盘） |
| `src/app/cases/[id]/page.tsx` | 案例详情页 |

### 业务核心模块

| 文件 | 作用 | 风险等级 |
|------|------|----------|
| `src/lib/store.ts` | **最重要的文件**。Zustand store，所有状态、pipeline、action 都在这里 | 🔴 最容易改坏 |
| `src/lib/ai/agents.ts` | 3 个 AI agent 函数 + mock 生成器 | 🟡 |
| `src/lib/ai/provider.ts` | 客户端 AI 调用层，mock/live 分发 | 🟡 |
| `src/app/api/ai/adapter.ts` | 服务端 AI 适配器，实际 HTTP 调用 | 🟡 |
| `src/types/index.ts` | 核心类型定义 | 🟢 改动少 |
| `src/lib/state-machine.ts` | 状态转换逻辑 | 🟢 |

### 配置文件

| 文件 | 作用 |
|------|------|
| `src/data/mock-config.ts` | 默认配置（角色、模型、审核规则、流程模板） |
| `src/data/mock-cases.ts` | 示例案例数据 |
| `tsconfig.json` | TypeScript 配置 |
| `next.config.ts` | Next.js 配置（当前为空） |

### 测试文件

**无**。项目没有任何测试文件。

### 容易误改的文件

| 文件 | 为什么容易误改 |
|------|---------------|
| `src/lib/store.ts` | 修改 async pipeline 时容易引入 stale closure（忘记 `get().getCase()`）；修改 selector 会破坏响应式 |
| `src/lib/ai/agents.ts` | mock 生成器的 ID 必须唯一，不能用 `Date.now()`；`tryParseJson` 的正则很脆弱 |
| `src/components/case-detail/case-detail-client.tsx` | Tabs 必须保持受控（`value` + `onValueChange`），否则异步数据加载后 tab 切换会出问题 |

---

## 6. 本地运行方式

```bash
# 安装依赖
npm install

# 启动开发环境
npm run dev

# 构建生产版本
npm run build

# 启动生产服务
npm run start

# TypeScript 类型检查
npx tsc --noEmit

# Lint 检查
npm run lint

# 注意：没有测试命令，项目无测试
```

---

## 7. 环境变量

### 当前状态

- **无 .env 文件**：项目不使用环境变量
- **无 .env.example**
- API Key 通过配置中心 UI 输入，存储在 Zustand → localStorage

### 不能提交的内容

- `localStorage` 中的 API Key（运行时数据，不在代码仓库中）
- `.next/` 构建产物

### 建议

应创建 `.env.example` 文件，列出未来可能需要的服务端环境变量（如默认 API Key、数据库连接等）。

---

## 8. 已知问题

### Lint Warnings（14 个，0 个 error）

```
review-tab.tsx     — CardDescription, Badge 未使用 import
models-tab.tsx     — TestConnectionResult 未使用 import
mock-cases.ts      — FlowNodeRun 未使用 import
agents.ts          — RunMode, AICallResult 未使用 import
store.ts           — reviewer 变量赋值后未使用（2处）
```

### 当前 Bug

1. **Live 模式下 keyResults 缺少 id**：`runDecompositionAgent` 的 live 解析路径中 `wrap()` 函数没有为 keyResults 生成 id 字段，可能导致 React key 警告和渲染问题
2. **重新拆解/重跑无真实进度指示**：使用 setTimeout(4000) 占位，实际 AI 调用可能更久或更快

### 类型错误

无。`tsc --noEmit` 通过。

### 性能或安全风险

1. **API Key 明文存储在 localStorage**：任何 XSS 都能窃取
2. **无速率限制**：`/api/ai/run` 和 `/api/ai/ai/test` 端点无 rate limiting
3. **服务端 API Key 透传**：客户端把 API Key 发送到服务端 route handler，再透传给 AI 提供商。服务端没有做 Key 校验或使用限制
4. **Zustand persist 全量序列化**：所有 case 数据（含大量文本）都在 localStorage，数据量大时可能影响性能

---

## 9. 给下一个 Coding Agent 的建议

### 最应该先读哪些文件

按优先级：

1. **`src/types/index.ts`** — 理解所有数据结构，这是读其他代码的基础
2. **`src/lib/store.ts`** — 核心业务逻辑，所有 pipeline 和状态管理
3. **`src/lib/ai/agents.ts`** — AI 调用和 mock 生成逻辑
4. **`src/components/case-detail/case-detail-client.tsx`** — 主 UI 入口，理解 tab 结构和数据流

### 最安全的下一步

1. **修复 live 模式下 keyResults 缺少 id**：在 `agents.ts` 的 `wrap()` 函数中为 keyResults 生成唯一 id
2. **清理 lint warnings**：删除未使用的 import，风险极低
3. **添加 .env.example**

### 不要做什么

1. **不要把 `s.cases.find()` 改回 `s.getCase(id)`** — 这会重新引入 UI 不响应 store 更新的 bug
2. **不要在 async pipeline 中直接使用闭包中的 case 数据** — 必须用 `get().getCase(caseId)` 重新读取最新状态
3. **不要用 `Date.now()` 生成多个 ID** — 同一毫秒内会重复
4. **不要把 Tabs 改回非受控模式** — 异步数据加载后 tab 会错位
5. **不要删除 mock fallback 逻辑** — 很多开发者没有 API Key，mock 是唯一可用的开发模式
6. **不要修改 `src/lib/ai/adapter.ts` 的 URL 规范化逻辑** — DeepSeek 等提供商的 base URL 处理很微妙，已经踩过坑

---

## 10. 验证清单

接手后应运行以下命令确认项目状态：

```bash
# 1. 安装依赖
npm install

# 2. TypeScript 类型检查（应无 error）
npx tsc --noEmit

# 3. Lint 检查（应无 error，14 warnings 可接受）
npm run lint

# 4. 生产构建（应成功）
npm run build

# 5. 启动开发环境
npm run dev
# 访问 http://localhost:3000 确认页面可加载

# 6. 手动验证核心流程
#    a. 首页 → 创建新案例 → 输入业务背景
#    b. 等待信息结构化完成 → 查看 Fact Pack 标签页有数据
#    c. 如提示信息不足 → 补充信息 → 开始拆解
#    d. 查看 Drafts 标签页有三版方案
#    e. 查看 Review 标签页有审核报告
#    f. 如审核未通过 → 点击"继续修改"应跳转 Drafts
#    g. 如审核通过 → 查看 Final 标签页
#    h. 进入配置中心 → 修改角色/模型 → 测试连接
```

---

## 附录：Git 状态

- **当前 commit**：`81170ff checkpoint before repo audit recovery`
- **未提交改动**：17 个文件，+508 / -341 行
- **所有改动均未暂存**（unstaged）
- **无 .gitignore 相关问题**
