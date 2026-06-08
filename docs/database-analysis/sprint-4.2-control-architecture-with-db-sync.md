# Sprint 4.2-C — 控制能力落地方案 (Control Architecture with DB-Sync)

> **状态**: ✅ 完成 (设计稿, **不写业务代码 / 不新增 API / 不修改数据库**)
> 设计时间: 2026-06-08
> 领导口径: 无站点 API 文档, **不假实现**, 可设计"DB 轮询/控制队列"
> 关联: Sprint 4.1 (任务控制能力审计) + requirements.md §3/§4

---

## 1. 设计前提

**关键约束**:
- 领导确认: 内部系统**没有现成接口文档**
- 同步走**每小时 SQL 拉数 → package 推送**, 不是实时 API
- 控制能力**不能假实现** (Sprint 4.1 已确认 0 真实写入 API)
- 严格按 requirements.md 设计, 不止展示

**核心权衡**:
- 走 API 转发 → 等站点先有 API (但没文档)
- 走 DB 轮询 → 总控主动同步可见, 控制通过反向 channel
- 走 SSO 跳转 → 用户在站点侧操作, 总控下次同步看到结果

**两个方案并行不冲突, 不同需求用不同方案**。

---

## 2. 方案 1: SSO 跳转站点执行 (走"按站点跳转")

### 2.1 流程

```
用户 → 总控 (登录态) → 点 "进入站点" → 跳转站点 URL (SSO 免登)
                                              ↓
                                      站点 (用户身份接管)
                                              ↓
                                      用户在站点操作
                                              ↓
                                      站点本地 DB 变化
                                              ↓
                                      下次 hourly 同步回总控
                                              ↓
                                      总控展示结果
```

### 2.2 实现 (总控侧)

```typescript
// components/site-jump-button.tsx (设计稿, 未实现)
"use client"
import { useSite } from "@/lib/site/site-context"

export function SiteJumpButton({ siteCode, action }: {
  siteCode: string
  action: "create_task" | "pause_task" | "resume_task" | "reset_task" | "inspect"
}) {
  const { siteCode: current } = useSite()

  // 站点 URL 配置 (来自总控后台 / 环境变量)
  const siteUrl = SITE_URLS[siteCode]  // e.g. "https://sh01.star.example.com"

  // 跳转路径: {siteUrl}/{action}?return={encoded_totalControlUrl}
  // 例如: https://sh01.star.example.com/tasks/create?return=https://control.example.com/tasks/{id}
  const target = `${siteUrl}/actions/${action}?return=${encodeURIComponent(window.location.href)}`

  return (
    <a href={target} target="_blank" rel="noopener noreferrer">
      <Button>在 {siteCode} 站点执行</Button>
    </a>
  )
}
```

### 2.3 适用需求 (高频需用户判断, 不能批量)

| REQ | 需求 | 适合 SSO 跳转? | 理由 |
|---|---|---|---|
| REQ-027 新建备份/恢复任务 | 选择文件/设备/优先级 | ✅ **强适合** | 选文件交互复杂, 用户必须在站点侧看 |
| REQ-031 盘笼移位登记 | 选盘笼 + 目标站点 + 审批 | ✅ **强适合** | 业务连续性 + 审批流程 |
| REQ-024 文件检索 | 检索后"回迁"操作 | ✅ **强适合** | 跨站调度, 用户必须确认目标 |
| REQ-027 任务新建中的"封包线程" 等参数 | 高级参数 | ✅ **强适合** | 配置复杂, 站点 UI 已成熟 |

**核心特征**: **单次决策 + 用户必须参与**。

### 2.4 优势/劣势

- ✅ **不假实现** — 真实在站点执行
- ✅ **零开发成本** — 跳转 URL 即可
- ✅ **复用站点已有 UI** — 不重复造轮子
- ❌ **依赖 SSO** — 站点必须有 ADFS/LDAP (CLAUDE.md 禁)
- ❌ **总控是"目录 + 入口", 不是"控制器"** — 不符合 requirements.md "管控" 定位
- ❌ **延迟可见** — 用户要等下个小时同步才能看到结果
- ❌ **审计困难** — 跨系统操作, 留痕在站点侧

