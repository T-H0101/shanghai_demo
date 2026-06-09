-- ============================================================
-- 统一平台中心库 Schema
-- Sprint 2B.0.1 - PostgreSQL 连接与中心库初始化（对齐修正版）
-- ============================================================
-- 本文件定义中心库的所有表结构
-- 每个 unified_* 表包含来源追溯字段，便于数据同步和溯源
--
-- 设计原则：
-- 1. 简单、数据量小的业务表先进入 PostgreSQL 中心库
-- 2. 文件级、日志级等大表不要进入 PostgreSQL 中心库
-- 3. 大表后续走 Elasticsearch 或 ClickHouse 做汇总、检索和分析
-- 4. source_site_id 统一使用站点代码字符串，不引用业务表外键
-- 5. 禁止明文提交数据库密码
-- ============================================================

-- ============================================================
-- A. sync_sites - 源库连接配置表（同步基础设施）
-- ============================================================
-- 用途：存储源站点的数据库连接配置，用于同步服务连接源库
-- 注意：这是同步配置，不是业务站点信息
-- 与 sites 表的区别：
--   - sync_sites: 源库连接配置（db_host, db_port, credential_ref）
--   - sites: 统一平台展示用业务站点信息（site_code, site_name, region）
-- ============================================================
CREATE TABLE IF NOT EXISTS sync_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 源站点标识
  site_code VARCHAR(50) NOT NULL UNIQUE,             -- 站点编码 (如: SH01)
  site_name VARCHAR(200) NOT NULL,                    -- 站点名称
  source_type VARCHAR(50) DEFAULT 'mysql',          -- 源库类型: mysql/postgresql/sqlserver

  -- 源库连接配置
  db_host VARCHAR(255) NOT NULL,                      -- 源库主机
  db_port INT DEFAULT 3306,                          -- 源库端口
  db_name VARCHAR(100) NOT NULL,                    -- 源库名称
  db_user VARCHAR(100) NOT NULL,                    -- 源库用户名
  credential_ref VARCHAR(255),                       -- 密码引用（环境变量名或密钥服务key）
  -- db_password VARCHAR(255),                      -- 禁止明文存储密码，改用 credential_ref

  -- 同步配置
  enabled BOOLEAN DEFAULT TRUE,                      -- 是否启用同步
  sync_interval_seconds INT DEFAULT 300,            -- 同步间隔（秒）
  last_connected_at TIMESTAMPTZ,                     -- 上次连接时间

  -- 状态
  status VARCHAR(20) DEFAULT 'active',              -- active/inactive/error

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_sites_code ON sync_sites(site_code);
CREATE INDEX IF NOT EXISTS idx_sync_sites_enabled ON sync_sites(enabled);
CREATE INDEX IF NOT EXISTS idx_sync_sites_status ON sync_sites(status);

-- ============================================================
-- B. sites - 统一平台展示用业务站点表
-- ============================================================
-- 用途：存储统一平台展示用的业务站点信息
-- 与 sync_sites 的区别：
--   - sync_sites: 源库连接配置（同步服务使用）
--   - sites: 业务站点信息（前端展示使用）
-- ============================================================
CREATE TABLE IF NOT EXISTS sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_code VARCHAR(50) NOT NULL UNIQUE,             -- 站点编码 (如: SH01)
  site_name VARCHAR(200) NOT NULL,                  -- 站点名称
  region VARCHAR(100),                              -- 区域
  datacenter VARCHAR(200),                           -- 数据中心
  address VARCHAR(500),                             -- 地址
  contact_name VARCHAR(100),                         -- 联系人
  contact_phone VARCHAR(50),                         -- 联系电话
  contact_email VARCHAR(200),                         -- 联系邮箱
  status VARCHAR(20) DEFAULT 'active',             -- 状态: active/inactive/maintenance
  is_central BOOLEAN DEFAULT FALSE,                 -- 是否中心库
  config JSONB DEFAULT '{}',                         -- 扩展配置
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sites_code ON sites(site_code);
CREATE INDEX IF NOT EXISTS idx_sites_status ON sites(status);

