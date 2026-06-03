# Sprint 2B.14 — 真实关联表探索 + 前端接真实数据前置设计

> **日期**: 2026-06-03
> **范围**: 只做查询和分析，不写代码、不改数据库、不改 mapper、不改前端
> **数据源**: pg_restore_test (star_storage_db) + unified_disc_postgres (source_restore) + tbl_task状态.docx

---

## 一、tbl_task 状态文档整理

### 1.1 task_type 枚举

| 值 | 含义 |
|----|------|
| 0 | 备份任务 |
| 1 | 恢复任务 |
| 2 | 刻录并封盘 |
| 3 | EPSON光盘刻录打印一体机任务 |
| 4 | 扫描任务 |
| 5 | 磁光复制任务 |
| 6 | 卷复制任务 |
| 7 | S3任务 |
| 8 | 封包任务 |
| 9 | 存证任务 |
| 10 | 加电任务 |

### 1.2 task_mode 枚举

| task_type | mode | 含义 |
|-----------|------|------|
| 0（备份） | 0 | 多台设备顺序刻录 |
| 0（备份） | 1 | 多台设备并行刻录 |
| 0（备份） | 2 | 视频合并顺序刻录 |
| 0（备份） | 3 | 视频合并并行刻录 |
| 0（备份） | 5 | 硬盘预分配任务 |
| 0（备份） | 6 | 硬盘克隆任务 |
| 0（备份） | 7 | 硬盘RAID任务 |
| 0（备份） | 8 | 封包离线接收备份任务 |
| 0（备份） | 9 | 硬盘修复任务（从源数据重新备份） |
| 0（备份） | 10 | 离线接收校验（灾备） |
| 1（恢复） | 0 | 普通恢复任务 |
| 1（恢复） | 7 | 硬盘RAID修复任务 |
| 1（恢复） | 11 | 光盘卷到硬盘卷/磁盘卷复制任务 |
| 1（恢复） | 12 | 介质巡检任务（包含内置硬盘、光盘） |
| 1（恢复） | 13 | ISO在线巡检 |
| 1（恢复） | 14 | ISO介质巡检 |
| 3（接口） | 0 | EPSON出版接口任务 |
| 4（扫描） | 0 | 归档硬盘入库扫描任务 |
| 4（扫描） | 1 | 归档盘文件检测任务 |
| 4（扫描） | 10 | 扫描移动硬盘数据到接收卷入库任务 |
| 5（磁光复制） | 0 | 硬盘卷/磁盘卷到光盘卷复制任务 |
| 6（卷复制） | 0 | 硬盘卷到硬盘卷/磁盘卷 |
| 6（卷复制） | 10 | 接收卷到磁盘卷复制任务 |
| 7（S3） | 0 | 外挂S3数据源归档任务 |
| 8（封包） | 8 | 文件迁移（不生成ISO） |
| 8（封包） | 9 | 仅封包 |
| 8（封包） | 10 | 仅扫描 |
| 8（封包） | 11 | 先扫描后封包 |
| 8（封包） | 12 | 边扫描边封包 |
| 9（存证） | 0 | 存证任务 |
| 10（加电） | 0 | 加电任务 |

### 1.3 status 枚举（关键：status 含义依赖 task_type）

#### task_type = 0（备份）/ 2（刻录并封盘）/ 3（EPSON光盘刻录打印一体机任务）

这三种类型共享同一组状态定义：

| status | 含义 | 真实数据中出现（type=0） |
|--------|------|------------------------|
| 0 | 刻录成功 | ✅ 26条 |
| 1 | 数据准备中 | ❌ |
| 2 | 任务取消 | ✅ 1条 |
| 3 | Restful接口插入tbl_folder与tbl_file表后准备就绪 | ❌ |
| 4 | 视频下载任务项目添加完成 | ❌ |
| 5 | 视频下载任务准备成功，可以开始下载 | ❌ |
| 6 | 就绪 | ❌ |
| 7 | 远程备份任务创建完成待处理 | ✅ 1条 |
| 10 | 刻录失败 | ❌ |
| 13 | S3数据准备中 | ❌ |
| 19 | MakeTask成功完成，正在备份 | ✅ 4条 |
| 20 | 任务暂停 | ✅ 4条 |
| 21 | 计划任务没有修改或新增的文件 | ❌ |
| 22 | MakeTask已启动扫描，未完成（status≠3时） | ❌ |
| 23 | MakeTask已启动扫描，未完成（status=3时） | ❌ |
| 29 | 已生成JDF文件 | ❌ |

