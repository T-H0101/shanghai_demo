# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 一、项目背景与阶段

### 1.1 项目概述

**统一光盘库管理平台** 是一款用于管理光盘库设备的前端演示系统。平台支持多站点管理、机架监控、任务调度、用户权限管理、日志查询等核心功能。

### 1.2 当前阶段

| 阶段 | 状态 | 说明 |
|------|------|------|
| 页面路由搭建 | ✅ 完成 | 8个页面 + 登录页全部可访问 |
| UI 组件开发 | ✅ 完成 | 57个 Radix UI 组件 |
| Mock 数据 | ✅ 完成 | 站点/任务/用户/日志等 Mock 数据 |
| Mock 认证 | ✅ 完成 | Site-based 权限隔离 |
| 数据关联强化 | ✅ 完成 | 任务↔站点↔设备↔存储卷 关联 |
| **企业控制台 UI 收敛** | ✅ 完成 | NOC/SOC 风格收敛 |
| Mock 流程补充 | ✅ 完成 | M6-M14 全部完成：日志错误码检索、索引导出Dialog、分片导出、推送路径、监控阈值、登录锁定、权限同步 |
| **真实数据库接入** | ✅ Sprint 2A 完成 | API Mode Switch + Mock Fallback |

### 1.3 Sprint 进度

| Sprint | 状态 | 说明 |
|--------|------|------|
| Sprint 1 | ✅ 完成 | API Skeleton + DTO + Adapter |
| Sprint 2A | ✅ 完成 | API Mode Switch + Mock Fallback |
| Sprint 2B | 🔲 进行中 | PostgreSQL 连接 |
| Sprint 2B.0 | ✅ 完成 | PostgreSQL 连接封装 |
| Sprint 2B.0.1 | ✅ 完成 | 中心库 Schema 对齐修正 |

### 1.4 Sprint 2A 完成内容

**新增文件**:
- `lib/api/index.ts` - Provider Factory（模式切换）
- `lib/api/fallback.ts` - Mock Fallback 工具
- `lib/api/api-providers.ts` - API Providers
- `.env.example` - 环境变量示例

**页面接入**:
- Dashboard (stats-cards, alert-center)
- 任务管理
- 盘架管理
- 站点管理

**Sprint 2A 约束**:
- ✅ 不连接真实 PostgreSQL
- ✅ 不实现同步服务
- ✅ 不修改页面 UI
- ✅ 不新增业务功能
- ✅ 不实现登录/权限
- ✅ API 失败自动 fallback 到 mock

### 1.4 技术栈

### 1.4 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 框架 | Next.js | 16.2.6 |
| UI | React | 19 |
| 样式 | Tailwind CSS | v4 |
| 组件库 | Radix UI | @radix-ui/react-* |
| 表单 | React Hook Form + Zod | - |
| 图表 | Recharts | - |
| 构建 | Turbopack | - |

---

## 二、项目结构约定

```
app/                    # 页面路由（Next.js App Router）
  logs/                 # 审计日志
  racks/                # 盘架管理
  search/               # 统一检索
  settings/             # 系统设置
  sites/                # 站点管理
  tasks/                # 任务管理
  users/                # 用户与权限

components/
  ui/                   # 通用 UI 组件（Radix 封装，57个）
  dashboard/            # 仪表盘组件
  platform/             # 平台通用组件

lib/
  mock/                 # Mock 数据（sites/tasks/users/racks/search/audit/settings）
  types/                # TypeScript 类型定义
  utils.ts              # 工具函数

docs/
  source/               # 原始需求文档
  5.19更新文档.md       # 开发进度与TODO清单
```

---

## 三、Agent 协作规范（agency-agents 多智能体工作流）

> 当任务涉及**多个专业领域**或**需要并行处理**时，使用 Agent 工具调度专项 Agent。
> 遵循：前端开发 → 测试验证 → 文档撰写 → 评估者 的工作流。

