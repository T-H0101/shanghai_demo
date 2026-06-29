-- ============================================================
-- Sprint R.86 — file_index_jobs (增量同步 job 编排表)
-- ============================================================
--
-- 目的:
--   把 R.85 的 "read bounded sample -> index to ES" 升级为
--   "watermark-based incremental + tombstone + retry/dead-letter" 状态机。
--
-- 边界 (per CLAUDE.md §四 + ADR 0001):
--   - 这张表是**中心库自己的调度账本**, 不属于站点 schema。
--   - 站点 schema 变更由 §4.2 沿用 blocked_by_source_schema / blocked_by_site_change,
--     不在此 Sprint 触碰。
--   - 状态机由 lib/jobs/file-index-job-state.ts 集中定义, 不允许散落。
--
-- 设计原则 (与 file_index_es 29 张表一一对应):
--   (source_site_id, source_table) UNIQUE
--     -> 每张站点端的 tbl_file*/tbl_folder* 在中心库有且仅有一行 watermark 记录。
--   (last_watermark_value, last_watermark_column)
--     -> 增量同步游标; 列名 = tbl_file*/tbl_folder* 上的增量键
--        (主表用 id, 部分扩展表用 create_date / updated_at)。
--   status: 6 态机
--     pending | running | succeeded | failed | dead_letter | tombstoned
--   retry_count + next_retry_at
--     -> 失败重试调度; 超过 max_retries 自动转 dead_letter。
--   last_error / last_run_at / last_scanned / last_indexed
--     -> 运维可观测性; R.87 监控硬化直接消费。
--
-- 这是 DEVELOPMENT-stage DDL:
--   - Sprint R.86 落地 (创建表 + 索引 + 注释)。
--   - 真正接入 indexer 由 R.86 后续任务执行。
--   - 生产硬化 (监控告警 / 死信重放 / cron) 由 R.87 接管。
-- ============================================================

CREATE TABLE IF NOT EXISTS file_index_jobs (
  -- 1. 主键与唯一约束
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 2. 范围 (与 R.84 file_index_es 29 张表 + 站点一一对应)
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL,

  -- 3. watermark (增量游标)
  --    列名必须是源表上存在的列: id | create_date | updated_at | insert_time
  last_watermark_column VARCHAR(50) NOT NULL DEFAULT 'id',
  --    游标值统一存为字符串; adapter 根据 column 类型做 cast
  last_watermark_value TEXT,

  -- 4. 状态机 (6 态)
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  --    pending      : 尚未启动
  --    running      : 正在执行 (worker 持有行级锁)
  --    succeeded    : 本次执行完成 (last_run_at 内)
  --    failed       : 本次执行失败, 等待 retry (next_retry_at 内)
  --    dead_letter  : 超过 max_retries, 进入死信, 需人工介入
  --    tombstoned   : 源表下线 / R.89 弃用, 停止再跑

  -- 5. retry 状态
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 5,
  next_retry_at TIMESTAMPTZ,
  last_error TEXT,

  -- 6. 运行时观测 (本 Sprint 写入, R.87 监控消费)
  last_run_at TIMESTAMPTZ,
  last_run_duration_ms INTEGER,
  last_scanned INTEGER,
  last_indexed INTEGER,
  last_failed INTEGER,
  last_tombstoned INTEGER,

  -- 7. 累计观测
  total_runs INTEGER NOT NULL DEFAULT 0,
  total_indexed BIGINT NOT NULL DEFAULT 0,
  total_failed BIGINT NOT NULL DEFAULT 0,

  -- 8. 调度
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  schedule_interval_seconds INTEGER NOT NULL DEFAULT 3600,

  -- 9. 时间戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 10. 约束
  CONSTRAINT file_index_jobs_site_table_uniq UNIQUE (source_site_id, source_table),
  CONSTRAINT file_index_jobs_status_check CHECK (
    status IN ('pending', 'running', 'succeeded', 'failed', 'dead_letter', 'tombstoned')
  ),
  CONSTRAINT file_index_jobs_watermark_column_check CHECK (
    last_watermark_column IN ('id', 'create_date', 'updated_at', 'insert_time')
  ),
  CONSTRAINT file_index_jobs_retry_nonneg CHECK (retry_count >= 0 AND max_retries >= 0)
);

COMMENT ON TABLE file_index_jobs IS
  'R.86 incremental file index job ledger — one row per (site, file_index_es table). '
  'Status machine + watermark + retry/dead-letter tracked here; indexer reads/writes.';

-- 调度扫描: 拉取可执行行 (worker 用)
CREATE INDEX IF NOT EXISTS idx_file_index_jobs_pending
  ON file_index_jobs (next_retry_at)
  WHERE status IN ('pending', 'failed', 'succeeded') AND is_enabled = TRUE;

-- 状态聚合 (监控用)
CREATE INDEX IF NOT EXISTS idx_file_index_jobs_status
  ON file_index_jobs (status, updated_at DESC);

-- 站点过滤 (多站点运维)
CREATE INDEX IF NOT EXISTS idx_file_index_jobs_site
  ON file_index_jobs (source_site_id, status);