-- ============================================================
-- C. sync_progress - 同步进度记录表
-- ============================================================
-- 用途：记录每个站点、每张表的同步游标，用于增量同步
-- ============================================================
CREATE TABLE IF NOT EXISTS sync_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,               -- 源站点代码 (如: SH01)
  source_table VARCHAR(100) NOT NULL,                -- 源表名 (如: tbl_task)

  -- 同步游标
  last_sync_time TIMESTAMPTZ,                        -- 上次同步时间
  last_source_id BIGINT DEFAULT 0,                   -- 上次同步的最大ID
  last_status VARCHAR(20) DEFAULT 'idle',           -- 上次同步状态: idle/success/failed

  -- 同步结果
  synced_rows INT DEFAULT 0,                        -- 本次同步记录数
  last_error TEXT,                                   -- 上次错误信息

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 唯一约束
  UNIQUE(source_site_id, source_table)
);

CREATE INDEX IF NOT EXISTS idx_sync_progress_site ON sync_progress(source_site_id);
CREATE INDEX IF NOT EXISTS idx_sync_progress_table ON sync_progress(source_table);
CREATE INDEX IF NOT EXISTS idx_sync_progress_status ON sync_progress(last_status);

-- ============================================================
-- D. sync_job_log - 同步任务执行日志表
-- ============================================================
-- 用途：记录同步任务的执行日志，用于审计和问题排查
-- ============================================================
CREATE TABLE IF NOT EXISTS sync_job_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id VARCHAR(100),                               -- 任务ID（用于关联调度系统）
  source_site_id VARCHAR(50) NOT NULL,              -- 源站点代码
  source_table VARCHAR(100) NOT NULL,               -- 源表名

  -- 执行时间
  started_at TIMESTAMPTZ DEFAULT NOW(),             -- 开始时间
  finished_at TIMESTAMPTZ,                          -- 结束时间

  -- 执行结果
  status VARCHAR(20) NOT NULL,                      -- running/success/failed/skipped
  rows_read INT DEFAULT 0,                          -- 读取行数
  rows_upserted INT DEFAULT 0,                      -- 写入/更新行数
  rows_skipped INT DEFAULT 0,                        -- 跳过行数
  error_message TEXT,                               -- 错误信息

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_job_log_site ON sync_job_log(source_site_id);
CREATE INDEX IF NOT EXISTS idx_sync_job_log_table ON sync_job_log(source_table);
CREATE INDEX IF NOT EXISTS idx_sync_job_log_started ON sync_job_log(started_at);
CREATE INDEX IF NOT EXISTS idx_sync_job_log_status ON sync_job_log(status);
CREATE INDEX IF NOT EXISTS idx_sync_job_log_job ON sync_job_log(job_id);

-- ============================================================
-- 1. unified_tasks - 任务统一表
-- ============================================================
-- 来源：tbl_task 或 tbl_store_task
-- 注意：只存储任务元数据，不存储文件明细
-- ============================================================
CREATE TABLE IF NOT EXISTS unified_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,               -- 源站点代码 (如: SH01)
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_task',
  source_id VARCHAR(100) NOT NULL,                   -- 源记录ID
  synced_at TIMESTAMPTZ DEFAULT NOW(),               -- 同步时间

  -- 任务基本信息
  task_no VARCHAR(100),                             -- 任务编号
  task_name VARCHAR(200),                           -- 任务名称
  task_type VARCHAR(50),                             -- 任务类型: backup/restore/package/export
  status VARCHAR(50),                               -- 状态
  phase VARCHAR(50),                                -- 当前阶段
  priority VARCHAR(20),                            -- 优先级

  -- 数据分类
  data_classification VARCHAR(100),                 -- 数据分类
  archive_name VARCHAR(200),                         -- 归档名称

  -- 存储路径
  source_path VARCHAR(1000),                        -- 源路径
  package_path VARCHAR(1000),                        -- 打包路径
  volume_id VARCHAR(100),                           -- 存储卷ID

  -- 设备信息
  device_id VARCHAR(100),                           -- 设备ID
  rack_id VARCHAR(100),                             -- 盘架ID

  -- 操作信息
  operator VARCHAR(100),                            -- 操作员
  department VARCHAR(100),                           -- 部门
  notes TEXT,                                       -- 备注

  -- 统计字段（汇总值，非文件明细）
  total_files BIGINT DEFAULT 0,                     -- 文件数量统计
  total_size BIGINT DEFAULT 0,                      -- 总大小统计（字节）

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 原始数据（用于追溯）
  raw_data JSONB DEFAULT '{}',

  -- 来源追溯唯一约束
  UNIQUE(source_site_id, source_table, source_id)
);

