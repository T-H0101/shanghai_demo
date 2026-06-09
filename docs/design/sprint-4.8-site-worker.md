# Sprint 4.8 — Site Worker 控制链路 MVP (设计)

> **状态**: 设计已定稿, 待批准后开 Sprint 4.8.1
> **设计者**: tian + AI
> **日期**: 2026-06-09

---

## 1. 核心原则 (用户确认)

1. **PG17 唯一数据库**, 与 MySQL 无关
2. **总控表 ≠ 站点表**: 总控表 (`control_command`) 是"管控风格", 状态机驱动, **不动站点表字段**
3. **source_restore = 测试站点只读快照** (领导给的 pg_basebackup 还原, 20260601), **不能改**
4. **真生产站点 = 各站点自己的 PG 数据库**, 通过 `SITE_DATABASE_URL` 连接 (worker 部署在站点侧时)
5. **内部项目, 无 API**, 全部走数据库同步
6. **暂停/恢复/重置** = 站点侧应用层操作, **总控表只表达"已下发"**, 真执行靠站点 worker + 站点库
7. **强密码**: 用户手动给, 见 `docs/secrets/SECRETS.md` (gitignored)
8. **集群 HA**: SKIP LOCKED 预留, 默认单 worker, ENV `SITE_WORKER_HA_MODE=multi` 开启

---

## 2. 架构: 总控-站点 双库分离

```
┌──────────────────────────┐         ┌──────────────────────────┐
│  总控 (本机 Next.js)     │         │  站点侧 (生产 worker)    │
│  ────────────            │         │  ────────────            │
│  DB: unified_disc_       │         │  DB: 站点自己的 PG (生产) │
│       platform (PG17)    │         │  例: SH01_site, SH02_site │
│                          │  HMAC   │                          │
│  表:                     │  鉴权   │  表:                     │
│  - control_command       │ ──────► │  - tbl_task              │
│  - unified_tasks         │         │  - tbl_disc              │
│  - unified_devices       │         │  - tbl_slots ...         │
│  - sync_package_log      │         │                          │
│  - audit_log (新增)      │ ◄────── │  (worker 直接 SQL 操作)  │
│                          │  拉取   │                          │
│  /api/control/commands   │         │  scripts/worker-site.ts  │
│  /api/site-control/      │         │  (拉 + 改 + 反馈)        │
└──────────────────────────┘         └──────────────────────────┘
         │                                      ▲
         │  ┌──────────────────┐                │
         ├─►│ source_restore   │  当前 dev 阶段 │
         │  │ (只读测试快照)   │  worker 不动它  │
         │  └──────────────────┘                │
         │         ▲                            │
         │  sync_package                        │
         │  (dispatcher) ───────────────────────┘
         │         │
         │  unified_tasks (聚合视图)
```

**关键不变量**:
- **总控 DB** (unified_disc_platform) **写** control_command / audit_log / unified_*
- **站点 DB** (生产时 worker 部署的库) worker **写** tbl_task 等业务表
- **dev 阶段** source_restore 是只读测试快照, worker **跳过写** (SITE_WORKER_DRY_RUN=true)

---

## 3. commandType 重新分类

| commandType | 真实修改目标 | dev (source_restore) 行为 | 生产 (站点库) 行为 | 保留? |
|---|---|---|---|---|
| **task_pause** | 站点 tbl_task (应用层 + status 标记) | DRY_RUN, log only | 真改 | ✅ 保留 |
| **task_resume** | 站点 tbl_task | DRY_RUN, log only | 真改 | ✅ 保留 |
| **task_reset** | 站点 tbl_task (status=1, burn_status=0) | DRY_RUN, log only | 真改 | ✅ 保留 |
| ~~task_priority_restore~~ | ~~站点 priority 字段~~ | ❌ 站点无字段 | ❌ 不可实现 | ❌ **删** |
| **inspect_start** | 站点 INSERT 新 tbl_task (task_type=4) | DRY_RUN, log only | 真 INSERT | ✅ 保留 |
| **recovery_start** | 站点 INSERT 新 tbl_task (task_type=1) | DRY_RUN, log only | 真 INSERT | ✅ 保留 |

**删除清单** (Sprint 4.8):
- `COMMAND_TYPES` 数组移除 `task_priority_restore`
- `app/control/page.tsx` 命令类型标签 + UI 选项
- `app/tasks/page.tsx` Tasks 页面**移除暂停/恢复/重置按钮** (3 个)

---