---

## 3. 方案 2: 总控控制队列 (DB-Sync 模式)

### 3.1 流程

```
用户 → 总控 (写 control_command)
         ↓
[ PG17.unified_control_command ]
         ↓
[ 站点 hourly 同步反向: 拉 control_command WHERE site=... AND status=pending ]
         ↓
站点执行 (写本地 tbl_task 等)
         ↓
站点下次同步回总控 (推结果 + 状态变更)
         ↓
总控 markCommandDone / Failed
         ↓
页面展示结果
```

### 3.2 表设计 (unified_control_command)

```sql
-- Sprint 4.5 设计稿
CREATE TABLE unified_control_command (
  id BIGSERIAL PRIMARY KEY,
  site_code VARCHAR(32) NOT NULL,         -- 目标站点
  action VARCHAR(32) NOT NULL,            -- pause/resume/reset/inspect/create
  target_type VARCHAR(16) NOT NULL,       -- task / volume / disc / device
  target_id VARCHAR(64) NOT NULL,         -- 目标 ID (如 task_id)
  payload JSONB DEFAULT '{}'::jsonb,      -- 业务参数 {reason, ratio, priority...}
  status VARCHAR(16) DEFAULT 'pending',   -- pending / sent / executing / done / failed / timeout
  created_by VARCHAR(64),                 -- 用户 (Auth 解锁后填)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,                    -- 站点拉走的时间
  executed_at TIMESTAMPTZ,                -- 站点完成时间
  finished_at TIMESTAMPTZ,                -- 总控回写完成时间
  result JSONB,                           -- 站点执行结果
  error_code VARCHAR(32),
  error_message TEXT,
  trace_id VARCHAR(64),                   -- 链路追踪
  ack_required BOOLEAN DEFAULT FALSE      -- 是否需站点 ACK
);
CREATE INDEX idx_control_site_status ON unified_control_command(site_code, status, created_at);
```

### 3.3 站点侧轮询 (新脚本: scripts/pull-control-commands.ts)

```typescript
// 设计稿: 站点侧拉控制命令
// 用法: pnpm pull:control SH01
// 频率: 每小时 (与 push 同步对偶)

import { Client } from 'pg'
import { readFileSync } from 'fs'

const SITE_DB = process.env.SOURCE_DATABASE_URL!  // star_storage_db
const CONTROL_API = process.env.SYNC_CONTROL_URL!  // 总控地址
const SITE_CODE = process.argv[2]

async function pullControlCommands() {
  // 1. 调 GET /api/control/commands?siteCode=SH01&status=pending
  // (或直接读总控 PG17: SELECT * FROM unified_control_command WHERE site_code=$1 AND status='pending')
  // 注: 站点侧有总控只读账号
  const res = await fetch(`${CONTROL_API}/api/control/commands?siteCode=${SITE_CODE}&status=pending`, {
    headers: { /* HMAC */ }
  })
  const { commands } = await res.json()

  // 2. 在本地 star_storage_db 执行
  const client = new Client({ connectionString: SITE_DB })
  await client.connect()
  for (const cmd of commands) {
    try {
      const result = await executeCommand(client, cmd)
      // 3. POST /api/control/ack 反馈
      await fetch(`${CONTROL_API}/api/control/ack`, {
        method: 'POST',
        body: JSON.stringify({ commandId: cmd.id, status: 'done', result }),
        headers: { /* HMAC */ }
      })
    } catch (e) {
      await fetch(`${CONTROL_API}/api/control/ack`, {
        method: 'POST',
        body: JSON.stringify({ commandId: cmd.id, status: 'failed', error: e.message }),
        headers: { /* HMAC */ }
      })
    }
  }
  await client.end()
}

async function executeCommand(client, cmd) {
  switch (cmd.action) {
    case 'pause_task':
      return client.query(`UPDATE tbl_task SET burn_status = 3 WHERE id = $1`, [cmd.target_id])
    case 'resume_task':
      return client.query(`UPDATE tbl_task SET burn_status = 0 WHERE id = $1 AND burn_status = 3`, [cmd.target_id])
    case 'reset_task':
      return client.query(`UPDATE tbl_task SET burn_status = 0, ret_msg = 'reset' WHERE id = $1`, [cmd.target_id])
    case 'create_task':
      // INSERT INTO tbl_task ...
    case 'inspect':
      // INSERT INTO tbl_disc_inspect ...
  }
}
```

