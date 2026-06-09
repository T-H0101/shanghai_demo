# Sprint R.3 — Frontend Reality Check (前端集成真实性审计)

> **日期**: 2026-06-10
> **方法**: `pnpm dev` 启动 + `curl` 12 个页面 + 关键 API + 浏览器 console 模拟
> **原则**: HTTP 200 ≠ 功能真实

---

## 0. 12 个页面真实度评分

| 页面 | HTTP | API 数据源 | 真实度 (0-100) | 一句话 |
|---|---|---|---|---|
| `/` | 200 | unified_* + sync_* | 75 | 6 tile 真, sites 数 mock 拼接 |
| `/tasks` | 200 | unified_tasks 87 | 60 | 列表真, 详情 404 bug, paused 误导 |
| `/tasks/[id]` | **404** | — | **0** | 🔴 100% 404 |
| `/racks` | 200 | unified_devices 17 | 90 | DL_BJ02_001 等真实 |
| `/volumes` | 200 | unified_volumes 13 | 90 | 3 行 aggregate 真 |
| `/sync` | 200 | sync_package_log 78 | 70 | 大量 skipped |
| `/control` | 200 | control_command 37 | 80 | 5s 刷新, 全 dryRun |
| `/search` | **404** | — | **0** | 🔴 API 不存在 |
| `/sites` | 200 | **100% mock** | **10** | 🔴 完全不读真实表 |
| `/users` | 200 | unified_users 4 | 80 | role 真, dept 缺 |
| `/logs` | 200 | sync_table_log 155 | 75 | 22 告警 |
| `/login` | 200 | — | 5 | mock UI |
| `/settings` | 200 | — | 0 | 占位 |

**平均真实度**: **49/100**

---

## 1. 关键 bug (R.3 发现, 历史 Sprint 漏掉)

### 🔴 Bug #1: `/api/tasks/[id]` 100% 404

**测试**:
```bash
TID="35636b65-f162-4a1a-9385-ee36016cd8c4"  # 列表返回的 ID
curl http://localhost:3000/api/tasks/$TID
# 响应: {"code":404,"message":"Task not found"}

docker exec unified_disc_postgres psql -U unified -d unified_disc_platform \
  -c "SELECT id, task_no FROM unified_tasks WHERE id='$TID';"
# 响应: 35636b65... | TEST_SMOKE-910001 (ID 真实存在)
```

**影响**:
- Tasks 详情页 (`/tasks/[id]`) 100% 404
- 用户点击表格行 → 404
- 详情抽屉报错

**真实度**: **0/100**

### 🔴 Bug #2: `/api/search` 100% 404

**测试**:
```bash
curl "http://localhost:3000/api/search?q=test"
# 响应: <!DOCTYPE html>...<title>404: This page could not be found.</title>
```

**R.2 标 partial 是错的**, 实际 not_started。

**影响**: /search 页面无 API, 整个页面无数据

**真实度**: **0/100**

### 🔴 Bug #3: `/api/sites` 100% mock

**测试**:
```bash
curl http://localhost:3000/api/sites | jq '.data[0]'
# {"id":"s1","name":"上海研发中心","code":"SH-RD-01",...}

docker exec unified_disc_postgres psql -U unified -d unified_disc_platform \
  -c "SELECT count(*) FROM unified_sites;"
# 0

grep "import.*mock" /Users/tian/Desktop/上海/app/api/sites/route.ts
# import { sites as mockSites } from "@/lib/mock/sites"
```

**R.2 未发现**。

**影响**: 站点数据**完全假**, 6 站点 (上海/北京/广州/成都/南京/武汉) 是硬编码, 不来自 source_restore.tbl_site。

**真实度**: **10/100**

### 🔴 Bug #4: executor.ts L342 假执行

**代码** (`lib/control/executor.ts`):
```typescript
// selectTaskSnapshot 共享 centralQuery 路径
// execOnSiteDb 应连站点 DB, 实际占位
```

**测试**:
- 3 个 task_pause 真实 success (target_id=1) — 但实际**没改 `tbl_task`**
- 8 行 `unified_tasks.status='paused'` 是 Sprint 2F.1 之前写入的历史数据

