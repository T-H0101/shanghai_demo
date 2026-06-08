# Sprint 4.5 — control_command 控制队列 MVP

> **状态**: ✅ 完成
> Sprint 4.5 目标: 让总控具备可落地的命令下发骨架, 不假实现, 不改 unified_tasks
> 关联: Sprint 4.1 (任务控制能力审计) + Sprint 4.2-A (PG 备份审查) + Sprint 4.2-C (控制方案)
> 提交: 5 新增路由 + 1 新增页面 + 1 新增 SQL + 1 service + 1 改造 (Tasks 按钮) + 1 文档

---

## 1. 背景与设计前提

**Sprint 4.2 收敛结论**:
- 完整源端 `pg_restore_test.star_storage_db` = 170 张表
- `source_restore` 是 **13 张白名单 partial dump (7.6%)**
- 同步按领导口径: **每小时 SQL 拉数 → package → HMAC push**
- 控制能力按 requirements.md 必须保留, 但**没有站点 API 文档**
- **可落地方案**: 总控写 `control_command`, 站点后续轮询执行, 结果再同步回总控 (Sprint 4.2-C 方案 2)

**Sprint 4.5 范围**:
- ✅ schema patch (control_command 表 + 4 索引)
- ✅ control service (5 函数: create/list/get/markPulled/markResult)
- ✅ 5 个 API (3 总控 + 2 站点)
- ✅ Tasks 页面 3 按钮接入 (暂停/恢复/重置)
- ✅ `/control` 控制命令列表页
- ❌ **不实现真实站点执行** (无 API 文档)
- ❌ **不改 unified_tasks 状态** (总控不是控制器)
- ❌ **不伪造结果** (站点没回写就是 pending/pulled)
- ❌ **不改 HMAC 协议** (Sprint 2G.1 保留)
- ❌ **不做 WebSocket / Auth / ES / ClickHouse**

---

## 2. schema patch

### 2.1 文件

`databases/sprint-4.5/control-command.sql`

### 2.2 表结构 (16 字段 + 4 索引 + 1 触发器)

```sql
CREATE TABLE control_command (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  command_no      text UNIQUE NOT NULL,            -- CTRL-SH01-YYYYMMDDHHmmss-XXXX
  source_site_id  text NOT NULL,
  command_type    text NOT NULL                    -- 6 种枚举值 (见下)
    CHECK (command_type IN ('task_pause', 'task_resume', 'task_reset',
                             'task_priority_restore', 'inspect_start', 'recovery_start')),
  target_type     text NOT NULL                    -- task/device/volume/media
    CHECK (target_type IN ('task', 'device', 'volume', 'media')),
  target_id       text NOT NULL,
  payload         jsonb NOT NULL DEFAULT '{}',
  status          text NOT NULL DEFAULT 'pending'  -- 6 种状态机
    CHECK (status IN ('pending', 'pulled', 'running', 'success', 'failed', 'cancelled')),
  requested_by    text,
  requested_ip    text,
  requested_at    timestamptz NOT NULL DEFAULT now(),
  pulled_at       timestamptz,
  completed_at    timestamptz,
  result          jsonb,
  error_message   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- 索引
CREATE INDEX idx_control_site_status  ON control_command(source_site_id, status, requested_at DESC);
CREATE INDEX idx_control_type_status  ON control_command(command_type, status, requested_at DESC);
CREATE INDEX idx_control_target       ON control_command(target_type, target_id);
CREATE INDEX idx_control_requested_at ON control_command(requested_at DESC);

-- 触发器: updated_at 自动更新
CREATE TRIGGER control_command_updated_at BEFORE UPDATE ON control_command
  FOR EACH ROW EXECUTE FUNCTION trg_control_command_updated_at();
```

### 2.3 状态机

```
                    ┌─→ running ─→ success
pending ─→ pulled ─┤              → failed
                    └─→ (直接) ─→ cancelled
```

- `pending`: 用户/系统刚创建, 等站点拉
- `pulled`: 站点已 GET 拉到, 准备执行
- `running`: 站点 ack 后, 正在执行
- `success / failed / cancelled`: 终态 (站点 result 回写)

---

## 3. control service (`lib/control/control-command.ts`)

### 3.1 5 个核心函数

