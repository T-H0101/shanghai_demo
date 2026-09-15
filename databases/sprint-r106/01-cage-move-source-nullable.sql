-- ============================================================
-- Sprint R.106 — 盘笼再迁：原站/原设备可空；仅最新登记可撤销
-- 首次迁移仍写站/设备；再迁（原位置=区域）站/设备为空
-- ============================================================

ALTER TABLE unified_cage_move_register
  ALTER COLUMN source_site_code DROP NOT NULL;

ALTER TABLE unified_cage_move_register
  ALTER COLUMN source_device_ip DROP NOT NULL;

COMMENT ON COLUMN unified_cage_move_register.source_site_code IS
  '原站点；首次迁移必填，再迁（仅区域）可空';
COMMENT ON COLUMN unified_cage_move_register.source_device_ip IS
  '原设备 IP；首次迁移必填，再迁（仅区域）可空';
