# Frontend Event Test Standard (前端事件测试标准)

> **Sprint**: R.5 落地 (2026-06-10)
> **依据**: CLAUDE.md §10 强约束 (R.5 新增)
> **目的**: 每次 Sprint 涉及前端/API/事件必须按本标准产出事件级测试, 禁止 commit
> **范围**: 6 类核心事件 + 每轮验收模板

---

## 0. 触发条件

如果 Sprint 涉及以下**任一**内容, 必须按本标准产出事件级测试:

| # | 触发内容 |
|---|---|
| 1 | 前端页面 (新/改/删) |
| 2 | 按钮 (新/改/删) |
| 3 | 表单 / 搜索框 / 筛选器 / 下拉框 |
| 4 | siteCode 切换 |
| 5 | 同步事件 / 创建事件 / 控制命令 / 导出事件 |
| 6 | toast / 弹窗 / drawer |
| 7 | API 接入 / mock → real data 切换 |

---

## 1. 点击事件测试标准

### 1.1 必测 10 项

| # | 项目 | 验证方法 | 失败判据 |
|---|---|---|---|
| 1 | 用户在哪里点击 | DOM selector (data-testid 优先) | 元素不存在 |
| 2 | 点击前页面状态 | curl /api/xxx → 列表/详情 | 状态错 |
| 3 | 点击后请求 API | 抓取 fetch 调用: endpoint + method + payload | 无 API 调用 / API 不匹配 |
| 4 | API 返回什么 | HTTP code + 关键字段 | 5xx / 4xx / 字段错 |
| 5 | 数据库是否变化 | docker exec psql 查 table | 期望变化未发生 |
| 6 | 页面是否刷新 | UI 状态变化 (列表/详情/toast) | 无变化 |
| 7 | toast 是否准确 | toast 文本 + variant (destructive/normal) | 误导措辞 (R.1 §7) |
| 8 | 是否存在 mock/fallback | API response source 字段 | 静默 mock |
| 9 | 是否误导用户 | 按钮文案 vs 真实后端 | 文案超出后端能力 |
| 10 | 是否符合 requirements.md | 关联 REQ-ID | 无 REQ 关联 |

### 1.2 模板 (scripts/e2e/test-tasks.ts 风格)

```ts
// scripts/e2e/test-tasks.ts
/**
 * Tasks 页面事件测试 - 示例
 *
 * 测试项:
 *   - "暂停" 按钮 → POST /api/control/commands → control_command INSERT → audit_log
 *   - "恢复" 按钮 → 同上 (commandType=task_resume)
 *   - "重置" 按钮 → 同上 (commandType=task_reset)
 *
 * 必测 10 项 (R.5 §1.1)
 */
import { strict as assert } from "node:assert"

const BASE = process.env.BASE_URL ?? "http://localhost:3000"

async function test_pause_button() {
  // 1. 用户在哪里点击: Tasks 表格 Eye 按钮旁的 Pause 图标
  // 2. 点击前页面状态: unified_tasks 87 行
  // 3. 点击后请求 API: POST /api/control/commands {commandType:"task_pause",targetId:"<id>"}
  // 4. API 返回: {ok:true, command:{id, status:"pending"}}
  // 5. 数据库变化: control_command +1 行, audit_log +1 行 (待 worker)
  // 6. 页面刷新: toast 显示
  // 7. toast 准确: "暂停命令已提交" (R.1 §7 规范)
  // 8. mock/fallback: 真实 DB 写入, 无 mock
  // 9. 误导: 按钮文案 "暂停" + toast "已提交" = 不误导
  // 10. 符合 requirements: REQ-4.2.2 任务控制
  console.log("✅ test_pause_button 10/10 项验证通过")
}

test_pause_button().catch(console.error)
```

---

## 2. 同步事件测试标准

### 2.1 必测项

| # | 同步事件 | 必测 |
|---|---|---|
| 1 | `/api/sync/package` POST (站点推送) | HMAC 401/200 + sync_package_log INSERT + sync_table_log INSERT |
| 2 | `/api/sync/packages` GET (列表) | status 分布 (success/failed/skipped) |
| 3 | `/api/sync/logs` GET (表日志) | rowsRead/rowsUpserted 真实数字 |
| 4 | siteCode 过滤 | 不同 siteCode 看到不同 packages |

### 2.2 关键脚本: `scripts/e2e/test-sync.ts` (R.5 占位)

```ts
/**
 * Sprint R.5 占位 - 后续 Sprint 涉及同步时按需实现
 */
console.log("⚠️ R.5 占位 - sync e2e 脚本待实现")
```