#### task_type = 1（恢复任务）

| status | 含义 |
|--------|------|
| 0 | 下载成功 |
| 1 | 开始回迁任务 |
| 3 | Restful接口插入tbl_ft_file表后准备就绪 |
| 6 | 数据从光盘上读取完成 |
| 7 | 数据从光盘上读取出错 |
| 9 | 正在光盘中读取 |
| 10 | 读取失败 |
| 11 | 警告 回迁出错 |
| 20 | 任务暂停 |

### 1.4 真实数据中出现的 status 值（全部 task_type=0）

| status | 数量 | 含义 |
|--------|------|------|
| 0 | 26 | 刻录成功 |
| 2 | 1 | 任务取消 |
| 7 | 1 | 远程备份任务创建完成待处理 |
| 19 | 4 | MakeTask成功完成，正在备份 |
| 20 | 4 | 任务暂停 |

**结论**：status 必须与 task_type 组合才能确定含义。`raw_status_<value>` 方式信息不足，应改为 `task_type + status` 组合映射。

### 1.5 iso_status 枚举

| iso_status | 含义 |
|------------|------|
| NULL | 等待任务处理 |
| 0 | 等待生成ISO |
| 1 | 成功生成ISO |
| 2 | 正在刻录ISO |
| 3 | 成功刻录ISO |
| 4 | 回迁时需要抓取ISO，不抓取ISO为NULL |
| 5 | 抓取ISO后再拷贝数据到ISO目录，再删除ISO |
| 6 | 多副本刻录时副本初始状态，前一张光盘刻录完成后置为1，再继续刻录下一份 |
| 7 | 归档版校验错误后检查ISO失败，需重新生成ISO |
| 10 | 正在生成ISO |
| 11 | 生成ISO错误 |
| 12 | 不用生成ISO |
| 13 | 故障转移到另外库的中间状态 |
| 14 | 磁带生产ISO文件（test_tape=4时，tbl_disc表会有多条记录） |
| 15 | 接收光盘，扫描目录入库 |

---

## 二、任务关联表探索

### 2.1 tbl_task（source_restore 中 37 条）

任务表是核心表。当前 source_restore 中已导入 37 条，全部 task_type=0（备份任务）。完整 pg_restore_test 中可查询其他关联表。

关键字段：
- `task_name`：大部分为 null，少数为 "Task1"，更接近备注字段而非任务名称
- `task_mode`：0（顺序刻录）或 5（硬盘预分配）
- `cmt`：全部为空
- `no`：任务序号（1-28）
- `archive_name`：null
- `encrypt`：null

### 2.2 tbl_user_task（star_storage_db，28 条）

**关联表**：连接 tbl_user 和 tbl_task。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint | PK |
| user_id | integer | → tbl_user.id |
| task_id | integer | → tbl_task.id（跨库关联，task 数据在 source_restore） |

**数据**：28 条记录，全部 user_id=1（admin 用户）。

**发现**：source_restore 中无此表，说明 tbl_user_task 是管控平台自身的表，不是源系统表。关联链路：

```
star_storage_db.tbl_user_task (user_id, task_id)
  ├── user_id → star_storage_db.tbl_user (admin/sec_admin/aud_admin)
  └── task_id → 源系统 tbl_task.id（source_restore）
```

### 2.3 tbl_user（star_storage_db，3 条）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | integer | PK |
| user_name | text | admin / sec_admin / aud_admin |
| real_name | text | 管理员 / 安全管理员 / 审计管理员 |
| email | text | |
| mobile | text | |
| department | integer | → tbl_depa.id（但 tbl_depa 为空） |
| status | integer | |

**数据**：3 条系统账号，均无 department 关联（tbl_depa 为空）。

### 2.4 tbl_depa（star_storage_db，0 条）

部门表，当前为空。

