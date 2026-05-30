# CLAUDE.md 精简草案

> 状态: 待确认
> 日期: 2026-05-30

---

## 精简目标

CLAUDE.md 应成为"项目导航 + 核心约束 + 开发流程规则"，不变成过长的历史记录或百科文档。

---

## 当前问题

| 问题类型 | 说明 |
|---------|------|
| Sprint 历史过长 | 8行阶段表格，大部分已完成 |
| 重复规则 | 不接真实源库出现4次 |
| 已过期约束 | Phase 1/2 描述已过时 |
| 过长实现细节 | Agent prompt 示例太具体 |
| 与 docs/ 重复 | requirements-alignment.md 已包含 |

---

## 精简后结构草案

```markdown
# CLAUDE.md

## 项目定位
- 集团层统一管控平台，不替代各站点原有系统
- 核心能力：数据同步、统一视图、统一权限、统一任务管理、日志管理

## 当前阶段
- Sprint 2B 进行中：PostgreSQL 中心库 + 同步服务
- Sprint 2B.3.1 完成，聚焦同步模块稳定

## 最高优先级文档
- **docs/source/requirements.md** - 需求规格（必须遵守）
- **docs/database-analysis/requirements-alignment.md** - Sprint 与需求对齐

## 禁止事项
- ❌ 不改 UI 风格
- ❌ 不接真实源库/不同步真实数据
- ❌ 不处理 tbl_file/tbl_folder 大表
- ❌ 不提交 .env.local、密码、真实源库连接
- ❌ 不新增业务页面
- ❌ 不修改前端类型契约
- ✅ 每次提交前必须 tsc/build 通过

## 开发流程
1. brainstorming → 确认需求
2. spec → 设计文档
3. plan → 实现计划
4. subagent → 任务执行
5. test → 测试验证
6. commit → 提交

每个 Sprint 必须说明对应 requirements.md 哪一节。

## 技术栈
| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16.2.6 + React 19 |
| UI | Tailwind CSS v4 + Radix UI |
| 数据库 | PostgreSQL 17 (Docker) |
| 构建 | pnpm |

## 常用命令
```bash
pnpm dev      # 开发服务器
pnpm build    # 生产构建
pnpm lint     # ESLint 检查
pnpm exec tsc --noEmit  # 类型检查
```

## 关键文档
| 文档 | 位置 |
|------|------|
| 需求规格 | docs/source/requirements.md |
| 需求对齐 | docs/database-analysis/requirements-alignment.md |
| Sprint Backlog | docs/database-analysis/sprint-2b-sync-backlog.md |
| 数据库方案 | docs/database-analysis/真实数据库接入实施方案.md |
```

---

## 精简对比

### 删除内容

| 原内容 | 理由 |
|--------|------|
| 1.2 详细阶段表格 | 已过时，简化为一行 |
| 1.3 Sprint 进度表格 | 太长，保留参考文档即可 |
| 1.4.3 requirements 对应 | requirements-alignment.md 已有 |
| 1.4.4 数据存储规范 | requirements-alignment.md 已有 |
| 1.5 Sprint 2A 详细 | 已有专门总结文档 |
| 3.3 Agent 调度示例 | 太具体，流程说明即可 |
| 3.5 阶段说明 | 已完成，简化为引用 |
| 3.6 agency-agents 映射 | 已有外部文档 |
| 3.7 专项推荐调度 | 已过期 |
| 4.2 当前阶段说明 | requirements-alignment.md 已有 |
| 参考文档中的 summary | 精简为索引 |

### 保留内容

| 内容 | 理由 |
|------|------|
| 项目定位 | 核心约束 |
| 禁止事项 | 必须快速可见 |
| 开发流程 | 规范开发方式 |
| 技术栈 | 常用参考 |
| 常用命令 | 开发必需 |
| 关键文档索引 | 快速导航 |

---

## 效果预估

| 指标 | 当前 | 精简后 |
|------|------|--------|
| 行数 | ~380 行 | ~100 行 |
| 重复规则 | 4 处 | 0 处 |
| 过时内容 | 3 处 | 0 处 |

---

*草案创建: 2026-05-30*