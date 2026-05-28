# 数据同步方案建议（修正版）

> 文档版本: v2.0
> 更新时间: 2026-05-28
> 数据源: disc_files.sql
> 目标: 统一光盘库管理平台 Demo

> 开工基线: 真实数据库接入以 `docs/database-analysis/真实数据库接入实施方案.md` 为准。本文保留方案分析口径。

---

## 一、执行摘要

| 指标 | 数值 | 说明 |
|------|------|------|
| SQL 表总数 | 146 | 排除动态表名后 |
| **P0 核心表** | **10** | 第一批同步 |
| P1 业务关联表 | 15 | 第二批同步 |
| P2 配置明细表 | 40 | 后续同步 |
| P3 暂缓表 | 81 | 大表/系统表/配置表 |

### P0 核心表清单

| 表名 | 说明 | 同步频率 |
|------|------|----------|
| `tbl_task` | 任务主表 | 5分钟 |
| `tbl_disc_lib` | 设备信息表 | 5分钟快照 |
| `tbl_slots` | 盘位/介质表 | 5分钟快照 |
| `tbl_magzines` | 盘笼/托盘表 | 5分钟快照 |
| `tbl_drivers` | 光驱信息表 | 5分钟快照 |
| `tbl_hd_info` | 硬盘信息表 | 5分钟快照 |
| `tbl_logical_volume` | 存储卷表 | 5分钟 |
| `tbl_early_warning` | 告警信息表 | 1分钟 |
| `tbl_lib_group` | 设备分组表 | 10分钟快照 |
| `tbl_user` | 用户表 | 10分钟 |

---

## 二、P0 核心表字段分析

### 2.1 tbl_task（任务主表）

**为什么放 P0**：首页任务统计、任务管理页面、任务详情

| 字段 | 类型 | 说明 | 同步用 |
|------|------|------|--------|
| `id` | bigint | 任务ID | 原始ID |
| `uuid` | varchar | UUID | 保留 |
| `task_type` | int | 任务类型（0备份/1恢复/2封盘/...） | 保留 |
| `task_name` | varchar | 任务名称 | 保留 |
| `status` | int | 任务状态 | 保留 |
| `burn_status` | tinyint | 刻录状态 | 保留 |
| `total_files` | bigint | 总文件数 | 保留 |
| `total_size` | bigint | 总大小 | 保留 |
| `create_dt` | datetime | 创建时间 | 增量同步 |
| `update_dt` | datetime | 更新时间 | **增量游标** |
| `ret_msg` | varchar | 状态信息 | 保留 |
| `data_source` | int | 数据来源 | 保留 |

### 2.2 tbl_disc_lib（设备信息表）

**为什么放 P0**：首页设备统计、设备管理页面、设备详情

| 字段 | 类型 | 说明 | 同步用 |
|------|------|------|--------|
| `lib_id` | int | 设备ID | 原始ID |
| `name` | varchar | 设备名称 | 保留 |
| `device_status` | int | 设备状态（1在线/0离线/2删除/3警告/4错误） | 状态字段 |
| `type` | int | 设备类型 | 保留 |
| `IP` | varchar | 设备IP | 保留 |
| `mags` | int | 片匣数 | 保留 |
| `slots` | int | 介质数 | 保留 |
| `group_id` | int | 分组ID | 关联 tbl_lib_group |
| `use_status` | tinyint | 使用模式 | 保留 |

### 2.3 tbl_slots（盘位/介质表）

**为什么放 P0**：盘位管理、介质详情

| 字段 | 类型 | 说明 | 同步用 |
|------|------|------|--------|
| `slot_id` | int | 介质ID | 原始ID |
| `mag_id` | int | 片匣ID | 关联 tbl_magzines |
| `disc_type` | int | 状态（0空/1新盘/2封盘/3有剩余/4损坏/5格式化中） | 保留 |
| `serial_num` | varchar | 序列号 | 保留 |
| `max_cap` | bigint | 总容量 | 保留 |
| `rest_cap` | bigint | 剩余容量 | **容量统计** |
| `hd_type` | int | 介质类型（0光盘/1硬盘/2磁带/3阵列） | 保留 |

### 2.4 tbl_early_warning（告警信息表）

**为什么放 P0**：首页告警统计、告警管理

| 字段 | 类型 | 说明 | 同步用 |
|------|------|------|--------|
| `id` | bigint | 告警ID | 原始ID |
| `title` | varchar | 告警标题 | 保留 |
| `type` | tinyint | 告警类型 | 保留 |
| `s_level` | tinyint | 告警级别（0警告/1错误/2严重/3紧急） | 保留 |
| `status` | int | 处理状态（0未开始/1处理中/2已完成） | 保留 |
| `create_date` | datetime | 创建时间 | **增量游标** |
| `lib_id` | bigint | 设备ID | 关联设备 |

