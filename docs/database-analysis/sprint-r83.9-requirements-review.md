# Sprint R.83.9 Center DB Governance Requirements Review — 128 张业务表全部接入完成

## 1. Requirement IDs

- REQ-2.3 同步(收尾)
- REQ-3 资源管理(备份/磁盘/下载辅助)
- REQ-6.3 PG17 兼容

## 2. Requirement 原始文本

> 中心库应完成所有非大表业务表的接入,确保数据一致性和完整性。

## 3. Implementation

| 文件 | 改动 | 用途 |
|---|---|---|
| `databases/sprint-r83.9/01-final-8-tables.sql` | 新建 | 8 张 DDL(收尾) |
| `databases/sprint-r83.9/__tests__/ddl-self-check.ts` | 新建 | DDL 自检 |
| `databases/sprint-2b0/init-docker.sh` | 修改 | 加入 R.83.9 DDL 迁移 |
| `lib/sync/package-schema.ts` | 修改 | ALLOWED_PACKAGE_TABLES 133 → 141 |
| `lib/sync/dump/manifest.ts` | 修改 | DUMP_ALLOWED_TABLES 133 → 141 |
| `lib/sync/dump/ingest.ts` | 修改 | TABLE_MAPPING +8 |
| `lib/sync/package-dispatcher.ts` | 修改 | 8 dispatch handlers + REGISTRY |
| `app/api/sync/dump-now/route.ts` | 修改 | srcToUnified +8 |
| `scripts/sync/real-e2e-multi-site-test.ts` | 修改 | TABLE_MAPPING +8 |
| `app/api/final-batch-a/route.ts` | 新建 | CRUD 4 张 backup/disk 表 |
| `app/api/final-batch-b/route.ts` | 新建 | CRUD 4 张 wait-download 表 |
| `app/api/__tests__/r83.9-api-test.ts` | 新建 | 2 端点 self-check |
| `app/check/page.tsx` | 修改 | 加 2 Tabs(备份辅助 + 下载等待)共 17 tabs |
| `components/check/__tests__/self-check.ts` | 修改 | 加 tab 文字验证 |
| `scripts/audit/center-db-integrity.ts` | 修改 | R.83.9 范围(133-140)+ 8 overrides + fallback `R.84+` |
| `scripts/audit/__tests__/matrix-round-source.ts` | 修改 | R83_9_SOURCES + threshold 141 |
| `docs/database-analysis/r83-170-table-governance-matrix.md` | 修改 | 8 行 R.83.9 + 桶分布 `R.84+ = 0` |
| `package.json` | 修改 | `test:r83.9-whitelist` `test:r83.9-api` |

## 4. Backend Reality

**8 张收尾表全部就位**:ddl-self-check 8/8 PASS。

**总进度(R.83.1-R.83.9)**:
- 中心库 `unified_*`:**143 张**(13 既有 + 128 R.83.x + 2 unified_alerts/file_index)
- ALLOWED_PACKAGE_TABLES:**141**
- DUMP_ALLOWED_TABLES:**141**
- dispatcher handlers:**128 个**(覆盖全部 dispatcher 路由)
- 远端 11 个 R.83.x commits,全部推送成功
- 主分支 `7f81424` 未动

## 5. UI Reality

`/check` 17 Tabs 全部 read-only display。/sync 页"立即同步"按钮(R.83.3 Task 11)继续作为多站点真同步入口。

## 6. Verdict

**`partial`→ 业务表接入完成** — R.83.9 完成 128 张业务表全部接入目标(原 R.83.1-R.83.9 共 9 轮每轮 15 张,R.83.9 收尾 8 张)。剩余 blocker 不在本 Sprint 范围:

按 §附录 B 完成度公式:
- 业务表接入完成度:**128/128 = 100%**(目标达成)
- 中心库总表数:**143 张**
- 同步白名单:**141 项**
- 大表 29 张走 ES/ClickHouse(`blocked_by_external_system`):独立 Sprint
- 任务控制闭环:`blocked_by_site_change`(需站点 app 配合)
- 真实 RBAC 拦截:`blocked_by_auth`(需 Sprint 5.x 解锁)

## 10. 不变量(全部满足)

| 不变量 | 验证 |
|---|---|
| 业务表 128 张全部接入 | ✅ matrix doc 15 + 桶分布 `R.84+ = 0` |
| `unified_*` ≥ 135(预期 143) | ✅ 143 张 |
| `ALLOWED_PACKAGE_TABLES` = 141 | ✅ |
| `DUMP_ALLOWED_TABLES` = 141 | ✅ |
| 主分支未污染 | ✅ `git rev-parse --short main` = `7f81424` |
| 远端推送成功 | ✅ |
| 多站点真同步基础设施 | ✅ Playwright 真实点击 + UNIQUE 隔离 |
| UI 复用 /check(17 Tabs) | ✅ 不新建页面,优先复用 |