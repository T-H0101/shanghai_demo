# Sprint R.83.5 — 数据接收 + 告警 + 媒体族 15 张业务表接入设计(简版)

> 沿用 R.83.4 模板。

**Goal:** 中心库 `unified_*` 从 75 张扩到 90 张(R.83.5 +15)。

**Architecture:** DDL → 白名单 73→88 → dispatcher → API(reuse /check 加 tab)→ dump manifest + e2e → audit matrix R.83.5。

**Base branch:** `codex/center-db-governance` HEAD = `6ecb59a`(R.83.4 review)。

---

## 1. 选定的 15 张表(全部为单 PK 表)

| # | 源表 | 中心库表 | 大小 |
|---:|---|---|---:|
| 1 | `tbl_data_receive_list` | `unified_data_receive_lists` | 16kB |
| 2 | `tbl_data_receive_log` | `unified_data_receive_logs` | 16kB |
| 3 | `tbl_data_receive_tasks` | `unified_data_receive_tasks` | 16kB |
| 4 | `tbl_data_classification` | `unified_data_classifications` | 64kB |
| 5 | `tbl_early_warning` | `unified_early_warnings` | 16kB |
| 6 | `tbl_early_warning_feedback` | `unified_early_warning_feedbacks` | 16kB |
| 7 | `tbl_disc_print` | `unified_disc_prints` | 24kB |
| 8 | `tbl_disc_inspect` | `unified_disc_inspects` | 16kB |
| 9 | `tbl_disc_type` | `unified_disc_types` | 32kB |
| 10 | `tbl_evidence_details` | `unified_evidence_details` | 16kB |
| 11 | `tbl_evidence_record_drp` | `unified_evidence_record_drps` | 16kB |
| 12 | `tbl_verify_details` | `unified_verify_details` | 16kB |
| 13 | `tbl_verify_record_drp` | `unified_verify_record_drps` | 16kB |
| 14 | `tbl_download_record` | `unified_download_records` | 16kB |
| 15 | `tbl_upload_record` | `unified_upload_records` | 16kB |

**命名规则**:`unified_<stripped>`,无 suffix。

## 2. 强约束(沿用 R.83.3/R.83.4)

- 总控不引用 restore 库
- DDL 严格 6 列标准 + UNIQUE(source_site_id, source_record_id) + GIN(raw_data) + B-tree(source_site_id) + COMMENT ON TABLE
- 多站点隔离:UNIQUE(source_site_id, source_record_id) 保证
- 复用 /check 页(已有 7 tabs,再加 2 tabs 共 9 tabs)

## 3. 不在范围

- ❌ 真实控制闭环
- ❌ 大表 tbl_file_*/tbl_folder_*
- ❌ 剩余 63 张 R.83.6+ 业务表
- ❌ RBAC 拦截

## 4. 文件结构

### 新建
- `databases/sprint-r83.5/01-data-warning-media-tables.sql`
- 7 个 API 端点(按族聚合)
- `scripts/test-r83.5-whitelist.ts`
- `scripts/sync/real-e2e-r83.5-test.ts`

### 修改
- `databases/sprint-2b0/init-docker.sh`
- `lib/sync/package-schema.ts`(73 → 88)
- `lib/sync/dump/manifest.ts`(73 → 88)
- `lib/sync/dump/ingest.ts`(73 → 88)
- `lib/sync/package-dispatcher.ts`(15 handlers)
- `app/api/sync/dump-now/route.ts`(15 mappings)
- `scripts/sync/real-e2e-multi-site-test.ts`(15 mappings)
- `app/check/page.tsx`(加 2 Tabs)
- `components/check/__tests__/self-check.ts`
- `scripts/audit/center-db-integrity.ts`(R.83.5 range)
- `docs/database-analysis/r83-170-table-governance-matrix.md`(15 行 + 桶分布 68→53)
- `README.md` §5.3.9
- `docs/summary/PROJECT_STATUS.md`
- `docs/summary/ROADMAP.md`
- `package.json`
- `docs/database-analysis/sprint-r83.5-requirements-review.md`

## 5. 不变量

- `unified_*` ≥ 90
- `ALLOWED_PACKAGE_TABLES` = 88
- `DUMP_ALLOWED_TABLES` = 88
- `pnpm audit:center-db --strict --matrix` exit 0
- 多站点真同步
- 主分支未污染
- R.83.5 requirements review 产出