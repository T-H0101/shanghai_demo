# Sprint R.13 — Unified Export Framework Post-Review

> **Sprint**: R.13 — 统一导出框架 (lib/export + 5 端点 + 4 页面 + 审计落库)
> **日期**: 2026-06-12
> **范围**: 抽象 3 个分散 export 的共性 + 新增 /api/users/export + audit_log 落库 + 4 页面 format 下拉
> **状态**: ✅ 完成 (e2e:exports 173/173 + e2e:all 全绿)

---

## 1. R.13 之前的导出现状 (审计)

### 1.1 3 个分散端点, 3 套不一致的实现

| 端点 | header 命名 | SHA-256 算法 | sanitize | audit | XLSX | format 协商 |
|---|---|---|---|---|---|---|
| `/api/racks/export` | `X-Content-SHA256` / `X-Export-Record-Count` | createHash 内联 | 无 | 无 | 无 | 无 (仅 CSV) |
| `/api/sync/export` | `X-Content-SHA256` / `X-Export-Record-Count` / `X-Export-Kind` | createHash 内联 | 无 | 无 | 无 | csv/json |
| `/api/logs/export` | `x-sha256` / `x-record-count` (R.12 新名) | createHash 内联 | 无 | 无 | 无 | csv/json |

### 1.2 三套 csvEscape 各写一份, 三套头部混乱
- `racks/export` 用 `csvCell()` (RFC 4180)
- `sync/export` 用 `csvCell()` (含 object → JSON.stringify)
- `logs/export` 用 `csvEscape()` (LF 而非 CRLF)

### 1.3 风险
- 没有 sanitize → 若数据库新增 password 字段会直接泄漏
- 没有 audit → 无法追溯谁导了什么
- 头部名称不统一 → 前端/e2e 难复用

---

## 2. 新增/修改 API

### 2.1 新增框架 `lib/export/`

| 文件 | 行数 | 职责 |
|---|---|---|
| `lib/export/index.ts` | ~120 | `buildExport()` 入口 + `exportHeaders()` |
| `lib/export/csv.ts` | ~30 | RFC 4180 CSV + CRLF |
| `lib/export/json.ts` | ~40 | 稳定 JSON schema (exportType/dataSource/items) |
| `lib/export/xlsx.ts` | ~40 | XLSX not_implemented 显式 |
| `lib/export/sha256.ts` | ~12 | 完整性摘要 (非证书签名) |
| `lib/export/manifest.ts` | ~40 | ExportManifest 类型 + builder |
| `lib/export/sanitize.ts` | ~80 | 字段黑名单 + 值 pattern 黑名单 |
| `lib/export/audit.ts` | ~40 | recordExport() → audit_log |
| `lib/export/next-response.ts` | ~30 | NextResponse 适配器 |
| **总计** | **~430 行** | 单一框架 |

### 2.2 重构 3 个旧端点 → 统一框架

| 端点 | refactor 前 | refactor 后 |
|---|---|---|
| `/api/racks/export` | 104 行 (内联 csvCell + createHash) | 90 行 (3 行 buildExport + 1 行 recordExport) |
| `/api/sync/export` | 178 行 (内联 csvCell + createHash + 4 kind) | 130 行 (定义 4 kind, 3 行 buildExport) |
| `/api/logs/export` | 267 行 | 220 行 (保留 6 类查询, CSV/JSON 主体改用框架) |

### 2.3 新增 `/api/users/export`

- 白名单列 13 个 (user_id/username/.../created_at), 不含 raw_data jsonb
- 4 筛选: siteCode / role / status / keyword
- format=csv/json/xlsx
- 自动 sanitize + audit + manifest

---

## 3. 支持的导出对象

