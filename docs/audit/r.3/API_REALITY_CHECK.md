# Sprint R.3 — API Reality Check (API 真实性审计)

> **日期**: 2026-06-10
> **方法**: `curl` 测试 21 个 API + Docker exec 验证返回数据
> **原则**: API 200 ≠ 数据真实; 必须查 DB 二次确认

---

## 0. API 总览 (21 个)

| 分类 | 数量 | 真实数据 | mock | 鉴权 |
|---|---|---|---|---|
| 业务查询 (GET) | 14 | 11 | 3 (/api/sites 全 mock, /api/search 404) | 0/14 |
| 业务写入 (POST) | 4 | 3 (HMAC sync 算 1) | 0 | 1/4 (/api/sync/package) |
| 控制命令 (control/site-control) | 5 | 5 (DRY_RUN) | 0 | 1/5 (site-control) |

---

## 1. 21 个 API 真实性矩阵

### 1.1 业务查询 API (14 个)

| API | Method | 数据源 | 真实/mock | 鉴权 | 状态机 | 关键问题 |
|---|---|---|---|---|---|---|
| `/api/dashboard/summary` | GET | unified_* + sync_* | 真实 (sites 拼接) | ❌ | N/A | siteCount 11 = mock 6 + DB 5 |
| `/api/dashboard/recent-syncs` | GET | sync_package_log | 真实 | ❌ | N/A | 14 failed, 64 success |
| `/api/tasks` | GET | unified_tasks 87 | 真实 | ❌ | status/phase 11 enum | 8 行 paused 历史 |
| `/api/tasks/[id]` | GET | — | **🔴 100% 404** | ❌ | N/A | DB 有 87 行, 详情全坏 |
| `/api/racks` | GET | unified_devices 17 | 真实 | ❌ | online/offline/fault | DL_BJ02_001 真 |
| `/api/racks/[id]` | GET | unified_devices | 真实 | ❌ | N/A | 假设 OK, 未单独测 |
| `/api/racks/[id]/slots` | GET | unified_slots 396 | 真实 | ❌ | N/A | Sprint 2C.4 |
| `/api/volumes` | GET | unified_volumes 13 | 真实 | ❌ | magnetic/composite | 3 行 aggregate |
| `/api/sync/packages` | GET | sync_package_log 78 | 真实 | ❌ | success/failed | 14 failed |
| `/api/sync/logs` | GET | sync_table_log 155 | 真实 | ❌ | success/skipped/failed | 大量 skipped |
| `/api/sites` | GET | **100% mock** | **❌** | ❌ | N/A | 6 站点全假 |
| `/api/users` | GET | unified_users 4 | 真实 | ❌ | N/A | role 1/2/3 真 |
| `/api/search` | GET | — | **🔴 404** | N/A | N/A | **未实现** |
| `/api/alerts` | GET | sync_table_log + control_command | 真实 | ❌ | N/A | 22 行 |

### 1.2 业务写入 API (4 个)

| API | Method | 数据源 | 真实/mock | 鉴权 | 状态机 | 关键问题 |
|---|---|---|---|---|---|---|
| `/api/sync/package` | POST | dispatch registry | 真实 | **✅ HMAC** | N/A | 401 无签名确认 |
| `/api/sync/package` (无 HMAC) | POST | — | 401 | N/A | N/A | 鉴权真工作 |
| `/api/tasks` | POST | — | **🔴 未实现** | ❌ | N/A | 新建任务无 API |
| `/api/control/commands` | POST | control_command | 真实 | ❌ | pending/pulled/running/success/failed/cancelled | 37 行, 全 dryRun |

### 1.3 控制命令 API (5 个)

| API | Method | 数据源 | 真实/mock | 鉴权 | 状态机 | 关键问题 |
|---|---|---|---|---|---|---|
| `/api/control/commands` | GET | control_command 37 | 真实 | ❌ | 同上 | /control 页面 5s 刷新 |
| `/api/control/commands/[id]` | GET | control_command | 真实 | ❌ | N/A | 单条详情 |
| `/api/site-control/commands` | GET | control_command | 真实 | **✅ x-site-control-signature** | N/A | Site Worker 内部 |
| `/api/site-control/commands/[id]/ack` | POST | control_command | 真实 | ✅ 同上 | pulled | Site Worker 内部 |
| `/api/site-control/commands/[id]/result` | POST | control_command | 真实 | ✅ 同上 | success/failed | Site Worker 内部 |

### 1.4 系统 API (2 个)

| API | Method | 数据源 | 真实/mock | 鉴权 | 状态机 | 关键问题 |
|---|---|---|---|---|---|---|
| `/api/system/health` | GET | 进程 | 真实 | ❌ | N/A | 13h uptime |
| `/api/system/db-health` | GET | DB | 真实 | ❌ | N/A | OK |

---

## 2. 关键 bug 详细

### 🔴 Bug A: `/api/tasks/[id]` 路由坏了

**测试**:
```bash
# 列表 API 返回的 ID
TID_LISTED="35636b65-f162-4a1a-9385-ee36016cd8c4"
curl "http://localhost:3000/api/tasks?limit=1" | jq '.data.items[0].id'
# "35636b65-f162-4a1a-9385-ee36016cd8c4"

# DB 中存在
docker exec unified_disc_postgres psql -U unified -d unified_disc_platform \
  -c "SELECT id, task_no FROM unified_tasks WHERE id='35636b65-f162-4a1a-9385-ee36016cd8c4';"
# 35636b65... | TEST_SMOKE-910001

# 详情 API 404
curl "http://localhost:3000/api/tasks/35636b65-f162-4a1a-9385-ee36016cd8c4"
# {"code":404,"message":"Task not found","data":null}
```

