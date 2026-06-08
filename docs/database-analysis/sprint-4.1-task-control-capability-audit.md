# Sprint 4.1 — Task Control Capability Audit (任务控制能力审计)

> **状态**: ✅ 完成 (只审计, **不写业务代码 / 不新增 API / 不新增页面 / 不修改数据库**)
> 审计时间: 2026-06-08
> 唯一标准: `docs/source/requirements.md §4.2 统一任务管理`
> 关联: Sprint 3.0 / 3.0R / 4.0 / 3.1

---

## 0. 审计范围

§4.2 统一任务管理 的全部需求条目, 拆成 6 个控制动作 + 1 个巡检动作, 审计:
- 哪些已实现 (UI/API/DB 端到端)
- 哪些 mock (UI 有按钮, 点开弹"已 XX" toast, 无持久化)
- 哪些 disabled / 弹"API 模式不可用"
- 哪些未实现
- 真实站点接入需要什么接口
- 总控 vs 站点职责划分
- 时序图 (总控→Site→Device)
- MVP 接口数 + 依赖

---

## 1. 需求条目逐项 (requirements.md §4.2)

### 1.1 原文摘录

> **4.2 任务管理**
> 1. **任务管理**: 1. 新建备份/恢复任务 2. 任务暂停/重置/恢复等任务控制
>    管理员需要任务管理权限; 管理员需要数据访问权限
> 2. **任务控制**: 1. 支持备份任务进行过程中后新建恢复任务
>    2. 支持优先执行恢复任务
>    单张光盘刻录过程中不能中断; 任务过程中可优先执行恢复任务
> 3. **数据巡检任务**: 1. 支持批量抽取光盘, 读取文件, 比较文件哈希, 验证光盘可读性
>    2. 支持全量或按比例抽取光盘上的文件
>    数据巡检针对介质、设备或存储卷
> 4. **任务监控与提醒**: 1. 查看与监控所有刻录、回迁任务的执行进度、状态
>    2. 任务完成/失败/超时自动推送提醒至责任人 (AD账号绑定的邮箱)
>    3. 任务异常 (失败/超时) 自动触发告警
>    4. 支持刻录成功或失败的详细日志导出
>    监控数据刷新频率 ≤ 10 秒

### 1.2 拆成 7 个原子动作

| # | 动作 | requirements.md 引用 | 用户场景 |
|---|---|---|---|
| TC-01 | **新建任务** | §4.2.1 "新建备份/恢复任务" | 选光盘库 + 卷 + 文件 → 提交 → 队列执行 |
| TC-02 | **暂停任务** | §4.2.1 "任务暂停" | 任务执行中 → 暂停 (等恢复) |
| TC-03 | **恢复任务** | §4.2.1 "恢复" | 暂停中 → 继续执行 |
| TC-04 | **重置任务** | §4.2.1 "重置" | 任务失败/异常 → 重置 → 重新入队 |
| TC-05 | **优先恢复任务** | §4.2.2 "支持优先执行恢复任务" | 备份中可新建恢复 + 优先执行 |
| TC-06 | **数据巡检** | §4.2.3 "SM3/全量/按比例" | 抽盘 → 读文件 → 哈希比对 |
| TC-07 | **任务完成/失败通知** | §4.2.4 "完成/失败/超时推送提醒" | 任务终态 → 邮箱/IM 通知 |

(注: 用户原始提示里 "恢复任务" 重复 1 次, 实际是 §4.2.1 恢复 + §4.2.2 优先恢复, 拆为 TC-03/05。)

---

## 2. 当前 UI 现状 (app/tasks/page.tsx)

### 2.1 已发现的按钮 (8 个)

| 按钮 | 位置 | 状态 | 实现方式 | 文件:行 |
|---|---|---|---|---|
| **新建任务** | 顶部 actions | 真实打开 modal | `setShowCreate(true)` / `isApiMode ? showApiWriteUnavailable` | tasks/page.tsx:344 |
| **详情** | 表格行 | 真实 | `openDetail(t)` 打开 drawer | tasks/page.tsx:499 |
| **推进进度** (pending 状态) | 表格行 | mock | `handleAdvance(t)` (仅 mock toast) | tasks/page.tsx:500 |
| **暂停** | 表格行 + drawer | mock | `isApiMode ? showApiWriteUnavailable("暂停任务")` | tasks/page.tsx:239, 502 |
| **恢复** (paused 状态) | 表格行 + drawer | mock | `isApiMode ? showApiWriteUnavailable("恢复任务")` | tasks/page.tsx:248, 503 |
| **标记完成** | 表格行 + drawer | mock | `handleComplete(t)` (mock toast) | tasks/page.tsx:504 |
| **标记失败** | 表格行 + drawer | mock | `handleFail(t)` (mock toast) | tasks/page.tsx:505 |
| **导出** | 表格行 | mock | `handleExport(t)` (mock toast) | tasks/page.tsx:506 |

