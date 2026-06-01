# Sprint 2B.10 真实 PG17 源表字段映射草案

> 基于 `databases/disc_files.sql`（领导提供的现有系统 PG17 源表结构），设计 tbl_task / tbl_disc_lib 到 unified_tasks / unified_devices 的字段映射草案。

---

## 1. 背景说明

### 1.1 当前状态

- `databases/disc_files.sql` 是领导提供的现有系统 PG17 源表结构定义文件（版本 6.5.1，2026.01.22），包含 20 张源表。
- 当前本地 PG17 运行库中没有导入 disc_files.sql 中的真实 tbl_task / tbl_disc_lib。
- 当前本地运行的是 mock_tbl_task（5 条）和 mock_tbl_disc_lib（3 条），字段名和类型与真实源表差异较大。
- 当前 `/api/ingest/tasks` 和 `/api/ingest/devices` 已跑通，但 mapper 基于 mock 字段设计。

### 1.2 本文档目的

基于 disc_files.sql 中的真实源表结构，设计字段映射草案，供领导/站点确认后用于：
- 重新设计推送 JSON 格式
- 更新 ingest mapper
- 判断是否需要调整 unified_* schema

### 1.3 不做的事

- 不写代码、不改 mapper、不改 schema
- 不导入 disc_files.sql 到本地
- 不删除 mock
- 不做真实推送

### 1.4 raw_data 脱敏原则

raw_data 保存前**必须移除或脱敏敏感字段**，不能把完整 source record 原样保存为 raw_data。具体来说：
- `encrypt`（tbl_task 加密密码）→ 移除
- `lib_pwd`（tbl_disc_lib 共享目录密码）→ 移除
- `lib_user`（tbl_disc_lib 共享目录用户）→ 移除或脱敏
- 其他字段可保留

---

## 2. tbl_task → unified_tasks 映射草案

### 2.1 有明确映射的字段

| disc_files.sql 字段 | 源表声明类型 | 字段注释/含义 | 建议写入 unified_tasks 字段 | 类型转换规则 | 进入 raw_data | 需确认 |
|-----|-----|-----|-----|-----|-----|-----|
| id | bigint | 刻录或回迁任务ID，应用端先生成 | source_id | String(id) | ✅ | — |
| task_name | varchar(255) | 任务名称 | task_name | 直接 | ✅ | — |
| task_type | int | 0备份/1恢复/2封盘/3接口/4扫描/5磁光复制/6卷复制/7S3/8封包/9存证/10加电/11异地热备 | task_type | int→string（枚举映射表见§4） | ✅ | **确认枚举** |
| status | int | 刻录任务6=准备好，回迁任务1=准备好，2=取消，3=接口任务准备好 | status | int→string（枚举映射表见§4） | ✅ | **确认枚举** |
| create_dt | datetime | 任务创建日期 | created_at | datetime→timestamptz | ✅ | — |
| update_dt | datetime | 刻录更新日期 | updated_at | datetime→timestamptz | ✅ | — |
| total_files | bigint | 任务总文件数 | total_files | 直接 | ✅ | — |
| total_size | bigint | 任务总文件大小 | total_size | 直接 | ✅ | — |
| uuid | varchar(64) | UUID | — | — | ✅ | — |
| cmt | varchar(500) | 备注 | notes | 直接 | ✅ | — |

### 2.2 建议进入 raw_data 但不写入主字段的字段