CREATE INDEX IF NOT EXISTS idx_tasks_site ON unified_tasks(source_site_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON unified_tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON unified_tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_tasks_no ON unified_tasks(task_no);

-- ============================================================
-- 2. unified_devices - 设备统一表
-- ============================================================
-- 来源：tbl_disc_lib
-- ============================================================
CREATE TABLE IF NOT EXISTS unified_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,               -- 源站点代码
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_disc_lib',
  source_id VARCHAR(100) NOT NULL,                   -- 源记录ID
  synced_at TIMESTAMPTZ DEFAULT NOW(),               -- 同步时间

  -- 设备基本信息
  device_id VARCHAR(100),                           -- 设备ID
  device_name VARCHAR(200),                          -- 设备名称
  device_type VARCHAR(50),                          -- 设备类型: disc_library/hard_disk/tape
  model VARCHAR(100),                               -- 型号
  manufacturer VARCHAR(100),                        -- 厂商
  serial_no VARCHAR(100),                           -- 序列号
  ip_address VARCHAR(50),                           -- IP地址

  -- 设备位置
  site_code VARCHAR(50),                             -- 站点编码
  location VARCHAR(200),                             -- 位置

  -- 设备容量
  total_capacity BIGINT,                             -- 总容量 (bytes)
  used_capacity BIGINT,                             -- 已用容量
  slot_count INT,                                    -- 槽位数量
  cage_count INT DEFAULT 0,                         -- 笼子数量
  floor VARCHAR(50),                                -- 楼层
  room VARCHAR(100),                                -- 机房

  -- 设备状态
  status VARCHAR(50),                              -- 状态: online/offline/error
  mode VARCHAR(50),                                 -- 工作模式: read/write/off
  use_status SMALLINT DEFAULT 0,                     -- 使用状态
  current_task_count INT DEFAULT 0,                  -- 当前任务数

  -- 原始数据
  raw_data JSONB DEFAULT '{}',

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(source_site_id, source_table, source_id)
);

CREATE INDEX IF NOT EXISTS idx_devices_site ON unified_devices(source_site_id);
CREATE INDEX IF NOT EXISTS idx_devices_type ON unified_devices(device_type);
CREATE INDEX IF NOT EXISTS idx_devices_status ON unified_devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_id ON unified_devices(device_id);

-- ============================================================
-- 3. unified_slots - 槽位统一表
-- ============================================================
-- 来源：tbl_slots
-- ============================================================
CREATE TABLE IF NOT EXISTS unified_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_slots',
  source_id VARCHAR(100) NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW(),

  -- 槽位信息
  slot_id VARCHAR(100),                              -- 槽位ID
  slot_index INT,                                    -- 槽位索引
  device_id VARCHAR(100),                            -- 所属设备ID
  magazine_id VARCHAR(100),                         -- 所属magazine ID

  -- 槽位状态
  status VARCHAR(50),                               -- 状态: empty/occupied/reserved
  occupied BOOLEAN DEFAULT FALSE,                    -- 是否占用
  media_id VARCHAR(100),                            -- 介质ID (如果有)
  media_type VARCHAR(50),                           -- 介质类型: hdd/bd/offline

  -- 容量信息
  capacity VARCHAR(50),                              -- 容量

  -- 原始数据
  raw_data JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(source_site_id, source_table, source_id)
);

CREATE INDEX IF NOT EXISTS idx_slots_device ON unified_slots(device_id);
CREATE INDEX IF NOT EXISTS idx_slots_status ON unified_slots(status);

-- ============================================================
-- 4. unified_magazines - Magazine 统一表
-- ============================================================
-- 来源：tbl_magzines
-- ============================================================
CREATE TABLE IF NOT EXISTS unified_magazines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_magzines',
  source_id VARCHAR(100) NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW(),

  -- Magazine 信息
  magazine_id VARCHAR(100),                         -- Magazine ID
  barcode VARCHAR(100),                              -- 条码
  rfid VARCHAR(100),                                -- RFID
  device_id VARCHAR(100),                           -- 所属设备

  -- Magazine 状态
  status VARCHAR(50),                               -- 状态: in_library/in_drive/exported
  position VARCHAR(50),                             -- 位置

  -- 容量
  slot_count INT,                                   -- 槽位数

  -- 原始数据
  raw_data JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(source_site_id, source_table, source_id)
);