### 2.2 按钮状态分类

| 分类 | 数量 | 行为 |
|---|---|---|
| **真实** | 2 (新建/详情) | 新建: 打开 form modal (UI 框架) / 详情: 打开 drawer (真实) |
| **API 模式 disabled + 弹窗** | 2 (暂停/恢复) | `isApiMode ? showApiWriteUnavailable` → toast "API 模式暂不可用" |
| **Mock (无 API 调用)** | 4 (推进/完成/失败/导出) | 调 mock provider → toast "已 XX" → 不持久化 |

### 2.3 新建任务 modal (`setShowCreate(true)`)

> ⚠️ 实际**未实现** TC-01。打开的是 80+ 字段的 form (modals/create-task-modal.tsx), 提交后:
> - mock 模式: 调 `mockTaskProvider.create()` 写入前端 store
> - api 模式: `showApiWriteUnavailable("新建任务")` — **不发送 POST**

### 2.4 表格行按钮可见性逻辑

```tsx
{t.phase === "pending" && <Button ... 推进进度 ... />}
{["scanning", "preparing", ..., "writing"].includes(t.phase) && <Button ... 推进 ... />}
{["scanning", ..., "writing"].includes(t.phase) && <Button ... 暂停 ... />}
{t.phase === "paused" && <Button ... 恢复 ... />}
{["pending", ..., "paused"].includes(t.phase) && <Button ... 标记失败 ... />}
```

按钮**总是显示** (满足 phase 条件就显示), 没有 disabled state — 点击后才判断 mock/api 模式。

### 2.5 巡检任务 (TC-06)

**无任何 UI** — `/tasks` 页面无"巡检" tab / 按钮 / drawer; `/sync` / `/racks` 也没。

### 2.6 任务通知 (TC-07)

**无任何 UI** — 无 toast 订阅 / WebSocket / 长轮询; `app/api/alerts/route.ts` 存在但仅 GET 读 `unified_sites` (空)。

---

## 3. 真实 API 现状 (app/api/tasks/*)

| 端点 | 方法 | 状态 | 行为 |
|---|---|---|---|
| `/api/tasks` | GET | ✅ 真实 | 读 `unified_tasks`, 含 runtime + _aggregate |
| `/api/tasks` | POST | ❌ 不存在 | 无 |
| `/api/tasks/[id]` | GET | ✅ 真实 | 读单条 |
| `/api/tasks/[id]` | PATCH / PUT | ❌ 不存在 | 无暂停/恢复/重置 |
| `/api/tasks/[id]/files` | GET | ✅ 真实 | 读 file_index |
| `/api/tasks/inspect` | POST | ❌ 不存在 | 无巡检 |
| `/api/tasks/[id]/control` | POST | ❌ 不存在 | 建议统一入口 |

**结论**: 7 个原子动作中, **0 个有真实写入 API**。`/api/tasks/*` 是只读快照。

---

## 4. 真实数据库 schema 缺口

`unified_tasks` 当前字段 (Sprint 2F.1 补了 8 字段):

```
runtime_seconds, package_count, success_count, error_count, progress,
current_phase, task_mode, error_message
```

**缺口**:

| 缺口字段 | 作用 | 阻塞动作 |
|---|---|---|
| `paused_at` | 暂停时间戳 | TC-02 暂停后状态持久化 |
| `pause_reason` | 暂停原因 | TC-02 |
| `resumed_at` | 恢复时间戳 | TC-03 |
| `priority` | 任务优先级 (高/中/低) | TC-05 优先恢复 |
| `inspect_target` | 巡检目标 (盘/卷/介质) | TC-06 |
| `inspect_ratio` | 抽取比例 (0-1) | TC-06 |
| `inspect_status` | 巡检状态 (queued/running/done) | TC-06 |
| `inspect_result` | 巡检结果 (pass/fail/xxx) | TC-06 |
| `notification_sent_at` | 通知发送时间 | TC-07 |
| `control_history` (JSONB) | 控制历史 [{ts, action, user, reason}] | 全部 |

