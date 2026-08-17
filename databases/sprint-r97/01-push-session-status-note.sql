-- ============================================================
-- Sprint R.97 - 业务分阶段推送（push-session）状态说明
-- ============================================================
-- sync_package_log.status 为 VARCHAR，无 CHECK；新增语义值无需改列。
-- 新增状态:
--   receiving  — begin 之后、commit 之前，可多次 push/table
--   partial    — commit 时部分表失败
--   abandoned  — 预留：超时未 commit（后续调度清理）
-- ============================================================

COMMENT ON COLUMN sync_package_log.status IS
  'pending|receiving|running|success|partial|failed|skipped|duplicated|abandoned';
