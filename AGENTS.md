# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

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
| GitHub Release 整理 | 🔲 待做 | Release notes / 版本标记 |

### 1.3 技术栈

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
| **document-generator** | 文档撰写、Markdown 输出 | 需求文档、设计文档、更新日志 |
| **quality-assurance** | 功能验证、边界测试 | 交互测试、表单验证 |
| **product-manager** | 需求分析、优先级排序 | 需求确认、方案评审 |

### 3.2 Agent 调用流程

```
用户请求
    ↓
[product-manager] 需求分析 → 确认范围与优先级
    ↓
并行调度:
├→ [frontend-developer] 实现功能
├→ [document-generator] 撰写文档
└→ [quality-assurance] 准备测试用例
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
Agent({ subagent_type: "document-generator", prompt: "撰写盘笼移位功能说明文档，更新 5.19 更新文档" })
Agent({ subagent_type: "quality-assurance", prompt: "准备盘笼移位功能的测试用例和验证清单" })

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

---

## 四、开发禁止事项

- **禁止重构 UI 风格** — 保持现有视觉设计不变
- **禁止接入真实后端** — 仅使用 Mock 数据
- **禁止接入真实数据库** — 数据层仅用 Mock
- **禁止新增业务页面** — 仅维护现有页面
- **禁止修改现有页面路由** — 路由结构已定
- **禁止修改 Mock 数据结构** — 如需变更类型，优先扩展而非修改

---

## 五、文档输出规范

- 除 AGENTS.md 外，所有代码、注释、文档使用**中文**
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
| 5.19 更新文档 | `docs/5.19更新文档.md` | 开发进度与 TODO 清单 |
| 缺陷记录 | `docs/bugs记录.md` | 历史问题追踪 |
| 登录审计与异常管控 | `docs/登录审计与异常管控待办.md` | 统一身份认证需求清单 |
| 后端接入清单 | `docs/后端接入清单.md` | Mock/后端替换映射 |
| 数据同步需求文档 | `docs/数据同步需求文档.md` | 数据同步功能需求 |