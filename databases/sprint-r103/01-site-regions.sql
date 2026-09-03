-- Sprint R.103: 站点区域（总控主数据，不由业务系统推送）
-- 业务站点（sync_sites）挂靠到区域，供后续盘笼按区域移位/回迁扇出使用。

CREATE TABLE IF NOT EXISTS site_regions (
  code VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT site_regions_status_check CHECK (status IN ('active', 'inactive'))
);

CREATE INDEX IF NOT EXISTS idx_site_regions_status ON site_regions(status);

ALTER TABLE sync_sites
  ADD COLUMN IF NOT EXISTS region_code VARCHAR(50);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sync_sites_region_code_fkey'
  ) THEN
    ALTER TABLE sync_sites
      ADD CONSTRAINT sync_sites_region_code_fkey
      FOREIGN KEY (region_code) REFERENCES site_regions(code)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sync_sites_region_code ON sync_sites(region_code);