| 对象 | 数据源 | 端点 | format | siteCode 过滤 |
|---|---|---|---|---|
| **devices** | unified_devices | `/api/racks/export` | csv/json/xlsx | ✅ |
| **sync_package** | sync_package_log | `/api/sync/export?kind=package` | csv/json/xlsx | ✅ |
| **sync_table** | sync_table_log | `/api/sync/export?kind=table` | csv/json/xlsx | ✅ |
| **sync_scheduler** | sync_scheduler_log | `/api/sync/export?kind=scheduler` | csv/json/xlsx | ✅ |
| **sync_consistency** | sync_consistency_log | `/api/sync/export?kind=consistency` | csv/json/xlsx | ✅ |
| **users** | unified_users (R.13 新增) | `/api/users/export` | csv/json/xlsx | ✅ |
| **logs (多源整合)** | 6 类日志 (R.12) | `/api/logs/export` | csv/json/xlsx | ✅ |

---

## 4. 支持的格式

| format | 状态 | 说明 |
|---|---|---|
| **CSV** | ✅ complete | RFC 4180, CRLF, UTF-8, BOM-less |
| **JSON** | ✅ complete | 稳定 schema (exportType/dataSource/columns/items[]) |
| **XLSX** | ⚠️ partial / blocked_by_dependency_policy | 显式 HTTP 501 + 提示 |

### 4.1 XLSX 不接入的理由 (R.13 决策)

1. **CLAUDE.md 核心约束**: 不引入无关重依赖 (xlsx ~700KB, exceljs ~1.1MB)
2. **R.1 §7 禁伪造**: 不允许用 `.xlsx` 文件名包 CSV/JSON 内容
3. **requirements.md §5.1**: "Excel/CSV/JSON 三选", CSV/JSON 已真实满足主路径
4. **R.13 处理**: HTTP 501 + `code=not_implemented` + 显式 message, 前端 toast "导出格式暂未接入"

### 4.2 XLSX 真正接入路径 (R.14+ 候选)

- 引 `exceljs` 走真实 XLSX 流式生成 (需领导批准依赖)
- 或基于 OOXML zip + `archiver` 自实现 (需引 zip 依赖)

---

## 5. SHA-256 manifest 说明

### 5.1 摘要算法
```typescript
createHash("sha256").update(body, "utf8").digest("hex")  // 64 hex
```
- 仅校验**正文完整性**, **不是数字签名** (无私钥/证书)
- 同一查询条件 + 同一数据快照 → 同一 SHA-256 (可重放)
- R.1 §7: 禁止把 SHA-256 摘要写成"数字签名校验通过"

### 5.2 Manifest 结构 (响应头 `x-manifest` base64 编码)
```typescript
interface ExportManifest {
  exportType: string         // e.g. "devices"
  format: "csv" | "json" | "xlsx"
  dataSource: string         // e.g. "unified_devices" (不允许 'mock')
  rowCount: number
  sha256: string             // 64 hex
  filename: string
  siteCode: string | null    // 'SH01' 或 null (全站)
  filters: Record<string, string|null>
  generatedAt: string        // ISO timestamp
  generator: "unified-disc-platform/lib/export@R.13"
}
```

### 5.3 响应头 (R.13 同时输出新旧名兼容)
| header | 值 | 用途 |
|---|---|---|
| `x-sha256` | 64 hex | R.13 新名 (logs/export 已用) |
| `x-content-sha256` | 64 hex | 旧 racks/sync e2e 兼容 |
| `x-record-count` | 数字 | R.13 新名 |
| `x-export-record-count` | 数字 | 旧 racks/sync e2e 兼容 |
| `x-data-source` | 真实表名 | **禁 'mock'** |
| `x-export-type` | exportType | R.13 新增 |
| `x-export-format` | csv/json/xlsx | R.13 新增 |
| `x-export-kind` | exportType | 旧 sync 端点兼容 |
| `x-manifest` | base64 JSON | R.13 新增 |
| `Content-Disposition` | `attachment; filename=...` | 强制下载 |

---

## 6. 导出审计记录

### 6.1 落地点: audit_log 表 (现有, 不新建)

```typescript
INSERT INTO audit_log (
  command_no,    // 'EXPORT-' + sha256.slice(0,8) + '-' + timestamp
  action,        // 'export'
  target_table,  // exportType (devices/users/...)
  target_id,     // filename (含 timestamp, 唯一)
  after_json,    // 完整 ExportManifest JSON
  site_code,     // siteCode || '__ALL__'
  actor,         // 'system' (ADFS 未接入, R.1 §7 不伪造身份)
  result         // 'success'
)
```