**结论**: 源端 `tbl_task` 只有 `status` / `burn_status` 0/2 占位, **几乎无控制字段** — 真实站点接入需先扩展 schema。

---

## 5. 统一抽象: TaskControlProvider

```typescript
// lib/task/control-provider.ts (设计稿, 未实现)

import type { TaskDTO } from "@/lib/api/dto"

export type TaskAction =
  | "create"        // TC-01
  | "pause"         // TC-02
  | "resume"        // TC-03
  | "reset"         // TC-04
  | "prioritize"    // TC-05
  | "inspect"       // TC-06
  | "acknowledge"   // TC-07 (确认告警)

export interface CreateTaskInput {
  taskType: "burn" | "restore" | "inspect"
  targetDeviceId: string
  targetVolumeId?: string
  sourceFiles?: string[]
  priority?: "low" | "normal" | "high"
  notifyUser?: string  // AD 账号
  packagingThreads?: number
  metadata?: Record<string, unknown>
}

export interface ControlResult {
  success: boolean
  taskId: string
  action: TaskAction
  acceptedAt: string       // ISO timestamp (总控接收)
  executedAt?: string      // 站点执行时间
  newState?: string
  errorCode?: string
  errorMessage?: string
  traceId: string
}

export interface TaskControlProvider {
  // TC-01 新建
  createTask(siteCode: string, input: CreateTaskInput): Promise<ControlResult>

  // TC-02 暂停
  pauseTask(siteCode: string, taskId: string, reason: string): Promise<ControlResult>

  // TC-03 恢复
  resumeTask(siteCode: string, taskId: string): Promise<ControlResult>

  // TC-04 重置
  resetTask(siteCode: string, taskId: string, reason: string): Promise<ControlResult>

  // TC-05 优先恢复
  prioritizeTask(siteCode: string, taskId: string, level: "high" | "critical"): Promise<ControlResult>

  // TC-06 巡检
  inspectMedia(siteCode: string, input: {
    targetType: "disc" | "volume" | "device"
    targetId: string
    ratio: number  // 0-1
    algorithm: "SM3" | "MD5" | "SHA256"
  }): Promise<ControlResult>

  // TC-07 确认告警
  acknowledgeAlert(siteCode: string, taskId: string): Promise<ControlResult>

  // 通用: 控制历史
  getControlHistory(siteCode: string, taskId: string): Promise<Array<{
    ts: string
    action: TaskAction
    user: string
    reason?: string
    result: "ok" | "fail"
    errorMessage?: string
  }>>
}
```

**两种实现**:
- `MockTaskControlProvider` — 写前端 store, 不持久化 (现有逻辑抽出来)
- `ApiTaskControlProvider` — POST 到总控 → 总控转发到站点

**Provider 工厂**:

```typescript
// lib/task/index.ts
export const taskControlProvider: TaskControlProvider = isApiMode
  ? new ApiTaskControlProvider()
  : new MockTaskControlProvider()
```

---

## 6. 职责划分: 哪些必须站点 / 哪些可以总控

### 6.1 总控的边界 (CLAUDE.md + LEADER_DECISIONS §7)

> **总控 PG17 不是站点库副本, 不写回站点, 单向数据流 站点→总控**

→ **总控不能直接控制设备**。所有"控制"动作必须经站点转发。

### 6.2 7 个动作的职责

| # | 动作 | 必须站点? | 总控能做什么 | 必须依赖 |
|---|---|---|---|---|
| **TC-01 新建** | ✅ 必须站点执行 (写入设备队列) | 校验权限 + 选设备 + 入队 + 返回 taskId | Auth (管理员权限) |
| **TC-02 暂停** | ✅ 必须站点执行 (写 burn_status=paused) | 写入 `unified_tasks.paused_at` + 转发站点 | Auth (管理员权限) |
| **TC-03 恢复** | ✅ 必须站点执行 | 写入 `unified_tasks.resumed_at` + 转发 | Auth (管理员权限) |
| **TC-04 重置** | ✅ 必须站点执行 | 写入 `control_history` + 转发 | Auth (管理员权限) |
| **TC-05 优先恢复** | ✅ 必须站点执行 (调队列优先级) | 写入 `unified_tasks.priority` + 转发 | Auth |
| **TC-06 巡检** | ✅ 必须站点执行 (读盘 + 哈希) | 写入 `unified_tasks.inspect_*` + 转发 | Auth + 源端 verify 列 |
| **TC-07 通知** | ⚠️ 总控可做 (邮件/WebSocket) | 总控可发邮件/IM (若总控有 SMTP) | 邮箱/IM 通道 |

