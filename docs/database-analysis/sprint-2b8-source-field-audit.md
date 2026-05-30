# Sprint 2B.8 源表字段核对

> 阶段整理：当前 ingest 能力与真实源表的差距分析。

---

## Sprint 阶段回顾

| Sprint | 状态 | 说明 |
|--------|------|------|
| 2B.1 | ✅ | Docker + PostgreSQL + 基础 schema |
| 2B.2 | ✅ | 同步服务骨架 + Mock tasks 同步 |
| 2B.3 | ✅ | status/logs 查询接口 |
| 2B.3.1 | ✅ | 架构清理 + sync-engine 重构 |
| 2B.4 | ✅ | devices 同步 + sync-engine |
| 2B.5 | ✅ | 站点推送式同步方案设计 |
| 2B.6 | ✅ | POST /api/ingest/tasks |
| 2B.7 | ✅ | POST /api/ingest/devices |
| 2B.8 | 进行中 | 阶段整理 + 真实接入准备 + 验收文档 |

---

## Tasks 源表字段核对

### 字段映射对比表

| 源表字段 (tbl_task) | TaskSourceRecord 类型 | mapTaskForIngest 写入 | unified_tasks 列 | 列类型 |
|-----|-----|-----|-----|-----|
| id | number | → source_id (String(id)) | source_id | varchar(100) NOT NULL |
| task_no | string | 直接写入 | task_no | varchar(100) |
| task_name | string | 直接写入 | task_name | varchar(200) |
| task_type | string | 直接写入 | task_type | varchar(50) |
| status | string | 直接写入 | status | varchar(50) |
| phase | string | 直接写入 | phase | varchar(50) |
| priority | string | 直接写入 | priority | varchar(20) |
| data_classification | string | 直接写入 | data_classification | varchar(100) |
| archive_name | string | 直接写入 | archive_name | varchar(200) |
| source_path | string | 直接写入 | source_path | varchar(1000) |
| package_path | string | 直接写入 | package_path | varchar(1000) |
| operator | string | 直接写入 | operator | varchar(100) |
| department | string | 直接写入 | department | varchar(100) |
| created_at | Date | 不写入（unified 用 NOW()） | created_at | timestamptz DEFAULT NOW() |
| updated_at | Date | 不写入（unified 用 NOW()） | updated_at | timestamptz DEFAULT NOW() |

### unified_tasks 中 mapper 未写入的列

| 列 | 类型 | 默认值 | 当前状态 | 说明 |
|-----|-----|-----|-----|------|
| volume_id | varchar(100) | null | 永远为空 | 存储卷关联，需求 §4.1 统一检索可能需要 |
| device_id | varchar(100) | null | 永远为空 | 设备关联，任务-设备关系 |
| rack_id | varchar(100) | null | 永远为空 | 盘笼关联，需求 §4.3 盘笼管理可能需要 |
| notes | text | null | 永远为空 | 任务备注 |
| total_files | bigint | 0 | 写入默认值 0 | 需要站点源表提供或从文件索引统计 |
| total_size | bigint | 0 | 写入默认值 0 | 同上 |

### 未确认问题

1. 站点 tbl_task 是否有 id 以外的唯一标识？（如 UUID）
2. task_no 是否全局唯一还是站点内唯一？
3. status 的合法值枚举？（如：进行中/已完成/已取消）
4. task_type 的合法值枚举？（如：刻录/回迁/巡检）
5. phase 与 status 的关系？（是否 status 表示整体，phase 表示子阶段）
6. source_path 和 package_path 的路径格式？（绝对路径/相对路径/URL）
7. 是否有软删除标记？（deleted_at 或 is_deleted）

---

## Devices 源表字段核对

### 字段映射对比表

| 源表字段 (tbl_disc_lib) | DeviceSourceRecord 类型 | mapDeviceForIngest 写入 | unified_devices 列 | 列类型 |
|-----|-----|-----|-----|-----|
| id | number | → source_id (String(id)) | source_id | varchar(100) NOT NULL |
| device_no | string | → device_id | device_id | varchar(100) |
| device_name | string | 直接写入 | device_name | varchar(200) |
| device_type | string | 直接写入 | device_type | varchar(50) |
| device_status | string | → status | status | varchar(50) |
| ip_address | string | 直接写入 | ip_address | varchar(50) |
| location | string | 直接写入 | location | varchar(200) |
| room | string | 直接写入 | room | varchar(100) |
| floor | string | 直接写入 | floor | varchar(50) |
| total_capacity | number | 直接写入 | total_capacity | bigint |
| used_capacity | number | 直接写入 | used_capacity | bigint |
| last_heartbeat | Date/null | → raw_data | raw_data | jsonb |
| operator | string | → raw_data | raw_data | jsonb |
| created_at | Date | 不写入 | created_at | timestamptz DEFAULT NOW() |
| updated_at | Date | 不写入 | updated_at | timestamptz DEFAULT NOW() |