| disc_files.sql 字段 | 源表声明类型 | 字段注释/含义 | 原因 |
|-----|-----|-----|-----|
| split_level | int | 文件分割级别 | 刻录配置细节，总控不需要 |
| burn_status | tinyint | 0已完成合并/2只下载/3在线离线混合/4未完成合并/>=10密级 | 刻录状态细节 |
| extension_filter | varchar(50) | 刻录归档目录 | 刻录配置 |
| json_path | text | 任务接口文件 | 站点内部路径 |
| slot_start | int | 任务起始slot id | 硬件配置 |
| slot_type | int | 3光盘打印，其他0 | 硬件配置 |
| task_mode | tinyint | 0顺序/1并行/2视频合并顺序/3视频合并并行 | 刻录模式 |
| burn_mode | tinyint | 0一次性/1追加 | 刻录方式 |
| burn_speed | int | 刻录速度/巡检比例 | 刻录参数 |
| verify_mode | tinyint | 0不校验/1文件/2快速/3双重/4介质检测 | 校验配置 |
| save_hash | tinyint | 0不保存/CRC32/MD5 | 校验配置 |
| encrypt | varchar(255) | 光盘加密密码 | **敏感字段，见§5** |
| add_csv | tinyint | 添加目录文件 | 刻录配置 |
| raid_groups | varchar(100) | RAID组集合 | 硬件配置 |
| use_buffer | tinyint | 使用缓存 | 刻录配置 |
| delete_files | tinyint | 封盘后是否删除源文件 | 刻录后处理 |
| copy_files | tinyint | 是否拷贝到本地 | 刻录配置 |
| copy_source | tinyint | 回迁时是否优先拷贝源文件 | 回迁配置 |
| copies | tinyint | 多副本刻录数 | 刻录配置 |
| split_mode | tinyint | 0容量顺序/1最高效率/2文档类型/3文件时间/4自动 | 切分方法 |
| prefix | varchar(50) | 光盘标签前缀 | 标签配置 |
| start_num | int | 光盘标签起始数字 | 标签配置 |
| add_zero | tinyint | 光盘标签补零个数 | 标签配置 |
| encoding | tinyint | 重新刻录次数 | 刻录状态 |
| max_disc | int | 上一次最大disc id | 刻录状态 |
| data_source | int | 0本地/1计划/2视频下载/1000000+异地备份 | 数据来源 |
| ret_value | int | MakeTask进程返回值 | 进程状态 |
| ret_msg | varchar(1000) | 任务状态信息 | 进程状态 |

### 2.3 unified_tasks 有但真实源表无的字段

| unified_tasks 字段 | 当前状态 | 建议 |
|-----|-----|-----|
| task_no | 无对应源字段 | **待确认**：是否有其他表存储任务编号？或用 String(id) 作为 task_no？ |
| phase | 无对应源字段 | **待确认**：真实系统是否有阶段概念？可先写 null |
| priority | 无对应源字段 | **待确认**：真实系统是否有优先级？可先写 null |
| data_classification | 无对应源字段 | **待确认**：真实系统是否有数据分类？burn_status>=10 指定密级？ |
| archive_name | 无对应源字段 | **待确认**：是否从其他表获取？可先写 null |
| source_path | 无对应源字段 | **待确认**：可能从 tbl_task_items 获取？可先写 null |
| package_path | 无对应源字段 | **待确认**：同上 |
| operator | 无对应源字段 | **待确认**：tbl_task 无操作员字段，是否在其他表？ |
| department | 无对应源字段 | **待确认**：同上 |
| volume_id | 无对应源字段 | 可从 tbl_task_folder 获取？可先写 null |
| device_id | 无对应源字段 | 可从关联表获取？可先写 null |
| rack_id | 无对应源字段 | 可先写 null |

---

## 3. tbl_disc_lib → unified_devices 映射草案

### 3.1 有明确映射的字段

| disc_files.sql 字段 | 源表声明类型 | 字段注释/含义 | 建议写入 unified_devices 字段 | 类型转换规则 | 进入 raw_data | 需确认 |
|-----|-----|-----|-----|-----|-----|-----|
| lib_id | int | 设备id | source_id | String(lib_id) | ✅ | — |
| name | varchar(200) | 设备名称 | device_name | 直接 | ✅ | — |
| device_status | int | 1在线/0离线/2删除/3警告/4错误 | status | int→string（枚举映射表见§4） | ✅ | **确认枚举** |
| type | int | 1-15 数字编码 | device_type | int→string（枚举映射表见§4） | ✅ | **确认枚举** |
| IP | varchar(50) | 设备IP | ip_address | 直接（字段名大写→小写） | ✅ | — |
| vendor | varchar(50) | 制造商 | manufacturer | 直接 | ✅ | — |
| model | varchar(50) | 型号 | model | 直接 | ✅ | — |
| sn | varchar(50) | 序列号 | serial_no | 直接 | ✅ | — |
| mags | int | 光盘库片匣数/硬盘库托盘数 | cage_count | 直接 | ✅ | — |
| slots | int | 设备介质数 | slot_count | 直接 | ✅ | — |
| use_status | tinyint | Windows:0/高速模式2/Linux:1/高速模式3 | use_status | 直接（tinyint→smallint） | ✅ | — |
| group_id | int | 设备所属分组 | — | — | ✅ | **待确认**：是否与站点/设备组有关，进入 raw_data |
| cmt | varchar(500) | 备注 | — | — | ✅ | — |