| 函数 | 用途 | 关键约束 |
|---|---|---|
| `createControlCommand(input)` | 写一条 pending 命令 | 参数化 SQL, command_no 自动生成, **不改 unified_tasks** |
| `listControlCommands(filter)` | 列表查询 (总控+站点都用) | 支持 siteCode/commandType/status/limit/offset |
| `getControlCommand(id)` | 单条详情 (id 或 command_no) | — |
| `markCommandPulled(id)` | pending → pulled | 只允许 pending → pulled (原子) |
| `markCommandResult(id, status, ...)` | pulled/running → success/failed/cancelled | 终态, 写 completed_at |

### 3.2 command_no 格式

`CTRL-{siteCode}-{YYYYMMDDHHmmss}-{4位hex}`, 例如 `CTRL-SH01-20260608140509-7398`

### 3.3 严格边界

- ✅ 参数化 SQL (`$1, $2, ...`), 不信任前端
- ✅ 校验 command_type / target_type 白名单
- ✅ sourceSiteId ≤ 32 字符, targetId ≤ 64 字符
- ❌ **不读 unified_tasks** (服务层职责单一)
- ❌ **不调任何外部 API** (HMAC / push / 等)
- ❌ **不写日志到 sync_*_log** (这条命令是 control 域, 不是 sync 域)

---

## 4. API 路由 (5 个新端点)

| 端点 | 方法 | 用途 | 鉴权 |
|---|---|---|---|
| `/api/control/commands` | POST | 总控写命令 (用户/系统) | **未鉴权** (Sprint 4.5 MVP; Auth 解锁后改 session) |
| `/api/control/commands` | GET | 总控列表查询 | 无 (读) |
| `/api/control/commands/[id]` | GET | 总控单条详情 | 无 (读) |
| `/api/site-control/commands` | GET | **站点轮询拉取** (auto-mark pulled) | dev: 无 / strict: `x-site-control-signature` = secret |
| `/api/site-control/commands/[id]/ack` | POST | 站点 ack (pulled → running) | 同上 |
| `/api/site-control/commands/[id]/result` | POST | 站点回写结果 (running → success/failed) | 同上 |

### 4.1 站点侧鉴权 (简化版)

复用 `lib/sync/package-auth.ts` 的 `SYNC_PACKAGE_SECRET`:

- `SYNC_PACKAGE_AUTH_MODE=dev` → 站点 API 放行 (开发用)
- `SYNC_PACKAGE_AUTH_MODE=strict` → 站点 API 要求 `x-site-control-signature` = `SYNC_PACKAGE_SECRET` (明文比对, 非 HMAC)

**注**: 此为 Sprint 4.5 MVP 简化, 不走完整 HMAC 签名 (Sprint 4.6 升级为完整 HMAC)。

### 4.2 站点轮询行为 (GET /api/site-control/commands)

1. 校验鉴权
2. 查 `status='pending' AND source_site_id=$1`, LIMIT 20
3. **循环** `markCommandPulled(id)` (原子 pending → pulled)
4. 返回已 pulled 的列表 (含 `pulledAt`)

> 简化: 单进程足够, 未做分布式锁。

### 4.3 站点 result 回写 (POST /api/site-control/commands/[id]/result)

请求体:
```json
{
  "status": "success",
  "result": { "burn_status": 3, "site_msg": "已暂停" },
  "errorMessage": "optional"
}
```

终态: `success` / `failed` / `cancelled`, 写 `completed_at = now()`, 写 `result` (jsonb), 写 `error_message`。

---

## 5. 前端最小接入 (Tasks 页面)

### 5.1 改造点

`app/tasks/page.tsx` 的 3 个 handler:

| Handler | 旧行为 (API mode) | 新行为 (API mode) |
|---|---|---|
| `handlePause` | `showApiWriteUnavailable("暂停任务")` | **POST `/api/control/commands`** `task_pause` |
| `handleResume` | `showApiWriteUnavailable("恢复任务")` | **POST `/api/control/commands`** `task_resume` |
| `handleRetry` | `showApiWriteUnavailable("重试任务")` | **POST `/api/control/commands`** `task_reset` (payload.action=retry) |

### 5.2 行为变化

