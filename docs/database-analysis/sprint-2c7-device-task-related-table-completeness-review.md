# Sprint 2C.7 — 设备域 + 任务域相关小表完整性审查与第一批 import 计划

> **日期**: 2026-06-04
> **范围**: 只做审查和计划，不写业务代码
> **核心原则**: 总控表不需要复制站点源表，只做跨站点统一展示

---

## 一、当前已接入表统计

| 源表 | 当前状态 | 进入中心方式 | 中心目标 | 是否接前端 |
|------|---------|------------|---------|-----------|
| tbl_task | ✅ 已接入 | 独立 import | unified_tasks | ❌ 未接 |
| tbl_disc_lib | ✅ 已接入 | 独立 import | unified_devices | ✅ 已接 |
| tbl_magzines | ✅ 已接入 | 聚合 | unified_devices.cage_count | ✅ 已接 |
| tbl_slots | ✅ 已接入 | 聚合 | unified_devices slot/capacity 字段 | ✅ 已接 |

**统计**：
- 当前已接入源表总数：**4**
- 当前设备域已接入源表数：**3**（tbl_disc_lib + tbl_magzines + tbl_slots）
- 当前任务域已接入源表数：**1**（tbl_task）
- 当前只聚合未独立建表的源表数：**2**（tbl_magzines + tbl_slots）

---

## 二、设备域相关小表审查

### 2.1 tbl_disc_lib（设备主表）

| 维度 | 值 |
|------|-----|
| disc_files.sql | ✅ |
| pg_restore_test | ✅ 4 条 |
| source_restore | ✅ 4 条 |
| 已 import | ✅ → unified_devices |
| 主键 | lib_id |
| 前端价值 | 设备列表核心数据 |

### 2.2 tbl_magzines（盘笼表）

| 维度 | 值 |
|------|-----|
| disc_files.sql | ✅ |
| pg_restore_test | ✅ 6 条 |
| source_restore | ✅ 6 条 |
| 已 import | ✅ 聚合到 unified_devices.cage_count |
| 主键 | mag_id |
| 关联 | lib_id → tbl_disc_lib.lib_id |
| 前端价值 | 盘笼数量展示 |

### 2.3 tbl_slots（盘位表）

| 维度 | 值 |
|------|-----|
| disc_files.sql | ✅ |
| pg_restore_test | ✅ 396 条 |
| source_restore | ✅ 396 条 |
| 已 import | ✅ 聚合到 unified_devices slot/capacity |
| 主键 | slot_id |
| 关联 | mag_id → tbl_magzines.mag_id → lib_id |
| 前端价值 | 盘位数、容量、使用率 |

### 2.4 tbl_disc（光盘/介质详情表）

| 维度 | 值 |
|------|-----|
| disc_files.sql | ✅ |
| pg_restore_test | ✅ 65 条 |
| source_restore | ❌ |
| 已 import | ❌ |
| 主键 | id |
| 关联 | task_id → tbl_task.id, slot_id → tbl_slots.slot_id |
| 关键字段 | task_id, disc_num, slot_id, disc_label, used_size, iso_status, iso_path |
| 是否小表 | ✅ 65 条 |
| 建议接入 | ✅ 推荐 |
| 接入方式 | 独立 unified_disc_media 表或聚合到 unified_tasks |
| 前端价值 | 任务详情页展示光盘列表、刻录状态、ISO 状态 |

### 2.5 tbl_logical_volume（逻辑卷表）

| 维度 | 值 |
|------|-----|
| disc_files.sql | ✅ |
| pg_restore_test | ✅ 3 条 |
| source_restore | ❌ |
| 已 import | ❌ |
| 主键 | volume_id |
| 关键字段 | volume_id, name, type, total_cap, used_cap, free_cap |
| 是否小表 | ✅ 3 条 |
| 建议接入 | ⚠️ 可选 |
| 接入方式 | 独立 unified_volumes 表（已有空壳表） |
| 前端价值 | 存储卷管理页面、设备详情页展示卷信息 |

