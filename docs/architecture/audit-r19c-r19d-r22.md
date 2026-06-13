# R.19C + R.19D + R.22 架构评估报告

> **Sprint**: R.19C (package push) + R.19D (control poll) + R.22 (PG action adapter)
> **方法**: 课程 4 章原则 (Ch 2 风格 + Ch 3 4+1 视图 + Ch 4 质量 + Ch 5 SOLID) 综合审视
> **日期**: 2026-06-13
> **目的**: 评估 R.19C/D/R.22 当前 spec/plan (commit `928f18a` + `888f6c5`) 架构决策合理性, 给出改进建议
> **状态**: 评估完成, 5 处改进建议已融入原 spec/plan (§6 总结)

---

## 1. Ch 2 — 架构风格评估

### 1.1 五大经典风格族

| 族 | R.19C/D/R.22 用到? | 评价 |
|---|---|---|
| **Data Flow** (Pipe-and-Filter) | ✅ 隐式: Agent 端 Pusher → 总控 packages → inlineUpsert (filter) | 数据流清晰, 但无显式 Pipe |
| **Event System** (Pub/Sub) | ⚠️ 部分: control_command 队列类似 Pub/Sub, Agent 拉 (不是真订阅) | 不是真 Pub/Sub, 是轮询 (5s) |
| **Call/Return** (Client/Server) | ✅ 主线: Agent=Client, 总控=Server, HTTP pull/push | 主架构风格 |
| **Data-Centered** (Repository) | ❌ 未用 | 不是必需 |
| **Virtual Machine** (Interpreter) | ❌ 未用 | 不是必需 |

### 1.2 R.19C/D/R.22 实际混合

| 组件 | 主风格 | 备注 |
|---|---|---|
| Agent → 总控 HTTP push (R.19C) | **Client/Server** + **Pipe-and-Filter** | Agent 推 → 总控派发 → inlineUpsert (3 filter) |
| Agent ← 总控 HTTP poll (R.19D) | **Client/Server** (轮询) | 不是真 Push, 5s 轮询拉 pending |
| Agent → 站点 DB (R.22) | **Layered** | Adapter 层隐藏 SQL |
| CommandQueue (SQLite) | **Repository** (局部) | 隐藏持久化细节 |

### 1.3 风格选择评价

| 维度 | 评分 | 说明 |
|---|---|---|
| 与 R.19A 现状一致 | ✅ 好 | 继承已有 Client/Server |
| 适合 R.19C 增量推 | ✅ 好 | Pipe-and-Filter 自然映射 |
| 适合 R.19D 命令响应 | ⚠️ 弱 | 5s 轮询不是真 Event, 有延迟 |
| 风格统一性 | ⚠️ 中 | 混合 3 种风格, 没明确主风格 |

### 1.4 改进建议

- **主风格明示**: 写 spec/plan 时, 明确"主风格 = Client/Server, Agent=client, 总控=server"
- **轮询可演进**: 在 spec §4 注明 "R.19D 轮询是过渡, 未来可升级 WebSocket (Ch 2 风格 D, Plan Task 备选)"

---

## 2. Ch 4 — 质量属性 + ATAM 场景

### 2.1 5 个核心质量属性 + 场景

| 属性 | 场景 (Source / Stimulus / Artifact / Env / Response / Measure) | 当前 R.19C/D/R.22 满足? |
|---|---|---|
| **可用性 (Availability)** | 外部信号 / Agent 进程崩溃 / Agent / 运行中 / Agent 重启 + 状态恢复 / 5min 内恢复 (heartbeat 检活) | ✅ 好: SQLite CommandQueue 持久化状态, Agent 重启从 pending 继续 |
| **性能 (Performance)** | 总控 / 高频控制命令 / control_command / 100 站点并发 / Agent 5s 内拉到 + 执行 / ≤5s 响应 (R.18 6.1) | ⚠️ 中: 5s 轮询有 0-5s 延迟, 满足 R.18 ≤5s 边界, 但不优 |
| **可修改性 (Modifiability)** | 开发者 / 新增 1 个 commandType / Agent lib/control / 编译期 / 加分支 + 测试 / 改动 < 5 文件 | ✅ 好: PgAdapter dispatch 6 个 commandType 显式枚举, 加 1 个只改 1 个 switch case + 1 个单测 |
| **安全性 (Security)** | 攻击者 / 重放旧命令 / Agent HTTP / 生产 / HMAC 验签 + nonce 防重放 / 100% 拒绝 | ✅ 好: R.19A 验签 + 5min timestamp 窗口 + 站点代码匹配 |
| **可测试性 (Testability)** | 测试者 / 跑 e2e / 总控 API / dev / 返 200 + 真改源 DB / 100% 覆盖 | ✅ 好: 5 套单测 20 项 + 3 套 e2e 23 项 |

