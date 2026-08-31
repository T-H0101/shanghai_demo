-- Sprint R.101: 站点预警投影列补齐
-- 对齐站点 tbl_early_warning.status / lib_id 与 feedback.user_name，便于跨站只读列表筛选。

ALTER TABLE unified_early_warnings
  ADD COLUMN IF NOT EXISTS status SMALLINT,
  ADD COLUMN IF NOT EXISTS lib_id BIGINT;

COMMENT ON COLUMN unified_early_warnings.status IS 'Site tbl_early_warning.status: 0未处理 / 1处理中 / 2已完成';
COMMENT ON COLUMN unified_early_warnings.lib_id IS 'Site tbl_early_warning.lib_id (device/lib ref)';
COMMENT ON COLUMN unified_early_warnings.warning_type IS 'Site type: 0空间不足 / 1温度异常 / 2设备异常';
COMMENT ON COLUMN unified_early_warnings.warning_level IS 'Site s_level: 0警告 / 1错误 / 2严重错误 / 3紧急';
COMMENT ON COLUMN unified_early_warnings.message IS 'Site title (预警内容)';
COMMENT ON COLUMN unified_early_warnings.triggered_at IS 'Site create_date';

CREATE INDEX IF NOT EXISTS idx_unified_early_warnings_status
  ON unified_early_warnings (status);
CREATE INDEX IF NOT EXISTS idx_unified_early_warnings_type
  ON unified_early_warnings (warning_type);
CREATE INDEX IF NOT EXISTS idx_unified_early_warnings_triggered
  ON unified_early_warnings (triggered_at DESC NULLS LAST);

ALTER TABLE unified_early_warning_feedbacks
  ADD COLUMN IF NOT EXISTS user_name TEXT;

COMMENT ON COLUMN unified_early_warning_feedbacks.user_name IS 'Site tbl_early_warning_feedback.user_name';
COMMENT ON COLUMN unified_early_warning_feedbacks.warning_id IS 'Site early_warning_id';
COMMENT ON COLUMN unified_early_warning_feedbacks.feedback_text IS 'Site content';
COMMENT ON COLUMN unified_early_warning_feedbacks.feedback_at IS 'Site create_date';

CREATE INDEX IF NOT EXISTS idx_unified_early_warning_feedbacks_warning
  ON unified_early_warning_feedbacks (source_site_id, warning_id);