CREATE INDEX IF NOT EXISTS idx_magazines_device ON unified_magazines(device_id);
CREATE INDEX IF NOT EXISTS idx_magazines_barcode ON unified_magazines(barcode);

-- ============================================================
-- 5. unified_drivers - 驱动器统一表
-- ============================================================
-- 来源：tbl_drivers
-- ============================================================
CREATE TABLE IF NOT EXISTS unified_drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_drivers',
  source_id VARCHAR(100) NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW(),

  -- 驱动器信息
  driver_id VARCHAR(100),                           -- 驱动器ID
  driver_index INT,                                  -- 驱动器索引
  device_id VARCHAR(100),                            -- 所属设备
  serial_no VARCHAR(100),                           -- 序列号

  -- 驱动器状态
  status VARCHAR(50),                               -- 状态: idle/busy/error/offline
  current_media_id VARCHAR(100),                    -- 当前介质ID
  operation_type VARCHAR(50),                       -- 操作类型: read/write/idle

  -- 原始数据
  raw_data JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(source_site_id, source_table, source_id)
);

CREATE INDEX IF NOT EXISTS idx_drivers_device ON unified_drivers(device_id);
CREATE INDEX IF NOT EXISTS idx_drivers_status ON unified_drivers(status);

-- ============================================================
-- 6. unified_hard_disks - 硬盘统一表
-- ============================================================
-- 来源：tbl_hd_info
-- ============================================================
CREATE TABLE IF NOT EXISTS unified_hard_disks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_hd_info',
  source_id VARCHAR(100) NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW(),

  -- 硬盘信息
  disk_id VARCHAR(100),                             -- 硬盘ID
  device_id VARCHAR(100),                           -- 所属设备
  slot_index INT,                                   -- 槽位索引

  -- 硬盘规格
  capacity VARCHAR(50),                             -- 容量
  model VARCHAR(100),                                -- 型号
  serial_no VARCHAR(100),                           -- 序列号

  -- 硬盘状态
  status VARCHAR(50),                               -- 状态: online/offline/error
  used_capacity BIGINT,                            -- 已用容量
  total_capacity BIGINT,                           -- 总容量
  health_status VARCHAR(50),                        -- 健康状态

  -- 原始数据
  raw_data JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(source_site_id, source_table, source_id)
);

CREATE INDEX IF NOT EXISTS idx_harddisks_device ON unified_hard_disks(device_id);
CREATE INDEX IF NOT EXISTS idx_harddisks_status ON unified_hard_disks(status);

-- ============================================================
-- 7. unified_volumes - 存储卷统一表
-- ============================================================
-- 来源：tbl_logical_volume
-- ============================================================
CREATE TABLE IF NOT EXISTS unified_volumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_logical_volume',
  source_id VARCHAR(100) NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW(),

  -- 卷信息
  volume_id VARCHAR(100),                           -- 卷ID
  volume_name VARCHAR(200),                          -- 卷名称
  volume_type VARCHAR(50),                          -- 卷类型: hdd/bd/offline

  -- 存储信息
  capacity VARCHAR(50),                             -- 容量
  used_capacity BIGINT,                            -- 已用容量
  file_count INT,                                  -- 文件数量
  site_code VARCHAR(50),                           -- 所属站点
  device_id VARCHAR(100),                          -- 所属设备

  -- 卷状态
  status VARCHAR(50),                              -- 状态: online/offline/archiving
  health_status VARCHAR(50),                        -- 健康状态

  -- 审计信息
  created_by VARCHAR(100),                         -- 创建人
  created_at_ts TIMESTAMPTZ,                        -- 创建时间

  -- 原始数据
  raw_data JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(source_site_id, source_table, source_id)
);

CREATE INDEX IF NOT EXISTS idx_volumes_site ON unified_volumes(site_code);
CREATE INDEX IF NOT EXISTS idx_volumes_status ON unified_volumes(status);
CREATE INDEX IF NOT EXISTS idx_volumes_type ON unified_volumes(volume_type);