### 3.2 建议进入 raw_data 但不写入主字段的字段

| disc_files.sql 字段 | 源表声明类型 | 字段注释/含义 | 原因 |
|-----|-----|-----|-----|
| device_order | int | 设备显示顺序 | 站点 UI 配置 |
| current_device | tinyint | 当前光盘库为1 | 运行时状态 |
| disc_type | int | 光盘类型ID或设备子类型 | 设备子类型 |
| port | varchar(10) | 服务端口号 | 网络配置 |
| slots_per_mag | int | 每匣抽片数/每托盘硬盘数 | 硬件配置 |
| lib_user | varchar(50) | 库共享目录用户 | **敏感字段，见§5** |
| lib_pwd | varchar(50) | 库共享目录密码 | **敏感字段，见§5** |

### 3.3 unified_devices 有但真实源表无的字段

| unified_devices 字段 | 当前状态 | 建议 |
|-----|-----|-----|
| device_id | 无对应源字段（lib_id 不是 device_id） | **建议**：用 String(lib_id) 作为 device_id，或从 lib_id 推导 |
| location | 无对应源字段 | **待确认**：真实系统是否在其他表存储位置信息？可先写 null |
| floor | 无对应源字段 | **待确认**：同上 |
| room | 无对应源字段 | **待确认**：同上 |
| total_capacity | 无对应源字段 | **待确认**：真实系统是否在其他表存储容量？可先写 null |
| used_capacity | 无对应源字段 | **待确认**：同上 |
| site_code | 无对应源字段 | 默认使用 API 请求中的 siteCode 填入 |
| mode | 无对应源字段 | **待确认**：可先写 null |
| current_task_count | 无对应源字段 | **待确认**：可先写 0 |

### 3.4 device_id 字段特殊说明

当前 unified_devices.device_id 在 mock mapper 中映射的是 `device_no`（如 "DL-SH01-001"），但真实 tbl_disc_lib 没有 `device_no` 字段，主键是 `lib_id`（如 1, 2, 3）。

**第一版策略：** 用 String(lib_id) 填充 device_id（如 "1", "2", "3"）。

**后续优化：** 如果领导/站点能提供业务设备编号（如设备资产编号、标签编号），再改为业务编号。需要领导确认。

---

## 4. 状态码/类型码整理

### 4.1 tbl_task.task_type（任务类型）

| 值 | 含义（来源：disc_files.sql 注释） | 建议统一字符串 |
|-----|-----|-----|
| 0 | 备份任务 | "backup" |
| 1 | 恢复任务 | "restore" |
| 2 | 刻录并直接封盘 | "burn_and_seal" |
| 3 | 接口任务 | "api_task" |
| 4 | 扫描任务 | "scan" |
| 5 | 磁光复制任务 | "optical_copy" |
| 6 | 卷复制任务 | "volume_copy" |
| 7 | S3任务 | "s3" |
| 8 | 封包任务 | "package" |
| 9 | 存证任务 | "evidence" |
| 10 | 加电任务 | "power_on" |
| 11 | 异地热备任务 | "remote_backup" |

**注意：** 统一字符串是本文档建议，需领导确认是否采用。

### 4.2 tbl_task.status（任务状态）

| 值 | 含义（来源：disc_files.sql 注释） | 建议统一字符串 |
|-----|-----|-----|
| 1 | 回迁任务=准备好 | "ready" |
| 2 | 任务取消 | "cancelled" |
| 3 | 接口任务准备好 | "api_ready" |
| 6 | 刻录任务=准备好 | "ready" |

**注释不完整。** 仅列出了部分状态值，其他值（如 4, 5, 7+）含义不明。**需领导/站点补充完整枚举。**

### 4.3 tbl_task.burn_status（刻录状态）

| 值 | 含义（来源：disc_files.sql 注释） |
|-----|-----|
| 0 | 已完成数据库表合并 |
| 2 | 视频任务只下载不刻录 |
| 3 | 同时有在线和离线盘笼 |
| 4 | 未完成数据库表合并 |
| >=10 | 指定任务密级（具体含义待确认） |

**注释不完整。** 值 1 和 5-9 含义不明。**需领导/站点补充。**

### 4.4 tbl_disc_lib.device_status（设备状态）

