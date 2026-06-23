-- ============================================================
-- Sprint R.83.1 — 部门 / 项目 / 接收单 15 张统一表 DDL
-- ============================================================
-- 目标: 在中心库 unified_disc_platform 一次性创建 15 张 unified_* 表
-- 源:   databases/disc_files.sql (MySQL 源 schema)
--       - 字段类型按源 EXACT 翻译: bigint→BIGINT, int→INTEGER,
--         tinyint→SMALLINT, varchar(N)→VARCHAR(N), text→TEXT,
--         datetime→TIMESTAMPTZ
--       - DEFAULT 子句按源保留
--       - COMMENT 子句转成 PostgreSQL COMMENT ON COLUMN
--
-- 通用列 (每张表必备):
--   id                UUID PRIMARY KEY DEFAULT gen_random_uuid()
--   source_site_id    VARCHAR(50) NOT NULL
--   source_table      VARCHAR(100) NOT NULL DEFAULT '<src>'
--   source_record_id  TEXT NOT NULL         -- 单值 ID 或 "<a>::<b>" 复合 PK
--   synced_at         TIMESTAMPTZ DEFAULT NOW()
--   raw_data          JSONB DEFAULT '{}'
--   UNIQUE(source_site_id, source_record_id)
--
-- 复合 PK 表 (source_record_id 拼接规则):
--   tbl_user_role       → "<user_id>::<role_id>"
--   tbl_workspace_user  → "<ws_id>::<user_id>"
--   tbl_depa_user       → "<depa_id>::<user_id>"
--   tbl_receipt_check   → "<r_file_id>::<check_id>"
--
-- AUTO_INCREMENT 源表: src_id BIGINT 单独保留源端的递增 ID 列,
-- 统一表自己的 id 列仍为 UUID PRIMARY KEY。
-- ============================================================


-- ============================================================
-- 1. unified_user_roles ← tbl_user_role  (PK user_id+role_id)
-- ============================================================
-- source_record_id 格式: "<user_id>::<role_id>"
CREATE TABLE IF NOT EXISTS unified_user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_user_role',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id BIGINT,
  role_id INTEGER,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_user_roles_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_user_roles IS 'Unified mirror of source tbl_user_role; composite PK (user_id, role_id) flattened to "<user_id>::<role_id>"';