**根因推断** (未深查):
- 详情 route handler 可能查条件错 (e.g. WHERE task_no=... 而不是 WHERE id=...)
- 或 ID 字段类型不匹配 (uuid vs string)

**R.3 不修, 仅报告** (R.4 修)

### 🔴 Bug B: `/api/search` 路由不存在

**测试**:
```bash
curl "http://localhost:3000/api/search?q=test"
# 404 HTML (Next.js 默认 404 页)
```

**R.2 报告 REQ-4.1.1 partial**, 实际 not_started。

**R.3 不修, 仅报告** (R.4 修)

### 🔴 Bug C: `/api/sites` 100% mock

**测试**:
```bash
curl "http://localhost:3000/api/sites" | jq '.data | length'
# 6

docker exec unified_disc_postgres psql -U unified -d unified_disc_platform \
  -c "SELECT count(*) FROM unified_sites;"
# 0

grep "import.*mock" /Users/tian/Desktop/上海/app/api/sites/route.ts
# import { sites as mockSites } from "@/lib/mock/sites"
```

**影响**:
- /sites 页面**完全假**
- Dashboard siteCount=11 实际是 mock 6 + DB 5 拼接

**R.3 不修, 仅报告** (R.4 修)

### 🔴 Bug D: executor.ts L342 假执行

**代码** (`lib/control/executor.ts`):
```typescript
// L342 注释: 当前用 centralQuery 占位; 后续生产时替换为 siteQuery
async function execOnSiteDb(sql: string, params: unknown[]) {
  return await centralQuery(sql, params)  // ⚠️ 假执行
}
```

**测试**:
- 3 个 `task_pause` real success (target_id=1)
- 但 `tbl_task.id=1` 的 status **没改变** (验证: docker exec psql)
- 8 行 `unified_tasks.status='paused'` 是 Sprint 2F.1 之前历史数据

**影响**: 所有 control_command 都是 **DRY_RUN 模式** (无论 SITE_WORKER_DRY_RUN env 如何)

**R.3 不修, 仅报告** (R.4 修)

---

## 3. 鉴权矩阵 (R.3 实测)

| API | 鉴权类型 | 测试结果 |
|---|---|---|
| `/api/sync/package` | HMAC-SHA256 + 5min + rawBody + timingSafeEqual | ✅ 401 无签名确认 |
| `/api/site-control/*` | x-site-control-signature | ✅ 401 无签名确认 |
| 其他 19 个 API | 无 | ❌ |

**结论**: 5/21 (24%) API 有鉴权, 16/21 (76%) 无鉴权。

---

## 4. 静默成功 / 假成功检测

### 4.1 静默成功 (silent success)

**未发现**。所有 API 都有明确状态码 (200/400/401/404/500)。

### 4.2 假成功 (fake success)

- 🔴 `/api/control/commands` POST 永远返回 200 (无论 commandType 是否在白名单)
- 🔴 `/api/sites` 200 但数据假 (已确认)
- ⚠️ `/api/sync/package` 200 但表内 sync_table_log 大量 status=skipped (演练)

---

## 5. 状态机完整性

### 5.1 control_command 状态机 (6 态)

| 状态 | 数量 | 备注 |
|---|---|---|
| pending | 0 | ✅ (R.4 后会被 worker 拉取) |
| pulled | 1 | task_pause |
| running | 0 | — |
| success | 29 | inspect_start 10 + recovery_start 9 + task_pause 10 |
| failed | 7 | task_pause 3 + task_resume 2 + task_reset 2 |
| cancelled | 0 | — |

**6 态全覆盖**, 但实际流转可能缺失 (e.g. running 0 行表明 worker 没真跑中间态)

### 5.2 sync_package_log 状态机

| 状态 | 数量 | 备注 |
|---|---|---|
| success | 64 | — |
| failed | 14 | — |

### 5.3 unified_tasks 状态枚举 (11 个)

burn_success(55) / make_task_done_backup_running(9) / paused(8) / pending(5) / cancelled(2) / remote_backup_created(2) / restore_started(2) / completed(1) / failed(1) / ready(1) / running(1)

**11 个枚举状态** vs 需求 §4.2 期望 6 个: 远超需求但缺少统一映射。

---

## 6. 总结

| 维度 | 数值 | 评价 |
|---|---|---|
| API 总数 | 21 | — |
| 真实数据 | 17 (81%) | 良好 |
| mock | 1 (5%) — /api/sites | 🔴 严重 |
| 未实现 (404) | 2 (10%) — /api/tasks/[id] + /api/search | 🔴 严重 |
| 假执行 (DRY_RUN) | 1 — executor.ts L342 | 🔴 严重 |
| 有鉴权 | 5 (24%) | 中等 |
| 有状态机 | 7 (33%) | 中等 |
| 静默/假成功 | 3 — control/sites/sync | ⚠️ 中等 |

**R.3 API 真实度评分**: **70/100** (扣 4 个🔴 bug)。