### unified_devices 中 mapper 未写入的列

| 列 | 类型 | 默认值 | 当前状态 | 说明 |
|-----|-----|-----|-----|------|
| model | varchar(100) | null | 永远为空 | 设备型号 |
| manufacturer | varchar(100) | null | 永远为空 | 制造商 |
| serial_no | varchar(100) | null | 永远为空 | 序列号 |
| site_code | varchar(50) | null | 永远为空 | 站点编码（注意：source_site_id 已写入 siteCode） |
| slot_count | integer | null | 永远为空 | 盘位数 |
| cage_count | integer | 0 | 永远为 0 | 盘笼数 |
| mode | varchar(50) | null | 永远为空 | 设备模式 |
| use_status | smallint | 0 | 永远为 0 | 使用状态 |
| current_task_count | integer | 0 | 永远为 0 | 当前任务数 |

### 未确认问题

1. 站点 tbl_disc_lib 是否有 id 以外的唯一标识？
2. device_no 是否全局唯一还是站点内唯一？
3. device_status 的合法值枚举？（如：online/offline/maintenance）
4. device_type 的合法值枚举？（如：optical_library/tape_library）
5. tbl_disc_lib 是否就是"设备表"？还是有其他设备表？
6. ip_address 是否可能为 IPv6？
7. total_capacity / used_capacity 的单位？（字节/MB/GB/光盘数）
8. last_heartbeat 是否为设备最后一次上报时间？

---

## raw_data 分析

### 当前写入方式

| ingest 类型 | raw_data 内容 | 写入语句 |
|-----|-----|-----|
| tasks-ingest | 整个 TaskSourceRecord 对象 | `raw_data: source` |
| devices-ingest | 整个 DeviceSourceRecord 对象 | `raw_data: source` |

### raw_data 价值

- **字段扩展缓冲**：即使 mapper 未映射的字段，也可通过 `raw_data->>'field_name'` 查询
- **调试用途**：对比源数据和映射后数据
- **JSONB 索引**：PostgreSQL 支持 GIN 索引，可对 raw_data 内字段建索引

### 潜在问题

- raw_data 会随记录全量更新（每次 UPSERT 都覆盖）
- 如果源表有敏感字段，raw_data 会完整保留（需要考虑是否脱敏）
- raw_data 体积可能较大，影响查询性能（可考虑压缩或裁剪）

---

## 当前 ingest 已有能力汇总

| 能力 | tasks | devices | 说明 |
|------|-------|---------|------|
| API Key 认证 | ✅ | ✅ | 环境变量配置 |
| siteCode 匹配 | ✅ | ✅ | 403 不匹配 |
| JSON 请求体校验 | ✅ | ✅ | 必填字段检查 |
| recordCount 校验 | ✅ | ✅ | mismatch 返回 400 |
| records 10000 条限制 | ✅ | ✅ | 超限返回 413 |
| sourceTable 白名单 | ✅ | ✅ | tbl_task / tbl_disc_lib |
| batchId 幂等 | ✅ | ✅ | 同内容 duplicated，异内容 409 |
| payload_hash 检查 | ✅ | ✅ | SHA-256 |
| UPSERT 到 unified 表 | ✅ | ✅ | 事务内执行 |
| ingest_batch_log | ✅ | ✅ | 完整生命周期记录 |
| 统一错误响应 | ✅ | ✅ | 结构化 JSON |

---

## requirements.md 对齐

### 已覆盖

- §2.3 数据同步：已实现 tasks/devices 数据接收和写入机制
- §6.4 可维护性：已实现 batch_log 日志记录

### 部分覆盖

- §6.2 安全需求：已实现 ingest 接口第一版 API Key/siteCode 校验和统一错误响应；完整统一身份认证、权限、防越权仍需后续规划

### 待验证

- §6.1 性能需求：具体性能指标需结合真实数据量和网络环境验证
- 当前方案为小表每小时全量快照推送，与"实时同步"要求的差距需评估

### 不在当前范围

- §4.1 统一检索：需要 file/folder 索引数据（大表）
- §4.2 统一任务管理：需要任务下发能力（不只是同步）
- §4.3 盘笼统一管理：需要 volumes/magazines 数据
- 大表（tbl_file/tbl_folder）不在当前范围内

---

## 后续方向（根据实际情况调整）

```
2B.8 (当前): 阶段整理 + 真实接入准备 + 验收文档
2B.9 (待定): 根据站点反馈，决定下一步——
             可能方向 A: 真实小表试点接入 + 字段适配
             可能方向 B: 测试自动化
             可能方向 C: sites/volumes ingest 扩展
             具体取决于站点提供的源表信息和网络环境
```

---

*文档创建: 2026-05-31*
*Sprint 2B.8: 阶段整理*