COMMENT ON COLUMN unified_user_roles.user_id IS '用户id';
COMMENT ON COLUMN unified_user_roles.role_id IS '角色id';
CREATE INDEX IF NOT EXISTS idx_unified_user_roles_site ON unified_user_roles (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_user_roles_user ON unified_user_roles (source_site_id, user_id);


-- ============================================================
-- 2. unified_departments ← tbl_depa  (PK depa_id)
-- ============================================================
CREATE TABLE IF NOT EXISTS unified_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_depa',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_depa_id BIGINT,
  depa_name VARCHAR(50),
  depa_code VARCHAR(20),
  alia_name VARCHAR(50),
  depa_enable SMALLINT DEFAULT 0,
  min_optical SMALLINT DEFAULT 0,
  create_time TIMESTAMPTZ,
  update_time TIMESTAMPTZ,
  base SMALLINT DEFAULT 0,
  del_flag SMALLINT DEFAULT 0,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_departments_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_departments IS 'Unified mirror of source tbl_depa; source PK depa_id preserved as src_depa_id';
COMMENT ON COLUMN unified_departments.src_depa_id IS '自增部门ID';
COMMENT ON COLUMN unified_departments.depa_name IS '部门名称';
COMMENT ON COLUMN unified_departments.depa_code IS '部门编号';
COMMENT ON COLUMN unified_departments.alia_name IS '别名';
COMMENT ON COLUMN unified_departments.depa_enable IS '0:停用  1：启用';
COMMENT ON COLUMN unified_departments.min_optical IS '刻录最长等待天数0不启用，大于0天数';
COMMENT ON COLUMN unified_departments.create_time IS '创建时间';
COMMENT ON COLUMN unified_departments.update_time IS '更新时间';
COMMENT ON COLUMN unified_departments.base IS '是否为标签样板0否1是';
COMMENT ON COLUMN unified_departments.del_flag IS '删除标志  0:正常  1:已删除';
CREATE INDEX IF NOT EXISTS idx_unified_departments_site ON unified_departments (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_departments_code ON unified_departments (source_site_id, depa_code);


-- ============================================================
-- 3. unified_workspaces ← tbl_workspace  (PK ws_id)
-- ============================================================
CREATE TABLE IF NOT EXISTS unified_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_workspace',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_ws_id BIGINT,
  depa_id INTEGER,
  user_id INTEGER,
  ws_name VARCHAR(50),
  alia_name VARCHAR(50),
  ws_enable SMALLINT DEFAULT 1,
  ws_type SMALLINT DEFAULT 0,
  ws_code VARCHAR(30),
  model_id INTEGER,
  tac_id INTEGER,
  min_optical SMALLINT DEFAULT 0,
  last_optical SMALLINT DEFAULT 0,
  disk_sn INTEGER,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_workspaces_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_workspaces IS 'Unified mirror of source tbl_workspace; source PK ws_id preserved as src_ws_id';
COMMENT ON COLUMN unified_workspaces.src_ws_id IS '自增工作区ID';
COMMENT ON COLUMN unified_workspaces.depa_id IS '部门ID';
COMMENT ON COLUMN unified_workspaces.user_id IS '个人类型用户ID';
COMMENT ON COLUMN unified_workspaces.ws_name IS '工作区名称';
COMMENT ON COLUMN unified_workspaces.alia_name IS '工作区别名';
COMMENT ON COLUMN unified_workspaces.ws_enable IS '0:停用  1：启用';
COMMENT ON COLUMN unified_workspaces.ws_type IS '0:部门，1:个人，2:公共，3:归档盘';
COMMENT ON COLUMN unified_workspaces.ws_code IS '工作区编号';
COMMENT ON COLUMN unified_workspaces.model_id IS '模板ID';
COMMENT ON COLUMN unified_workspaces.tac_id IS '策略ID';
COMMENT ON COLUMN unified_workspaces.min_optical IS '刻录最长等待天数0不启用，大于0天数';
COMMENT ON COLUMN unified_workspaces.last_optical IS '上次刻录时间';
COMMENT ON COLUMN unified_workspaces.disk_sn IS '托管硬盘的sn号';
CREATE INDEX IF NOT EXISTS idx_unified_workspaces_site ON unified_workspaces (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_workspaces_code ON unified_workspaces (source_site_id, ws_code);


-- ============================================================
-- 4. unified_workspace_users ← tbl_workspace_user  (PK ws_id+user_id)
-- ============================================================
-- source_record_id 格式: "<ws_id>::<user_id>"
CREATE TABLE IF NOT EXISTS unified_workspace_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_workspace_user',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ws_id INTEGER,
  user_id INTEGER,
  permission INTEGER,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_workspace_users_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_workspace_users IS 'Unified mirror of source tbl_workspace_user; composite PK (ws_id, user_id) flattened to "<ws_id>::<user_id>"';
COMMENT ON COLUMN unified_workspace_users.ws_id IS '组合卷编号';
COMMENT ON COLUMN unified_workspace_users.user_id IS '用户编号';
COMMENT ON COLUMN unified_workspace_users.permission IS '0：可检索，1：可读可写 2只读可回迁';
CREATE INDEX IF NOT EXISTS idx_unified_workspace_users_site ON unified_workspace_users (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_workspace_users_ws ON unified_workspace_users (source_site_id, ws_id);


-- ============================================================
-- 5. unified_department_users ← tbl_depa_user  (PK depa_id+user_id)
-- ============================================================
-- source_record_id 格式: "<depa_id>::<user_id>"
CREATE TABLE IF NOT EXISTS unified_department_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_depa_user',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  depa_id INTEGER,
  user_id INTEGER,
  black_list VARCHAR(255),
  white_list VARCHAR(255),
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_department_users_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_department_users IS 'Unified mirror of source tbl_depa_user; composite PK (depa_id, user_id) flattened to "<depa_id>::<user_id>"';
COMMENT ON COLUMN unified_department_users.depa_id IS '部门编号';
COMMENT ON COLUMN unified_department_users.user_id IS '用户编号';
COMMENT ON COLUMN unified_department_users.black_list IS '工作区黑名单';
COMMENT ON COLUMN unified_department_users.white_list IS '工作区白名单';
CREATE INDEX IF NOT EXISTS idx_unified_department_users_site ON unified_department_users (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_department_users_depa ON unified_department_users (source_site_id, depa_id);


-- ============================================================
-- 6. unified_department_user_info ← tbl_depa_user_info  (PK id AUTO_INCREMENT)
-- ============================================================
CREATE TABLE IF NOT EXISTS unified_department_user_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_depa_user_info',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_id BIGINT,
  depa_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  fuc_id INTEGER,
  create_time TIMESTAMPTZ,
  update_time TIMESTAMPTZ,
  del_status SMALLINT DEFAULT 0,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_department_user_info_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_department_user_info IS 'Unified mirror of source tbl_depa_user_info; source surrogate id preserved as src_id';
COMMENT ON COLUMN unified_department_user_info.src_id IS '自增部门用户权限ID';
COMMENT ON COLUMN unified_department_user_info.depa_id IS '部门编号';
COMMENT ON COLUMN unified_department_user_info.user_id IS '用户编号';
COMMENT ON COLUMN unified_department_user_info.fuc_id IS '权限id';
COMMENT ON COLUMN unified_department_user_info.create_time IS '创建时间';
COMMENT ON COLUMN unified_department_user_info.update_time IS '更新时间';
COMMENT ON COLUMN unified_department_user_info.del_status IS '删除标志  0:正常  1:已删除';
CREATE INDEX IF NOT EXISTS idx_unified_department_user_info_site ON unified_department_user_info (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_department_user_info_depa ON unified_department_user_info (source_site_id, depa_id);


-- ============================================================
-- 7. unified_projects ← tbl_project  (PK project_id)
-- ============================================================
CREATE TABLE IF NOT EXISTS unified_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_project',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_project_id BIGINT,
  maintitle VARCHAR(255),
  project_title VARCHAR(255),
  subtitle VARCHAR(255),
  project_dt TIMESTAMPTZ,
  volume_id INTEGER NOT NULL,
  status INTEGER DEFAULT 1,
  cmt VARCHAR(500),
  project_num VARCHAR(500),
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_projects_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_projects IS 'Unified mirror of source tbl_project (项目表); source PK project_id preserved as src_project_id';
COMMENT ON COLUMN unified_projects.src_project_id IS 'project_id (source PK)';
COMMENT ON COLUMN unified_projects.maintitle IS '主标题';
COMMENT ON COLUMN unified_projects.project_title IS '项目名称';
COMMENT ON COLUMN unified_projects.subtitle IS '项目副标题';
COMMENT ON COLUMN unified_projects.project_dt IS '项目时间';
COMMENT ON COLUMN unified_projects.volume_id IS '逻辑卷编号';
COMMENT ON COLUMN unified_projects.status IS '状态（1：可下载，2：下载中，3：下载完成，4：归档中，0：归档完成（可自动出版），10:自动化出版待归档，12：自动化出版完成，21：下载异常，41：归档异常）';
COMMENT ON COLUMN unified_projects.cmt IS '描述';
COMMENT ON COLUMN unified_projects.project_num IS '项目编号';
CREATE INDEX IF NOT EXISTS idx_unified_projects_site ON unified_projects (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_projects_status ON unified_projects (source_site_id, status);


-- ============================================================
-- 8. unified_project_sites ← tbl_project_site  (PK id AUTO_INCREMENT)
-- ============================================================
CREATE TABLE IF NOT EXISTS unified_project_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_project_site',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_id BIGINT,
  project_id BIGINT NOT NULL,
  site_id INTEGER NOT NULL,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  cmt VARCHAR(500),
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_project_sites_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_project_sites IS 'Unified mirror of source tbl_project_site (任务对应房间); source surrogate id preserved as src_id';
COMMENT ON COLUMN unified_project_sites.src_id IS 'id (source PK)';
COMMENT ON COLUMN unified_project_sites.project_id IS '任务ID';
COMMENT ON COLUMN unified_project_sites.site_id IS '房间ID';
COMMENT ON COLUMN unified_project_sites.start_time IS '开始时间';
COMMENT ON COLUMN unified_project_sites.end_time IS '结束时间';
COMMENT ON COLUMN unified_project_sites.cmt IS '描述';
CREATE INDEX IF NOT EXISTS idx_unified_project_sites_site ON unified_project_sites (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_project_sites_project ON unified_project_sites (source_site_id, project_id);


-- ============================================================
-- 9. unified_task_projects ← tbl_task_projects  (PK id AUTO_INCREMENT)
-- ============================================================
CREATE TABLE IF NOT EXISTS unified_task_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_task_projects',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_id BIGINT,
  task_id BIGINT NOT NULL,
  project_id BIGINT NOT NULL,
  cmt VARCHAR(500),
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_task_projects_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_task_projects IS 'Unified mirror of source tbl_task_projects (任务-项目关联表); source surrogate id preserved as src_id';
COMMENT ON COLUMN unified_task_projects.src_id IS 'id (source PK)';
COMMENT ON COLUMN unified_task_projects.task_id IS 'tbl_task表ID，1个任务可包含多个项目';
COMMENT ON COLUMN unified_task_projects.project_id IS '项目ID';
COMMENT ON COLUMN unified_task_projects.cmt IS '描述';
CREATE INDEX IF NOT EXISTS idx_unified_task_projects_site ON unified_task_projects (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_task_projects_task ON unified_task_projects (source_site_id, task_id);


-- ============================================================
-- 10. unified_task_receipts ← tbl_task_receipts  (PK id AUTO_INCREMENT)
-- ============================================================
CREATE TABLE IF NOT EXISTS unified_task_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_task_receipts',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_id BIGINT,
  task_id BIGINT NOT NULL,
  r_id BIGINT NOT NULL,
  cmt VARCHAR(500),
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_task_receipts_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_task_receipts IS 'Unified mirror of source tbl_task_receipts (任务-接收单关联表); source surrogate id preserved as src_id';
COMMENT ON COLUMN unified_task_receipts.src_id IS 'id (source PK)';
COMMENT ON COLUMN unified_task_receipts.task_id IS 'tbl_task表ID，1个任务1个接收单';
COMMENT ON COLUMN unified_task_receipts.r_id IS '接收单ID';
COMMENT ON COLUMN unified_task_receipts.cmt IS '描述';
CREATE INDEX IF NOT EXISTS idx_unified_task_receipts_site ON unified_task_receipts (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_task_receipts_task ON unified_task_receipts (source_site_id, task_id);


-- ============================================================
-- 11. unified_task_files ← tbl_task_files  (PK id AUTO_INCREMENT)
-- ============================================================
CREATE TABLE IF NOT EXISTS unified_task_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_task_files',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_id BIGINT,
  file_path VARCHAR(1024) NOT NULL,
  file_size BIGINT NOT NULL,
  close_time TIMESTAMPTZ,
  monitor_id INTEGER NOT NULL,
  cmt VARCHAR(200),
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_task_files_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_task_files IS 'Unified mirror of source tbl_task_files; source surrogate id preserved as src_id';
COMMENT ON COLUMN unified_task_files.src_id IS '自增ID';
COMMENT ON COLUMN unified_task_files.file_path IS '文件全路径';
COMMENT ON COLUMN unified_task_files.file_size IS '文件大小';
COMMENT ON COLUMN unified_task_files.close_time IS '文件关闭时间';
COMMENT ON COLUMN unified_task_files.monitor_id IS '监听目录表ID';
COMMENT ON COLUMN unified_task_files.cmt IS 'cmt';
CREATE INDEX IF NOT EXISTS idx_unified_task_files_site ON unified_task_files (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_task_files_monitor ON unified_task_files (source_site_id, monitor_id);


-- ============================================================
-- 12. unified_task_checks ← tbl_task_check  (PK id AUTO_INCREMENT)
-- ============================================================
CREATE TABLE IF NOT EXISTS unified_task_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_task_check',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_id INTEGER,
  lib_id INTEGER,
  driver VARCHAR(50),
  mode INTEGER,
  verify_std INTEGER,
  batch INTEGER,
  aql VARCHAR(20),
  accept INTEGER,
  reject INTEGER,
  discs INTEGER,
  ignored INTEGER,
  spot VARCHAR(50),
  person VARCHAR(50),
  date VARCHAR(50),
  cmt VARCHAR(500),
  slot_start INTEGER,
  slot_end INTEGER,
  status INTEGER,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_task_checks_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_task_checks IS 'Unified mirror of source tbl_task_check; source surrogate id preserved as src_id';
COMMENT ON COLUMN unified_task_checks.src_id IS '自增ID';
COMMENT ON COLUMN unified_task_checks.lib_id IS '光盘库ID';
COMMENT ON COLUMN unified_task_checks.driver IS '光盘库中的检测光驱（可能有多个）';
COMMENT ON COLUMN unified_task_checks.mode IS '检测模式：0全检，1 SPOT1，2 SPOT2';
COMMENT ON COLUMN unified_task_checks.verify_std IS '检测标准';
COMMENT ON COLUMN unified_task_checks.batch IS '批次量';
COMMENT ON COLUMN unified_task_checks.aql IS '标准中的AQL';
COMMENT ON COLUMN unified_task_checks.accept IS '接受数';
COMMENT ON COLUMN unified_task_checks.reject IS '拒受数';
COMMENT ON COLUMN unified_task_checks.discs IS '检测光盘数，根据批次量计算出';
COMMENT ON COLUMN unified_task_checks.ignored IS 'ignored';
COMMENT ON COLUMN unified_task_checks.spot IS 'spot';
COMMENT ON COLUMN unified_task_checks.person IS 'person';
COMMENT ON COLUMN unified_task_checks.date IS 'date';
COMMENT ON COLUMN unified_task_checks.cmt IS 'cmt';
COMMENT ON COLUMN unified_task_checks.slot_start IS '光盘库开始检测的抽片号';
COMMENT ON COLUMN unified_task_checks.slot_end IS '光盘库结束检测的抽片号';
COMMENT ON COLUMN unified_task_checks.status IS 'status';
CREATE INDEX IF NOT EXISTS idx_unified_task_checks_site ON unified_task_checks (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_task_checks_lib ON unified_task_checks (source_site_id, lib_id);


-- ============================================================
-- 13. unified_receipts ← tbl_receipt  (PK id AUTO_INCREMENT)
-- ============================================================
CREATE TABLE IF NOT EXISTS unified_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_receipt',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_id BIGINT,
  annual VARCHAR(50),
  batch VARCHAR(50),
  receive_num VARCHAR(50),
  transfer_unit VARCHAR(50),
  transferer VARCHAR(20),
  transfer_date TIMESTAMPTZ,
  receive_unit VARCHAR(50),
  receiver VARCHAR(20),
  files_count INTEGER,
  nums INTEGER,
  remark VARCHAR(200),
  status SMALLINT,
  update_dt TIMESTAMPTZ,
  create_dt TIMESTAMPTZ,
  volume_id INTEGER DEFAULT 0,
  file_path VARCHAR(1024),
  ws_id BIGINT,
  type INTEGER DEFAULT 0,
  archive_type VARCHAR(200),
  template_type VARCHAR(200),
  check_type BIGINT,
  check_params VARCHAR(500),
  scan_task_id BIGINT,
  import_method INTEGER DEFAULT 0,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_receipts_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_receipts IS 'Unified mirror of source tbl_receipt; source surrogate id preserved as src_id';
COMMENT ON COLUMN unified_receipts.src_id IS '自增ID';
COMMENT ON COLUMN unified_receipts.annual IS '年度';
COMMENT ON COLUMN unified_receipts.batch IS '批次';
COMMENT ON COLUMN unified_receipts.receive_num IS '接收号';
COMMENT ON COLUMN unified_receipts.transfer_unit IS '移交单位';
COMMENT ON COLUMN unified_receipts.transferer IS '移交人';
COMMENT ON COLUMN unified_receipts.transfer_date IS '移交时间';
COMMENT ON COLUMN unified_receipts.receive_unit IS '接收单位';
COMMENT ON COLUMN unified_receipts.receiver IS '接收人';
COMMENT ON COLUMN unified_receipts.files_count IS '案卷数';
COMMENT ON COLUMN unified_receipts.nums IS '份数';
COMMENT ON COLUMN unified_receipts.remark IS '附注';
COMMENT ON COLUMN unified_receipts.status IS '接收单状态待审核：1,已入库：0,审核成功：2,审核失败：3,接收文件成功：4,四性检测成功：5,四性检测失败：10,元数据关联成功：6,元数据关联失败：20,四性检测中:7,入库磁存储：8，入库失败：11，删除 -1';
COMMENT ON COLUMN unified_receipts.update_dt IS '更新时间';
COMMENT ON COLUMN unified_receipts.create_dt IS '创建时间';
COMMENT ON COLUMN unified_receipts.volume_id IS '卷ID';
COMMENT ON COLUMN unified_receipts.file_path IS '档案包文件路径';
COMMENT ON COLUMN unified_receipts.ws_id IS '存储工作区';
COMMENT ON COLUMN unified_receipts.type IS 'type';
COMMENT ON COLUMN unified_receipts.archive_type IS '接收单档案类型';
COMMENT ON COLUMN unified_receipts.template_type IS '接收单模版类型';
COMMENT ON COLUMN unified_receipts.check_type IS '四性检测模版类型';
COMMENT ON COLUMN unified_receipts.check_params IS '四性检测选择项';
COMMENT ON COLUMN unified_receipts.scan_task_id IS '扫描任务ID';
COMMENT ON COLUMN unified_receipts.import_method IS '导入方式，0 普通流程，1 批量流程';
CREATE INDEX IF NOT EXISTS idx_unified_receipts_site ON unified_receipts (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_receipts_status ON unified_receipts (source_site_id, status);


-- ============================================================
-- 14. unified_receipt_checks ← tbl_receipt_check  (PK r_file_id+check_id)
-- ============================================================
-- source_record_id 格式: "<r_file_id>::<check_id>"
CREATE TABLE IF NOT EXISTS unified_receipt_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_receipt_check',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  r_file_id INTEGER,
  check_id VARCHAR(64),
  result INTEGER,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_receipt_checks_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_receipt_checks IS 'Unified mirror of source tbl_receipt_check; composite PK (r_file_id, check_id) flattened to "<r_file_id>::<check_id>"';
COMMENT ON COLUMN unified_receipt_checks.r_file_id IS '接收单关联的文件编号';
COMMENT ON COLUMN unified_receipt_checks.check_id IS '检测任务编号';
COMMENT ON COLUMN unified_receipt_checks.result IS '检测结果：0检测中1检测成功2检测失败';
CREATE INDEX IF NOT EXISTS idx_unified_receipt_checks_site ON unified_receipt_checks (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_receipt_checks_rfile ON unified_receipt_checks (source_site_id, r_file_id);


-- ============================================================
-- 15. unified_receipt_files ← tbl_receipt_file  (PK id AUTO_INCREMENT)
-- ============================================================
CREATE TABLE IF NOT EXISTS unified_receipt_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_receipt_file',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_id BIGINT,
  file_name VARCHAR(765),
  file_size BIGINT,
  hash VARCHAR(65),
  r_id BIGINT NOT NULL,
  create_date TIMESTAMPTZ,
  status SMALLINT DEFAULT 0,
  path VARCHAR(1024),
  check_id VARCHAR(64),
  cmt VARCHAR(765),
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_receipt_files_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_receipt_files IS 'Unified mirror of source tbl_receipt_file; source surrogate id preserved as src_id';
COMMENT ON COLUMN unified_receipt_files.src_id IS '自增ID';
COMMENT ON COLUMN unified_receipt_files.file_name IS '文件名(带后缀)';
COMMENT ON COLUMN unified_receipt_files.file_size IS '大小';
COMMENT ON COLUMN unified_receipt_files.hash IS 'md5';
COMMENT ON COLUMN unified_receipt_files.r_id IS '接收单id';
COMMENT ON COLUMN unified_receipt_files.create_date IS '文件原始创建时间';
COMMENT ON COLUMN unified_receipt_files.status IS '文件检测状态0待检测1检测通过2检测中3检测失败';
COMMENT ON COLUMN unified_receipt_files.path IS '检测文件zip所在路径';
COMMENT ON COLUMN unified_receipt_files.check_id IS '检测任务ID';
COMMENT ON COLUMN unified_receipt_files.cmt IS '备注';
CREATE INDEX IF NOT EXISTS idx_unified_receipt_files_site ON unified_receipt_files (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_receipt_files_rid ON unified_receipt_files (source_site_id, r_id);


-- ============================================================
-- raw_data GIN indexes (R.83.1 spec §4.3 item 3: 全文检索)
-- 按表名升序,15 张表各 1 条
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_unified_user_roles_raw_gin ON unified_user_roles USING GIN (raw_data);
CREATE INDEX IF NOT EXISTS idx_unified_departments_raw_gin ON unified_departments USING GIN (raw_data);
CREATE INDEX IF NOT EXISTS idx_unified_workspaces_raw_gin ON unified_workspaces USING GIN (raw_data);
CREATE INDEX IF NOT EXISTS idx_unified_workspace_users_raw_gin ON unified_workspace_users USING GIN (raw_data);
CREATE INDEX IF NOT EXISTS idx_unified_department_users_raw_gin ON unified_department_users USING GIN (raw_data);
CREATE INDEX IF NOT EXISTS idx_unified_department_user_info_raw_gin ON unified_department_user_info USING GIN (raw_data);
CREATE INDEX IF NOT EXISTS idx_unified_projects_raw_gin ON unified_projects USING GIN (raw_data);
CREATE INDEX IF NOT EXISTS idx_unified_project_sites_raw_gin ON unified_project_sites USING GIN (raw_data);
CREATE INDEX IF NOT EXISTS idx_unified_task_projects_raw_gin ON unified_task_projects USING GIN (raw_data);
CREATE INDEX IF NOT EXISTS idx_unified_task_receipts_raw_gin ON unified_task_receipts USING GIN (raw_data);
CREATE INDEX IF NOT EXISTS idx_unified_task_files_raw_gin ON unified_task_files USING GIN (raw_data);
CREATE INDEX IF NOT EXISTS idx_unified_task_checks_raw_gin ON unified_task_checks USING GIN (raw_data);
CREATE INDEX IF NOT EXISTS idx_unified_receipts_raw_gin ON unified_receipts USING GIN (raw_data);
CREATE INDEX IF NOT EXISTS idx_unified_receipt_checks_raw_gin ON unified_receipt_checks USING GIN (raw_data);
CREATE INDEX IF NOT EXISTS idx_unified_receipt_files_raw_gin ON unified_receipt_files USING GIN (raw_data);