| 值 | 含义（来源：disc_files.sql 注释） | 建议统一字符串 |
|-----|-----|-----|
| 0 | 离线 | "offline" |
| 1 | 在线 | "online" |
| 2 | 删除 | "deleted" |
| 3 | 警告（光驱坏1个） | "warning" |
| 4 | 错误（光驱全坏） | "error" |

### 4.5 tbl_disc_lib.type（设备类型）

| 值 | 含义（来源：disc_files.sql 注释） | 建议统一字符串 |
|-----|-----|-----|
| 1 | 二代库 | "gen2_library" |
| 2 | 二代离线库 | "gen2_offline" |
| 3 | 一代旧库 | "gen1_legacy" |
| 4 | 一代新库 | "gen1_new" |
| 5 | 一代离线库 | "gen1_offline" |
| 6 | 三代库 | "gen3_library" |
| 7 | 出版设备 | "publisher" |
| 8 | 硬盘库 | "hdd_library" |
| 9 | 磁带库 | "tape_library" |
| 10 | 磁带机 | "tape_drive" |
| 11 | 新SAS硬盘库 | "sas_hdd_library" |
| 12 | 胶片库 | "film_library" |
| 13 | 网盘 | "nas" |
| 14 | 报警器 | "alarm" |
| 15 | 四代库 | "gen4_library" |

### 4.6 tbl_task.burn_mode（刻录方式）

| 值 | 含义 |
|-----|-----|
| 0 | 一次性刻录 |
| 1 | 追加刻录 |

### 4.7 tbl_task.verify_mode（校验模式）

| 值 | 含义 |
|-----|-----|
| 0 | 不校验 |
| 1 | 文件校验 |
| 2 | 快速校验 |
| 3 | 双重校验 |
| 4 | 光盘介质检测 |

### 4.8 tbl_task.save_hash（保存校验码）

| 值 | 含义 |
|-----|-----|
| 0 | 不保存校验码 |
| 1 | CRC32 |
| 2 | MD5 |

### 4.9 tbl_task.task_mode（刻录模式）

| 值 | 含义 |
|-----|-----|
| 0 | 顺序刻录 |
| 1 | 并行刻录 |
| 2 | 视频合并顺序刻录 |
| 3 | 视频合并并行刻录 |

### 4.10 tbl_task.split_mode（切分方法）

| 值 | 含义 |
|-----|-----|
| 0 | 按数据容量顺序分配 |
| 1 | 按最高存储效率分配 |
| 2 | 按文档类型 |
| 3 | 按文件时间 |
| 4 | 按光盘类型自动选择 |

### 4.11 tbl_task.data_source（数据来源）

| 值 | 含义 |
|-----|-----|
| 0 | 本地任务 |
| 1 | 计划任务 |
| 2 | 视频下载任务 |
| >=1000000 | 异地备份taskId（表示已备份成功） |

### 4.12 tbl_disc_lib.use_status（使用状态）

| 值 | 含义 |
|-----|-----|
| 0 | Windows |
| 1 | Linux |
| 2 | 高速模式（Windows，不实际下电） |
| 3 | 高速模式（Linux） |

---

## 5. 敏感字段处理建议

### 5.1 tbl_task 敏感字段

| 字段 | 内容 | 风险等级 | 建议 |
|-----|-----|-----|-----|
| encrypt | 光盘加密密码 | **高** | **不推送**。密码不应离开站点。从推送 JSON 中排除。 |
| json_path | 任务接口文件路径 | 低 | 原样进入 raw_data。路径本身不含密码。 |
| ret_msg | 任务状态信息 | 低 | 原样进入 raw_data。可能包含错误信息但不含密码。 |

### 5.2 tbl_disc_lib 敏感字段

| 字段 | 内容 | 风险等级 | 建议 |
|-----|-----|-----|-----|
| lib_pwd | 库共享目录密码 | **高** | **不推送**。密码不应离开站点。从推送 JSON 中排除。 |
| lib_user | 库共享目录用户 | **中** | **脱敏后进入 raw_data**。如需推送，建议只保留用户名，不保留密码。或直接不推送。 |
| IP | 设备 IP 地址 | 低 | 原样写入 ip_address 主字段。IP 是必要监控信息。 |
| port | 服务端口号 | 低 | 原样进入 raw_data。 |
| sn | 序列号 | 低 | 原样写入 serial_no 主字段。 |

### 5.3 路径类字段

| 字段 | 建议 |
|-----|-----|
| json_path | 原样进入 raw_data |
| extension_filter | 原样进入 raw_data |

### 5.4 总体原则