**结论**: **6 个动作 (TC-01~06) 必须站点执行**, 总控只能做"指令转发 + 状态镜像 + 审计"; **TC-07 总控可独立做** (发邮件不依赖设备)。

### 6.3 关键设计

**总控是"指令代理 + 状态镜像", 不是"控制器"**:

```
用户 → 总控 (鉴权 + 记录 + 转发) → 站点 (真实执行) → 设备
                                                  ↓
                            设备状态 → 站点 → 总控 (镜像 unified_*) → 用户
```

---

## 7. 任务控制时序图 (总控 → Site → Device)

### 7.1 TC-02 暂停 (代表流程)

```
┌────────┐          ┌────────┐         ┌────────┐         ┌────────┐
│  用户  │          │  总控  │         │  站点  │         │  设备  │
│ 浏览器 │          │ Next.js│         │  系统  │         │ 光盘库 │
└───┬────┘          └───┬────┘         └───┬────┘         └───┬────┘
    │  1.点暂停         │                  │                  │
    │─────────────────►│                  │                  │
    │                  │                  │                  │
    │                  │ 2. Auth: JWT/JWT │                  │
    │                  │    (暂停管理员)  │                  │
    │                  │                  │                  │
    │                  │ 3. 查 unified_tasks (taskId 存在?)  │
    │                  │ 4. 写 control_history                │
    │                  │    (action=pause, user, ts)          │
    │                  │                  │                  │
    │                  │ 5. POST /api/control/tasks/pause     │
    │                  │    {taskId, reason, traceId}         │
    │                  │    HMAC + x-site-code                │
    │                  │─────────────────►│                  │
    │                  │                  │                  │
    │                  │                  │ 6. 校验 HMAC     │
    │                  │                  │ 7. 查 burn_status│
    │                  │                  │ 8. 写 burn_status=paused
    │                  │                  │ 9. 通知设备停队列│
    │                  │                  │─────────────────►
    │                  │                  │                  │
    │                  │                  │ 10. 设备确认     │
    │                  │                  │◄─────────────────
    │                  │                  │                  │
    │                  │ 11. 202 {state: paused, ts}          │
    │                  │◄─────────────────│                  │
    │                  │                  │                  │
    │                  │ 12. 写 unified_tasks.paused_at       │
    │                  │ 13. 推 WebSocket / 长轮询 (用户)    │
    │                  │                  │                  │
    │  14. toast "已暂停"                │                  │
    │◄─────────────────│                  │                  │
    │                  │                  │                  │
```

### 7.2 TC-06 巡检 (异步, 需轮询/回调)

```
用户 → 总控 (POST /api/control/tasks/inspect) → 站点
                                                ↓
                                       写 inspect_status=queued
                                                ↓
                                       设备读盘 + 哈希 (异步)
                                                ↓
                                       写 inspect_status=done
                                                ↓
                                       package 推送 → 总控
                                                ↓
                                       写 unified_tasks.inspect_result
                                                ↓
                              总控 WebSocket 推送 → 用户
```

### 7.3 TC-07 通知 (总控可独立)

```
用户 ←─ WebSocket/邮件 ← 总控
         (或 SMTP)     (轮询 sync_table_log.status=failed)
```

---

## 8. 站点侧需要的接口 (设计稿)

### 8.1 必须新增 (MVP 6 个)

| # | 接口 (站点侧) | 用途 | 时延 |
|---|---|---|---|
| 1 | `POST /api/internal/control/tasks` | 接收总控指令 (action + taskId + reason + traceId) | 同步 |
| 2 | `GET /api/internal/tasks/{id}/state` | 总控轮询任务状态 (≤10 秒) | 同步 |
| 3 | `POST /api/internal/inspect/disc` | 站点启动巡检 (返回 inspect_id) | 异步 |
| 4 | `GET /api/internal/inspect/{id}/result` | 总控拉巡检结果 | 同步 |
| 5 | `WS /api/internal/events` (或 SSE) | 站点推送状态变更 (≤10s 实时) | 长连接 |
| 6 | `POST /api/internal/control/ack` | 设备/巡检/告警确认 (总控→站点) | 同步 |

**接口数**: 站点侧 6 个; 总控侧 6 个 (mirror, 转发到站点)