### 2.6 tbl_volume_slot（卷-盘位关联表）

| 维度 | 值 |
|------|-----|
| disc_files.sql | ✅ |
| pg_restore_test | ✅ 161 条 |
| source_restore | ❌ |
| 已 import | ❌ |
| 主键 | volume_id + slot_id |
| 关联 | volume_id → tbl_logical_volume.volume_id, slot_id → tbl_slots.slot_id |
| 是否小表 | ✅ 161 条 |
| 建议接入 | ⚠️ 与 tbl_logical_volume 一起考虑 |
| 接入方式 | 聚合到 unified_volumes 或 unified_devices |
| 前端价值 | 卷-盘位映射，设备详情页展示卷占用盘位 |

### 2.7 tbl_hd_info（硬盘健康表）

| 维度 | 值 |
|------|-----|
| disc_files.sql | ✅ |
| pg_restore_test | ✅ 8 条 |
| source_restore | ❌ |
| 已 import | ❌ |
| 主键 | slot_id |
| 关键字段 | slot_id, serial_num, model, health, hd_status, hd_online, raid_type |
| 关联 | 无 lib_id，需通过 slot_id → tbl_slots → tbl_magzines → lib_id 间接关联 |
| 是否小表 | ✅ 8 条 |
| 建议接入 | ⚠️ 可选 |
| 接入方式 | 聚合到 unified_devices 或独立 unified_hard_disks |
| 前端价值 | 设备详情页展示硬盘健康状态 |

### 2.8 tbl_lib_group（设备分组表）

| 维度 | 值 |
|------|-----|
| disc_files.sql | ✅ |
| pg_restore_test | ✅ 0 条 |
| source_restore | ❌ |
| 已 import | ❌ |
| 建议接入 | ❌ 暂不接入（空表） |

### 设备域审查结论

**设备详情页缺哪些表？**
- tbl_disc：光盘/介质详情（65 条），支持光盘列表展示
- tbl_logical_volume + tbl_volume_slot：卷信息（3+161 条），支持卷管理展示
- tbl_hd_info：硬盘健康（8 条），支持健康监控

**Racks 页面是否需要继续补？**
- 当前设备列表已完整（名称/类型/状态/容量/盘位）
- 设备详情页需要 tbl_disc + tbl_logical_volume 才能展示光盘和卷信息

**unified_magazines / unified_slots / unified_hard_disks 是否应真正使用？**
- 当前为空壳表，数据聚合到 unified_devices
- 如果做设备详情页，应启用这些表存储详细数据
- 当前阶段聚合方案足够，详情页时再启用

---

## 三、任务域相关小表审查

### 3.1 tbl_task（任务主表）

| 维度 | 值 |
|------|-----|
| disc_files.sql | ✅ |
| pg_restore_test | ✅ 37 条 |
| source_restore | ✅ 37 条 |
| 已 import | ✅ → unified_tasks |
| 主键 | id |
| 前端价值 | 任务列表核心数据 |

### 3.2 tbl_lib_task（任务-设备关联表）

| 维度 | 值 |
|------|-----|
| disc_files.sql | ✅ |
| pg_restore_test | ✅ 86 条 |
| source_restore | ❌ |
| 已 import | ❌ |
| 主键 | id |
| 关联 | task_id → tbl_task.id, lib_id → tbl_disc_lib.lib_id, disc_id → tbl_disc.id |
| 关键字段 | task_id, disc_id, lib_id, command, task_status, start_dt, end_dt, drive |
| 是否小表 | ✅ 86 条 |
| 建议接入 | ✅ **最优先** |
| 接入方式 | 聚合到 unified_tasks（补充 device_id/device_name）或独立表 |
| 前端价值 | 任务列表显示关联设备、任务详情页显示设备操作记录 |

### 3.3 tbl_user_task（用户-任务关联表）