- **密码/密钥类**：不推送，从 JSON 中排除
- **IP/端口**：原样推送，是必要监控信息
- **路径类**：原样进入 raw_data
- **用户名类**：建议不推送，或脱敏后进入 raw_data

---

## 6. 推送 JSON 格式决策

### 方案 A：站点推送真实源表原始字段名

```json
{
  "records": [
    {
      "id": 1001,
      "task_name": "财务报表备份",
      "task_type": 0,
      "status": 1,
      "create_dt": "2026-05-31T08:00:00Z",
      "update_dt": "2026-05-31T09:30:00Z",
      "total_files": 1523,
      "total_size": 268435456000,
      "burn_status": 0,
      "task_mode": 0,
      "burn_mode": 1,
      "verify_mode": 1,
      "save_hash": 2
    }
  ]
}
```

**优点：**
- 站点不需要做字段名转换，直接 SELECT * 导出
- 站点侧改动最小
- 字段值保持原始类型（int），由总控端做类型转换
- 减少站点侧出错概率

**缺点：**
- 总控端 mapper 需要处理所有原始字段名和类型
- 如果各站点表结构有差异，总控端需要适配多种结构
- JSON 字段名不统一（如 `IP` 大写、`create_dt` 不是 `created_at`）

### 方案 B：站点推送总控统一字段名

```json
{
  "records": [
    {
      "source_id": "1001",
      "task_name": "财务报表备份",
      "task_type": "backup",
      "status": "ready",
      "created_at": "2026-05-31T08:00:00Z",
      "updated_at": "2026-05-31T09:30:00Z",
      "total_files": 1523,
      "total_size": 268435456000
    }
  ]
}
```

**优点：**
- 总控端 mapper 简单，直接映射
- JSON 字段名统一、语义清晰
- 类型转换在站点侧完成

**缺点：**
- 站点需要编写导出脚本做字段名和类型转换
- 站点侧改动较大
- 如果站点技术人员能力有限，可能出错
- 站点系统不归总控控制，不能随意要求站点大改

### 推荐

**推荐方案 A（原始字段名）。**

理由：
1. 站点系统不归总控控制，不能随意要求站点大改
2. 站点侧只需 SELECT + JSON 序列化，改动最小
3. 字段名/类型转换是总控端的职责，总控端可以统一处理
4. 各站点表结构可能有差异，总控端适配比站点侧适配更可控
5. 如果后续站点表结构变化，总控端只需更新 mapper，不需要通知站点改脚本

**但需要确认：** 各站点 tbl_task / tbl_disc_lib 结构是否与 disc_files.sql 一致。如果各站点有差异，总控端需要做兼容处理。

---

## 7. 当前 mapper 差距总结

### 7.1 tasks-ingest 当前 mapper 与真实 tbl_task 的差异

| 差异点 | 当前 mapper（基于 mock） | 真实 tbl_task | 影响 |
|--------|------------------------|--------------|------|
| 主键字段名 | `id` | `id` | 无差异 |
| 任务类型字段类型 | string（如 "backup"） | **int**（如 0） | **必须改**：需要 int→string 枚举映射 |
| 状态字段类型 | string（如 "completed"） | **int**（如 1） | **必须改**：需要 int→string 枚举映射 |
| 创建时间字段名 | `created_at` | **`create_dt`** | **必须改**：字段名不同 |
| 更新时间字段名 | `updated_at` | **`update_dt`** | **必须改**：字段名不同 |
| task_no | 有 | **无** | **待确认**：unified_tasks.task_no 如何填 |
| phase | 有 | **无** | 可写 null |
| priority | 有 | **无** | 可写 null |
| data_classification | 有 | **无** | 可写 null |
| archive_name | 有 | **无** | 可写 null |
| source_path | 有 | **无** | 可写 null |
| package_path | 有 | **无** | 可写 null |
| operator | 有 | **无** | 可写 null |
| department | 有 | **无** | 可写 null |
| total_files | 写入默认值 0 | **有真实值** | **必须改**：应写入真实值 |
| total_size | 写入默认值 0 | **有真实值** | **必须改**：应写入真实值 |
| notes | 未写入 | cmt 有值 | 建议写入 |
| 20+ 配置字段 | 未映射 | 有值 | 全部进入 raw_data |

### 7.2 devices-ingest 当前 mapper 与真实 tbl_disc_lib 的差异