---

## 3. 创建事件测试标准

### 3.1 当前 R.4 状态

| 端点 | 状态 | 测试要求 |
|---|---|---|
| `POST /api/tasks` (新建任务) | ❌ **NOT IMPLEMENTED** (R.4 维持) | 待 REQ-4.2.1 实施后写 e2e |
| `POST /api/control/commands` | ✅ 已实现 (R.4 6 commandType) | 已验证 e2e:worker |

### 3.2 创建事件必测项

- UI 按钮触发 → API POST → DB INSERT → 列表/详情刷新 → toast
- 若仅 audit (无真改): 必须显式标记 `mock_or_simulator=audit_only`

---

## 4. 控制命令测试标准

### 4.1 6 原子 (REQ-4.2.2 + REQ-4.2.3)

| 原子 | 端点 | commandType | R.4 状态 |
|---|---|---|---|
| 暂停 | POST /api/control/commands | task_pause | ✅ audit 框架 + executor 修复 |
| 恢复 | POST /api/control/commands | task_resume | ✅ 同上 |
| 重置 | POST /api/control/commands | task_reset | ✅ 同上 |
| 巡检 | POST /api/control/commands | inspect_start | ✅ 同上 |
| 恢复任务 | POST /api/control/commands | recovery_start | ✅ 同上 |
| **优先恢复** | POST /api/control/commands | **task_priority_restore** (R.4 新增) | ✅ 同上 |

### 4.2 e2e:worker (R.4 已实现)

```
[worker-site] polled 3 pending commands
[worker-site] inspect_start 1 → dry_run_success (2ms) [DRY_RUN]
[worker-site] task_pause 1 → dry_run_success (9ms) [DRY_RUN]
[worker-site] recovery_start 1 → dry_run_success (1ms) [DRY_RUN]
```

### 4.3 关键脚本: `scripts/e2e/test-control.ts` (R.5 占位)

---

## 5. siteCode 切换测试标准

### 5.1 当前 R.4 状态

- Header 站点选择器 (`components/platform/site-selector.tsx`) 接入 `useSite()`
- 8 个核心 API 接受 `siteCode` query param: tasks/racks/volumes/sync/control/users/alerts/racks/[id]/slots
- `localStorage` 记忆 + URL 同步 (Sprint 2F.4)

### 5.2 必测项

| # | 验证 |
|---|---|
| 1 | Header 切换 siteCode → 所有数据列表自动过滤 |
| 2 | URL `?siteCode=SH01` 同步 |
| 3 | localStorage 记忆 (刷新页面保持) |
| 4 | "All Sites" 视角工作 |
| 5 | invalid siteCode 不崩 |

### 5.3 关键脚本: `scripts/e2e/test-sites.ts` (R.5 占位, 主要测 siteCode 切换)

---

## 6. mock/fallback 检查标准

### 6.1 R.1 §7 + R.4 强约束

**禁止**:
- mock 冒充真实数据
- silent fallback (静默 success)
- DRY_RUN 冒充真实执行
- toast 冒充成功

**显式标记**:
- `dataSource: "mock" | "database" | "derived" | "not_implemented"`
- `status: "dry_run_success" | "unsupported" | "success" | "failed"`
- `blocker: "blocked_by_source_schema" | "blocked_by_site_change" | "blocked_by_auth" | "blocked_by_external_system"`

### 6.2 检查清单 (R.5 强制)

| # | 检查 |
|---|---|
| 1 | API response 是否含 `source` / `dataSource` 字段 |
| 2 | status 是否区分 dry_run_success / success / unsupported |
| 3 | UI 是否显示 blocker (R.4 /search 页面 amber banner 是范例) |
| 4 | toast 文案是否符合 R.1 §7 (无"暂停成功"等误导) |
| 5 | 按钮 title 是否明确状态 (e.g. "暂停" 而非 "已暂停") |

---

## 7. 每轮 Sprint 验收模板 (R.5 强制)

> **本节是 R.5 强制要求**: 每次 Sprint 完成时, 必须复制本节到 `docs/database-analysis/sprint-<X.Y>-requirements-review.md`, 完成 9 项 (A-I) 才能 commit。

### A. Requirement 对照

| REQ-ID | 当前状态 | 真实度 | 证据 |
|---|---|---|---|
| REQ-X.Y.Z | complete/partial/not_started/blocked_* | 0-100% | SQL / API / 浏览器 |

### B. 前端变更清单 (8 项强制披露, R.5 §0)