### 2.5 tbl_depa_user（star_storage_db，0 条）

部门-用户关联表，当前为空。

### 2.6 tbl_depa_user_info（star_storage_db，0 条）

| 字段 | 类型 |
|------|------|
| id | bigint |
| depa_id | integer |
| user_id | integer |
| fuc_id | integer |
| create_time | timestamp |
| update_time | timestamp |
| del_status | smallint |

当前为空。

### 2.7 tbl_lib_task（star_storage_db，86 条）

**关键关联表**：连接 tbl_task 和 tbl_disc_lib。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint | PK |
| task_id | integer | → tbl_task.id |
| disc_id | integer | → tbl_disc.id |
| task_status | integer | 设备任务状态 |
| command | text | CopyHdDrive / StartOneMakeIso |
| lib_id | integer | → tbl_disc_lib.lib_id |
| drive | integer | 驱动器编号 |
| start_dt | timestamp | |
| end_dt | timestamp | |
| cmt | text | |

**数据示例**：
```
task_id=1, disc_id=1, lib_id=1, drive=0, command=CopyHdDrive
task_id=3, disc_id=5, lib_id=2, drive=101, command=StartOneMakeIso
```

**结论**：此表可提供"任务使用了哪台设备"的信息，是补充 unified_tasks 设备关联的关键。

### 2.8 tbl_disc（star_storage_db，65 条）

**任务-光盘关联表**：记录每个任务刻录的光盘详情。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | integer | PK |
| task_id | bigint | → tbl_task.id |
| disc_num | integer | 光盘编号 |
| slot_id | integer | → tbl_slots.id |
| burn_success | integer | 刻录是否成功 |
| used_size | bigint | 已用大小 |
| disc_label | text | 光盘标签 |
| iso_status | smallint | ISO 状态 |
| iso_path | text | ISO 路径 |
| stage | smallint | 阶段 |
| burn_errors | smallint | 刻录错误数 |
| error_files | integer | 错误文件数 |
| create_dt | timestamp | |
| update_dt | timestamp | |

**结论**：可用于统计任务的 total_files / total_size（通过 sum used_size），以及光盘级状态。

### 2.9 tbl_task_projects（0 条）

项目表，当前为空。

### 2.10 任务关联表汇总

| 表 | 位置 | 记录数 | 能补充什么 |
|----|------|--------|-----------|
| tbl_user_task | star_storage_db | 28 | 任务→用户映射 |
| tbl_user | star_storage_db | 3 | 用户名/部门（但 department 为空） |
| tbl_depa | star_storage_db | 0 | 部门名称（空） |
| tbl_lib_task | star_storage_db | 86 | 任务→设备映射 |
| tbl_disc | star_storage_db | 65 | 任务→光盘映射，used_size 可算 total_size |

**能否补充 unified_tasks.operator？**
- 部分可以。通过 tbl_user_task → tbl_user 可获取 user_name/real_name。
- 但当前所有 28 条关联的都是 admin 用户，不是真正的操作员。
- 真实操作员信息可能在源系统（leader 发的备份中）。

**能否补充 unified_tasks.department？**
- 当前不能。tbl_depa 为空，tbl_user.department 无有效值。

**能否提供任务名/备注？**
- tbl_task.task_name 大部分为空，少数为 "Task1"，不是有意义的任务名。
- tbl_task.cmt 全部为空。
- tbl_task.no（1-28）是任务序号，可作为辅助标识。

---

## 三、设备关联表探索

### 3.1 tbl_disc_lib（source_restore 4 条 / star_storage_db 4 条）

设备主表，两张库数据相同。

| lib_id | name | type | device_status | ip | vendor | model | sn | mags | slots | slots_per_mag | group_id |
|--------|------|------|--------------|-----|--------|-------|-----|------|-------|--------------|----------|
| 1 | HD32-X | 8 (hdd_library) | 1 (online) | 127.0.0.1 | STARSHINE | model43 | emx801 | 4 | 96 | 24 | 0 |
| 2 | BD200 | 6 (gen3_library) | 1 (online) | 127.0.0.1 | STARSHINE | model255 | emx601 | 1 | 200 | 200 | 0 |
| 3 | BD100 | 6 (gen3_library) | 1 (online) | 127.0.0.1 | STARSHINE | model255 | emx602 | 1 | 100 | 100 | 0 |
| 4 | ntest | null | 0 (offline) | 172.168.1.1 | vtest | mtest | stest | null | null | null | 1 |

