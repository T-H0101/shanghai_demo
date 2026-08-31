-- Sprint R.102: 卷-盘位关系明细（tbl_volume_slot → unified_volume_slots）
-- 支撑存储卷详情「分配介质」按设备分组展示；聚合计数仍写 unified_volumes.raw_data._aggregate

CREATE TABLE IF NOT EXISTS unified_volume_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_volume_slot',
  source_id VARCHAR(200) NOT NULL,
  source_record_id TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW(),

  volume_id VARCHAR(100) NOT NULL,
  slot_id VARCHAR(100) NOT NULL,
  on_line SMALLINT,
  slot_num BIGINT,
  slot_code TEXT,

  raw_data JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (source_site_id, source_table, source_id)
);

CREATE INDEX IF NOT EXISTS idx_unified_volume_slots_site_volume
  ON unified_volume_slots (source_site_id, volume_id);
CREATE INDEX IF NOT EXISTS idx_unified_volume_slots_site_slot
  ON unified_volume_slots (source_site_id, slot_id);

COMMENT ON TABLE unified_volume_slots IS 'Unified mirror of source tbl_volume_slot (volume↔slot)';
