# CLAUDE.md

本项目开发指南，包含项目定位、核心约束、开发流程规则。

---

## 项目定位

**集团层统一管控平台**，不替代各站点原有系统。

核心能力：数据同步、统一视图、统一权限、统一任务管理、日志管理。

---

## 当前阶段

| Sprint | 状态 | 说明 |
|---------|------|------|
| Sprint 1 | ✅ | API Skeleton + DTO + Adapter |
| Sprint 2A | ✅ | API Mode Switch + Mock Fallback |
| Sprint 2B | 进行中 | PostgreSQL 中心库 + 同步服务 |
| Sprint 2B.1 ~ 2B.3.1 | ✅ | Docker/同步/查询接口/架构清理 |

**当前主线**: Sprint 2B 聚焦同步模块稳定

---

## 最高优先级文档

| 文档 | 用途 |
|------|------|
| `docs/source/requirements.md` | 需求规格（必须遵守） |
| `docs/database-analysis/requirements-alignment.md` | Sprint 与需求对齐 |
| `docs/database-analysis/sprint-2b-sync-backlog.md` | 同步模块后续重构项 |
| `docs/database-analysis/sprint-2b3-1-sync-refactor-summary.md` | 架构清理总结 |
| `docs/testing/sprint-2b1-db-verification-guide.md` | 数据库验证流程 |

---

## 核心约束

### 开发禁止事项

- ❌ 不改 UI 风格（保持现有视觉设计）
- ❌ 不修改前端类型契约（`lib/types/*` 是 Adapter 接口）
- ❌ 不直接修改 Mock 数据结构（需变更则扩展而非修改）

### 数据与安全

- ❌ 当前阶段不接真实源库（进入真实源库 Sprint 前必须先做方案确认）
- ❌ 不处理 tbl_file/tbl_folder 大表（后续走 ES/ClickHouse）
- ❌ 不提交敏感信息（`.env.local`、数据库密码、真实源库连接）
- ❌ Docker volume 数据不提交到 git

### 需求与范围

- ❌ 未经确认不新增业务页面
- ❌ 不做无需求依据的 UI 扩展
- ❌ 不替换现有 API provider 数据源
- ❌ 不做登录权限系统

### 构建要求

- ✅ 每次提交前必须 `pnpm build` 成功
- ✅ 每次提交前必须 `pnpm exec tsc --noEmit` 无错误

---

## 开发流程

### 标准流程

```
brainstorming → spec → plan → subagent → test → commit
```

1. **brainstorming**: 确认需求、方案选择
2. **spec**: 设计文档保存到 `docs/superpowers/specs/`
3. **plan**: 实现计划保存到 `docs/superpowers/plans/`
4. **subagent**: 按任务执行
5. **test**: 测试验证
6. **commit**: 提交

### Sprint 约束

**每个 Sprint 必须先说明对应 `docs/source/requirements.md` 哪一节。**

---

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16.2.6 + React 19 |
| UI | Tailwind CSS v4 + Radix UI |
| 数据库 | PostgreSQL 17 (Docker) |
| 组件 | React Hook Form + Zod + Recharts |
| 构建 | pnpm |

---

## 常用命令

```bash
# 开发
pnpm dev          # 开发服务器（http://localhost:3000）
pnpm build        # 生产构建
pnpm lint         # ESLint 检查
pnpm exec tsc --noEmit  # 类型检查

# 数据库
pnpm db:up        # 启动 PostgreSQL
pnpm db:init      # 初始化数据库（schema + seed）
pnpm db:init:sync # 初始化同步表（mock_tbl_task）
```

---

## 项目结构

```
app/           # Next.js 页面路由
components/    # UI 组件（ui/, dashboard/, platform/）
lib/
  api/        # API 模式切换
  mock/       # Mock 数据
  sync/       # 同步模块（config.ts, query.ts, tasks-sync.ts 等）
  types/      # TypeScript 类型
  db/         # PostgreSQL 连接
docs/
  source/     # 原始需求文档
  database-analysis/  # 数据库分析与方案
  superpowers/      # Sprint 设计/计划/总结
  testing/           # 测试指南
```