### 3.2 tbl_magzines（star_storage_db，6 条）

**盘笼表**，关联 tbl_disc_lib。

| 字段 | 类型 | 说明 |
|------|------|------|
| mag_id | integer | PK |
| name | text | 盘笼名称 |
| lib_id | integer | → tbl_disc_lib.lib_id |
| slot_count | integer | 盘位数量 |
| use_status | integer | 使用状态 |
| status | integer | 状态 |
| site_code | text | 站点编码 |
| create_time | timestamp | |
| update_time | timestamp | |

**数据**：
```
mag_id=1, lib_id=1 (HD32-X), slot_count=24
mag_id=2, lib_id=1 (HD32-X), slot_count=24
mag_id=3, lib_id=1 (HD32-X), slot_count=24
mag_id=4, lib_id=2 (BD200), slot_count=200
mag_id=5, lib_id=3 (BD100), slot_count=100
mag_id=6, lib_id=2 (BD200), slot_count=200
```

**结论**：可补充设备的盘笼数量和盘位分布。但注意 lib_id=1 有 3 个盘笼（对应 mags=4 中的 3 个有数据），实际 slots_per_mag=24。

### 3.3 tbl_slots（star_storage_db，396 条）

**盘位表**，关联 tbl_magzines。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | integer | PK |
| slot_type | smallint | 盘位类型 |
| lib_id | integer | → tbl_disc_lib.lib_id |
| mag_id | integer | → tbl_magzines.mag_id |
| slot | integer | 盘位序号 |
| status | smallint | 状态 |
| volume_id | integer | → tbl_logical_volume.id |
| create_time | timestamp | |
| update_time | timestamp | |
| used_capacity | bigint | 已用容量 |
| total_capacity | bigint | 总容量 |
| del_status | smallint | |

**统计数据**：
```
lib_id | mag_id | count | slots
1      | 1      | 24    | 0-23
1      | 2      | 24    | 0-23
1      | 3      | 24    | 0-23
2      | 4      | 100   | 0-99
2      | 6      | 100   | 0-99
3      | 5      | 100   | 0-99
```

**注意**：BD200 的 lib_id=2 有两个盘笼（mag_id=4 和 6），每个 100 盘位，但 tbl_disc_lib.slots=200。

**容量信息**：
- 大部分 slot 的 used_capacity=0, total_capacity=0
- 有 volume 关联的 slot 有容量数据

### 3.4 tbl_logical_volume（star_storage_db，3 条）

**逻辑卷表**。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | integer | PK |
| volume_name | text | 卷名 |
| volume_size | bigint | 总大小 |
| file_type | text | 文件系统类型 |
| create_time | timestamp | |
| update_time | timestamp | |
| volume_type | smallint | 卷类型 |
| used_size | bigint | 已用大小 |
| status | smallint | |
| del_status | smallint | |
| mkfs_options | text | 格式化选项 |
| pre_alloc | boolean | 是否预分配 |
| allocated_size | bigint | 已分配大小 |
| over_provision | boolean | 超额配置 |

**数据**：
```
id=1, volume_name=HV1, volume_size=1048576000 (~1GB), file_type=ntfs, used_size=104857600, allocated_size=0
id=2, volume_name=OV1, volume_size=1048576000 (~1GB), file_type=udf, used_size=0, allocated_size=0
id=100, volume_name=OV100, volume_size=1048576000 (~1GB), file_type=udf, used_size=0, allocated_size=0
```

### 3.5 tbl_volume_slot（star_storage_db，161 条）

**卷-盘位关联表**。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint | PK |
| volume_id | integer | → tbl_logical_volume.id |
| slot_id | integer | → tbl_slots.id |
| create_time | timestamp | |
| update_time | timestamp | |

**统计**：
```
volume_id | count | 说明
1 (HV1)  | 100   | 硬盘卷，占 100 个盘位
2 (OV1)  | 60    | 光盘卷，占 60 个盘位
100 (OV100) | 1 | 光盘卷，占 1 个盘位
```