### 6.2 失败行为
- 写入失败仅 `console.warn`, **不阻断导出本身** (导出已 200 返回)
- HTTP 501 (XLSX) **不写 audit** (导出未发生)

### 6.3 e2e 验证 (test-exports.ts)
- 调用 `/api/users/export` 前查 audit_log count
- 调用后查 count + 1
- 抽样最新一条: target_table 非空 / actor='system' / result='success' / after_json 含 manifest

实测 (R.13 上线后): **before=22 → after=23** ✅

---

## 7. 前端按钮和 e2e 覆盖

### 7.1 4 页面接入

| 页面 | 格式下拉 | 按钮 selector | toast 文案 (合规) |
|---|---|---|---|
| `/logs` | csv/json/xlsx 三按钮 | 按钮文本 | "导出完成 + SHA-256 摘要已生成" |
| `/sync` | sync-export-format Select | `[data-testid=sync-export]` | "导出完成 + SHA-256 摘要已生成" |
| `/racks` | racks-export-format Select | `[data-testid=racks-export]` | "导出完成 + SHA-256 摘要已生成" |
| `/users` | users-export-format Select | `[data-testid=users-export]` | "导出完成 + SHA-256 摘要已生成" |

### 7.2 toast 禁用措辞 (R.1 §7)
- ❌ "签名完成" / "数字签名通过" / "证书校验通过"
- ✅ "导出完成 + SHA-256 摘要已生成"
- ✅ "导出格式暂未接入" (XLSX 501)

### 7.3 e2e:exports 173 项
- 7 端点 × {CSV/JSON/XLSX + siteCode + secret 检查} ≈ 21 项/端点 → 147 项
- audit_log 5 项
- 前端 selector 10 项
- 措辞合规 4 项 (4 页面 × 1)
- 其他附加 7 项

---

## 8. Secret 泄漏检查

### 8.1 双层防护 (lib/export/sanitize.ts)

#### 字段名黑名单 (子串匹配, 大小写不敏感)
```
password / passwd / secret / token / api_key / apikey /
private_key / privatekey / auth_token / session_id /
credential / database_url / db_url / connection_string / conn_str
```

#### 值内容黑名单 (regex)
```
postgres(?:ql)?:\/\/[^@\s]+:[^@\s]+@   # PG 连接串含密码
mysql:\/\/[^@\s]+:[^@\s]+@             # MySQL
mongodb(?:\+srv)?:\/\/[^@\s]+:[^@\s]+@ # Mongo
Bearer\s+[A-Za-z0-9._-]{20,}           # Bearer token
sk-[A-Za-z0-9]{20,}                    # OpenAI 类
xox[a-z]-[A-Za-z0-9-]{20,}             # Slack
```

匹配的值 → 替换为 `"[REDACTED]"`, 字段名命中 → 整列剔除。

### 8.2 e2e 实测 (test-exports.ts)
- 7 端点 × CSV/JSON 各 1 项检查 = **14 项**
- 全部 0 命中 ✅

### 8.3 已知限制
- 不扫描嵌套 JSON 字段内的 secret (sync_consistency.result_json 等)
- 用户自定义字段 (raw_data jsonb) **/api/users/export 已明确不导出**
- 后续如新增端点导出嵌套 jsonb, 需扩 sanitize 深度

---

## 9. requirements 完成率变化

| 维度 | R.12 之后 | R.13 之后 | 变化 |
|---|---|---|---|
| total | 45 | 45 | 0 |
| complete | 6 (13.3%) | 6 (13.3%) | 0 |
| partial | 17 (37.8%) | 18 (40.0%) | **+1** (REQ-5.1.2 推进, REQ-4.1.2 / REQ-4.3.2 强化) |
| **完成率** | **13.3%** | **13.3%** | **0** (R.13 是 partial 推进, 不升 complete) |

### R.13 推进的需求 (partial 强化, 不升 complete)

