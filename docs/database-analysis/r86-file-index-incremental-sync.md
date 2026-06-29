# R.86 文件索引增量同步 (watermark / tombstone / retry)

> **目的**: 把 R.85 的 "read bounded sample -> index to ES" 升级为 **watermark 增量同步 + tombstone + retry/dead-letter 状态机**, 覆盖 R.84 file_index_es 全 29 张表。
>
> **依据**: `requirements.md §5.2` (索引需定期更新, 支持增量更新) + §2.3 (同步策略 增量/定时) + ADR 0001 (tbl_file*/tbl_folder* 走 ES 禁入 PG 全量)。
>
> **状态**: `complete` (本 Sprint 落地 DDL + 状态机 + 仓储 + 单表 worker + bootstrap; 真生产调度 cron 由 R.87 接管)。

---

## 0. 范围

**做**:
- `file_index_jobs` 中心库表 (DDL + 约束 + 索引)。
- 6 态状态机 (`pending` / `running` / `succeeded` / `failed` / `dead_letter` / `tombstoned`) + 合法转换表。
- 仓储层 (`createFileIndexJobRepository`) — 中心库 PG 读写; 不允许散落 SQL。
- 单表 worker (`scripts/index/file-index-job-runner.ts`) — 单 (site, table) 单次跑。
- 启动引导 (`scripts/index/file-index-job-bootstrap.ts`) — 给 N 站点 × 29 表插默认行。
- watermark 列: `id` (默认) / `create_date` / `updated_at` / `insert_time`。
- tombstone 流程 (R.89 inventory 标记下线后调用 `repo.tombstone()`)。

**不做** (留给 R.87):
- 监控告警 / 健康检查 endpoint。
- cron 调度器 (`scheduler:file-index`) — R.87 接管。
- 死信重放 CLI。
- 权限过滤强化 (按 dept_id / site 过滤) — §4.1 校验约束, R.87。

---

## 1. DDL 概要 (databases/sprint-r86/01-file-index-jobs.sql)

```sql
CREATE TABLE file_index_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL,
  last_watermark_column VARCHAR(50) NOT NULL DEFAULT 'id',
  last_watermark_value TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 5,
  next_retry_at TIMESTAMPTZ,
  last_error TEXT,
  last_run_at TIMESTAMPTZ,
  last_run_duration_ms INTEGER,
  last_scanned INTEGER,
  last_indexed INTEGER,
  last_failed INTEGER,
  last_tombstoned INTEGER,
  total_runs INTEGER NOT NULL DEFAULT 0,
  total_indexed BIGINT NOT NULL DEFAULT 0,
  total_failed BIGINT NOT NULL DEFAULT 0,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  schedule_interval_seconds INTEGER NOT NULL DEFAULT 3600,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT file_index_jobs_site_table_uniq UNIQUE (source_site_id, source_table),
  CONSTRAINT file_index_jobs_status_check CHECK (
    status IN ('pending', 'running', 'succeeded', 'failed', 'dead_letter', 'tombstoned')
  ),
  CONSTRAINT file_index_jobs_watermark_column_check CHECK (
    last_watermark_column IN ('id', 'create_date', 'updated_at', 'insert_time')
  ),
  CONSTRAINT file_index_jobs_retry_nonneg CHECK (retry_count >= 0 AND max_retries >= 0)
);
```

---

## 2. 状态机 (lib/jobs/file-index-job-state.ts)

```
pending --(worker claim)--> running
pending --(R.89 tombstone)--> tombstoned [terminal]

running --(全部成功)--> succeeded
running --(部分失败)--> failed
running --(致命错误)--> dead_letter

failed --(retry 触发)--> running
failed --(retry_count+1 >= max_retries)--> dead_letter

succeeded --(下次调度)--> running
succeeded --(R.89 tombstone)--> tombstoned [terminal]

dead_letter --(人工 resetDeadLetter)--> pending
dead_letter --(确认不再跑)--> tombstoned [terminal]
```

- `tombstoned` 是终态, 不允许任何转换出去。
- `decideAfterFailure(retry_count, max_retries)` 集中判定, 不允许散落。

---

## 3. 仓储层 (lib/jobs/file-index-job.ts)

| 方法 | 用途 |
|---|---|
| `listAll()` | 全量读取 (admin UI 用) |
| `findBySiteTable(site, table)` | 单行查询 |
| `ensureSeedRows(site, tables)` | 启动引导 (idempotent) |
| `claimForRun(site, table)` | worker 抢锁 (`pending` / due `failed` / due `succeeded` -> `running`) |
| `reportRun(...)` | 报告结果 (succeeded / failed / dead_letter / tombstoned) |
| `reportFailure(...)` | 失败上报, 自动判 retry vs dead_letter |
| `resetDeadLetter(site, table)` | 人工解锁死信 |
| `tombstone(site, table, reason)` | R.89 标记下线 |

**关键约束**:
- 一切状态转换走 `canTransition()` 守卫。
- 一切失败判定走 `decideAfterFailure()`。
- 不允许直接拼 SQL 改 `status`; 一律走仓储。