### 3.6 tbl_hd_info（star_storage_db，8 条）

**硬盘信息表**。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | integer | PK |
| model | text | 型号 |
| health | integer | 健康状态 |
| temperature | integer | 温度 |
| serial_number | text | 序列号 |
| host | text | 主机 |
| hd_type | integer | 硬盘类型 |
| total_size | bigint | 总容量 |
| used_size | bigint | 已用容量 |
| lib_id | integer | → tbl_disc_lib.lib_id |
| site_code | text | 站点编码 |
| front_slot | integer | 前置盘位号 |
| back_slot | integer | 后置盘位号 |
| ... | | 更多健康/寿命字段 |

**数据**：8 条硬盘，model 包括 ST8000NM0055-1RM112、WD80EMZZ-11B7NB2 等，均为 8TB 级别。

**与 tbl_disc_lib 关联**：lib_id 字段。

### 3.7 其他设备相关表

| 表 | 记录数 | 说明 |
|----|--------|------|
| tbl_lib_group | 0 | 设备分组（空） |
| tbl_volume_group | 0 | 卷组（空） |
| tbl_site | 0 | 站点表（空） |
| tbl_cd_cabinet | 0 | 光盘柜（空） |
| tbl_slot_type | 2 | 盘位类型定义 |

### 3.8 设备关联表汇总

| 表 | 记录数 | 能补充什么 |
|----|--------|-----------|
| tbl_magzines | 6 | 设备盘笼数量、盘位分布 |
| tbl_slots | 396 | 盘位详情、容量、状态 |
| tbl_logical_volume | 3 | 逻辑卷容量 |
| tbl_volume_slot | 161 | 卷-盘位映射 |
| tbl_hd_info | 8 | 硬盘型号、健康、容量 |
| tbl_lib_task | 86 | 任务-设备关联 |

**能否补充 unified_devices.location / room / floor？**
- 当前不能。这些字段不在数据库表中，来自部署环境信息。
- tbl_disc_lib 和 tbl_site（空）均无 location 字段。

**能否补充 unified_devices.total_capacity / used_capacity？**
- 可以从 tbl_slots 聚合：`SUM(total_capacity)`, `SUM(used_capacity) GROUP BY lib_id`
- 但当前大部分 slot 的容量为 0（未格式化的空盘位）
- tbl_hd_info 有硬盘级容量，更适合汇总

**是否需要新增 unified_magazines / unified_slots / unified_hard_disks？**
- 数据量小（6 mag + 396 slot + 8 hd），但结构各异，独立建表与 JSONB 嵌入各有优劣。
- 关联数据后续可选择：查询时聚合、独立 unified_magazines/unified_slots/unified_hard_disks 表，或 detail_data JSONB。
- **当前不做 schema 变更，需单独设计方案后再决定。**

---

## 四、Mapper 重新评估

### 4.1 Task Status Mapper

**当前**：`raw_status_<value>` — 信息不足。

**建议**：改为 `task_type + status` 组合映射。

```
task_type=0/2/3 + status=0  → "burn_success"     (刻录成功)
task_type=0/2/3 + status=1  → "data_preparing"    (数据准备中)
task_type=0/2/3 + status=2  → "task_cancelled"    (任务取消)
task_type=0/2/3 + status=3  → "ready_after_api"   (Restful接口插入表后准备就绪)
task_type=0/2/3 + status=6  → "ready"             (就绪)
task_type=0/2/3 + status=7  → "remote_pending"    (远程备份任务创建完成待处理)
task_type=0/2/3 + status=10 → "burn_failed"       (刻录失败)
task_type=0/2/3 + status=19 → "making_backup"     (MakeTask成功完成，正在备份)
task_type=0/2/3 + status=20 → "task_paused"       (任务暂停)
task_type=1 + status=0      → "download_success"  (下载成功)
task_type=1 + status=1      → "restoring"         (开始回迁任务)
task_type=1 + status=7      → "read_error"        (数据从光盘上读取出错)
task_type=1 + status=10     → "read_failed"       (读取失败)
...
```