## 4. 控制链路完整时序 (生产时)

```
1. 用户 (浏览器)
   │
   │  POST /api/control/commands
   │  {commandType: 'task_pause', targetType: 'task', targetId: '123', siteCode: 'SH01'}
   │
2. Next.js API (control/commands/route.ts)
   │  - 鉴权 (Sprint 4.7+ session, 当前 MVP null)
   │  - 校验 (commandType, targetType, targetId)
   │  - INSERT INTO control_command (status='pending', command_no, ...)
   │  - 201 返回
   │
3. 浏览器
   │  - toast "已提交"
   │  - 5s 轮询 GET /api/control/commands?status=running
   │
   ▼
═══════════════════════════════════════
   站点侧 worker (scripts/worker-site.ts)
═══════════════════════════════════════
   │
4. pollLoop (1s 间隔):
   │  GET /api/site-control/commands?siteCode=SH01&limit=20
   │  [HMAC 鉴权, Sprint 4.7 timingSafeEqual]
   │
5. SELECT pending → markCommandPulled
   │  [SELECT FOR UPDATE SKIP LOCKED, HA 模式]
   │  status: pending → pulled, pulled_at = now()
   │
6. 业务执行 (lib/control/executor.ts):
   │  case 'task_pause':
   │    - SELECT * FROM tbl_task WHERE id=$1
   │    - payload.before = {status, burn_status, ...}
   │    - 模拟执行 (Sprint 4.8):
   │      - sleep 200ms
   │      - 检查 SITE_WORKER_DRY_RUN=true → 仅 log
   │    - 真执行 (生产):
   │      - UPDATE tbl_task SET status=2, update_dt=now() WHERE id=$1
   │        (或 应用层: in-memory 标记 pausedTaskIds.add(id))
   │    - payload.after = {status, ...}
   │  case 'task_resume':  对称
   │  case 'task_reset':   UPDATE status=1, burn_status=0
   │  case 'inspect_start': INSERT INTO tbl_task (task_type=4, status=1, ...)
   │  case 'recovery_start': INSERT INTO tbl_task (task_type=1, status=1, ...)
   │
7. 反馈 (lib/control/executor.ts):
   │  - INSERT INTO audit_log (command_no, action, before, after, actor, ip, at)
   │  - 状态: running → success / failed
   │  - 耗时 < 1s (dev dry-run) / 1-30s (生产)
   │
8. POST /api/site-control/commands/[id]/result
   │  {status: 'success', result: {affectedRows, dryRun}, errorMessage?: null}
   │
9. Next.js API (site-control/commands/[id]/result)
   │  markCommandResult (state machine pulled/running → success/failed)
   │
   ▼
10. 浏览器
    │  - 轮询拿到 status=success → 展示 + toast
    │
═══════════════════════════════════════
   sync package (异步, 10 分钟一次)
═══════════════════════════════════════
11. 站点 push 模式上报 tbl_task 全表
    │
12. dispatcher (Sprint 2H)
    │  写入 unified_tasks (status/phase)
    │
13. Dashboard / Tasks 页面
    │  显示最终状态 (二次校准 feedback)
```

---

## 5. 数据库新增 (Sprint 4.8)

### 5.1 audit_log 表 (新增, 必须)

```sql
-- databases/sprint-4.8/audit-log.sql
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  command_no TEXT NOT NULL,                  -- 关联 control_command.command_no
  action TEXT NOT NULL,                       -- 'task_pause' | 'task_resume' | ...
  target_table TEXT NOT NULL,                 -- 'tbl_task' | 'tbl_disc' | ...
  target_id TEXT NOT NULL,                    -- 业务主键
  before_json JSONB,                          -- 修改前快照
  after_json JSONB,                           -- 修改后快照
  actor TEXT,                                 -- 触发人 (IP + session.user)
  actor_ip TEXT,
  site_code TEXT NOT NULL,
  dry_run BOOLEAN DEFAULT FALSE,              -- dev 阶段 true
  result TEXT,                                -- 'success' | 'failed'
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_command_no ON audit_log(command_no);
CREATE INDEX idx_audit_site_created ON audit_log(site_code, created_at DESC);
CREATE INDEX idx_audit_action ON audit_log(action);
```

### 5.2 control_command 表 (无 schema 变更, 仅校验逻辑)

- 移除 `COMMAND_TYPES` 中的 `task_priority_restore`
- 前端表单不再显示该选项
- API 仍能接受历史数据 (DB 已有数据兼容)

---