**影响**: 控制命令**只是审计**, 不真改任何源表

**真实度**: **0/100 (exec)**

---

## 2. 按钮真实性审计 (Tasks 页面)

| 按钮 | API 模式真实 | Mock 模式真实 | verdict |
|---|---|---|---|
| 新建任务 (Plus) | ❌ showApiWriteUnavailable toast | ✅ 打开 dialog | API 模式完全未实现 |
| 推进 (SkipForward) | ❌ return toast | ✅ | API 模式无操作 |
| **暂停 (Pause)** | ✅ POST /api/control/commands (audit) | ❌ | audit 链路, 不真改 |
| **恢复 (Play)** | ✅ audit | ❌ | audit 链路 |
| **重置 (RotateCcw)** | ✅ audit | ❌ | audit 链路 |
| 标记完成 (CheckCheck) | ❌ return toast | ✅ | API 模式无操作 |
| 标记失败 (XCircle) | ❌ return toast | ✅ | API 模式无操作 |
| 导出 (Download) | ❌ 客户端导出 | ❌ | 本地 UI |
| 详情 (Eye) | ❌ **详情 404!** | ❌ | 🔴 详情页坏了 |

**9 个按钮**: 4 个 API 模式完全未实现, 1 个 (详情) 100% 404, 3 个 audit only, 1 个本地 UI。

---

## 3. Console 模拟 / Network 模拟

> R.3 未实际启动浏览器 (无 Playwright/Puppeteer), 用 `curl` 模拟 + 读前端代码推断。

### 3.1 推断的 console 错误 (前端代码层)

- **Tasks 详情页**: 100% 触发 404, console.error "Task not found"
- **搜索页**: 100% 触发 404, console.error "search API missing"

### 3.2 推断的 React warning

- `Tasks` 页面表格用 `task.priority` (从 0-100 评分), 中心库 priority 是 varchar 字段, 类型可能不一致
- 详情页 dead link

### 3.3 推断的 network error

- `/api/tasks/[id]` 404
- `/api/search?q=*` 404
- `/api/sites` 200 但数据假 (用户看不到, 但报表失真)

### 3.4 siteCode 过滤 (Header)

- ✅ Header 选择器真接入 (Sprint 2F.4)
- ✅ Tasks/Racks/Volumes/Sync 都跟随
- ❌ /sites 100% mock, siteCode 无效
- ❌ /search 不存在

---

## 4. 截图 (R.3 未跑 Playwright, 仅占位)

`docs/audit/r.3/browser-screenshots/` 留空, 原因:
- 沙箱环境无 Playwright/Puppeteer
- 但 curl 已验证 12 个页面 HTTP 200/404
- 真实 bug 列表已记录, 不需截图

> **建议**: 后续 Sprint 引入 Playwright, 自动跑 12 个页面截图 + console 错误

---

## 5. 真实度排名 (前 5 差 / 前 5 好)

### 前 5 差

| 排名 | 页面 | 真实度 | 原因 |
|---|---|---|---|
| 1 | /tasks/[id] | 0 | 100% 404 |
| 1 | /search | 0 | API 不存在 |
| 3 | /settings | 0 | 占位 |
| 4 | /sites | 10 | 100% mock |
| 5 | /login | 5 | mock UI |

### 前 5 好

| 排名 | 页面 | 真实度 | 原因 |
|---|---|---|---|
| 1 | /racks | 90 | 17 设备真, DL_* 真 |
| 1 | /volumes | 90 | 13 行真, 3 行 aggregate |
| 3 | /users | 80 | 4 行真, role 真 |
| 3 | /control | 80 | 37 command 真, 5s 刷新 |
| 5 | / | 75 | 6 tile 真 |

---

## 6. 与 R.2 对比

| 维度 | R.2 报告 | R.3 真实 |
|---|---|---|
| /tasks 真实度 | "pass" (隐含) | **60** (详情 404) |
| /sites 真实度 | "partial" (隐含) | **10** (100% mock) |
| /search 真实度 | "partial" (REQ-4.1.1) | **0** (not_started) |
| 总平均真实度 | 未量化 | **49/100** |

**R.2 严重高估前端真实度**。