---

## 三、大表处理策略

### 3.1 暂不同步的大表

| 表名 | 预估数据量 | 原因 |
|------|-----------|------|
| `tbl_file` | **几千万~几亿** | 文件级明细 |
| `tbl_folder` | **几千万** | 文件夹明细 |
| `tbl_zip_file` | **几千万** | 压缩包文件 |
| `tbl_sys_log` | **几百万~几千万** | 系统日志 |
| `tbl_file_path_archive` | **几千万** | 归档路径 |
| `tbl_check_file` / `tbl_check_files` | **几百万~几千万** | 检测文件 |

### 3.2 大表处理方案

```
┌─────────────────────────────────────────────────────────────┐
│                     大表处理决策树                          │
├─────────────────────────────────────────────────────────────┤
│  1. 目录/文件夹索引                                       │
│     └─ 同步目录元数据（名称、路径、文件数）               │
│     └─ 不同步文件级明细                                   │
│                                                         │
│  2. 归档记录                                             │
│     └─ 同步归档元数据（任务ID、卷ID、时间）               │
│     └─ 不同步具体文件列表                                 │
│                                                         │
│  3. 日志表                                               │
│     └─ 同步最近30天日志                                   │
│     └─ 历史日志按需查询                                   │
│                                                         │
│  4. 文件内容                                             │
│     └─ 只同步文件索引（名称、大小、路径、校验码）         │
│     └─ 不同步文件二进制内容                               │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 未来文件级能力方案

| 能力 | 方案 | 优先级 |
|------|------|--------|
| 文件检索 | 独立搜索索引服务（Elasticsearch） | P2 |
| 文件导出 | 按需生成导出任务，不预同步 | P2 |
| 文件预览 | 流式读取，不存储 | P3 |
| 批量操作 | 分页 + 异步任务 | P2 |

---

## 四、同步频率建议

| 数据类型 | 同步频率 | 理由 |
|----------|----------|------|
| 告警信息 | **1 分钟** | 需要及时通知 |
| 任务状态 | **5 分钟** | 实时性要求高 |
| 设备状态 | **5 分钟** | 状态变化不频繁 |
| 存储容量 | **5 分钟** | 定期刷新即可 |
| 介质信息 | **5 分钟** | 变化不频繁 |
| 用户权限 | **10 分钟** | 变更不频繁 |
| 分组配置 | **10 分钟** | 静态配置 |
| 文件索引 | **按需/定时** | 数据量大，差异同步 |
| 日志记录 | **按需** | 按时间范围拉取 |

---

## 五、增量同步策略

### 5.1 增量游标字段

```sql
-- 任务表增量
WHERE update_dt > '{{last_sync_time}}'

-- 存储卷增量
WHERE update_time > '{{last_sync_time}}'

-- 用户增量
WHERE update_time > '{{last_sync_time}}'

-- 告警表增量
WHERE create_date > '{{last_sync_time}}'
   OR id > '{{last_sync_id}}'
```

注意：`tbl_disc_lib`、`tbl_slots`、`tbl_magzines`、`tbl_drivers`、`tbl_lib_group` 未提供可靠更新时间字段，一期采用全量快照 + hash 差异 upsert，不按 `update_dt` 增量。

### 5.2 首次全量同步策略

```sql
-- 分页初始化（避免大表一次性全量同步）
SELECT * FROM tbl_task ORDER BY id LIMIT 10000 OFFSET 0;
SELECT * FROM tbl_task ORDER BY id LIMIT 10000 OFFSET 10000;
-- ... 直到全部同步完成