## 6. 文件清单 (Sprint 4.8.1)

### 新增 (6 文件)

| 文件 | 行数 | 说明 |
|---|---|---|
| `databases/sprint-4.8/audit-log.sql` | 30 | audit_log 表 DDL |
| `lib/control/executor.ts` | 280 | 6 个 commandType → SQL 分发器 (含 DRY_RUN) |
| `lib/control/audit.ts` | 60 | audit_log 写库 helper |
| `scripts/worker-site.ts` | 250 | 主进程: 3 循环 (poll/exec/health) |
| `docs/design/sprint-4.8-site-worker.md` | (本文件) | 设计文档 |
| `scripts/sprint-4.8-e2e.sh` | 60 | 端到端测试脚本 |

### 修改 (4 文件)

| 文件 | 变更 |
|---|---|
| `lib/control/control-command.ts` | 移除 `task_priority_restore` from `COMMAND_TYPES` |
| `app/control/page.tsx` | 命令类型 enum 移除 priority_restore + 加 5s 轮询 |
| `app/tasks/page.tsx` | 移除暂停/恢复/重置 3 个按钮 (handlePause/handleResume/handleReset + JSX) |
| `package.json` | +1 script: `worker:site` |

### 总计: 6 新增 + 4 修改, +900 / -150 行

---

## 7. 估时

| 项 | 估时 | 风险 |
|---|---|---|
| 1. audit_log 表 DDL + 部署 | 0.2d | 低 |
| 2. lib/control/executor.ts (DRY_RUN 6 分发) | 0.5d | 中 (DRY_RUN vs 真改的切换) |
| 3. lib/control/audit.ts | 0.1d | 低 |
| 4. scripts/worker-site.ts (3 循环 + SKIP LOCKED) | 0.5d | 中 (并发) |
| 5. /control 页 5s 轮询 + UI 调整 | 0.3d | 低 |
| 6. tasks 页面移除 3 按钮 | 0.1d | 低 |
| 7. package.json + docs + 5 个文件 | 0.2d | 低 |
| 8. e2e 测试 + 修复 | 0.5d | 中 |

**合计**: **2-2.5d** (1 人) / **1.5d** (2 人并行)

---

## 8. ENV 变量清单 (Sprint 4.8 新增)

| 变量 | 默认值 | 说明 |
|---|---|---|
| `SITE_WORKER_DRY_RUN` | true (dev) / false (生产) | 是否真改站点 DB |
| `SITE_WORKER_HA_MODE` | single | single = 1 worker, multi = SKIP LOCKED 多 worker |
| `SITE_WORKER_POLL_INTERVAL_MS` | 1000 | 拉取间隔 |
| `SITE_WORKER_HEALTH_PORT` | 3001 | 健康检查端口 (/health) |
| `SITE_DATABASE_URL` | (无) | 站点侧 DB 连接 (生产时配) |

---

## 9. 验收

- [ ] tsc / build / smoke:sync 全清
- [ ] `pnpm worker:site` 启动后, 5s 内能拉到新命令
- [ ] 5 个 commandType (pause/resume/reset/inspect/recovery) 端到端走通
- [ ] DRY_RUN 模式下, source_restore **0 行被改** (SELECT count before/after)
- [ ] 失败命令正确显示 failed + errorMessage
- [ ] /control 页 5s 自动刷新
- [ ] tasks 页面无暂停/恢复/重置按钮
- [ ] HA 模式 (multi): 启 2 个 worker, 命令只被一个处理 (SKIP LOCKED 验证)
- [ ] crash recovery: pending 注入 → kill worker → 重启 → 不留孤儿

---

## 10. 不做的事 (Sprint 4.8)

- ❌ 不接真实生产站点 (Sprint 4.9+)
- ❌ 不实现 ADFS 鉴权 (Sprint 5.1)
- ❌ 不动 source_restore (只读测试)
- ❌ 不删 control_command 表 (兼容历史数据)
- ❌ 不加 file/folder 大表 (CLAUDE.md 禁)
- ❌ 不引入 ES / ClickHouse / Kafka (CLAUDE.md 禁)
- ❌ 不做集群 HA 部署文档 (代码就绪, 部署后续)
- ❌ 不替换现有 dispatcher / sync 链路

---

## 11. 等批准后开 Sprint 4.8.1

需要你回复:
1. **go / no-go** — 设计是否通过
2. 强密码 (DB) — 你手动给还是用 dev 默认

无其它阻塞. 一批准, 2-2.5d 闭环.