| 维度 | 值 |
|------|-----|
| disc_files.sql | ✅ |
| pg_restore_test | ✅ 28 条 |
| source_restore | ❌ |
| 已 import | ❌ |
| 主键 | user_id + task_id |
| 关联 | user_id → tbl_user.id, task_id → tbl_task.id |
| 关键字段 | user_id, task_id, machine_uuid, os_platform, os_hostname, user_name, user_agent |
| 是否小表 | ✅ 28 条 |
| 建议接入 | ⚠️ 可选 |
| 接入方式 | 聚合到 unified_tasks（补充 operator/user_name） |
| 前端价值 | 任务列表显示操作员、操作系统信息 |
| 备注 | 全部 user_id=1（admin），数据单一 |

### 3.4 tbl_user（用户表）

| 维度 | 值 |
|------|-----|
| disc_files.sql | ✅ |
| pg_restore_test | ✅ 3 条 |
| source_restore | ❌ |
| 已 import | ❌ |
| 主键 | id |
| 关键字段 | user_name, real_name, department, email, mobile |
| 是否小表 | ✅ 3 条 |
| 建议接入 | ⚠️ 数据不足（仅系统账号） |
| 接入方式 | 独立 unified_users（已有空壳表） |
| 前端价值 | 用户管理页面 |
| 限制 | 需领导提供真实用户数据 |

### 3.5 tbl_depa（部门表）

| 维度 | 值 |
|------|-----|
| pg_restore_test | ✅ 0 条 |
| 建议接入 | ❌ 空表，暂不接入 |

### 任务域审查结论

**tasks 页面最缺哪几张表？**
1. **tbl_lib_task**（最缺）：任务关联了哪台设备，前端需要 deviceName
2. **tbl_user_task**（次缺）：任务操作员信息
3. **tbl_disc**（详情页）：任务刻录的光盘列表

**tbl_lib_task 是否是关键表？**
- ✅ 是。它是任务-设备关联的唯一桥梁
- 当前 unified_tasks 中 deviceName/deviceId 为 null
- 接入后可让任务列表显示"使用了 HD32-X"

**tbl_user / tbl_depa 数据不足是否影响？**
- 影响用户管理页面，但不影响任务核心展示
- tbl_user_task 中的 user_name 字段已包含操作员名

---

## 四、中心表与站点表关系说明

### 4.1 总控表不应复制站点表结构

站点源表保留原始业务结构（如 tbl_task 有 38 个字段），中心表只保留总控展示需要的字段。

### 4.2 字段分层

| 层 | 说明 | 示例 |
|----|------|------|
| 中心主字段 | 总控展示/查询/统计直接使用 | task_no, task_type, status, device_id |
| raw_data | 原始字段完整保留，JSON 格式 | tbl_task 全部 38 个字段 |
| source_* 追溯 | 来源标识 | source_site_id, source_table, source_id |
| 总控配置字段 | 总控独有，站点无此数据 | location, room, floor, display_name |

### 4.3 何时新增 unified_* 独立表

- 当该实体需要独立展示/查询/统计时（如 unified_tasks 列表页）
- 当该实体需要跨站点聚合时
- 当数据量足够小，中心库可承载时

### 4.4 何时只需聚合到已有表

- 当数据只是附属信息（如容量是设备的属性）
- 当不需要独立展示列表
- 当关联关系简单（1:N 可聚合）

### 4.5 如何避免中心库变成站点库复制

- 只同步总控需要的字段，不全量复制
- 大表（tbl_file/tbl_folder）不导入
- 关联表优先聚合而非独立建表
- 原始终 raw_data 保留追溯能力

---

## 五、下一批接入候选