| 差异点 | 当前 mapper（基于 mock） | 真实 tbl_disc_lib | 影响 |
|--------|------------------------|------------------|------|
| 主键字段名 | `id` | **`lib_id`** | **必须改**：字段名不同 |
| 设备名称字段名 | `device_name` | **`name`** | **必须改**：字段名不同 |
| 设备类型字段类型 | string（如 "disc_library"） | **int**（如 1） | **必须改**：需要 int→string 枚举映射 |
| 设备状态字段类型 | string（如 "online"） | **int**（如 1） | **必须改**：需要 int→string 枚举映射 |
| IP 字段名 | `ip_address` | **`IP`**（大写） | **必须改**：字段名大小写不同 |
| device_no | 有 | **无** | **待确认**：unified_devices.device_id 如何填 |
| location | 有 | **无** | 可写 null |
| room | 有 | **无** | 可写 null |
| floor | 有 | **无** | 可写 null |
| total_capacity | 有 | **无** | 可写 null |
| used_capacity | 有 | **无** | 可写 null |
| last_heartbeat | 有 | **无** | 可写 null |
| operator | 有 | **无** | 可写 null |
| vendor | 未映射 | 有 | **应写入** manufacturer |
| model | 未映射 | 有 | **应写入** model |
| sn | 未映射 | 有 | **应写入** serial_no |
| mags | 未映射 | 有 | **应写入** cage_count |
| slots | 未映射 | 有 | **应写入** slot_count |
| use_status | 未映射 | 有 | **应写入** use_status |
| group_id | 未映射 | 有 | 进入 raw_data，是否与站点/设备组有关待确认 |
| port | 未映射 | 有 | 进入 raw_data |
| disc_type | 未映射 | 有 | 进入 raw_data |
| slots_per_mag | 未映射 | 有 | 进入 raw_data |
| lib_user / lib_pwd | 未映射 | 有 | **敏感字段，见§5** |

### 7.3 必须改才能真实接入的字段

**tasks mapper 必须改：**
1. task_type: int→string 枚举映射
2. status: int→string 枚举映射
3. 字段名: `create_dt`→`created_at`，`update_dt`→`updated_at`
4. total_files/total_size: 从默认值 0 改为写入真实值

**devices mapper 必须改：**
1. 主键: `id`→`lib_id`
2. 设备名称: `device_name`→`name`
3. device_type: int→string 枚举映射
4. device_status: int→string 枚举映射
5. IP: `ip_address`→`IP`
6. 新增写入: vendor→manufacturer, model→model, sn→serial_no, mags→cage_count, slots→slot_count, use_status→use_status

---

## 8. 是否需要调整 unified_tasks / unified_devices schema

### 8.1 unified_tasks

**现有字段基本够用。** 以下字段在真实源表中无对应，但可先写 null：

| 字段 | 建议 |
|------|------|
| task_no | **待确认**：如果真实系统无此字段，可考虑用 String(id) 填充，或允许 null |
| phase | 先写 null，后续如有需求再扩展 |
| priority | 先写 null，后续如有需求再扩展 |
| data_classification | 先写 null，burn_status>=10 可能表示密级，待确认 |
| archive_name | 先写 null |
| source_path | 先写 null，可能需要从 tbl_task_items 关联查询 |
| package_path | 先写 null |
| operator | 先写 null，可能需要从其他表关联 |
| department | 先写 null，可能需要从其他表关联 |

**可能需要新增列（待确认）：**
- `burn_status`：当前 unified_tasks 无此列，刻录状态是重要业务字段
- `task_mode` / `burn_mode`：刻录模式信息
- `ret_value` / `ret_msg`：任务执行结果

### 8.2 unified_devices

**现有字段基本够用。** 以下字段在真实源表中无对应，但可先写 null：

| 字段 | 建议 |
|------|------|
| location / floor / room | 先写 null，可能需要从其他表关联 |
| total_capacity / used_capacity | 先写 null，可能需要从其他表关联 |
| mode | 先写 null |
| current_task_count | 先写 0 |
| site_code | 由 API 请求中的 siteCode 填入，或从 group_id 推导 |

**可能需要新增列（待确认）：**
- `group_id`：设备分组，当前 unified_devices 无此列
- `disc_type`：光盘类型，当前无此列
- `port`：端口，当前无此列

### 8.3 不建议直接 ALTER