**关键**：status=0 在 type=0/2/3 下是"刻录成功"，在 type=1 下是"下载成功"。status=1 在 type=0/2/3 下是"数据准备中"，在 type=1 下是"开始回迁任务"。

**建议策略**：
1. 短期：保留英文 code，但使用组合映射而非 raw_status
2. 保持原始值在 raw_data 中
3. unified_tasks 表可考虑增加 `status_meaning` 字段（中文描述）

### 4.2 Task Status → 可读状态分组

建议将 status 分为语义组（以 type=0/2/3 为主，type=1 部分通用）：

| 语义组 | 英文 code | 覆盖的 status |
|--------|-----------|--------------|
| 成功 | success | status=0 |
| 准备中 | preparing | status=1 |
| 取消 | cancelled | status=2 |
| 就绪 | ready | status=3, 6 |
| 失败 | failed | status=10 |
| 等待远程处理 | remote_pending | status=7 |
| 进行中 | in_progress | status=19 |
| 暂停 | paused | status=20 |
| 无变更 | no_changes | status=21 |
| 扫描中 | scanning | status=22, 23 |
| 已生成JDF | jdf_generated | status=29 |

### 4.3 task_name

**当前写入**：`source.task_name ?? null`

**发现**：真实数据中大部分为 null，少数为 "Task1"。不是有意义的任务名称。

**建议**：
- 继续写入 task_name（不改字段名），但文档说明它是"备注/别名"字段
- 可从 tbl_task.no（序号）生成 task_no：如 `task_no = siteCode + "-" + task.no`
- 或保持 task_no = String(source.id)

### 4.4 task_no

**当前**：`String(source.id)` — 即源系统主键。

**评估**：
- source.id 是 PG 序列自增 ID，无业务含义
- source.no（1-28）是任务序号，但也无全局唯一性
- **建议**：task_no 可改为 `siteCode + "-" + source.id`，如 "SH01-1"，确保多站点时不冲突

### 4.5 Devices 是否需要从关联表补充

| 字段 | 当前值 | 可补充来源 | 建议 |
|------|--------|-----------|------|
| location | null | 无来源 | 暂不补充 |
| room | null | 无来源 | 暂不补充 |
| floor | null | 无来源 | 暂不补充 |
| total_capacity | null | tbl_slots / tbl_hd_info | 可通过 SUM(tbl_hd_info.total_size) WHERE lib_id=X |
| used_capacity | null | tbl_slots | 可通过 SUM(tbl_slots.used_capacity) WHERE lib_id=X |

**结论**：容量字段可通过关联表聚合补充。位置字段无数据源。

---

## 五、前端接真实数据前置设计

### 5.1 当前前端页面

| 页面 | 路径 | 数据源 |
|------|------|--------|
| 任务管理 | `/tasks` | taskProvider → TaskDTO |
| 盘架管理（设备） | `/racks` | rackProvider → RackDTO |

### 5.2 现有 API 路由

**任务**：
- `GET /api/tasks` — 列表，支持 status/type/siteCode 筛选
- `GET /api/tasks/[id]` — 详情

**设备**：
- `GET /api/racks` — 列表，支持 siteCode/status 筛选
- `GET /api/racks/[id]` — 详情
- `GET/PUT /api/racks/[id]/slots` — 盘位

**当前实现**：全部返回 Mock 数据（`lib/api/mock-providers.ts`）。

### 5.3 无 unified 路由

当前 `app/` 目录下无任何 `unified_tasks` 或 `unified_devices` 的 API 路由。

### 5.4 已有的 Provider + Adapter 模式

```
Page → Provider (interface) → Mock/API Provider → Adapter → DTO
         ↓                        ↓
   TaskProvider/RackProvider   mock-providers.ts / api-providers.ts
         ↓
   task-adapter.ts / rack-adapter.ts
         ↓
   TaskDTO / RackDTO
```

**切换方式**：`NEXT_PUBLIC_API_MODE` 环境变量（"mock" 或 "api"）。

### 5.5 前端 TaskDTO 所需字段 vs unified_tasks 现有字段

