-- ============================================================
-- Sprint R.98 — 跨站点盘笼移位登记（总控）
-- REQ-4.3.1 盘笼移位登记；支撑 REQ-4.1.1 跨站检索归属
-- 不写入站点库；不作为站点已执行移位的证据
-- ============================================================

CREATE TABLE IF NOT EXISTS unified_cage_move_register (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cage_id VARCHAR(100),
  magazine_rfid VARCHAR(50) NOT NULL,
  source_site_code VARCHAR(50) NOT NULL,
  source_device_ip VARCHAR(50) NOT NULL,
  source_device_port VARCHAR(10),
  target_site_code VARCHAR(50) NOT NULL,
  target_device_ip VARCHAR(50) NOT NULL,
  target_device_port VARCHAR(10),
  registrar_name VARCHAR(100) NOT NULL,
  operator_account_id UUID NOT NULL,
  remark TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'registered',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unified_cage_move_register_status_check
    CHECK (status IN ('registered', 'cancelled')),
  CONSTRAINT unified_cage_move_register_sites_diff_check
    CHECK (source_site_code <> target_site_code)
);

CREATE INDEX IF NOT EXISTS idx_cage_move_register_rfid
  ON unified_cage_move_register (magazine_rfid);

CREATE INDEX IF NOT EXISTS idx_cage_move_register_created
  ON unified_cage_move_register (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cage_move_register_target_site
  ON unified_cage_move_register (target_site_code);

COMMENT ON TABLE unified_cage_move_register IS
  '总控盘笼移位登记流水。magazine_rfid 为跨站身份；当前位置取该 RFID 最新 registered 行的目标站点/设备 IP。不代表站点已执行移位。';

COMMENT ON COLUMN unified_cage_move_register.cage_id IS '源站 mag_id，仅备注，不作跨站主键';
COMMENT ON COLUMN unified_cage_move_register.magazine_rfid IS '盘笼 RFID，跨站唯一身份';
COMMENT ON COLUMN unified_cage_move_register.source_device_port IS '原设备端口，可空';
COMMENT ON COLUMN unified_cage_move_register.target_device_port IS '目标设备端口，可空';
COMMENT ON COLUMN unified_cage_move_register.registrar_name IS '登记人（手工输入）';
COMMENT ON COLUMN unified_cage_move_register.operator_account_id IS '操作账号 id（登录 session）';