以上新增列建议仅为分析结果，不建议直接执行 ALTER TABLE。原因：
1. 需先确认哪些字段总控端确实需要展示
2. 不需要展示的字段留在 raw_data 即可
3. schema 变更需要评估对现有数据和 API 的影响

---

## 9. 需要领导/站点确认的问题清单

### 9.1 源表结构确认

| 序号 | 问题 | 紧迫度 |
|------|------|--------|
| Q1 | disc_files.sql 是否为当前线上最新 PG17 源表结构？版本 6.5.1 (2026.01.22) 是否最新？ | **高** |
| Q2 | 各站点的 tbl_task / tbl_disc_lib 表结构是否完全一致？还是有站点定制字段？ | **高** |
| Q3 | tbl_task.status 完整枚举是什么？当前注释只列出了 1/2/3/6，其他值（4/5/7+）含义？ | **高** |
| Q4 | tbl_task.burn_status 完整枚举是什么？值 1 和 5-9 含义？>=10 的密级具体映射？ | **高** |
| Q5 | tbl_task 中是否有操作员/部门信息？在哪个表？ | **中** |
| Q6 | tbl_disc_lib 中是否有位置信息（机房/楼层）？在哪个表？ | **中** |
| Q7 | tbl_disc_lib 中是否有容量信息（总容量/已用）？在哪个表？ | **中** |
| Q8 | tbl_task 是否有任务编号字段？还是用 id 作为编号？ | **中** |

### 9.2 推送方案确认

| 序号 | 问题 | 紧迫度 |
|------|------|--------|
| Q9 | 推送 JSON 用原始字段名（lib_id, name, IP, create_dt）还是统一字段名（device_id, device_name, ip_address, created_at）？ | **高** |
| Q10 | 哪个站点先试点？ | **高** |
| Q11 | 站点侧谁负责导出和推送？是否有技术人员？ | **高** |
| Q12 | 是否能每小时推送一次小表全量快照？ | **中** |
| Q13 | 站点是否能调用中心 HTTP/HTTPS 接口？ | **中** |
| Q14 | API Key 如何分发和保管？ | **中** |

### 9.3 安全确认

| 序号 | 问题 | 紧迫度 |
|------|------|--------|
| Q15 | tbl_task.encrypt（加密密码）是否允许推送？建议不允许。 | **高** |
| Q16 | tbl_disc_lib.lib_pwd（共享目录密码）是否允许推送？建议不允许。 | **高** |
| Q17 | tbl_disc_lib.lib_user（共享目录用户）是否允许推送？建议不允许或脱敏。 | **中** |
| Q18 | 推送数据是否需要 HTTPS 加密传输？ | **中** |

### 9.4 数据规模确认

| 序号 | 问题 | 紧迫度 |
|------|------|--------|
| Q19 | 单站点 tbl_task 当前记录数？每日新增/更新量？ | **中** |
| Q20 | 单站点 tbl_disc_lib 当前记录数？ | **中** |
| Q21 | 10000 条/批限制是否足够？ | **中** |

---

## 10. 推荐下一步

### 10.1 是否建议先让领导确认该映射草案

**是。** 这是进入真实推送试点的前置条件。所有后续工作（改 mapper、写站点脚本、做联调）都依赖映射确认。

### 10.2 是否建议暂缓代码清理

**是。** 等真实数据流确认后再清理。sync 线是否保留、mock 是否删除，取决于真实接入方案。

### 10.3 是否建议暂缓 sites/volumes

**是。** 在真实字段确认前，新增 ingest 对象只是基于假设，大概率要返工。

### 10.4 是否建议下一 Sprint 再改 mapper

**是，但前提是映射草案已确认。** 下一 Sprint 方向：

```
如果映射草案已确认：
  → Sprint 2B.11：更新 mapper + 设计推送 JSON 格式 + 站点侧导出示例

如果映射草案尚未确认：
  → 等待领导/站点反馈，暂停代码开发
```

### 10.5 不建议现在做的事

| 不建议 | 原因 |
|--------|------|
| 立即改 mapper | 映射未确认，改了可能要再改 |
| 立即清理 mock/sync | 真实接入方案未定 |
| 立即新增 sites/volumes ingest | 等真实字段确认 |
| 立即抽象通用 ingest-service | 等第 3 个对象 |
| 导入 disc_files.sql 到本地 | 等架构决策 |
| 站点侧写导出脚本 | 等 JSON 格式确认 |

---

*文档创建: 2026-05-31*
*Sprint 2B.10: 真实 PG17 源表字段映射草案*