| TaskDTO 字段 | unified_tasks 现有 | 能否填充 |
|-------------|-------------------|---------|
| taskNo | task_no (=String(id)) | ✅ |
| name | task_name (大部分 null) | ⚠️ 多为空 |
| archiveName | archive_name (null) | ❌ 无数据 |
| type | task_type | ✅ |
| backupScope | 无对应 | ❌ |
| progress | 无对应 | ❌ |
| speed | 无对应 | ❌ |
| fileCount | total_files | ✅ (多数=0) |
| totalSize | total_size | ✅ (多数=0) |
| deviceName | 无对应 | ❌ 需关联 tbl_lib_task |
| phase | phase (null) | ❌ |
| operator | operator (null) | ⚠️ 需 tbl_user_task |
| department | department (null) | ❌ tbl_depa 为空 |
| sm3Status | 无对应 | ❌ |
| status | status | ✅ 但需改映射 |

### 5.6 前端 RackDTO 所需字段 vs unified_devices 现有字段

| RackDTO 字段 | unified_devices 现有 | 能否填充 |
|-------------|-------------------|---------|
| rackId | device_id (=lib_id) | ✅ |
| ip | ip_address | ✅ |
| deviceType | device_type | ✅ |
| siteName | site_code | ✅ 需 site_code → site_name |
| totalCapacity | total_capacity (null) | ⚠️ 需聚合 tbl_hd_info |
| remainingCapacity | used_capacity (null) | ⚠️ 需聚合 tbl_slots |
| usagePercent | 无 | ⚠️ 需计算 |
| usedSlots | 无 | ⚠️ 需聚合 tbl_slots |
| totalSlots | 无 | ⚠️ 需聚合 tbl_slots |
| deviceStatus | status | ✅ |
| room | room (null) | ❌ 无数据 |
| datacenter | 无 | ❌ |
| mode | 无 | ❌ |
| trays[] | 无 | ⚠️ 需 tbl_magzines |
| slots[] | 无 | ⚠️ 需 tbl_slots |
| recentTasks[] | 无 | ⚠️ 需 tbl_lib_task |
| deviceLogs[] | 无 | ❌ |

### 5.7 空字段影响评估

**Tasks 页面**：如果直接用 unified_tasks 数据
- 任务列表基本可展示：taskNo、type、status
- **严重缺失**：name（多为空）、progress、speed、deviceName
- **影响**：表格会有很多空白列，用户体验差

**Racks 页面**：如果直接用 unified_devices 数据
- 设备列表基本可展示：rackId、ip、deviceType、status
- **缺失**：capacity、slot 统计、trays、slots
- **影响**：容量条形图为空，盘位详情无法展示

### 5.8 建议：先接哪个页面？

**推荐先接 Racks（设备）页面**，原因：
1. 设备数据相对完整（4 条设备 + 关联表有盘笼/盘位数据）
2. 设备状态映射已正确（DEVICE_STATUS_MAP）
3. 设备类型映射已正确（DEVICE_TYPE_MAP）
4. 容量可通过关联表聚合补充
5. 数据量小，容易验证

**Tasks 页面暂缓**，原因：
1. status 映射需大改（需 task_type + status 组合）
2. 进度、速度等实时字段无数据源
3. 操作员/部门无有效数据
4. 需要更多设计决策

---

## 六、下一阶段候选方向

| 方向 | 内容 | 依赖 | 价值 | 建议顺序 |
|------|------|------|------|---------|
| **E** | 写阶段汇报给领导 / 确认业务字段 | 本文档探索结果 | 高（决策前置） | **1** |
| **D** | 改 task status mapper 为组合映射 | 领导确认 status 方案 | 高（正确性） | **2** |
| **B** | 扩展设备关联表 import（tbl_magzines/tbl_slots/tbl_hd_info） | 设备探索（已有） | 高（数据完整性） | **3** |
| **A** | 先做真实 devices 页面 API + 前端展示 | 方向 D+B | 高（可视化） | **4** |
| **C** | 扩展任务关联表 import（tbl_user_task/tbl_user/tbl_lib_task） | 任务探索（已有） | 中 | **5** |

**推荐执行顺序**：

1. **E. 先写阶段汇报给领导 / 确认业务字段**：汇总所有探索结果和设计决策，提交给领导确认后再动手改代码。重点确认 Q1-Q10 问题。