- [ ] 新增了哪些页面/组件
- [ ] 修改了哪些按钮/交互
- [ ] 删除了哪些按钮/交互
- [ ] 哪些是 UI-only (无后端)
- [ ] 哪些是真实后端能力 (有 SQL/API 证据)
- [ ] 哪些只是 simulator / DRY_RUN
- [ ] 是否新增了 `requirements.md` 未要求的内容
- [ ] 如果新增: **必须说明理由 + 标注"不属于需求主线"**

### C. API 变更清单

| 端点 | 方法 | 新/改/删 | 真实/mock/fallback | 验证 |
|---|---|---|---|---|

### D. 数据库变更清单

| 表 | 变更类型 (CREATE/ALTER/DROP/SELECT/INSERT) | 真实数据 | 证据 |
|---|---|---|---|

### E. 事件测试清单 (10 项, R.5 §1.1)

- [ ] 用户在哪里点击 (element + selector)
- [ ] 点击前页面状态
- [ ] 点击后请求 API (endpoint + method + payload)
- [ ] API 返回 (HTTP code + 关键字段)
- [ ] 数据库变化 (docker exec psql)
- [ ] 页面刷新 (UI 状态)
- [ ] toast 准确 (无 R.1 §7 误导)
- [ ] mock/fallback (R.1 §7)
- [ ] 误导用户 (按钮 vs 后端)
- [ ] 符合 requirements.md (REQ-ID)

### F. 浏览器验证结果

| 页面 | URL | HTTP | 关键 HTML/CSS 状态 | 截图 |
|---|---|---|---|---|
| /tasks | http://localhost:3000/tasks | 200 | (描述) | (R.6 引入 Playwright) |
| /api/tasks/[id] | ... | 200 | JSON 字段 | N/A |

### G. mock/simulator/DRY_RUN 标记

| 元素 | 类型 | 显式标记 | 状态 |
|---|---|---|---|
| /api/sites | derived | dataSource=derived | 接受 |
| /api/search | not_implemented | source=not_implemented | 阻塞 |
| executor task_pause (DRY_RUN) | dry_run_success | status=dry_run_success | 区分 |

### H. 未完成项

| # | 项 | 原因 | 下一 Sprint |
|---|---|---|---|

### I. **是否允许 commit** (R.5 强制)

- [ ] A 全部 REQ 有状态 + 证据
- [ ] B 8 项前端披露全部填写
- [ ] C API 变更完整列出
- [ ] D DB 变更完整列出
- [ ] E 10 项事件测试全部通过
- [ ] F 浏览器验证 (HTTP 至少, 截图 R.6+ 引入)
- [ ] G mock/simulator/DRY_RUN 显式标记
- [ ] H 未完成项明确
- [ ] **CLAUDE.md §10 强约束 10 项禁止无违反**

**Verdict**: `pass` (全部 ✅) / `partial` (部分 ✅) / `fail` (任一关键项 ❌)

---

## 8. R.5 测试缺口 (待补)

> R.5 范围严格: 0 业务功能, 0 新增 API, 仅产出规则 + 占位文档。后续 Sprint 涉及前端/事件时, 按缺口清单实施。

| 缺口 | 影响 | 估时 | 建议 Sprint |
|---|---|---|---|
| `scripts/e2e/test-dashboard.ts` | Dashboard 6 tile 真实性 | 1d | R.5+ |
| `scripts/e2e/test-tasks.ts` | Tasks 9 按钮 + 详情 + siteCode | 2d | R.5+ |
| `scripts/e2e/test-sync.ts` | 同步链路 + HMAC + table log | 1d | R.5+ |
| `scripts/e2e/test-control.ts` | 6 commandType + worker poll | 1.5d | R.5+ |
| `scripts/e2e/test-sites.ts` | 站点 derived + 切换 | 1d | R.5+ |
| `scripts/e2e/test-search.ts` | not_implemented 路由 + UI banner | 0.5d | R.5+ |
| **Playwright e2e** (浏览器截图) | R.5 仅 HTTP 验证, R.6+ 引入 | 3d | R.6 |

**合计 ~10 人天, 0 阻塞, 全部可自主推进**。

---

## 9. R.5 总结

- ✅ CLAUDE.md §10 强约束加入 (一票否决)
- ✅ 测试标准文档 6 类事件 (点击/同步/创建/控制/siteCode/mock)
- ✅ 每轮 Sprint 验收模板 9 项 (A-I)
- ✅ scripts/e2e/ 计划目录 + 6 个占位
- ✅ 测试缺口清单 (R.5+ 候选)
- ✅ R.5 范围严格: 0 业务代码
- ✅ 不修改任何业务逻辑
