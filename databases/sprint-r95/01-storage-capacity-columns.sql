-- R.95: 站点存储总量/已用 — 容量字段补齐
-- tbl_slots.rest_cap → unified_slots.remaining_capacity
-- tbl_disc_type.disc_cap/disc_side → unified_disc_types

ALTER TABLE unified_slots
  ADD COLUMN IF NOT EXISTS capacity_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS remaining_capacity BIGINT;

COMMENT ON COLUMN unified_slots.capacity_bytes IS 'Source tbl_slots.max_cap (bytes)';
COMMENT ON COLUMN unified_slots.remaining_capacity IS 'Source tbl_slots.rest_cap (bytes)';

ALTER TABLE unified_disc_types
  ADD COLUMN IF NOT EXISTS disc_cap BIGINT,
  ADD COLUMN IF NOT EXISTS disc_side SMALLINT;

COMMENT ON COLUMN unified_disc_types.disc_cap IS 'Source tbl_disc_type.disc_cap (bytes per side)';
COMMENT ON COLUMN unified_disc_types.disc_side IS 'Source tbl_disc_type.disc_side (1=single, 2=dual)';

ALTER TABLE unified_magazines
  ADD COLUMN IF NOT EXISTS disc_type INT;

COMMENT ON COLUMN unified_magazines.disc_type IS 'Source tbl_magzines.disc_type (catalog id for optical capacity)';