2. **D. 改 task status mapper**：基于领导确认的 status 方案，实现 task_type + status 组合映射。小改动，立即提升数据正确性。

3. **B. 扩展设备关联表 import**：引入 tbl_magzines、tbl_slots 聚合容量，为设备页面提供数据基础。

4. **A. 先做 devices 页面 API**：基于方向 D+B 的成果，新增 `GET /api/unified-devices` 路由，读取 unified_devices 表，适配为 RackDTO 格式。然后切换前端到 API 模式。

5. **C. 扩展任务关联表 import**：引入 tbl_user_task、tbl_lib_task，补充任务的用户和设备关联。

---

## 七、仍需领导确认的问题

### Q1: task_name 字段定位
tbl_task.task_name 实际大部分为空，少数为 "Task1"。领导已确认更接近备注字段。前端页面当前显示"任务名称"列，是否接受大部分为空？

### Q2: 操作员/部门数据
当前 tbl_user 只有 3 个系统账号（admin/sec_admin/aud_admin），tbl_depa 为空。真实操作员信息在源系统的哪个表中？是否需要额外的 dump？

### Q3: 任务进度/速度
前端当前需要 progress（进度百分比）和 speed（速度），这些是实时计算的还是存储的？统一管控平台如何获取？

### Q4: 设备容量数据
设备容量可通过 tbl_hd_info / tbl_slots 聚合计算。是否接受在 API 查询时实时聚合，还是需要在 import 时预计算？

### Q5: 设备盘位详情
前端 racks 页面需要 trays[] 和 slots[] 数据。是否需要将 tbl_magzines 和 tbl_slots 同步到中心库？

### Q6: location / room / floor
这些字段在数据库表中不存在，来自部署环境信息。是否需要站点上报这些信息？还是可以通过其他方式获取？

### Q7: tbl_user_task 归属
tbl_user_task 在 star_storage_db（管控平台）中，不在 source_restore（源系统）中。说明用户-任务关联是管控平台自行维护的，不是从源系统同步的。这个理解正确吗？

### Q8: 多 task_type 的 status 映射
当前真实数据全是 task_type=0（备份），状态文档覆盖了 type 0-4。是否需要在 mapper 中预置所有已知的 type+status 组合，还是只处理当前出现的 type=0？

### Q9: 前端切换时机
建议先接设备页面（数据较完整），任务页面延后。领导是否同意这个优先级？

### Q10: 新增关联表的同步方式
扩展设备关联表（tbl_magzines/tbl_slots/tbl_hd_info）是通过 PG dump import 流程同步，还是通过 JSON push（ingest）方式？

---

## 附录：star_storage_db 完整表清单（155 张）

主要表分类：

**任务相关**：tbl_task（不在本库）、tbl_user_task（28）、tbl_lib_task（86）、tbl_disc（65）、tbl_task_projects（0）

**用户/权限**：tbl_user（3）、tbl_role（5）、tbl_user_role（3）、tbl_privilege（49）、tbl_role_privilege（115）、tbl_depa（0）、tbl_depa_user（0）、tbl_depa_user_info（0）、tbl_token（0）

**设备相关**：tbl_disc_lib（4）、tbl_magzines（6）、tbl_slots（396）、tbl_slot_type（2）、tbl_hd_info（8）、tbl_cd_cabinet（0）、tbl_lib_group（0）

**卷相关**：tbl_logical_volume（3）、tbl_volume_slot（161）、tbl_volume_group（0）

**备份记录**：tbl_backup_record（8）、tbl_server_backup_record（12）、tbl_file_record（0）

**光盘任务**：tbl_cd_task（58）、tbl_cd（45）、tbl_cd_type（0）

**系统配置**：tbl_config（26）、tbl_sys_license（1）、tbl_sys_log（6）、tbl_site（0）、tbl_workflow_template（3）、tbl_workflow_node（9）、tbl_wf_group（2）

**ISO 相关**：tbl_iso（22）、tbl_iso_lock（0）、tbl_iso_file（0）、tbl_iso_location（0）、tbl_iso_task（0）、tbl_iso_task_sync（0）
