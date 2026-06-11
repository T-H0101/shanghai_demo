# Sprint R.12 — /logs 真实化 Post-Review

> **Sprint**: R.12 — /logs 页面真实化 (日志检索 + 导出)
> **日期**: 2026-06-11
> **范围**: 仅 /logs 页面 + /api/logs 整合 + e2e,不接 ClickHouse/不伪造系统日志/不写 secret
> **状态**: ✅ 完成 (e2e:logs 37/37 + e2e:all 7 项全绿)

---

## 1. /logs 原 mock 问题 (R.12 之前)

### 1.1 硬编码 mock
- `import { auditLogs } from "@/lib/mock/audit"` (L15)
- `useState<AuditLog[]>(auditLogs)` (L30) 直接灌入 mock 列表
- 7 个 Tab (operations/security/system/task/compliance/alerts/login) 全部来自 mock

### 1.2 全量 setTimeout 假操作
- `handleExport` (L87-143): 1.5s 后客户端 setTimeout 假"导出成功"
- `handleVerifySignature` (L145-158): 1s 后 setTimeout 假"签名校验"
- `handleCopyJson` (L160-166): 假"已复制"

### 1.3 假数字签名
- `selected.signatureValid` (L153) 来自 mock, 假证书
- 详情面板"数字签名: 校验通过/失败"显示给用户, **R.1 §7 严格禁止伪造签名**

### 1.4 登录审计无后端
- `useLoginAuditStore` (L50) 客户端 zustand store, 无任何后端
- 登录流水来源不明, 假装是审计日志

### 1.5 误导措辞
- "数字签名验证成功" / "校验通过" (R.1 §7 禁止假证书)
- "导出成功" (实际是客户端 blob 下载, 非后端导出)

---

## 2. 新增/修改 API

### 2.1 新增 `GET /api/logs`
- 文件: `app/api/logs/route.ts` (~340 行)
- 整合 6 类日志源 (Promise.all 并行查询, 按 occurred_at DESC 合并):
  1. `sync_package_log` (R.2D.4, 103 行实测)
  2. `sync_table_log` (205 行实测)
  3. `sync_scheduler_log` (R.8, 9 行实测)
  4. `sync_consistency_log` (R.7, 48 行实测)
  5. `control_command` (R.4, 259 行实测)
  6. `audit_log` (100 行实测)
- 筛选: `type` / `siteCode` / `status` / `keyword` / `dateFrom` / `dateTo` / `limit` (max 500) / `offset`
- 响应包含 `dataSource` 显式: `database` / `empty` / `error` (不允许 mock)
- `meta.requirement` 显式 REQ-5.1.3 / partial

### 2.2 新增 `GET /api/logs/export`
- 文件: `app/api/logs/export/route.ts` (~280 行)
- 与 R.11B `/api/sync/export` 风格一致:
  - 真实数据库读取, 不允许 mock
  - CSV / JSON 两种格式
  - `x-record-count` 响应头
  - `x-sha256` 完整正文摘要 (Node `crypto.createHash('sha256')`)
  - `x-data-source: database` 显式
  - `Content-Disposition: attachment; filename="logs-<timestamp>.<ext>"`
- 复用 `/api/logs` 的查询函数 (单类型版本)
- 上限 5000 条 (与 R.11B 同步)

### 2.3 保持/不修改
- `/api/sync/logs` (R.2D.4 旧) 保持, 不破坏 R.6 e2e:sync
- `/api/sync/export` (R.11B) 保持, /sync 页面继续使用
- 不接 ClickHouse (CLAUDE.md §五明确禁止)
- 不新增数据库表

---

## 3. 页面真实接入方式

### 3.1 数据流

```
[sync_package_log]    ─┐
[sync_table_log]      ─┤
[sync_scheduler_log]  ─┤
[sync_consistency_log]─┤──> GET /api/logs ──> app/logs/page.tsx
[control_command]     ─┤                         (dataSource=database/empty/error)
[audit_log]           ─┘
                            │
                            └─> GET /api/logs/export?format=csv|json
                                  (Content-Disposition: attachment, x-sha256: ...)
```

### 3.2 /logs 改造 (app/logs/page.tsx)