- ✅ **创建 command 成功** → toast `"控制命令已提交, 等待站点同步执行: CTRL-SH01-..."` 
- ✅ **不修改 task 状态** (`unified_tasks` 完全不动)
- ✅ **不伪造成功** (没有 mark task done / 改 phase)
- ✅ mock mode 保留原逻辑 (不影响前端开发)

### 5.3 Racks 设备控制按钮

**未接入** (Sprint 4.5 范围: 任务控制优先)。Racks 上的"在站点管理" 类按钮保持 `showApiWriteUnavailable`, 因为 requirements §3 任务控制比设备控制更优先。

---

## 6. /control 控制命令列表页 (新)

### 6.1 路径

`app/control/page.tsx` (Sprint 4.5 新增, sidebar "控制命令" 入口)

### 6.2 展示

- 顶部 5 个 stat tile: 总数 / 待拉取 / 执行中 / 成功 / 失败
- 列表表格: commandNo / 站点 / 类型 / 目标 / 状态徽章 / 提交时间 / 完成时间 / 错误
- 筛选: 按 status (pending/pulled/running/success/failed/cancelled) + 搜索 commandNo / targetId

### 6.3 数据源

`GET /api/control/commands?siteCode=...&limit=200`, 跟随全局 siteCode 筛选 (Sprint 2F.4)。

---

## 7. 端到端测试结果 (Sprint 4.5 实际跑通)

### 7.1 流程

| # | 操作 | 命令 | 结果 |
|---|---|---|---|
| 1 | 创建 task_pause | `POST /api/control/commands` | ✅ `CTRL-SH01-20260608140509-7398`, status=pending |
| 2 | 站点轮询 | `GET /api/site-control/commands?siteCode=SH01` | ✅ pulledCount=2, status=pending→pulled |
| 3 | 站点 ack | `POST /api/site-control/commands/[id]/ack` | ✅ status=pulled→running |
| 4 | 站点 result | `POST /api/site-control/commands/[id]/result` `{status:"success",result:{burn_status:3}}` | ✅ status=running→success, completedAt 已写 |
| 5 | 验证 unified_tasks 未改 | `SELECT * FROM unified_tasks WHERE task_no='T-002'` | ✅ **0 行** (T-002 是测试 ID, 不存在; 真实测试用 task_no='task_test_001' 同样 0 行) |
| 6 | 回归 GET /api/sync/packages | — | ✅ HTTP 200, 真实数据 |
| 7 | 回归 POST /api/sync/package 无签名 | `SYNC_PACKAGE_AUTH_MODE=strict curl ...` | ✅ HTTP 400 (HMAC 协议未改) |
| 8 | 回归 `pnpm smoke:sync` | — | ✅ `packageStatus: success, duplicateDetected: true, tableLogs: 2` |

### 7.2 tsc + build

- ✅ `pnpm exec tsc --noEmit` — clean
- ✅ `pnpm build` — 6 新路由全部成功 (`/api/control/commands`, `/api/control/commands/[id]`, `/api/site-control/commands`, `/api/site-control/commands/[id]/ack`, `/api/site-control/commands/[id]/result`, `/control`)

---

## 8. 不伪造状态说明 (Sprint 4.5 严格边界)

| 不做的 | 原因 |
|---|---|
| **不直接改 unified_tasks.phase / status** | 控制链路是"命令队列", 不是"控制器"。总控只是发命令, 真正执行在站点 |
| **不自动 mark task 为 paused** | 站点没回写 success 之前, task 状态保持原样 (不假实现) |
| **不伪造 ack** | 只有真实站点 (或 curl 模拟) 调用 `/api/site-control/.../result` 才更新 status |
| **不预填 success** | 状态机严格: pending → pulled → running → success (或 failed/cancelled) |
| **不改 sync_table_log** | control 域 ≠ sync 域, 两条链路不互相影响 |
| **不引入 WebSocket** | Sprint 4.5 范围不含, Sprint 4.6 之后 |
| **不要求真实站点已存在** | 站点 API 是为未来站点接入预留, 当前可用 curl 模拟测试 |

---

## 9. 当前限制 (Sprint 4.5 已知边界)

