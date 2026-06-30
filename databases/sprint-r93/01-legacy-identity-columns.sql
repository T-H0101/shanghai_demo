-- R.93: Make legacy unified tables compatible with source_record_id dispatch.
-- R.83+ dispatcher writes source_record_id for these tables; fresh installs must
-- get the same schema that R.92.1 previously applied manually in local DB.

ALTER TABLE unified_tasks ADD COLUMN IF NOT EXISTS source_record_id TEXT;
ALTER TABLE unified_devices ADD COLUMN IF NOT EXISTS source_record_id TEXT;
ALTER TABLE unified_magazines ADD COLUMN IF NOT EXISTS source_record_id TEXT;
ALTER TABLE unified_slots ADD COLUMN IF NOT EXISTS source_record_id TEXT;
ALTER TABLE unified_hard_disks ADD COLUMN IF NOT EXISTS source_record_id TEXT;
ALTER TABLE unified_disc_media ADD COLUMN IF NOT EXISTS source_record_id TEXT;
ALTER TABLE unified_volumes ADD COLUMN IF NOT EXISTS source_record_id TEXT;

ALTER TABLE unified_magazines ALTER COLUMN source_id DROP NOT NULL;
ALTER TABLE unified_slots ALTER COLUMN source_id DROP NOT NULL;
ALTER TABLE unified_hard_disks ALTER COLUMN source_id DROP NOT NULL;
ALTER TABLE unified_disc_media ALTER COLUMN source_id DROP NOT NULL;
ALTER TABLE unified_volumes ALTER COLUMN source_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS unified_tasks_source_site_id_source_record_id_key
  ON unified_tasks(source_site_id, source_record_id);
CREATE UNIQUE INDEX IF NOT EXISTS unified_devices_source_site_id_source_record_id_key
  ON unified_devices(source_site_id, source_record_id);
CREATE UNIQUE INDEX IF NOT EXISTS unified_magazines_source_site_id_source_record_id_key
  ON unified_magazines(source_site_id, source_record_id);
CREATE UNIQUE INDEX IF NOT EXISTS unified_slots_source_site_id_source_record_id_key
  ON unified_slots(source_site_id, source_record_id);
CREATE UNIQUE INDEX IF NOT EXISTS unified_hard_disks_source_site_id_source_record_id_key
  ON unified_hard_disks(source_site_id, source_record_id);
CREATE UNIQUE INDEX IF NOT EXISTS unified_disc_media_source_site_id_source_record_id_key
  ON unified_disc_media(source_site_id, source_record_id);
CREATE UNIQUE INDEX IF NOT EXISTS unified_volumes_source_site_id_source_record_id_key
  ON unified_volumes(source_site_id, source_record_id);

CREATE TABLE IF NOT EXISTS sync_scheduler_log (
  id BIGSERIAL PRIMARY KEY,
  site_code VARCHAR(50) NOT NULL,
  run_id VARCHAR(100) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL,
  export_status VARCHAR(20),
  push_status VARCHAR(20),
  consistency_status VARCHAR(20),
  package_batch_id VARCHAR(100),
  error_message TEXT,
  result_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