---

## 4. 单表 worker (scripts/index/file-index-job-runner.ts)

执行流程:

1. **校验表**: 必须属于 R.84 `FILE_INDEX_ES_TABLES` (29 张); 否则 `exit 2`。
2. **种子行**: 调 `repo.ensureSeedRows(site, [table])` (idempotent)。
3. **抢锁**: `claimForRun(site, table)` -> 行级 UPDATE, 仅 `pending` / 到期 `failed` / 到期 `succeeded` 可抢。
4. **watermark SELECT**: 按 `last_watermark_column` + `last_watermark_value` 取增量行; 源表/列读取失败必须进入 `failed` / `dead_letter`, 不允许伪装成空结果。
5. **映射**: 不同表走不同分支 (`tbl_folder*` / `tbl_file*` / best-effort)。
6. **ES 索引**: `SearchPort.indexFiles(docs)` (R.85 端口, 落 ADR 0002)。
7. **推进 watermark**: 取最后成功行的 id / updated_at 写回。
8. **上报**: `reportRun` (succeeded) 或 `reportFailure` (failed/dead_letter)。

**输出**: `JSON { site, table, status, scanned, indexed, failed, duration_ms, watermark }`

**禁止**:
- 不允许在 worker 内直接拼 SQL 改 `file_index_jobs` (走 repo)。
- 不允许把 `tbl_file*` / `tbl_folder*` 之外的表写入 ES (违反 ADR 0001)。

---

## 5. 启动引导 (scripts/index/file-index-job-bootstrap.ts)

```bash
pnpm tsx scripts/index/file-index-job-bootstrap.ts --sites SH01,BJ02
```

输出 `inserted / skipped / total_jobs`。开发阶段先跑一次, 后续 N 站点接入按 R.88 走。

---

## 6. 29 张表覆盖矩阵

| Source Table | Watermark Column (default) | Schema Branch |
|---|---|---|
| `tbl_file` | `id` | full |
| `tbl_folder` | `id` | full |
| `tbl_file_1` / `tbl_file_1_a` / `tbl_file_2` / `tbl_file_2_a` / `tbl_file_3` / `tbl_file_3_a` | `id` | full (同 tbl_file) |
| `tbl_file_1_empty` / `tbl_file_1_error` / `tbl_file_1_repeat` / `tbl_file_2_empty` / `tbl_file_2_error` / `tbl_file_2_repeat` / `tbl_file_3_empty` / `tbl_file_3_error` / `tbl_file_3_repeat` | `id` | full (同 tbl_file; 开发环境多为空) |
| `tbl_file_10000` / `tbl_file_10001` / `tbl_file_10002` | `id` | full (历史大表, schema 与 tbl_file 同) |
| `tbl_file_parts` / `tbl_file_path_archive` / `tbl_file_path_restore` / `tbl_file_recover_info` / `tbl_file_stat` | `id` | best-effort (只取 id, 走最小契约) |
| `tbl_folder_1` / `tbl_folder_2` / `tbl_folder_3` / `tbl_folder_10000` | `id` | full (同 tbl_folder) |

---

## 7. 验收

```bash
# 1. 应用 DDL
docker exec -i unified_disc_postgres psql -U unified -d unified_disc_platform \
  < databases/sprint-r86/01-file-index-jobs.sql

# 2. 验证表存在 + 约束生效
docker exec -i unified_disc_postgres psql -U unified -d unified_disc_platform \
  -c "\d+ file_index_jobs"

# 3. bootstrap seed
pnpm tsx scripts/index/file-index-job-bootstrap.ts --sites SH01

# 4. 单表 worker (使用真实 ES URL 或 blocked 路径)
pnpm tsx scripts/index/file-index-job-runner.ts --site SH01 --table tbl_file --batch 50

# 5. e2e: bootstrap + 1 table run, expect JSON output, exit 0
```

---

## 8. 留待 R.87 接管

| 项 | 接管点 |
|---|---|
| 调度 cron (`scheduler:file-index`) | R.87 生产硬化; R.86 已提供 due `succeeded` / due `failed` 抢锁语义 |
| 监控告警 (status=dead_letter / status=stuck_running > 30m) | R.87 |
| 死信重放 CLI | R.87 |
| `last_run_duration_ms` 阈值告警 | R.87 |
| `permission_filter_hardening` (按 dept / site 过滤) | R.87 + §4.1 业务 |
| 增量键按 `updated_at` 替换默认 `id` (运营决策) | R.87 |

---

## 9. 与 R.84 / R.85 的边界

- R.84 file_index_es 29 张分类保持不变; R.86 不修改矩阵。
- R.85 `SearchPort` 不变; R.86 仅复用 `indexFiles()`。
- R.85 R.85 e2e (`e2e:search-r85`) 继续通过; R.86 新增 `e2e:file-index-r86`。
- R.87 接管监控/告警/cron; R.86 不实现。

---

_End of R.86 file index incremental sync design._