-- 记录同步进度
INSERT INTO sync_progress (table_name, last_id, synced_count, status)
VALUES ('tbl_task', 10000, 10000, 'syncing');
```

### 5.3 同步状态追踪

```sql
-- 同步进度表
CREATE TABLE sync_progress (
  id SERIAL PRIMARY KEY,
  table_name VARCHAR(100) NOT NULL,
  last_sync_id BIGINT DEFAULT 0,
  last_sync_time TIMESTAMP,
  total_count BIGINT DEFAULT 0,
  synced_count BIGINT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'idle',  -- idle/syncing/completed/failed
  error_msg TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 六、多站点 ID 策略

### 6.1 问题

不同站点数据库的 `id` 会冲突：
- 站点A：`tbl_task.id = 1`
- 站点B：`tbl_task.id = 1`

### 6.2 解决方案

**方案A：复合主键**

```sql
-- 统一平台中心库
CREATE TABLE unified_tasks (
  id SERIAL PRIMARY KEY,           -- 自增主键
  source_site_id VARCHAR(50) NOT NULL,    -- 来源站点ID
  source_table VARCHAR(100) NOT NULL,      -- 来源表名
  source_id BIGINT NOT NULL,              -- 原始ID
  task_name VARCHAR(255),
  status INT,
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source_site_id, source_table, source_id)
);
```

**方案B：UUID/GUID**

```sql
-- 直接使用原始 UUID
CREATE TABLE unified_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_uuid VARCHAR(64),    -- 原始 UUID
  source_site_id VARCHAR(50),
  task_name VARCHAR(255),
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 6.3 推荐方案

**采用复合主键方案**，原因：
1. 保留原始 ID，便于溯源
2. 支持多表关联查询
3. 索引效率高

### 6.4 同步元数据字段

```sql
-- 所有同步表必须包含以下字段
ALTER TABLE unified_tasks ADD COLUMN source_site_id VARCHAR(50);   -- 来源站点
ALTER TABLE unified_tasks ADD COLUMN source_db VARCHAR(100);        -- 来源数据库
ALTER TABLE unified_tasks ADD COLUMN source_table VARCHAR(100);    -- 来源表名
ALTER TABLE unified_tasks ADD COLUMN source_id BIGINT;             -- 原始主键
ALTER TABLE unified_tasks ADD COLUMN synced_at TIMESTAMP;          -- 同步时间
ALTER TABLE unified_tasks ADD COLUMN sync_status VARCHAR(20);      -- 同步状态
```

---

## 七、Staging/Mirror 表结构

### 7.1 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                      数据同步架构                          │
├─────────────────────────────────────────────────────────────┤
│                                                         │
│   站点A DB ──┐                                         │
│              │                                          │
│   站点B DB ──┼──→ [Sync Service] ──→ [Staging Area]    │
│              │                        │                  │
│   站点C DB ──┘                        ▼                  │
│                              [Data Transform]             │
│                                      │                   │
│                                      ▼                   │
│                              [Unified Center DB]         │
│                                      │                   │
│                                      ▼                   │
│                              [Web Dashboard]             │
│                                                         │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Staging Area（临时存储）

```sql
-- Staging 表：接收原始数据，暂不合并
CREATE TABLE staging_tasks (
  id SERIAL PRIMARY KEY,
  source_site_id VARCHAR(50) NOT NULL,
  raw_data JSONB NOT NULL,           -- 原始 JSON
  received_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'pending',  -- pending/processed/failed
  error_msg TEXT
);

-- 处理完成后删除 staging 数据，或归档到日志表
```

### 7.3 Mirror 表（镜像表）

```sql
-- Mirror 表：最终合并后的数据
CREATE TABLE mirror_tasks (
  id BIGSERIAL,
  source_site_id VARCHAR(50) NOT NULL,
  source_id BIGINT NOT NULL,
  task_uuid VARCHAR(64),
  task_name VARCHAR(255),
  task_type INT,
  status INT,
  total_files BIGINT,
  total_size BIGINT,
  create_dt TIMESTAMP,
  update_dt TIMESTAMP,
  synced_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(source_site_id, source_id)
);

-- 创建索引
CREATE INDEX idx_mirror_tasks_status ON mirror_tasks(status);
CREATE INDEX idx_mirror_tasks_site ON mirror_tasks(source_site_id);
CREATE INDEX idx_mirror_tasks_update ON mirror_tasks(update_dt);
```

---

## 八、实施建议

### 第一阶段（当前）

1. **确认 P0 表清单** ✅
   - 10 张核心表已确定
   - 字段已分析

2. **设计统一平台数据库 schema**
   - 确定复合主键策略
   - 设计 staging/mirror 表结构
   - 添加同步元数据字段

3. **开发增量同步脚本**
   - 支持 last_sync_time 游标
   - 支持分页初始化
   - 支持错误重试

### 第二阶段

1. **接入 P0 表**
   - 任务表（tbl_task）
   - 设备表（tbl_disc_lib）
   - 盘位表（tbl_slots）
   - 告警表（tbl_early_warning）

2. **验证同步脚本**
   - 增量同步测试
   - 分页初始化测试
   - 错误处理测试

### 第三阶段

1. **接入 P1 表**
   - 关联表（光盘、加电、刻录统计）
   - 用户权限表

2. **评估大表处理方案**
   - 文件索引服务选型
   - 搜索服务选型

---

## 九、关键技术决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 主键策略 | 复合主键 (site_id + original_id) | 保留原始 ID，便于溯源 |
| 同步频率 | 1-5 分钟 | 满足实时性需求 |
| 大表处理 | 不同步全量，按需查询 | 数据量太大 |
| 同步方式 | 增量同步 + 分页初始化 | 避免大表全量同步 |
| 错误处理 | 重试机制 + 失败日志 | 保证数据一致性 |
