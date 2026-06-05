-- ============================================================
-- Sprint 2C.18A - Task-scoped file/folder index schema
-- ============================================================
-- These are central task-level index tables, not full copies of
-- source tbl_file / tbl_folder.
-- ============================================================

CREATE TABLE IF NOT EXISTS unified_file_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_file',
  source_id VARCHAR(100) NOT NULL,
  task_source_id VARCHAR(100) NOT NULL,
  folder_source_id VARCHAR(100),
  slot_id INTEGER,
  file_name TEXT,
  file_size BIGINT,
  content_type VARCHAR(100),
  status INTEGER,
  hash VARCHAR(128),
  source_created_at TIMESTAMPTZ,
  indexed_at TIMESTAMPTZ DEFAULT NOW(),
  batch_id VARCHAR(100),
  checksum VARCHAR(128),
  raw_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unified_file_index_source_unique UNIQUE (source_site_id, source_table, source_id)
);

CREATE TABLE IF NOT EXISTS unified_folder_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_folder',
  source_id VARCHAR(100) NOT NULL,
  parent_source_id VARCHAR(100),
  name TEXT,
  folder_path TEXT,
  disc_path TEXT,
  level INTEGER,
  file_count INTEGER,
  total_size BIGINT,
  indexed_at TIMESTAMPTZ DEFAULT NOW(),
  batch_id VARCHAR(100),
  checksum VARCHAR(128),
  raw_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unified_folder_index_source_unique UNIQUE (source_site_id, source_table, source_id)
);

CREATE INDEX IF NOT EXISTS idx_unified_file_index_task
  ON unified_file_index(source_site_id, task_source_id, source_id);
CREATE INDEX IF NOT EXISTS idx_unified_file_index_folder
  ON unified_file_index(source_site_id, folder_source_id);
CREATE INDEX IF NOT EXISTS idx_unified_file_index_batch
  ON unified_file_index(source_site_id, batch_id);

CREATE INDEX IF NOT EXISTS idx_unified_folder_index_source
  ON unified_folder_index(source_site_id, source_id);
CREATE INDEX IF NOT EXISTS idx_unified_folder_index_parent
  ON unified_folder_index(source_site_id, parent_source_id);
CREATE INDEX IF NOT EXISTS idx_unified_folder_index_batch
  ON unified_folder_index(source_site_id, batch_id);

COMMENT ON TABLE unified_file_index IS '任务级文件索引表，不是 tbl_file 全量复制';
COMMENT ON TABLE unified_folder_index IS '任务级目录索引表，不是 tbl_folder 全量复制';