### 3.4 适用需求 (批量 + 自动化 + 无人值守)

| REQ | 需求 | 适合控制队列? | 理由 |
|---|---|---|---|
| REQ-027 任务新建 (备份/恢复) | 简单参数任务 | ✅ 适合 | 无需用户看 UI |
| REQ-027 任务暂停/恢复/重置 | 单条指令 | ✅ **强适合** | 简单 SQL 即可 |
| REQ-028 优先恢复 | 改 priority 字段 | ✅ **强适合** | 一行 SQL |
| REQ-029 数据巡检 (SM3) | 后台抽盘+哈希 | ✅ **强适合** | 长时间任务, 异步 |
| REQ-027 任务完成通知 | 改 status 即可 | ✅ 适合 | 站点有 ret_msg 字段 |
| REQ-030 任务监控 (≤10s 刷新) | 状态镜像 | ⚠️ 弱适合 | 同步周期 1h, 实时性差 |

**核心特征**: **可批量 + 后台跑 + 容忍小时级延迟**。

### 3.5 优势/劣势

- ✅ **不依赖站点 API** — 走 SQL 即可
- ✅ **总控有完整审计** — control_command 表是总控自有
- ✅ **符合 requirements.md "管控" 定位** — 总控真正"控"
- ✅ **小时级延迟符合领导口径** — 同步周期本来就是 1h
- ❌ **小时级延迟** — 实时性差 (但领导确认不需要)
- ❌ **需站点开发 pull 脚本** (或总控读 PG17 共享账号)
- ❌ **状态镜像要等下个小时** — 用户看到 1h 前的状态

---

## 4. 方案 3 (降级): 站点无任何能力时 — 纯展示 + 跳转

**最简降级** (站点完全不能动):

```
用户 → 总控 (展示状态, 无控制按钮) → "详情请到站点"
```

- /tasks 详情页加 "在站点查看" 跳转链接
- /volumes /racks 详情页加 "在站点管理" 链接
- 完全不假实现, 符合"不破坏"

**适用**: 站点侧既无 API 也无法跑脚本时的过渡。

---

## 5. requirements.md 控制需求 × 方案 矩阵

| REQ | 需求 | 方案 1 (SSO 跳转) | 方案 2 (控制队列) | 方案 3 (降级) | 推荐 |
|---|---|---|---|---|---|
| REQ-001 任务新建 (备份/恢复) | ✅ | ✅ | ⚠️ 入口 | **方案 1** (选文件复杂) |
| REQ-002 任务暂停/恢复/重置 | ❌ | ✅ | ⚠️ | **方案 2** (单 SQL) |
| REQ-003 优先恢复 (高/紧急) | ❌ | ✅ | ⚠️ | **方案 2** (改 priority) |
| REQ-004 数据巡检 (SM3 抽盘) | ❌ | ✅ | ❌ | **方案 2** (异步, 需站点跑) |
| REQ-005 任务监控 (≤10s) | ❌ | ⚠️ (小时延迟) | ⚠️ | **方案 3 + 文档化边界** |
| REQ-006 任务完成/失败/超时提醒 | ❌ | ✅ (异步 email) | ⚠️ | **方案 2** (总控发 SMTP) |
| REQ-007 盘笼移位登记 | ✅ | ✅ | ⚠️ | **方案 1** (审批流程) |
| REQ-008 站点切换 (SSO 免登) | ✅ | ❌ | ⚠️ | **方案 1** (核心) |
| REQ-009 跨站 ES 全文检索 → 回迁 | ✅ | ⚠️ | ⚠️ | **方案 1** (调度到站点) |
| REQ-010 检索结果导出 (CSV) | ❌ | ❌ | ✅ | **方案 3 + 本地下载** |
| REQ-011 日志导出 (CSV + 数字签名) | ❌ | ❌ | ✅ | **方案 3** (下载) |
| REQ-012 部门管理 / 账号生命周期 | ✅ | ❌ | ❌ | **方案 1** (站点管) |
| REQ-013 RBAC 权限分配 | ✅ | ❌ | ❌ | **方案 1** (站点管) |