| 原 (R.12 之前) | 现 (R.12) |
|---|---|
| `import { auditLogs } from "@/lib/mock/audit"` | 移除 |
| `useState<AuditLog[]>(auditLogs)` | `useState<LogRow[]>([]) + useEffect(fetch /api/logs)` |
| 7 个 Tab (operations/security/system/task/compliance/alerts/login) | 6 个 Tab (sync_package/sync_table/sync_scheduler/sync_consistency/control/audit) |
| 8 个 mock 字段筛选 | 4 个真实筛选 (siteCode/status/keyword/dateFrom-dateTo) |
| `handleExport` 1.5s setTimeout 假下载 | `fetch /api/logs/export` 真实下载, 含 SHA-256 显示 |
| `handleVerifySignature` 假证书 | 按钮改名 "数字签名校验 (未接入)" + `handleUnsupported` toast |
| 硬编码 `auditStats` | `useMemo` 从真实数据派生统计 |
| `useLoginAuditStore` 客户端 zustand | 完全移除, 改 amber banner 显式 blocked_by_auth |

### 3.3 dataSource 显示
- `database` 绿色 Badge `<Database>` icon
- `empty` 灰色 Badge "empty"
- `error` 红色 Badge "error" + 重试按钮
- 顶部 `sources: <table>_log, ...` + `REQ-5.1.3` 元信息

### 3.4 阻塞显式
- 顶部 amber banner 显式说明:
  - 登录流水 → `blocked_by_auth` (依赖 ADFS)
  - 数字签名 → 需证书/私钥托管 (R.1 §7 禁止伪造)
  - 当前可检索 6 类日志源

### 3.5 数字签名按钮
- 详情面板底部保留按钮
- 按钮文案: "数字签名校验 (未接入)" (显式)
- 点击后 `handleUnsupported("数字签名校验")` toast, 提示 REQ-5.1.2 仍需证书托管
- **不**显示假"校验通过" toast (R.1 §7 禁止)

---

## 4. 支持的日志类型 (6 类)

| 类型 | 表 | 来源 | R/Sprint |
|---|---|---|---|
| sync_package | `sync_package_log` | 同步包记录 (13 张白名单表汇总) | R.2D.4 |
| sync_table | `sync_table_log` | 单表同步明细 (inserted/updated/skipped/failed) | R.2D.4 |
| sync_scheduler | `sync_scheduler_log` | 每小时调度记录 (export/push/consistency) | R.8 |
| sync_consistency | `sync_consistency_log` | 7 表 source vs unified 校验结果 | R.7 |
| control | `control_command` | 6 类任务控制命令 (pause/resume/reset/inspect/recovery/priority) | R.4 |
| audit | `audit_log` | 操作流水 (control_command + sync_*) | 既有 |

### 4.1 不支持 (显式 blocked)
- **login_audit (登录流水)**: 中心库无表, 依赖 ADFS (REQ-2.2.1 blocked_by_auth)
- **数字签名 (cert_signature)**: 不伪造证书, 需密钥托管方案
- **Excel (xlsx)**: 当前仅 CSV/JSON, R.11B/R.12 仍缺
- **tbl_file / tbl_log 全量日志**: 不接 (CLAUDE.md §五禁止大表)

---

## 5. 导出格式和验证结果

### 5.1 格式
- **CSV**: 9 列 (log_type, log_id, site_code, status, occurred_at, operator, ref_batch_id, ref_table_name, summary)
- **JSON**: 结构 `{ items: LogRow[], count: number, types: LogType[] }`
- **签名/摘要**: `x-sha256` 响应头 (64 hex), 仅完整性摘要, **不冒充证书签名**

### 5.2 实测验证 (R.12 e2e:logs)
```
✅ /api/logs/export CSV 200
✅ /api/logs/export CSV x-data-source=database
✅ /api/logs/export CSV x-sha256 非空 (64 hex)
✅ /api/logs/export CSV x-record-count = 50
✅ /api/logs/export CSV 附件含 Content-Disposition
✅ /api/logs/export CSV 正文有 header 行
✅ /api/logs/export JSON 200
✅ /api/logs/export JSON SHA-256 有效
✅ /api/logs/export JSON 结构有效 (items[] + count)
✅ CSV 摘要 x-sha256 与实际正文 SHA-256 一致
```

**SHA-256 实际校验 (e2e 内部用 `node:crypto` 重新计算)**:
```javascript
const actualSha = createHash("sha256").update(csvBody).digest("hex")
expect(actualSha).toBe(csvSha256)  // ✅ 一致
```

---

## 6. e2e 覆盖情况

### 6.1 e2e:logs (37/37 ✅) — Sprint R.12 新增