### 3.1 Agent 类型与职责

| Agent 类型 | 职责 | 适用场景 |
|-----------|------|---------|
| **frontend-developer** | 前端页面开发、组件实现 | 新增功能页面、组件改造 |
| **code-reviewer** | 代码审查、质量把关 | PR 合并前、代码质量审计 |
| **test-results-analyzer** | 测试结果分析、回归检测 | build 后验证、问题定位 |
| **evidence-collector** | 截图/可视化证据收集 | Demo 演示材料、汇报材料 |
| **technical-writer** | 文档撰写、Markdown 输出 | 需求文档、设计文档、更新日志 |
| **reality-checker** | 功能验证、边界测试 | 交互测试、表单验证 |
| **product-manager** | 需求分析、优先级排序 | 需求确认、方案评审 |

### 3.2 Agent 调用流程

```
用户请求
    ↓
[product-manager] 需求分析 → 确认范围与优先级
    ↓
并行调度:
├→ [frontend-developer] 实现功能
├→ [technical-writer] 撰写文档
└→ [reality-checker] 准备验收清单
    ↓
[code-reviewer] 代码审查
    ↓
[test-results-analyzer] 验证构建与功能
    ↓
[evidence-collector] 收集演示材料（如需）
    ↓
用户确认 / 评估者复审
```

### 3.3 Agent 调度示例

**示例：实现"盘笼移位登记"功能**

```typescript
// 1. 先用 product-manager 分析需求
Agent({
  subagent_type: "product-manager",
  prompt: "分析盘笼移位登记流程需求：来源站点/目标站点/操作人/审批人/移位原因，涉及页面和 Mock 数据变更点"
})

// 2. 并行调度开发、文档、测试
Agent({ subagent_type: "frontend-developer", prompt: "实现盘笼移位 Dialog，包含表单验证和 Toast 反馈" })
Agent({ subagent_type: "technical-writer", prompt: "撰写盘笼移位功能说明文档，更新 5.19 更新文档" })
Agent({ subagent_type: "reality-checker", prompt: "准备盘笼移位功能的测试用例和验证清单" })

// 3. 代码审查与验证
Agent({ subagent_type: "code-reviewer", prompt: "审查盘笼移位实现代码，检查 Mock 数据一致性和 UI 交互" })
Agent({ subagent_type: "test-results-analyzer", prompt: "运行 pnpm build 验证，构建成功后分析是否满足验收标准" })
```

### 3.4 Agent 通讯规范

| 规范 | 说明 |
|------|------|
| **Prompt 要完整** | Agent 无上下文，需包含所有必要信息（文件路径、行号、需求背景） |
| **结果需验证** | Agent 输出不等于正确，需用 Read/Bash 工具验证 |
| **避免重复工作** | 同一任务不要同时调度多个同类型 Agent |
| **单一职责** | 一个 Agent 专注于一个任务，不要跨领域 |

### 3.5 阶段说明

#### 阶段一：前端 Demo 跑通（已完成）
- `/racks` 页面作为 Provider 模式示范，已完成 localStorage mock 持久化
- 验证了前端类型 + Provider 接口 + Mock 数据的三层分离架构
- 详细计划见 `docs/superpowers/plans/2026-05-20-all-pages-runable.md`

#### 阶段二：真实数据库接入（当前）

**当前子阶段**: Sprint 2B.0.1 - 中心库 Schema 对齐修正

**架构设计**:
- 中心库: PostgreSQL，15 张表（10 张 unified_* + 3 张 sync_* + sites）
- 同步: 定时任务 + 增量/快照策略，不强制 hash
- API: Node.js/Go，Sprint 2B 只做 mock response
- 前端: Adapter 层隔离字段变化，Provider 接口不变
- 暂存: 一期直接 UPSERT，不实现 Staging 层

