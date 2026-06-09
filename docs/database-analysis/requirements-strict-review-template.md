# Requirements Strict Review Template

> **目的**: 每次 Sprint 必须以 `docs/source/requirements.md` 为最高验收标准, 严格区分"完成 / 模拟完成 / UI 完成 / 真实后端完成"。本模板为强制产出, 不允许填"全完成"了事。

> **触发条件**: 任何 Sprint 完成 commit 之前, 必须复制本模板到 `docs/database-analysis/sprint-<X.Y>-requirements-review.md` 并填写完整, 链接到 PR / commit。

---

## 0. Sprint 元信息

| 字段 | 值 |
|---|---|
| Sprint ID | `Sprint <X.Y>` (例如 `Sprint 4.8.2-R`) |
| Sprint 标题 | (一句话) |
| 日期 | YYYY-MM-DD |
| 对应 requirement 节 | `requirements.md §<X.Y>` (必填, 不允许空) |
| 关联文档 | (link) |
| 总控负责人 | (name) |
| 验证人 | (name) |

---

## 1. Requirement IDs 列表

> 列出本 Sprint 涉及的所有 requirement 编号 (来自 `requirements.md`)。

| Req ID | 需求原文 (≤30 字) | 状态枚举 |
|---|---|---|
| REQ-2.1.1 | (站点配置) | (见 §3 枚举) |
| REQ-4.2.x | (任务控制) | |

---

## 2. Requirement 原始文本 (逐字摘录)

> 严格复制 `requirements.md` 中相应章节的原文, 不允许改写 / 缩短 / 解读。摘录 3-5 段关键句即可。

```
(原文摘录 1)
(原文摘录 2)
```

---

## 3. 需求状态枚举 (8 选 1)

> 每个 Req ID 必须打 1 个标签。

| 状态 | 含义 |
|---|---|
| `complete` | 真实后端完成 + UI 完成 + 端到端验证通过 |
| `partial` | 部分能力完成, 但有缺失件 (列出) |
| `not_started` | 尚未开工 |
| `blocked_by_source_schema` | 源端 / 站点库缺字段, 需源端变更 |
| `blocked_by_site_change` | 需站点应用 / 配置 / API 配合 |
| `blocked_by_auth` | 受登录 / RBAC / SSO 阻塞 (CLAUDE.md 当前禁) |
| `blocked_by_external_system` | 受外部系统 (ES / ClickHouse / 站点 API) 阻塞 |
| `out_of_scope` | 明确不在本项目范围 |

---

## 4. 实现明细 (Implementation)

> 对每个 Req ID, 列出: 修改了哪些文件 / 新增了哪些 API / 数据库表 / 脚本。

| Req ID | 文件 / API / 表 | 改动类型 | commit hash |
|---|---|---|---|
| REQ-4.2.1 | `app/tasks/page.tsx` | 修改 (新增 3 按钮) | (hash) |
| REQ-4.2.1 | `app/api/control/commands/route.ts` | 已存在 (未改) | — |

---

## 5. 后端真实能力 (Backend Reality)

> **关键**: 必须明确"是数据库 / API / 队列真正支持, 还是仅 UI 层面调用"。

| Req ID | 后端真实能力 | 证据 (SQL / API / 端到端测试) |
|---|---|---|
| REQ-4.2.1 (暂停) | ⚠️ audit + simulator — `control_command` 表写入, Site Worker DRY_RUN 处理, **不修改 `tbl_task.paused` (字段不存在)** | `SELECT * FROM control_command WHERE command_type='task_pause'` |
| REQ-4.2.1 (恢复) | ⚠️ 同上 (audit) | 同上 |
| REQ-4.2.1 (重置) | ⚠️ 同上 (audit) | 同上 |
| REQ-4.2.3 (巡检) | ⚠️ audit only — 站点应用是否会读 `tbl_check_patrol_task` 新行**无 evidence** | DRY_RUN 写入成功, 真实响应未验证 |
| REQ-4.2.3 (恢复任务) | ⚠️ audit only — 站点应用是否会读 `tbl_hot_restore_record` 新行**无 evidence** | 同上 |

---

## 6. UI 真实能力 (UI Reality)

| Req ID | UI 元素 | 真实点击行为 | 是否误导用户? |
|---|---|---|---|
| REQ-4.2.1 暂停 | 表格 + 抽屉各 1 个按钮 | POST `/api/control/commands` → toast "已提交到控制队列, 等待站点拉取执行" | ✅ 不误导 (文案明确) |
| REQ-4.2.1 恢复 | 同上 | 同上 | ✅ |
| REQ-4.2.1 重置 | 同上 | 同上 | ✅ |

**禁止**:
- ❌ 按钮 + 弹窗显示"已暂停" (错误, 是"已提交")
- ❌ UI 显示 paused 状态 (后端无 paused 字段)
- ❌ toast 用"成功"代替"已提交"

---

## 7. Mock / Simulator 状态

| Req ID | Mock 模式 | Simulator | DRY_RUN | 真控制 |
|---|---|---|---|---|
| REQ-4.2.1 暂停 | ❌ Mock 模式禁用按钮 (返回 destructive toast) | ✅ Site Worker DRY_RUN 处理 | ✅ | ❌ (缺 paused 字段) |
| REQ-4.2.3 巡检 | ❌ | ✅ | ✅ | ❌ (无 evidence) |

**白话**: 哪个能力是真后端, 哪个是模拟, 必须分别列出。

---

## 8. 缺失件 (Missing Pieces)

> 列出本 Sprint **没有**实现 / 不可能实现的部分, 不允许隐藏。

| Req ID | 缺失件 | 原因 |
|---|---|---|
| REQ-4.2.1 暂停 | 真实暂停 `tbl_task` | 站点表 170 张全扫, `paused` 字段 0 命中 |
| REQ-4.2.1 优先级 | 真实 priority 调度 | 站点表无 `priority` 字段 |
| REQ-4.2.3 巡检 | 站点应用响应 | 无应用代码, 无 poll 行为 evidence |
| REQ-4.2.3 恢复任务 | 同上 | 同上 |

---

## 9. Blocker 类型 (8 选 1)

> 每个缺失件打 1 个 blocker 标签。

| 缺失件 | Blocker Type | 解除条件 |
|---|---|---|
| 真实暂停 | `blocked_by_source_schema` | 站点表加 `paused` 字段 + 站点 app 读这个字段 |
| 真实巡检 | `blocked_by_site_change` | 站点应用 poll `tbl_check_patrol_task` 新行 + 写 status |
| 真实恢复 | `blocked_by_site_change` | 站点应用 poll `tbl_hot_restore_record` 新行 + 写 progress |
| 真实优先级 | `blocked_by_source_schema` | 站点表加 `priority` 字段 + 调度改造 |
| 真实账号体系 | `blocked_by_auth` | CLAUDE.md 解禁 (或 5.x 解锁) |
| 真实 ES 检索 | `blocked_by_external_system` | 引入 ES 服务 |
| 真实 ClickHouse 日志 | `blocked_by_external_system` | 引入 ClickHouse 服务 |

---

## 10. 需要的源端 / 站点 schema/API 变更清单

> 把所有 blocked 项转成"站点需要做什么"的具体清单, 提交给领导/站点运维。

| 变更项 | 涉及表 / API | 具体 DDL / 文档点 |
|---|---|---|
| `tbl_task` 加 `paused BOOLEAN` | `tbl_task` | `ALTER TABLE tbl_task ADD COLUMN paused BOOLEAN DEFAULT FALSE;` |
| `tbl_task` 加 `priority SMALLINT` | `tbl_task` | `ALTER TABLE tbl_task ADD COLUMN priority SMALLINT DEFAULT 0;` |
| 站点 app poll `control_command` 新行 | 站点 app | 启动时注册 HTTP GET /api/site-control/commands, 写 status, 调 /api/site-control/commands/[id]/ack |
| 站点 app 读 `tbl_check_patrol_task` 新行 | 站点 app | 巡检进程启动时 SELECT pending 行 |
| 站点 app 读 `tbl_hot_restore_record` 新行 | 站点 app | 热恢复进程启动时 SELECT pending 行 |
| 提供真站点 API 文档 | 站点 | swagger / openapi.yml 提交到 `docs/source/site-api-spec.md` |

---

## 11. 是否影响 requirements 完成率

> 计算需求完成度公式:
>
> ```
> requirements 完成率 = complete / (total - out_of_scope) × 100%
> ```

| 维度 | 数值 |
|---|---|
| 本 Sprint 涉及 Req ID 数 | N |
| `complete` | a |
| `partial` | b |
| `not_started` | c |
| `blocked_*` | d |
| `out_of_scope` | e |
| **本 Sprint 完成率** | a / (N - e) |
| **全局完成率 (累计)** | Σcomplete / (Σtotal - Σout_of_scope) |