### 8.2 总控侧需要的 API (转发层)

| # | 端点 | 方法 | 用途 |
|---|---|---|---|
| 1 | `/api/control/tasks` | POST | 总控接收用户指令 (含 Auth) |
| 2 | `/api/control/tasks/{id}/pause` | POST | 拆动作路由 |
| 3 | `/api/control/tasks/{id}/resume` | POST | 同上 |
| 4 | `/api/control/tasks/{id}/reset` | POST | 同上 |
| 5 | `/api/control/tasks/{id}/prioritize` | POST | 同上 |
| 6 | `/api/control/inspect` | POST | 巡检入口 |
| 7 | `/api/control/notify/{taskId}/ack` | POST | 通知确认 |
| 8 | `/api/control/tasks/{id}/history` | GET | 控制历史 |
| 9 | `/api/control/events` | WS / SSE | 推送给前端 |

**接口数**: 总控 9 个 (7 POST + 1 GET + 1 WS) — 但都是 thin wrapper, 内部转发到站点 + 写 unified_*

### 8.3 数据库 schema 扩展 (unified_tasks)

```sql
-- Sprint 4.x 控制字段
ALTER TABLE unified_tasks
  ADD COLUMN paused_at TIMESTAMPTZ,
  ADD COLUMN pause_reason TEXT,
  ADD COLUMN resumed_at TIMESTAMPTZ,
  ADD COLUMN priority SMALLINT DEFAULT 0,  -- 0=low, 1=normal, 2=high, 3=critical
  ADD COLUMN control_history JSONB DEFAULT '[]',  -- [{ts, action, user, reason, result}]
  ADD COLUMN inspect_target_type VARCHAR(16),
  ADD COLUMN inspect_target_id VARCHAR(64),
  ADD COLUMN inspect_ratio NUMERIC(4,3),
  ADD COLUMN inspect_algorithm VARCHAR(8),
  ADD COLUMN inspect_status VARCHAR(16),
  ADD COLUMN inspect_result JSONB,  -- {pass, fail, total, sampled, mismatches}
  ADD COLUMN notification_sent_at TIMESTAMPTZ,
  ADD COLUMN notification_channel VARCHAR(16);  -- email/im/ws
```

**扩展字段数**: 13 个

---

## 9. 最终输出 (4 大回答)

### 9.1 A. 最小可落地控制方案

**MVP 范围**: 6 个原子动作 (TC-01~06), **不含 TC-07 通知** (总控可独立做, 后置)

**最小可落地 = 3 件事**:

1. **总控侧**: 9 个 thin API 端点 (含 1 个 WebSocket), 调用站点 6 个 internal API
2. **站点侧**: 6 个 internal API + 1 个 WebSocket 推送
3. **PG17 schema 扩展**: unified_tasks 加 13 个字段 (paused_at, priority, control_history, inspect_*)

**MVP 总工时**: 估 **15-20 人天** (含前后端)

**分阶段**:

| 阶段 | 内容 | 估时 |
|---|---|---|
| Phase 1 | 站点侧 6 个 internal API (mock 实现可先用总控 mock) | 5d |
| Phase 2 | 总控 9 个 thin API + 转发逻辑 | 3d |
| Phase 3 | PG17 schema 扩展 + control_history 写入 | 1d |
| Phase 4 | 前端按钮接通 (替换 isApiMode ? showApiWriteUnavailable) | 3d |
| Phase 5 | WebSocket / SSE 推送 (≤10s 刷新) | 3d |
| Phase 6 | 端到端 e2e + 测试 | 3d |

### 9.2 B. MVP 版本需要几个接口

| 位置 | 接口数 |
|---|---|
| **总控侧 (转发层)** | 7 POST + 1 GET + 1 WS = **9 个** |
| **站点侧 (执行层)** | 5 POST + 1 GET + 1 WS = **7 个** (含 ack) |
| **DB schema 扩展** | 13 个字段 |
| **前端接入** | 替换 4 个 mock 按钮 + 1 个 modal 提交 |

**总接口数 = 16 个** (9 总控 + 7 站点), **总字段数 = 13 个**。

**为什么不止 6 个**: 7 个动作 = 7 个指令接口, 加 1 个 GET history + 1 个 WS push + ack 合并, 再加 1 个总控 internal 路由 — 是 9+7 的结果, 不是 7 的。

### 9.3 C. 是否依赖 ADFS/JWT