-- ============================================================
-- 8. unified_alerts - 告警统一表
-- ============================================================
-- 来源：tbl_early_warning
-- ============================================================
CREATE TABLE IF NOT EXISTS unified_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_early_warning',
  source_id VARCHAR(100) NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW(),

  -- 告警信息
  alert_id VARCHAR(100),                            -- 告警ID
  device_id VARCHAR(100),                           -- 设备ID
  alert_type VARCHAR(100),                         -- 告警类型
  alert_level VARCHAR(20),                         -- 告警级别: info/warning/error/critical
  alert_code VARCHAR(50),                          -- 告警代码

  -- 告警内容
  message TEXT,                                    -- 告警消息
  description TEXT,                                -- 详细描述

  -- 时间和状态
  occurred_at TIMESTAMPTZ,                          -- 发生时间
  resolved_at TIMESTAMPTZ,                          -- 解决时间
  status VARCHAR(50),                              -- 状态: active/resolved/ignored

  -- 关联信息
  task_id VARCHAR(100),                            -- 关联任务ID
  rack_id VARCHAR(100),                            -- 关联盘架ID

  -- 原始数据
  raw_data JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(source_site_id, source_table, source_id)
);

CREATE INDEX IF NOT EXISTS idx_alerts_site ON unified_alerts(source_site_id);
CREATE INDEX IF NOT EXISTS idx_alerts_device ON unified_alerts(device_id);
CREATE INDEX IF NOT EXISTS idx_alerts_level ON unified_alerts(alert_level);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON unified_alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_occurred ON unified_alerts(occurred_at);

-- ============================================================
-- 9. unified_device_groups - 设备组统一表
-- ============================================================
-- 来源：tbl_lib_group
-- ============================================================
CREATE TABLE IF NOT EXISTS unified_device_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_lib_group',
  source_id VARCHAR(100) NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW(),

  -- 设备组信息
  group_id VARCHAR(100),                            -- 组ID
  group_name VARCHAR(200),                          -- 组名称
  group_type VARCHAR(50),                           -- 组类型: device/volume/custom
  parent_group_id VARCHAR(100),                      -- 上级组ID
  site_code VARCHAR(50),                           -- 所属站点

  -- 配置信息
  description TEXT,                                -- 描述
  config JSONB DEFAULT '{}',                        -- 配置

  -- 网络挂载配置
  protocol VARCHAR(20),                             -- 协议: CIFS/NFS
  mount_path VARCHAR(500),                          -- 挂载路径
  manage_path VARCHAR(500),                         -- 管理路径

  -- 原始数据
  raw_data JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(source_site_id, source_table, source_id)
);

CREATE INDEX IF NOT EXISTS idx_devicegroups_site ON unified_device_groups(site_code);
CREATE INDEX IF NOT EXISTS idx_devicegroups_type ON unified_device_groups(group_type);

-- ============================================================
-- 10. unified_users - 用户统一表
-- ============================================================
-- 来源：tbl_user
-- ============================================================
CREATE TABLE IF NOT EXISTS unified_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_user',
  source_id VARCHAR(100) NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW(),

  -- 用户基本信息
  user_id VARCHAR(100),                             -- 用户ID
  username VARCHAR(100) NOT NULL,                   -- 用户名
  display_name VARCHAR(200),                         -- 显示名称
  email VARCHAR(200),                               -- 邮箱
  phone VARCHAR(50),                               -- 电话

  -- 权限信息
  role VARCHAR(50),                                -- 角色: admin/operator/viewer
  department VARCHAR(100),                         -- 部门
  accessible_sites TEXT[],                        -- 可访问站点列表

  -- 状态
  status VARCHAR(50),                              -- 状态: active/inactive/locked

  -- 原始数据
  raw_data JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(source_site_id, source_table, source_id)
);

CREATE INDEX IF NOT EXISTS idx_users_username ON unified_users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON unified_users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON unified_users(status);

-- ============================================================
-- 时间戳触发器函数
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为所有 unified_* 表和 sync_* 表添加 updated_at 触发器
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'sync_sites', 'sites', 'sync_progress',
    'unified_tasks', 'unified_devices', 'unified_slots',
    'unified_magazines', 'unified_drivers', 'unified_hard_disks',
    'unified_volumes', 'unified_alerts', 'unified_device_groups',
    'unified_users'
  ]
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS update_%s_updated_at ON %s;',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON %s
       FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();',
      tbl, tbl
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql;