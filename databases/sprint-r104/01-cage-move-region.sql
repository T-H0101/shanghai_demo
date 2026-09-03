-- ============================================================
-- Sprint R.104 — 盘笼移位目标改为站点区域
-- REQ-4.3.1 盘笼移位登记；REQ-4.1.1 统一检索按逻辑区域过滤
-- 未上线：清空历史登记后演进字段；目标站/设备列保留可空
-- 依赖：sprint-r103 site_regions
-- ============================================================

TRUNCATE unified_cage_move_register;

ALTER TABLE unified_cage_move_register
  ADD COLUMN IF NOT EXISTS source_region_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS target_region_code VARCHAR(50);

ALTER TABLE unified_cage_move_register
  ALTER COLUMN target_site_code DROP NOT NULL,
  ALTER COLUMN target_device_ip DROP NOT NULL;

ALTER TABLE unified_cage_move_register
  DROP CONSTRAINT IF EXISTS unified_cage_move_register_sites_diff_check;

ALTER TABLE unified_cage_move_register
  DROP CONSTRAINT IF EXISTS unified_cage_move_register_regions_diff_check;

ALTER TABLE unified_cage_move_register
  ADD CONSTRAINT unified_cage_move_register_regions_diff_check
    CHECK (source_region_code IS DISTINCT FROM target_region_code);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unified_cage_move_register_source_region_fkey'
  ) THEN
    ALTER TABLE unified_cage_move_register
      ADD CONSTRAINT unified_cage_move_register_source_region_fkey
        FOREIGN KEY (source_region_code) REFERENCES site_regions(code);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unified_cage_move_register_target_region_fkey'
  ) THEN
    ALTER TABLE unified_cage_move_register
      ADD CONSTRAINT unified_cage_move_register_target_region_fkey
        FOREIGN KEY (target_region_code) REFERENCES site_regions(code);
  END IF;
END $$;

ALTER TABLE unified_cage_move_register
  ALTER COLUMN source_region_code SET NOT NULL,
  ALTER COLUMN target_region_code SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cage_move_register_target_region
  ON unified_cage_move_register (target_region_code);

DROP INDEX IF EXISTS idx_cage_move_register_target_site;

COMMENT ON TABLE unified_cage_move_register IS
  '总控盘笼移位登记流水。magazine_rfid 为跨站身份；当前逻辑区域取最新 registered 行的 target_region_code。目标站/设备可空预留。不代表站点已执行移位。';

COMMENT ON COLUMN unified_cage_move_register.source_region_code IS '登记时源站所属站点区域';
COMMENT ON COLUMN unified_cage_move_register.target_region_code IS '本阶段必填：目标站点区域';
COMMENT ON COLUMN unified_cage_move_register.target_site_code IS '预留：精确目标业务站，本阶段写 NULL';
COMMENT ON COLUMN unified_cage_move_register.target_device_ip IS '预留：精确目标设备 IP，本阶段写 NULL';