**是, 强依赖**。需求 §4.2.1 明示"管理员需要任务管理权限":

> 任务管理 | 1. 新建备份/恢复任务 2. 任务暂停/重置/恢复等任务控制
> 管理员需要任务管理权限; 管理员需要数据访问权限

| 需求 | Auth 依赖 |
|---|---|
| TC-01 新建 | ✅ 必须: 管理员权限 + 数据访问权限 |
| TC-02 暂停 | ✅ 必须: 管理员权限 |
| TC-03 恢复 | ✅ 必须: 管理员权限 |
| TC-04 重置 | ✅ 必须: 管理员权限 |
| TC-05 优先恢复 | ✅ 必须: 管理员 + 业务连续性授权 |
| TC-06 巡检 | ✅ 必须: 管理员 + 数据访问 |
| TC-07 通知 | ⚠️ 弱依赖: 邮箱属于用户属性 |

**未做 Auth 的现状**:
- 当前按钮点击**无权限校验** (任何人能点)
- 后果: 误操作可暂停/重置任意任务

**最小降级方案** (Auth 未解锁时):
- 用 `x-site-code` + IP 白名单 (Sprint 2G.1 已做头校验)
- 控制历史 `control_history` 写 IP + 时间戳代替 user
- 等 Auth 体系就绪后回填 user 字段

### 9.4 D. 下一 Sprint 开发顺序

按"ROI + 解锁成本" 排序:

| # | Sprint | 目标 | ROI | 解锁成本 | 估时 |
|---|---|---|---|---|---|
| **1** | **3.7 Racks slot drawer** (P0 已有真实数据) | 不依赖任何外部 | 5 | 0 | 0.5d |
| **2** | **5.1 控制接口设计 + schema 扩展** | 加 13 字段 + 9 API 骨架 (mock 实现) | 4 | 0 | 2d |
| **3** | **5.2 前端按钮接通** | 替换 mock → 调真实 API | 4 | 0 | 3d |
| **4** | **5.3 站点侧 6 个 internal API** | 需要站点配合 | 5 | **需站点先做** | 5d |
| **5** | **5.4 WebSocket 推送** | 实时状态 | 3 | 0 | 3d |
| **6** | **5.5 端到端测试 + 压测** | 真实场景 | 4 | 0 | 3d |
| 7 | 5.6 Auth 接入 | 解锁 REQ-003/006/007 | 5 | **需 Auth 解锁** | 9d |
| 8 | 5.7 真实 RBAC 角色分配 | 管理员/操作员/审计员 | 3 | 需 Auth | 5d |
| 9 | 5.8 巡检结果可视化 | 巡检详情页 | 3 | 需站点 SM3 通道 | 3d |
| 10 | 5.9 通知 (TC-07) | SMTP / WebSocket 推送 | 3 | 0 | 2d |

**关键路径**: **5.1 → 5.2 → 5.3 → 5.4 → 5.5** 是闭环 (站点 + 总控 + 前端 + 实时), **5.6 是验证点**。Auth 解锁后, 5.7/5.8/5.9 继续。

---

## 10. 关键发现

1. **7 个动作, 0 个真实写入 API** — `app/api/tasks/*` 全是只读 GET
2. **6 个按钮**: 2 mock-disabled (暂停/恢复) + 4 mock-toast (推进/完成/失败/导出) + 2 真实 (新建打开 form / 详情打开 drawer)
3. **6 个动作必须站点执行**, 总控只能做"指令代理 + 状态镜像" (LEADER_DECISIONS §7)
4. **MVP 需要 16 个接口** (9 总控 + 7 站点) + **13 个 DB 字段**
5. **强依赖 Auth** (CLAUDE.md 禁), 最小降级用 IP+siteCode 兜底
6. **关键路径 5 步**: schema 扩展 → 总控 API → 前端接通 → 站点 internal → WebSocket 推送
7. **TC-07 通知总控可独立做** (SMTP/IM 不依赖设备), ROI 高可后置

## 11. 结论

- **当前 7 个原子动作全部 mock**, 0 个有真实持久化
- **MVP 估时 15-20 人天** (含前后端 + 站点配合)
- **总控是"代理 + 镜像"**, 不是"控制器" — 这是与设备控制 (Sprint 3.0 评估) 相同的设计边界
- **Auth 是最大阻塞** — 解锁后整个控制能力才完整
- **推荐下一 Sprint 5.1** (schema + API 骨架, 2d) 作为最低成本启动点