**关键设计决策**:
- `created_at`/`updated_at`: 每个 unified 表都有
- `unified_devices`: 含 cage_count/floor/room/current_task_count
- `AuditProvider`/`SettingsProvider`: P0 保留 mock
- `raw_data JSONB`: P0 保留，P2 评估是否裁剪
- Mock Fallback: API 失败时降级到 mock，不影响 demo
- `source_site_id`: 统一使用站点代码字符串（如 SH01），不引用 sites 表外键

**Sprint 2B 约束**:
- ❌ 不连接真实源站点业务库
- ❌ 不同步真实数据
- ❌ 不替换现有 API provider 数据源
- ✅ PostgreSQL 连接 + Schema 初始化
- ✅ Docker PostgreSQL 17 验证本地中心库
- ✅ 大表不进 PostgreSQL（后续走 ES/ClickHouse）

### 3.6 agency-agents 映射

优先使用 `/Users/tian/Desktop/agency/agency-agents/README.md` 中的实际 agent 文件：

| 本项目角色 | agency 文件 | 用途 |
|-----------|-------------|------|
| product-manager | `/Users/tian/Desktop/agency/agency-agents/product/product-manager.md` | 校准“跑通”定义、范围和验收 |
| frontend-developer | `/Users/tian/Desktop/agency/agency-agents/engineering/engineering-frontend-developer.md` | 实现 provider 和页面接入 |
| technical-writer | `/Users/tian/Desktop/agency/agency-agents/engineering/engineering-technical-writer.md` | 更新计划、后端接入清单、进度文档 |
| code-reviewer | `/Users/tian/Desktop/agency/agency-agents/engineering/engineering-code-reviewer.md` | 审查类型、状态流、UI 禁止项 |
| test-results-analyzer | `/Users/tian/Desktop/agency/agency-agents/testing/testing-test-results-analyzer.md` | 分析 lint/build 输出 |
| reality-checker | `/Users/tian/Desktop/agency/agency-agents/testing/testing-reality-checker.md` | 做功能验收和边界确认 |
| evidence-collector | `/Users/tian/Desktop/agency/agency-agents/testing/testing-evidence-collector.md` | 截图和演示证据 |

### 3.7 当前专项推荐调度顺序

```typescript
Agent({ subagent_type: "product-manager", prompt: "确认 /racks 设备/盘架展示竖切的跑通定义和验收口径，不改代码。" })
Agent({ subagent_type: "frontend-developer", prompt: "按 docs/superpowers/plans/2026-05-20-all-pages-runable.md 实现 Phase 1-2，只改 provider、mock-store 和 app/racks/page.tsx。" })
Agent({ subagent_type: "technical-writer", prompt: "按计划更新后端接入清单和进度文档，说明 localStorage 是 mock 演示持久化。" })
Agent({ subagent_type: "code-reviewer", prompt: "审查 /racks provider 接入，检查页面是否绕过 provider、类型是否一致、是否违反禁止项。" })
Agent({ subagent_type: "test-results-analyzer", prompt: "运行 pnpm lint 和 pnpm build，分析结果并给最小修复建议。" })
Agent({ subagent_type: "reality-checker", prompt: "验收 /racks：加载、同步、移位登记、刷新保持、导出。" })
Agent({ subagent_type: "evidence-collector", prompt: "验收通过后保存 /racks 截图到 docs/screenshots/racks-provider-runable.png。" })
```

---

## 四、开发禁止事项

- **禁止重构 UI 风格** — 保持现有视觉设计不变
- **禁止新增业务页面** — 仅维护现有页面
- **禁止修改现有页面路由** — 路由结构已定
- **禁止修改前端类型定义** — `lib/types/*` 是 Adapter 的契约，变更需评估影响
- **禁止直接修改 Mock 数据结构** — 如需变更，扩展而非修改

### 4.1 数据库设计规范