### 2.2 属性冲突 (Ch 4 强调)

| 冲突 | R.19C/D/R.22 表现 |
|---|---|
| 安全性 vs 性能 | HMAC 签名每个请求算一次, ~0.1ms, 无显著冲突 ✅ |
| 可修改性 vs 性能 | 单体 Agent vs 双进程: 单体可改但 5s 控制响应被 push 阻塞 ⚠️ |
| 可用性 vs 复杂度 | SQLite 持久化增复杂度, 但换 Agent 重启恢复 ✅ |

### 2.3 改进建议

- **性能可优化**: R.19D 5s 轮询如真生产, 可降 1-2s (但负载增 5x), 留可配
- **可修改性 + 性能**: Plan Task 9 的优先级调度已处理 (P1 control 优先于 P0 push), 需在 spec §4 明示

---

## 3. Ch 5 — SOLID + 耦合内聚 评估

### 3.1 SOLID 5 原则逐项

| 原则 | R.19C/D/R.22 表现 | 改进建议 |
|---|---|---|
| **SRP** (单一职责) | ⚠️ PgAdapter 同时负责 SQL 执行 + 类型判定 (type=1 unsupported) | **重构**: 抽 `TaskTypePolicy` 类, PgAdapter 只管 SQL, Policy 决定支持 |
| **OCP** (开闭) | ✅ 好: 加 commandType 加 switch case, 不改原代码 | 无需改 |
| **LSP** (里氏替换) | ✅ 好: AdapterResult / PushResult / PollResult 都是简单数据类 | 无需改 |
| **ISP** (接口隔离) | ⚠️ CtrlPoller 依赖 PgAdapter 全接口, 不只用 execute | **可选重构**: 抽 `CommandExecutor` interface (execute), PgAdapter 实现, CtrlPoller 依赖接口 |
| **DIP** (依赖倒置) | ⚠️ SyncPusher / CtrlPoller 直接 new PgReader / PgAdapter (具体类) | **可选重构**: 构造时注入, 便于 mock (目前用 vi.fn 模拟) |

### 3.2 5 种耦合 (从紧到松)

| 类型 | R.19C/D/R.22 哪里有? | 评价 |
|---|---|---|
| Content | ❌ 无 | OK |
| Common | ⚠️ Agent 进程内全局 config (siteCode/platformUrl/secret) | 进程内 OK, 跨进程需共享 (R.19B 单进程不跨) |
| Control | ⚠️ PgAdapter 返 status 字符串 ("success"/"unsupported"/"failed"), 传 control flow | 显式 status, 不可避免 |
| Stamp | ⚠️ CommandRow 在 Agent ↔ 总控间共享整个对象 | 中等可接受 |
| Data | ✅ 好: HMAC 签名只传必要 header (siteCode/timestamp/nonce/signature) | 优 |

### 3.3 7 种内聚 (从好到差)

| 类型 | R.19C/D/R.22 哪里? | 评价 |
|---|---|---|
| Functional | ✅ CommandQueue (dedupe + state + 重启恢复 = 一个任务) | 优 |
| Sequential | ✅ PgReader.readIncremental → SyncPusher.pushOnce (输出 = 输入) | 优 |
| Communicational | ⚠️ SyncPusher 操作 source DB rows | 中等 |
| Procedural | ❌ 无 | OK |
| Temporal | ⚠️ Agent 主循环按 1s 短睡眠顺序执行 (heartbeat/sync/control) | 弱, 不可避免 |
| Logical | ❌ 无 | OK |
| Coincidental | ❌ 无 | OK |