**结论**:
- **方案 1 适合**: 5 项 (用户参与决策型)
- **方案 2 适合**: 5 项 (后台执行型)
- **方案 3 降级**: 3 项 (暂时不能做的, 文档化)
- **总控可独立做** (无需方案): REQ-006 (邮件), REQ-010/011 (导出)

---

## 6. 关键决策矩阵

| 决策点 | 选方案 1 | 选方案 2 | 选方案 3 |
|---|---|---|---|
| 用户需看 UI 选文件/设备 | ✅ | ❌ | ❌ |
| 业务需审批流 | ✅ | ❌ | ❌ |
| 业务可后台跑 | ❌ | ✅ | ❌ |
| 业务可容忍 1h 延迟 | ❌ | ✅ | ✅ |
| 站点没 API | ❌ | ✅ | ✅ |
| 总控想"管" 不止"展示" | ❌ | ✅ | ❌ |
| 已 CLAUDE.md 禁 (无 Auth) | ❌ | ✅ (用 IP+siteCode 兜底) | ✅ |

---

## 7. 实现优先级 (与 4.3 路线图对齐)

| 阶段 | 任务 | 估时 | 解锁 |
|---|---|---|---|
| **Phase 1 (4.7)** | SSO 跳转占位 (方案 1 骨架) | 1d | 0 |
| **Phase 2 (4.5)** | control_command 表 + 总控写 API | 2d | 0 |
| **Phase 3 (4.5+4.6)** | 站点侧 pull-control 脚本 + HMAC + ack | 3d | 需站点配合 |
| **Phase 4 (4.8)** | 巡检 / 恢复 / 优先 接入控制队列 | 3d | 0 |
| **Phase 5 (后续)** | Auth 解锁后, control_command 填 user, 完整审计 | 5d | 需 Auth |

**总估时 14d, 阶段 1-2 项目能独立完成, 阶段 3 需站点配合**。

---

## 8. 关键发现

1. **方案 1 (SSO 跳转) 与 方案 2 (控制队列) 互补**, 不是二选一
2. **方案 2 才是 requirements.md "管控" 落地的核心** — 5 项 REQ 适合
3. **方案 1 是过渡** — 等 Auth 解锁后, 跳转才能 SSO 免登
4. **小时级延迟符合领导口径**, 不需要"实时控制"
5. **总控可独立做**: 邮件通知 (REQ-006) + 文件下载 (REQ-010/011) — 无需方案
6. **关键阻塞**: 方案 2 需要站点开发 `pull-control` 脚本, 或总控给站点只读 PG17 账号
7. **降级方案 3** (纯展示 + 跳转) 适合"现在不能动" 的需求, 文档化边界

## 9. 结论

- **方案 1 = 用户参与型** (5 项 REQ)
- **方案 2 = 后台执行型** (5 项 REQ, 关键)
- **方案 3 = 降级** (3 项, 文档化)
- **总控独立** (2-3 项, 邮件/下载)
- **下个 Sprint 4.5 优先做方案 2 骨架** (control_command 表 + 总控写 API)