**禁止**:
- ❌ 用"业务完成度 85%" 代替"requirements 完成度" (业务完成度 = 同步链路完成度)
- ❌ 用 "X% 已实现" 模糊表达
- ❌ 把 mock / simulator 算入 complete

---

## 12. 最终判决 (Verdict)

> **三选一**: pass / partial / fail

### Verdict: `partial` (示例)

**理由**:
- ✅ UI 按钮接通 (暂停/恢复/重置) — 真实 API + audit + DRY_RUN 链路完整
- ✅ 端到端 5/5 命令通过 worker 拉取, audit_log 1:1
- ✅ smoke + siteCode 全部干净
- ⚠️ **核心限制**: `paused` / `priority` 字段在 170 张站点表中**全部 0 命中**, **真实控制不可能实现**
- ⚠️ **核心限制**: 站点应用是否会响应 `control_command` 新行 **无 evidence**
- ❌ 不能宣称"任务控制已实现", 只能宣称"控制队列框架已实现 + 等待站点配合"

**领导决策项**:
- A. 站点表加 `paused` / `priority` 字段 → 总控能改 → 站点能读 → 真控制
- B. 提供站点 API 文档 → 总控走 API → 真控制
- C. 维持当前 audit + simulator (当前方案) → 仅总控侧审计

---

## 13. 提交前检查清单 (强制)

- [ ] §1 所有 Req ID 已列, 不允许漏
- [ ] §3 每个 Req ID 打了 1 个状态标签 (8 选 1)
- [ ] §5 后端真实能力每个 Req ID 都有 SQL / API 证据
- [ ] §7 明确 mock / simulator / DRY_RUN / 真控制 4 者的区别
- [ ] §8 缺失件不隐藏, 全部列出
- [ ] §9 blocker 类型 8 选 1
- [ ] §10 站点 schema/API 变更清单已提交给领导
- [ ] §11 requirements 完成率已计算 (禁止用"业务完成度")
- [ ] §12 verdict 给出 (pass / partial / fail)
- [ ] 文件命名 `sprint-<X.Y>-requirements-review.md` 放 `docs/database-analysis/`
- [ ] PROJECT_STATUS.md / ROADMAP.md 同步更新
- [ ] 链接到本模板的 commit / PR 描述

---

## 附录 A: 禁止使用的措辞 (除非证据完整)

| 禁止 | 必须改用 |
|---|---|
| "控制能力已完成" | "控制队列框架完成" / "DRY_RUN 模拟完成" |
| "任务暂停已实现" | "audit 提交到 control_command 队列" / "等待站点拉取" |
| "恢复已实现" | 同上 |
| "巡检已实现" | 同上 |
| "需求完成度 85%" | "requirements 完成度 X%" (基于 §11 公式) |
| "业务完成度 85%" | "同步链路完成度 X%" / "展示链路完成度 X%" |
| "完成" | "complete / partial / not_started / blocked_*/out_of_scope" (8 选 1) |
| "暂停成功" (toast) | "暂停命令已提交" / "已记录到控制队列" |
| "已暂停" (UI 状态) | "已提交暂停命令" |
| "真实控制" (未验证) | "DRY_RUN 模拟" / "audit 记录" |

---

## 附录 B: 需求 ID 编号约定 (建议)

| 段 | 编号规则 | 例 |
|---|---|---|
| 一 (整体架构) | REQ-1.x | REQ-1.1 系统定位 |
| 二 (基础支撑) | REQ-2.x | REQ-2.1 站点管理 / REQ-2.2 认证 / REQ-2.3 同步 |
| 三 (核心管控) | REQ-3.x | REQ-3.1 账号 / REQ-3.2 权限 / REQ-3.3 部门 |
| 四 (业务操作) | REQ-4.x | REQ-4.1 检索 / REQ-4.2 任务管理 / REQ-4.3 盘笼 |
| 五 (辅助保障) | REQ-5.x | REQ-5.1 日志 / REQ-5.2 索引导出 |
| 六 (非功能) | REQ-6.x | REQ-6.1 性能 / REQ-6.2 安全 / REQ-6.3 兼容 / REQ-6.4 可维护 |

具体到原子项, 用 `REQ-<段>.<章>.<子>`:
- `REQ-4.2.1`: §4.2 任务管理 → 任务管理 (新建/暂停/重置/恢复)
- `REQ-4.2.2`: §4.2 任务管理 → 任务控制 (优先执行恢复任务)
- `REQ-4.2.3`: §4.2 任务管理 → 数据巡检任务
- `REQ-4.2.4`: §4.2 任务管理 → 任务监控与提醒