### 3.4 改进建议 (按 ROI 排序)

| 优先级 | 改进 | 改动量 | 收益 |
|---|---|---|---|
| 🟡 中 | **抽 `TaskTypePolicy`** 独立判定 (R.22 拆分) | 1 个新文件, 改 PgAdapter + 1 单测 | 满足 SRP, 未来加新 type 不改 PgAdapter |
| 🟢 低 | **抽 `CommandExecutor` interface** (CtrlPoller 注入) | 改 2 文件 (interface + CtrlPoller 构造) | ISP + 便于 mock (目前 vi.fn 已够) |
| ⚪ 不做 | DIP 重构 (PgReader / PgAdapter 注入) | 改 4 文件 | 当前 vi.fn 已 mock, 收益低 |

### 3.5 关键反模式检查 (Ch 5 Design Smells)

| Smell | R.19C/D/R.22 表现 | 处置 |
|---|---|---|
| 僵化性 (Rigidity) | ✅ 无: 加 commandType 改 1 处 | OK |
| 脆弱性 (Fragility) | ⚠️ 中: reset type 路径要同步改 executor (R.3/R.16/R.22 三处) | **R.16 已用 R.18 capability matrix 收敛**, 单点真相 |
| 固化性 (Immobility) | ⚠️ 中: 5 个 Agent lib/site-agent/*.ts 强耦合 platformUrl/secret | **可接受**: Agent 进程内共享 config, 不跨进程 |
| 粘滞性 (Viscosity) | ✅ 无: HMAC 验签在 R.19A 已统一, R.19C/D 复用 | OK |
| 晦涩性 (Opacity) | ⚠️ 中: 5 个 Agent 类命名接近 (Pusher/Poller/Adapter/Reader/Queue) | **OK**: 文件名已区分 |
| 无谓复杂性 | ⚠️ 中: better-sqlite3 + Watermark map + 优先级调度 = 3 层状态 | **OK**: 每层都有真实价值 (重启恢复 / 增量 / 响应) |
| 无谓重复 | ⚠️ 中: HMAC 签名逻辑在 Pusher / Poller / HeartbeatClient 各 1 份 | **R.19A 已抽 `hmac.ts`**, R.19C/D 复用 signRequest 私有方法即可, 但 R.19C/D 自己实现了 signRequest, **应抽到 hmac.ts** |

---

## 4. Ch 3 — 4+1 视图

### 4.1 逻辑视图 (Logical View) — 类 / 模块结构

```
┌────────────────────────────────────────────────────────┐
│                     Site Agent                          │
│                                                          │
│  ┌─────────────────┐         ┌──────────────────┐      │
│  │  SyncPusher     │         │  CtrlPoller      │      │
│  │  (R.19C)        │         │  (R.19D)         │      │
│  │  - pushOnce()   │         │  - pollOnce()    │      │
│  └────────┬────────┘         └────────┬─────────┘      │
│           │                            │                │
│  ┌────────┴────────┐         ┌────────┴─────────┐      │
│  │  PgReader       │         │  PgAdapter       │      │
│  │  (R.19C)        │         │  (R.22)          │      │
│  │  - readIncr()   │         │  - execute()     │      │
│  └────────┬────────┘         └────────┬─────────┘      │
│           │                            │                │
│           │                  ┌─────────┴─────────┐      │
│           │                  │  TaskTypePolicy   │      │
│           │                  │  (R.22 拆分后)     │      │
│           │                  │  - isResetable()  │      │
│           │                  └───────────────────┘      │
│           │                                              │
│  ┌────────┴────────────────────────────────────────┐    │
│  │  CommandQueue (SQLite, 共享)                    │    │
│  │  - markPending() / markPulled() / markResult()  │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │  HeartbeatClient (R.19A, 复用)                  │    │
│  │  - sendHeartbeat()                              │    │
│  └─────────────────────────────────────────────────┘    │
└────────────────┬───────────────────────────────────────┘
                 │
                 │ HMAC-SHA256 + siteCode/timestamp/nonce
                 │
                 ▼
┌────────────────────────────────────────────────────────┐
│                       总控                                │
│                                                          │
│  POST /api/site-agent/packages      (R.19C 接收)        │
│   ↓ verifySiteAgentRequest (R.19A)                      │
│   ↓ dispatchPackage (R.2H.2 inlineUpsert)              │
│                                                          │
│  GET /api/control/commands/pending  (R.19D 拉)          │
│   ↓ verifySiteAgentRequest                              │
│   ↓ listControlCommands (R.4.5)                         │
│                                                          │
│  POST /api/control/commands/[id]/ack   (R.19D ack)      │
│   ↓ markCommandPulled (R.4.5)                           │
│                                                          │
│  POST /api/control/commands/[id]/result (R.19D result)  │
│   ↓ markCommandResult (R.4.5)                           │
└────────────────────────────────────────────────────────┘
```

### 4.2 部署视图 (Deployment View)

```
┌─────────────────────────┐        ┌────────────────────────┐
│  测试站点 source_restore │        │  总控 (Next.js :3000)    │
│  (Docker :5432)         │        │  (本机)                  │
│  - tbl_task              │        │  - Next.js API routes  │
│  - tbl_disc              │        │  - lib/site-agent      │
│  - tbl_disc_lib          │        │  - lib/sync (R.2H.2)   │
│  - tbl_magzines          │        │  - lib/control (R.4.5) │
│  - tbl_hd_info           │        │  - lib/db (PG)         │
│  - tbl_logical_volume    │        │                         │
└──────────┬──────────────┘        └──────────┬─────────────┘
           │ 直连 (SITE_DATABASE_URL)            │ 直连
           │ (R.19A 已有)                          │ (unified_disc_platform)
           │                                       │
┌──────────┴────────────────────────────────────────────┐
│  Agent SystemD service (本机)                            │
│  - User: site-agent                                      │
│  - ExecStart: pnpm agent:site                            │
│  - EnvFile: /etc/unified-disc-site-agent.env             │
│  - 3 个循环: heartbeat (5min) / sync push (60s) / ctrl    │
│    poll (5s), 优先级 P1 > P0 > P1                        │
│  - SQLite: /var/lib/unified-disc-site-agent/             │
│    command-queue.db (持久化)                            │
└──────────────────────────────────────────────────────────┘
```

### 4.3 过程视图 (Process View) — R.19C push 数据流时序

```
Agent (Pusher)             总控 (POST /packages)            inlineUpsert
      │                            │                            │
      │ 1. readIncremental()       │                            │
      │───────────────────→ PostgreSQL                           │
      │ ←──────── rows  ─────────│                            │
      │                            │                            │
      │ 2. POST /api/site-agent/packages + HMAC                 │
      │───────────────────→│                            │
      │                            │ 3. verifySiteAgentRequest│
      │                            │ (验签 + 5min window +     │
      │                            │  nonce 防重放)            │
      │                            │                            │
      │                            │ 4. dispatchPackage         │
      │                            │───────────────────→│
      │                            │  5. inlineUpsert          │
      │                            │  (事务 + audit_log)        │
      │                            │ ←─── 200 OK ─────────────│
      │ ←───── 200 {accepted: N, rejected: M} ─────────│
      │                            │                            │
      │ 6. 更新 SQLite watermark   │                            │
```

### 4.4 开发视图 (Development View) — 模块 / 文件 / 编译单元

```
lib/site-agent/                scripts/site-agent/
├── config.ts (R.19A)           └── run.ts (主循环)
├── hmac.ts (R.19A)             (集成 Pusher + Poller + Heartbeat)
├── heartbeat-client.ts (R.19A)
├── command-queue.ts (Task 1)   scripts/e2e/
├── pg-reader.ts (Task 2)       ├── test-r19c-push.ts
├── sync-pusher.ts (Task 4)     ├── test-r19d-poll.ts
├── pg-adapter.ts (Task 7)      └── test-r22-pg-adapter.ts
├── task-type-policy.ts (Task 7 拆分)
└── ctrl-poller.ts (Task 8)
```

### 4.5 场景视图 (Scenario / +1) — 暂停任务端到端

```
1. 用户 /tasks 页面点"暂停"按钮
2. POST /api/control/commands (前端) → control_command.status=pending
3. Agent 5s 拉: GET /api/control/commands/pending → 找到这条
4. Agent CommandQueue.markPending() dedupe → 新命令
5. Agent POST /api/control/commands/[id]/ack → status=pulled
6. Agent PgAdapter.execute("task_pause", "1") → UPDATE tbl_task SET status=20
7. Agent POST /api/control/commands/[id]/result {status: success}
8. 总控 markCommandResult → control_command.status=success
9. audit_log 落 (before/after status=0/20)
10. /api/tasks 拉时: control_command.result.before/after 含 status 整数
11. 用户刷新 /tasks 看到 status="paused" (R.16R 已验)
```

---

## 5. 总结: 4 原则综合评分

| 原则 | 当前状态 | 评分 (1-5) |
|---|---|---|
| Ch 2 风格 (主 Client/Server) | 主风格明示但混合 3 种 | ⭐⭐⭐ |
| Ch 3 4+1 视图 | 5 视图都已画, 完整性好 | ⭐⭐⭐⭐ |
| Ch 4 质量 + ATAM | 5 属性均评估, 2 改进点 | ⭐⭐⭐⭐ |
| Ch 5 SOLID + 耦合内聚 | 1 处 SRP 违反 (PgAdapter), 1 处重复 (HMAC signRequest) | ⭐⭐⭐ |

**总评**: 3.5 / 5, 良好, 有 2 处具体改进 (SRP + DRY), 不影响 R.19C/D/R.22 实施但应纳入 spec/plan.

---

## 6. 改进建议 (融回 spec/plan)

### 6.1 P1 — 必做 (融入 R.22)

**抽 `TaskTypePolicy` 类独立判定 (SRP)**
- 新增 `lib/site-agent/task-type-policy.ts`
- PgAdapter 改为 `private readonly policy: TaskTypePolicy` 注入
- PgAdapter.execTaskReset 改调 `policy.isResetable(taskType)` 决定 unsupported 或真写
- 单测拆为 2 套 (Policy 测 6 type, Adapter 测 6 commandType)
- **Plan Task 7 拆分**: 7a (TaskTypePolicy) + 7b (PgAdapter with policy)

**抽 `signRequest` 到 `hmac.ts` (DRY)**
- 把 Pusher/Poller/HeartbeatClient 各自的 signRequest 私有方法挪到 `lib/site-agent/hmac.ts` 公共函数
- Plan Task 4 / 8 / R.19A heartbeat-client 都改 import

### 6.2 P2 — 可选 (提升可读性, 不必立即做)

**画 4+1 视图到 spec/plan**
- 把本报告 §4 的 5 视图贴到 spec §2 架构总览
- 5 个图 (~30 行 ASCII), 1 段叙事

**优先级调度描述**
- Plan Task 9 加 1 段: "P1 control > P0 sync push > P1 heartbeat" + 解释为什么 control 优先 (响应 ≤5s 是硬需求)

### 6.3 P3 — 不做 (YAGNI)

- DIP 重构 (PgReader / PgAdapter 注入) — 当前 vi.fn mock 已够
- 双进程拆分 — 5s 轮询延迟可接受
- WebSocket 升级 — 后续 Sprint 评估

---

## 7. 边界声明 (R.18 严口径)

- 本评估仅审视 R.19C/D/R.22 内部架构, 不审视跨项目架构
- 不改变 R.18 已定的 6 个 commandType + Agent 部署边界
- 改进建议不改 requirements 完成度 (3/45 = 6.7% 维持)
- 评估结果融入 spec/plan §2 / §3 / §4, 不重写架构

---

## 8. 推荐行动

| 项 | 行动 | 工时 |
|---|---|---|
| 6.1 P1 必做 | 改 Plan Task 4/7/8, 加 Task 7a, 改 hmac.ts, 改 R.19A heartbeat-client (如必要) | 0.5h |
| 6.2 P2 可选 | 把 4+1 视图贴到 spec §2, 加优先级调度段 | 0.5h |
| 6.3 P3 不做 | 不动 | 0 |
| **总计** | | **1h** |

改完 commit, 沿原计划执行 R.19C/D/R.22.