| REQ ID | 状态 | R.13 推进点 |
|---|---|---|
| REQ-5.1.2 (日志导出) | partial | csv/json 真实, **xlsx 显式 partial: blocked_by_dependency_policy** |
| REQ-5.1.3 (日志检索) | partial | unchanged (R.12) |
| REQ-4.1.2 (检索结果导出) | partial | 新框架可复用, /api/users/export 落地 |
| REQ-4.3.2 (盘笼信息导出) | partial | 旧 /api/racks/export 升级框架版, 3 格式 |
| REQ-2.3.3 (同步链路) | partial | 4 类 sync log 导出统一头部 |
| **新增标注**: blocked_by_dependency_policy | — | XLSX 不引入 xlsx/exceljs 依赖 |

### 不升 complete 的理由 (CLAUDE.md §一)
- REQ-5.1.2 明确要 Excel + 数字签名 → 二者均未真实 → 仍 partial
- REQ-4.1.2 真实数据导出但**未做大文件分片** (5000 行硬上限)
- 完成率口径 (CLAUDE.md 附录 B): `complete / (45 - out_of_scope) × 100% = 6/45 = 13.3%`

---

## 10. 7 项验证结果 (实测)

| # | 命令 | 结果 |
|---|---|---|
| 1 | `pnpm exec tsc --noEmit` | ✅ 0 错 |
| 2 | `pnpm build` | ✅ 成功 |
| 3 | `pnpm smoke:sync` | ✅ passed |
| 4 | `pnpm check:sync-consistency -- --siteCode=SH01` | ✅ 7/7 matched |
| 5 | `pnpm baseline:check` | ✅ 13/13 |
| 6 | `pnpm e2e:exports` (R.13 新增) | ✅ **173/173** |
| 7 | `pnpm e2e:logs` | ✅ 37/37 (R.12 不破坏) |
| 8 | `pnpm e2e:sync` | ✅ (不破坏) |
| 9 | `pnpm e2e:racks` | ✅ (不破坏) |
| 10 | `pnpm e2e:all` | ✅ 全过 (11 脚本含 exports) |

---

## 11. 约束自检 (R.13 硬约束)

- ✅ 不接 ClickHouse
- ✅ 不伪造系统日志
- ✅ 不写 secret / 真实密码到 .env / 配置文件
- ✅ 不新增无关页面 (4 个已有页面接按钮)
- ✅ 不引入 xlsx/exceljs 重依赖 (显式 501)
- ✅ XLSX 不伪装为 CSV 内容 (R.1 §7)
- ✅ 导出来自真实 API + 真实 DB 查询 (无 mock fallback)
- ✅ 所有按钮 e2e 点击测试 (3 selector + logs 按钮文本)
- ✅ toast 文案合规 (无伪签名, 无"已暂停"伪状态)
- ✅ 不修改 requirements-traceability 主状态 (partial 强化, 不升 complete)
- ✅ dataSource 显式 (database 真实 / not_implemented XLSX, 禁 mock)
- ✅ audit_log 真实落库 (e2e count +1 验证通过)

---

## 12. 提交信息

```
feat: add unified export framework
```

变更摘要:
- `lib/export/` 新增 9 文件 (~430 行) — 框架核心
- `app/api/racks/export/route.ts` refactor (104 → 90 行)
- `app/api/sync/export/route.ts` refactor (178 → 130 行)
- `app/api/logs/export/route.ts` refactor (267 → 220 行)
- `app/api/users/export/route.ts` 新增 (~130 行)
- `app/sync/page.tsx` + `app/racks/page.tsx` + `app/users/page.tsx` 加 format 下拉
- `app/logs/page.tsx` 加 XLSX 按钮 + 501 处理
- `scripts/e2e/test-exports.ts` 新增 (~280 行, 173 项验证)
- `package.json` e2e:exports + e2e:all 链
- `docs/database-analysis/requirements-traceability.md` REQ-5.1.2/4.1.2/4.3.2 强化
- `docs/database-analysis/sprint-r.13-requirements-review.md` 严格审查 (本文档)
- `docs/summary/PROJECT_STATUS.md` + `docs/summary/ROADMAP.md` R.13 段