- **源库 SQL 是 MySQL DDL 参考** — `databases/disc_files.sql` 只作为字段和业务含义参考，不直接导入 PostgreSQL
- **中心库只存小表** — 只存统一平台需要的元数据表、配置表、mirror 表
- **大表不进 PostgreSQL** — `tbl_file`/`tbl_folder` 等文件级、日志级大表后续走 ES/ClickHouse
- **source_site_id 统一使用站点代码** — 使用 `VARCHAR(50)` 存站点代码（如 SH01），不引用 sites 表外键
- **禁止明文提交数据库密码** — 使用 `credential_ref` 引用环境变量或密钥服务

### 4.2 当前阶段说明

**前端 Demo 冻结期 (2026-05-28 起)**:
- 前端页面保持稳定，不因数据库字段变化而大改
- 通过 Adapter 层隔离变化：数据库字段 → API DTO → 前端类型
- Provider 接口不变：`lib/api/providers.ts` 是前端与后端的契约
- 参考文档: `docs/database-analysis/后端接入方案-完整版.md`

**Sprint 2B 约束 (2026-05-29 起)**:
- ❌ 不连接真实源站点业务库
- ❌ 不同步真实数据
- ❌ 不替换现有 API provider 数据源
- ❌ 不改页面 UI
- ❌ 不做登录权限
- ❌ 不做 P1/P2/P3 功能
- ❌ 不处理 tbl_file/tbl_folder 大表
- ✅ PostgreSQL 连接 + Schema 初始化
- ✅ Docker PostgreSQL 17 验证本地中心库

**Adapter 状态码映射规范**:
- 所有源状态码必须通过 MAP 转前端枚举
- 未识别状态码 fallback 到 `unknown`/`other`
- 禁止页面因未知状态码崩溃

---

## 五、文档输出规范

- 除 CLAUDE.md 外，所有代码、注释、文档使用**中文**
- 变量/函数命名保持英文（代码规范）
- 提交信息使用中文，描述清楚改动内容
- Agent 生成的文档需人工复核后再提交

---

## 六、测试与验收要求

| 验收项 | 标准 |
|--------|------|
| 页面加载 | 无路由 404，所有页面可访问 |
| 表单交互 | 提交有 Toast 反馈 |
| 列表展示 | 数据正常显示，分页正常 |
| 图表渲染 | 无报错，数据显示正确 |
| 响应式 | 桌面端（≥1920×1080）正常 |
| 构建 | `pnpm build` 成功 |
| 代码检查 | `pnpm lint` 无报错 |

---

## 七、常用命令

```bash
pnpm dev      # 开发服务器（http://localhost:3000）
pnpm build    # 生产构建
pnpm start    # 生产服务器
pnpm lint     # ESLint 检查
```

---

## 八、配置说明

| 配置项 | 值 | 说明 |
|--------|---|------|
| Next.js ignoreBuildErrors | `true` | 构建时不强制类型检查 |
| 图片 unoptimized | `true` | 适合静态部署 |
| CSS | `@tailwindcss/postcss` | Tailwind v4 |
| 路径别名 | `@/*` → 根目录 | 方便导入 |

---

## 九、参考文档

| 文档 | 位置 | 用途 |
|------|------|------|
| 需求规格说明书 | `docs/source/requirements.md` | 功能需求依据 |
| 真实数据库接入方案 | `docs/database-analysis/后端接入方案-完整版.md` | API Contract、Adapter 设计 |
| 真实数据库实施方案 | `docs/database-analysis/真实数据库接入实施方案.md` | 同步范围、Schema、同步策略 |
| 后端接入清单 | `docs/database-analysis/后端接入清单.md` | Mock/后端替换映射 |
| 同步候选表清单 | `docs/database-analysis/sync-candidates.md` | P0/P1/P2/P3 表分层 |
| 同步策略提案 | `docs/database-analysis/sync-strategy-proposal.md` | 同步技术方案讨论 |
| 源表关联分析 | `docs/database-analysis/relevant-tables.md` | 表间关系分析 |
| 缺陷记录 | `docs/bugs记录.md` | 历史问题追踪 |