| 限制 | 何时解锁 |
|---|---|
| **不要求 Auth** (任何人都能 POST 创建命令) | Sprint 5.x (Auth 解锁后从 session 读 requestedBy) |
| **不要求 RBAC** (用户能创建任何 command_type) | Sprint 5.4 (RBAC 接入后按角色过滤) |
| **站点侧鉴权简化** (明文 secret 比对) | Sprint 4.6 (升级完整 HMAC + nonce + 时间窗) |
| **单进程拉取** (无分布式锁) | 多实例部署时 (Sprint 6.4) 加 SELECT FOR UPDATE |
| **不通知用户** (command 完成仅靠轮询 /control 页面) | Sprint 4.8 (SMTP/WebSocket) |
| **不接站点巡检** (inspect_start / recovery_start 写表但无执行) | Sprint 4.8 (站点开发 pull-control 脚本) |
| **不写审计日志** (control 域无独立审计) | Sprint 5.5 (审计体系) |

---

## 10. 未来如何接 ADFS/RBAC (Sprint 5.x 计划)

### 10.1 接入 ADFS 后

```typescript
// app/api/control/commands/route.ts 改造
import { getSession } from "@/lib/auth/session"
const session = await getSession()
if (!session) return NextResponse.json({ error: "未登录" }, { status: 401 })

// requestedBy 自动从 session 读
const row = await createControlCommand({
  ...input,
  requestedBy: session.user,        // 新增: 来自 ADFS 用户
})
```

### 10.2 接入 RBAC 后

```typescript
// commandType 权限矩阵
const PERMISSIONS = {
  task_pause:        ["site_admin", "operator"],
  task_resume:       ["site_admin", "operator"],
  task_reset:        ["site_admin"],
  task_priority_restore: ["site_admin"],
  inspect_start:     ["site_admin", "auditor"],
  recovery_start:    ["site_admin", "operator"],
}

// middleware 检查
if (!PERMISSIONS[input.commandType].includes(session.role)) {
  return NextResponse.json({ error: "权限不足" }, { status: 403 })
}
```

### 10.3 接入审计后

```sql
-- Sprint 5.5 加审计表
CREATE TABLE control_audit (
  id BIGSERIAL PRIMARY KEY,
  command_id uuid REFERENCES control_command(id),
  user_id text NOT NULL,
  action text NOT NULL,
  ip text,
  ts timestamptz DEFAULT now()
);
```

---

## 11. 关键文件清单 (Sprint 4.5 变更)

| 路径 | 变更 |
|---|---|
| `databases/sprint-4.5/control-command.sql` | ➕ 新 (16 字段 + 4 索引 + 1 触发器) |
| `lib/control/control-command.ts` | ➕ 新 (5 函数 + 3 类型) |
| `app/api/control/commands/route.ts` | ➕ 新 (POST + GET) |
| `app/api/control/commands/[id]/route.ts` | ➕ 新 (GET 单条) |
| `app/api/site-control/commands/route.ts` | ➕ 新 (GET 轮询, auto-mark pulled) |
| `app/api/site-control/commands/[id]/ack/route.ts` | ➕ 新 (POST ack) |
| `app/api/site-control/commands/[id]/result/route.ts` | ➕ 新 (POST result) |
| `app/control/page.tsx` | ➕ 新 (控制命令列表页) |
| `app/tasks/page.tsx` | ✏️ handlePause/Resume/Retry 改写 (API mode 走 command) |
| `components/dashboard/sidebar.tsx` | ✏️ 加 Terminal icon + "控制命令" 菜单项 |
| `docs/database-analysis/sprint-4.5-control-command-mvp.md` | ➕ 本文档 |

---

## 12. 下一 Sprint 建议 (Sprint 4.6)

按 Sprint 4.2 路线图:

| 任务 | 估时 | 依赖 |
|---|---|---|
| TaskControlProvider 抽象 + 9 thin API | 2d | 4.5 已完成 |
| 站点侧完整 HMAC 鉴权 (Sprint 4.6 升级) | 0.5d | 0 |
| `/control` 加批量操作 (按 status 批量取消) | 0.5d | 0 |
| WebSocket 推送 command 状态变更 | 3d | 0 |
| `inspect_start` / `recovery_start` 接入 (Sprint 4.8) | 4d | 站点侧 pull-control |
| 真实站点拉取脚本示例 (Sprint 4.8) | 1d | 0 |

**推荐本周后续**: 4.6 TaskControlProvider (2d) + 完整 HMAC 升级 (0.5d) + `/control` 批量操作 (0.5d) = **3d**