| 优先级 | 源表 | 记录数 | 理由 | 进入方式 | 前端价值 |
|--------|------|--------|------|---------|---------|
| **1** | tbl_lib_task | 86 | 任务-设备关联关键表 | 聚合到 unified_tasks | 任务列表显示设备名 |
| **2** | tbl_disc | 65 | 光盘详情，任务产出物 | 独立表或聚合 | 任务详情光盘列表 |
| **3** | tbl_logical_volume | 3 | 逻辑卷信息 | 独立 unified_volumes | 设备/卷管理 |
| **4** | tbl_volume_slot | 161 | 卷-盘位映射 | 聚合到卷或设备 | 设备详情页 |
| 暂缓 | tbl_hd_info | 8 | 硬盘健康，无 lib_id | 需间接关联 | 设备详情页 |
| 暂缓 | tbl_user_task | 28 | 用户-任务关联 | 聚合到 unified_tasks | 任务操作员 |
| 暂缓 | tbl_user | 3 | 数据不足 | 独立表 | 用户管理 |
| 不接 | tbl_lib_group | 0 | 空表 | — | — |
| 不接 | tbl_depa | 0 | 空表 | — | — |

---

## 六、推荐 Sprint 2C.8 实现范围

### 用户倾向评估

用户倾向：tbl_lib_task + tbl_disc + (tbl_logical_volume + tbl_volume_slot 作为一组)

**评估**：

| 表 | 合理性 | 说明 |
|----|--------|------|
| tbl_lib_task | ✅ 合理 | 最高价值，任务-设备关联 |
| tbl_disc | ✅ 合理 | 中等价值，光盘详情 |
| tbl_logical_volume + tbl_volume_slot | ⚠️ 稍多 | 两张表一组可接受，但增加复杂度 |

### 推荐方案

**第一批（2C.8）**：最多 3 张表

1. **tbl_lib_task**（86 条）→ 聚合到 unified_tasks
   - 补充 device_id / device_name / command
   - 任务列表可显示关联设备
   - 需 source_restore 导入

2. **tbl_disc**（65 条）→ 聚合到 unified_tasks 或独立表
   - 补充 disc_count / total_disc_size
   - 任务详情可显示光盘列表
   - 需 source_restore 导入

3. **tbl_logical_volume**（3 条）→ 独立 unified_volumes
   - 填充已有空壳表
   - 卷管理页面可展示
   - 需 source_restore 导入

**不建议 2C.8 同时做**：
- tbl_volume_slot（161 条）：依赖 tbl_logical_volume，可后续补充
- tbl_hd_info（8 条）：无 lib_id，关联复杂，后续考虑
- tbl_user_task（28 条）：数据单一（全部 admin），价值有限

---

## 七、后续固定统计模板

```
Sprint 2C.X 完成统计
====================
本次新增接入源表：X 张
本次更新接入源表：X 张
本次同步/导入源表数量：X 张
当前累计接入源表数量：X 张
当前累计设备域源表：X 张
当前累计任务域源表：X 张
当前进入中心独立表的源表：X 张
当前仅聚合进入中心表的源表：X 张
当前暂不处理的大表：tbl_file, tbl_folder
本次新增中心表/schema patch：X
本次影响 API：X
本次影响前端：X
剩余未接入关键小表：X 张
```

**2C.7 基线统计**：
```
本次新增接入源表：0 张（审查 Sprint）
本次更新接入源表：0 张
本次同步/导入源表数量：0 张
当前累计接入源表数量：4 张
当前累计设备域源表：3 张（tbl_disc_lib, tbl_magzines, tbl_slots）
当前累计任务域源表：1 张（tbl_task）
当前进入中心独立表的源表：2 张（tbl_task → unified_tasks, tbl_disc_lib → unified_devices）
当前仅聚合进入中心表的源表：2 张（tbl_magzines, tbl_slots → unified_devices）
当前暂不处理的大表：tbl_file, tbl_folder
本次新增中心表/schema patch：0
本次影响 API：0
本次影响前端：0
剩余未接入关键小表：6 张（tbl_lib_task, tbl_disc, tbl_logical_volume, tbl_volume_slot, tbl_user_task, tbl_hd_info）
```