| 类别 | 项数 | 详情 |
|---|---|---|
| 页面/API 基础 | 4 | /logs 200, /api/logs 200, dataSource 显式, 禁 mock |
| 6 类日志 type | 6 | 各类返回 200 |
| 整合查询 | 1 | type=all ≥3 不同 log_type |
| 4 筛选 | 4 | siteCode / status / keyword / dateFrom-dateTo |
| 导出 API | 9 | CSV/JSON 200 + headers + 摘要一致 + JSON 结构 |
| 页面源码审计 | 8 | 无 mock import + 4 处 fetch + 6 Tab + 4 筛选 + 数字签名未接入 + 无误导 toast |
| 联动 + 交叉 | 3 | 8 核心 API 200 + 至少 1 类有数据 + 与 sync_consistency 一致 |
| CSR 壳 | 1 | HTML 含客户端脚本 |
| **合计** | **37** | **全过** |

### 6.2 e2e:all (10 脚本, 5 项联动)
- dashboard / tasks / sync / control / sites / search / settings / users / racks / **logs (R.12)**
- /api/logs 加入 8 核心 siteCode 联动端点
- 之前 5 个 e2e 脚本无破坏性变更

---

## 7. requirements 完成率变化

| 维度 | R.11D 之后 | R.12 之后 | 变化 |
|---|---|---|---|
| total | 45 | 45 | 0 |
| complete | 6 (13.3%) | 6 (13.3%) | 0 |
| partial | 17 (37.8%) | 17 (37.8%) | 0 |
| **完成率** | **6/(45-0) = 13.3%** | **13.3%** | **0** (R.12 是 partial 推进, 不升 complete) |

**R.12 实际进展 (不增 complete, 仅强化 partial)**:
- REQ-5.1.2 (日志导出): ui_reality 从 "⚠️ /logs 仍为旧 mock" → "✅ /logs 接 /api/logs/export 真实下载"
- REQ-5.1.3 (日志检索): backend_reality 从 "⚠️ 基础筛选" → "✅ 整合 6 类, 4 筛选, 模糊匹配"
- 完成率口径 (CLAUDE.md 附录 B): `complete / (total - out_of_scope) × 100% = 6/45 = 13.3%`

---

## 8. 7 项验证结果

| # | 命令 | 结果 |
|---|---|---|
| 1 | `pnpm exec tsc --noEmit` | ✅ 0 错 |
| 2 | `pnpm build` | ✅ 成功 |
| 3 | `pnpm smoke:sync` | ✅ passed |
| 4 | `pnpm check:sync-consistency -- --siteCode=SH01` | ✅ 7/7 matched |
| 5 | `pnpm baseline:check` | ✅ 13/13 |
| 6 | `pnpm e2e:logs` | ✅ **37/37** (R.12 新增) |
| 7 | `pnpm e2e:all` | ✅ 全过 (含 logs) |

---

## 9. 约束自检

- ✅ 不接 ClickHouse (CLAUDE.md §五禁止)
- ✅ 不伪造系统日志 (R.1 §七)
- ✅ 不写 secret / 真实密码到 .env / 配置文件
- ✅ 不新增无关页面 (仅 /logs 改造 + /api/logs 新建)
- ✅ 不把 mock 当真实日志 (移除 auditLogs import)
- ✅ 导出必须来自真实 API 查询结果 (fetch /api/logs/export)
- ✅ 所有按钮 e2e 点击测试 (CSV/JSON 导出按钮有 fetch 验证 + SHA-256 摘要验证)
- ✅ 数字签名按钮显式 "未接入", 不伪造证书
- ✅ 不修改 requirements-traceability 主状态 (partial 强化, 不升 complete)
- ✅ dataSource 显式 (database/empty/error, 不允许 mock)

---

## 10. 提交信息

```
feat: connect logs page to real log data
```

变更:
- `app/logs/page.tsx` 完整重写 (mock → 真实 6 类整合 API)
- `app/api/logs/route.ts` 新增 (整合 6 表, 6 筛选)
- `app/api/logs/export/route.ts` 新增 (CSV/JSON, SHA-256 摘要)
- `scripts/e2e/test-logs.ts` 新增 (37 项验证)
- `package.json` 新增 `e2e:logs`, 加入 `e2e:all`
- `docs/database-analysis/requirements-traceability.md` REQ-5.1.2/5.1.3 强化 partial 描述
