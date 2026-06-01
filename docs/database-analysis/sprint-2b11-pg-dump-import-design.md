# Sprint 2B.11 PG Dump 导入式真实接入方案设计

> 基于领导确认的 pg_dump 导出方式，设计真实数据接入方案。

---

## 一、当前标准快照

### 1.1 Git 与构建

| 项目 | 值 |
|------|-----|
| 分支 | main |
| 最新 commit | `4c73cac` docs: add real PG17 source field mapping draft |
| git status | 干净 |
| 与 origin/main | 领先 1（未 push） |
| tsc | 通过 |
| build | 通过 |

### 1.2 当前数据库

| 项目 | 值 |
|------|-----|
| 数据库名 | unified_disc_platform |
| PostgreSQL | 17.10 |
| 总表数 | 17 |

**表分类：**

| 分类 | 表 | 记录数 |
|------|-----|--------|
| 中心统一表 | unified_tasks, unified_devices, unified_volumes, unified_alerts, unified_device_groups, unified_drivers, unified_hard_disks, unified_magazines, unified_slots, unified_users | 0-13 |
| Mock 源表 | mock_tbl_task(5), mock_tbl_disc_lib(3) | 8 |
| 基础设施表 | sync_job_log(75), sync_progress(2), sync_sites(2), sites(2), ingest_batch_log(8) | 89 |

### 1.3 当前已有 API

| API | 用途 | 状态 |
|-----|------|------|
| POST /api/ingest/tasks | JSON POST ingest tasks | 已跑通，基于 mock 字段 |
| POST /api/ingest/devices | JSON POST ingest devices | 已跑通，基于 mock 字段 |
| POST /api/sync/tasks | 中心拉取 mock tasks | 已跑通，读 mock_tbl_task |
| POST /api/sync/devices | 中心拉取 mock devices | 已跑通，读 mock_tbl_disc_lib |
| GET /api/sync/status | 同步状态查询 | 已跑通 |
| GET /api/sync/logs | 同步日志查询 | 已跑通 |

### 1.4 当前关键文档

| 文档 | 用途 |
|------|------|
| `docs/database-analysis/sprint-2b10-real-pg17-source-field-mapping.md` | 真实源表字段映射草案 |
| `docs/database-analysis/sprint-2b8-site-communication-checklist.md` | 站点沟通确认清单 |
| `docs/testing/ingest-verification.md` | JSON ingest 验收文档 |
| `docs/database-analysis/sprint-2b8-source-field-audit.md` | 源表字段核对 |

---

## 二、新架构：PG Dump 导入式数据流

### 2.1 新数据流

```
站点 PG17 数据库
  │
  │ pg_dump（领导导出）
  ▼
table_backup.sql / .dump 文件
  │
  │ psql -f / pg_restore（中心恢复）
  ▼
source_restore 数据库（独立，不污染中心库）
  ├── tbl_task（真实源表）
  ├── tbl_disc_lib（真实源表）
  └── 其他表（参考）
  │
  │ Node/TS 服务函数（连接两个数据库）
  ▼
mapper 转换（tbl_task → unified_tasks, tbl_disc_lib → unified_devices）
  │
  │ UPSERT 事务
  ▼
unified_disc_platform 数据库
  ├── unified_tasks
  ├── unified_devices
  └── import_job_log（或复用现有日志表）
```

### 2.2 与旧 JSON Ingest 方案的区别

| 维度 | 旧方案（JSON POST Ingest） | 新方案（PG Dump 导入） |
|------|--------------------------|----------------------|
| 数据来源 | 站点 HTTP POST JSON | 站点 pg_dump 导出 SQL/dump 文件 |
| 传输方式 | HTTP/HTTPS | 文件传输（邮件/共享/SCP） |
| 站点侧工作 | 编写导出脚本 + 调用 API | 只需 pg_dump，无需脚本 |
| 数据格式 | JSON records[] | PG 原生 SQL/二进制 dump |
| 中心侧工作 | 接收 JSON + 校验 + UPSERT | 恢复 dump + 查询 + UPSERT |
| 字段映射 | 站点侧或中心侧做 JSON 字段转换 | 中心侧直接查真实表，无需 JSON 转换 |
| 数据完整性 | 依赖站点脚本正确性 | PG dump 保证完整性 |
| 敏感字段 | 站点侧决定是否包含 | dump 包含全部字段，中心侧决定处理方式 |
| 多站点 | 每个站点独立 POST | 每个站点独立 dump + 独立恢复 |
| 增量同步 | 每小时全量快照 | 可全量 dump，后续可做增量 |

### 2.3 JSON Ingest 接口是否保留

**保留，但不继续开发。** 作为备选方案，如果后续站点有能力做 JSON 推送，仍可使用。当前优先 PG Dump 方案。

---

## 三、Dump 恢复位置方案对比

### 方案 A：独立 source_restore 数据库

```
unified_disc_platform  — 中心库（unified_*, 日志表）
source_restore         — 恢复库（真实源表 tbl_task, tbl_disc_lib 等）
```

**命名说明：** 单站点试点可用 `source_restore`；多站点时建议使用 `source_<siteCode>`，如 `source_sh01`、`source_bj02`。

**优点：**
- 完全隔离，不污染中心库
- 恢复/删除 dump 不影响中心数据
- 多站点可建多个独立数据库（source_sh01, source_bj02...）
- 不需要修改中心库 schema
- 清晰的数据所有权

**缺点：**
- 需要管理多个数据库连接
- Node/TS 服务需要跨数据库查询
- Docker 需要创建额外数据库

**对现有代码影响：** 需要新增 source_restore 数据库连接配置，不影响现有 unified_disc_platform 代码。

**对数据隔离影响：** 最佳，完全隔离。

**对多站点扩展影响：** 支持良好，每个站点一个独立数据库。

**推荐程度：** ⭐⭐⭐ **推荐**

### 方案 B：同库不同 schema

```
unified_disc_platform
  ├── public（中心表）
  ├── source_sh01（站点 SH01 源表）
  └── source_bj02（站点 BJ02 源表）
```

**优点：**
- 同一数据库连接，代码简单
- schema 级别隔离
- 可用 `SET search_path` 切换

**缺点：**
- dump 恢复到指定 schema 需要额外处理（pg_dump 不直接支持 schema 重定向）
- 所有站点数据在同一数据库，单点风险
- 如果 dump 包含 DROP TABLE 等语句，可能误删中心表
- 需要在恢复前修改 dump 文件中的 schema 引用

**对现有代码影响：** 需要修改 SQL 查询中的表名前缀。

**对数据隔离影响：** 中等，schema 隔离但同库。

**对多站点扩展影响：** 可以，但 schema 管理复杂度增加。

**推荐程度：** ⭐⭐

### 方案 C：同库临时表前缀

```
unified_disc_platform
  ├── unified_tasks（中心表）
  ├── import_tbl_task（导入源表）
  └── import_tbl_disc_lib（导入源表）
```

**优点：**
- 最简单，同库同 schema
- 不需要额外连接

**缺点：**
- 严重污染中心库
- 每次导入需要先清理旧 import 表
- 多站点时 import 表冲突（import_sh01_tbl_task?）
- dump 恢复时可能与现有表冲突
- 不利于数据隔离

**对现有代码影响：** 小，但容易出错。

**对数据隔离影响：** 最差。

**对多站点扩展影响：** 差，命名冲突。

**推荐程度：** ⭐ **不推荐**

### 推荐

**方案 A：独立 source_restore 数据库。** 完全隔离，不污染中心库，支持多站点扩展。

---

## 四、Dump 恢复流程设计

### 4.1 收到 dump 后的判断

```bash
# 判断文件格式
file table_backup.sql

# .sql 文本格式 → 用 psql
# .dump / .backup custom 格式 → 用 pg_restore
```

### 4.2 创建独立恢复数据库

```bash
# 在 Docker PostgreSQL 中创建 source_restore 数据库
docker exec -i unified_disc_postgres psql -U unified -c "CREATE DATABASE source_restore;"
```

### 4.3 恢复 dump

**文本格式 (.sql)：**

```bash
# 复制 dump 文件到 Docker 容器
docker cp table_backup.sql unified_disc_postgres:/tmp/table_backup.sql

# 恢复到 source_restore 数据库
docker exec -i unified_disc_postgres psql -U unified -d source_restore -f /tmp/table_backup.sql
```

**Custom 格式 (.dump/.backup)：**

```bash
# 复制 dump 文件到 Docker 容器
docker cp table_backup.dump unified_disc_postgres:/tmp/table_backup.dump

# 恢复到 source_restore 数据库
docker exec -i unified_disc_postgres pg_restore -U unified -d source_restore /tmp/table_backup.dump
```

### 4.4 恢复后验证

```bash
# 1. 确认数据库存在
docker exec -i unified_disc_postgres psql -U unified -c "\l" | grep source_restore

# 2. 查看表数量
docker exec -i unified_disc_postgres psql -U unified -d source_restore -c "\dt" | wc -l

# 3. 确认 tbl_task 存在
docker exec -i unified_disc_postgres psql -U unified -d source_restore -c "\d+ tbl_task"

# 4. 确认 tbl_disc_lib 存在
docker exec -i unified_disc_postgres psql -U unified -d source_restore -c "\d+ tbl_disc_lib"

# 5. 查看记录数
docker exec -i unified_disc_postgres psql -U unified -d source_restore -c "SELECT count(*) FROM tbl_task;"
docker exec -i unified_disc_postgres psql -U unified -d source_restore -c "SELECT count(*) FROM tbl_disc_lib;"

# 6. 查看字段结构（与 disc_files.sql 对比）
docker exec -i unified_disc_postgres psql -U unified -d source_restore -c "\d+ tbl_task"
docker exec -i unified_disc_postgres psql -U unified -d source_restore -c "\d+ tbl_disc_lib"

# 7. 脱敏查看示例数据
docker exec -i unified_disc_postgres psql -U unified -d source_restore -c "
SELECT id, task_name, task_type, status, create_dt, total_files, total_size 
FROM tbl_task LIMIT 3;"

docker exec -i unified_disc_postgres psql -U unified -d source_restore -c "
SELECT lib_id, name, type, device_status, IP, vendor, model 
FROM tbl_disc_lib LIMIT 3;"
```

### 4.5 重要提醒

- **不要**将 dump 恢复到 unified_disc_platform
- **不要**在恢复前执行 DROP TABLE（dump 文件可能包含 DROP 语句，需检查）
- **建议**在恢复前先 `grep -i "DROP TABLE" table_backup.sql` 确认风险
- **建议**恢复后立即备份 source_restore（`docker exec ... pg_dump source_restore > source_restore_backup.sql`）

---

## 五、真实源表抽取方案

### 方案 A：Node/TS 服务函数连接两个数据库

```typescript
// lib/import/source-reader.ts
// 连接 source_restore 数据库读取源表
// 连接 unified_disc_platform 数据库写入目标表
```

**优点：**
- 复用现有 Node/TS 技术栈
- 可以复用现有 mapper 和 upsert 逻辑
- 类型安全，TypeScript 类型定义
- 可以做复杂转换（int→string 枚举映射等）

**缺点：**
- 需要管理两个数据库连接
- 大数据量时可能有内存压力

**推荐程度：** ⭐⭐⭐ **推荐第一版方案**

### 方案 B：PostgreSQL FDW（外部数据包装器）

```sql
-- 在 unified_disc_platform 中创建 FDW 连接 source_restore
CREATE EXTENSION postgres_fdw;
CREATE SERVER source_server FOREIGN DATA WRAPPER postgres_fdw OPTIONS (host 'localhost', dbname 'source_restore');
CREATE FOREIGN TABLE foreign_tbl_task (...) SERVER source_server OPTIONS (table_name 'tbl_task');
```

**优点：**
- SQL 级别跨库查询
- 不需要应用层处理

**缺点：**
- 需要安装 postgres_fdw 扩展
- Docker 环境中配置复杂
- 性能可能不如本地表
- 不适合做复杂字段转换

**推荐程度：** ⭐⭐

### 方案 C：pg_dump 指定表后导入 staging schema

```bash
# 从 source_restore 导出指定表
docker exec ... pg_dump -d source_restore -t tbl_task -t tbl_disc_lib > staging.sql

# 修改 schema 后导入 unified_disc_platform 的 staging schema
```

**优点：**
- 使用 PG 原生工具
- 简单直接

**缺点：**
- 需要修改 dump 文件中的 schema 引用
- 仍然污染中心库
- 每次导入需要清理 staging 表

**推荐程度：** ⭐

### 方案 D：手工 psql COPY/INSERT

```bash
# 从 source_restore 导出 CSV
docker exec ... psql -d source_restore -c "\COPY tbl_task TO '/tmp/tbl_task.csv' CSV HEADER"

# 导入到 unified_disc_platform
# 需要手工处理字段映射
```

**优点：**
- 灵活

**缺点：**
- 手工操作，容易出错
- 不可重复
- 不适合生产环境

**推荐程度：** ⭐

### 推荐

**方案 A：Node/TS 服务函数连接两个数据库。** 复用现有技术栈，支持复杂字段转换，适合第一版。

---

## 六、现有模块如何处理

### 6.1 /api/ingest/tasks 和 /api/ingest/devices

| 项目 | 决定 |
|------|------|
| 是否保留 | **保留** |
| 是否继续开发 | **暂停** |
| 用途 | 作为备选接口，如果后续站点有能力做 JSON 推送仍可使用 |
| 优先级 | 低于 PG Dump 方案 |

### 6.2 /api/sync/tasks 和 /api/sync/devices

| 项目 | 决定 |
|------|------|
| 是否保留 | **保留** |
| 是否继续开发 | **暂停** |
| 用途 | 本地 mock 验证用，确保中心端基础功能可用 |
| 优先级 | 最低 |

### 6.3 lib/ingest/*

| 项目 | 决定 |
|------|------|
| 是否保留 | **保留** |
| 是否重构 | **暂不** |
| 原因 | 等 PG Dump 方案跑通后，再决定是否将 ingest 逻辑合并到新的 import 模块 |

### 6.4 lib/sync/*

| 项目 | 决定 |
|------|------|
| upsert.ts | **复用** — PG Dump 抽取方案仍需 upsert 逻辑 |
| types.ts | **复用** — UnifiedTaskRecord/UnifiedDeviceRecord 仍需使用 |
| sync-job-log.ts | **复用** — 或参考设计 import_job_log |
| 其他文件 | **暂不动**，等新方案稳定后再决定是否清理 |

### 6.5 新增模块预判

| 模块 | 用途 |
|------|------|
| `lib/import/source-connector.ts` | 连接 source_restore 数据库 |
| `lib/import/task-importer.ts` | 从 source_restore 读取 tbl_task，映射写入 unified_tasks |
| `lib/import/device-importer.ts` | 从 source_restore 读取 tbl_disc_lib，映射写入 unified_devices |
| `lib/import/field-mapper.ts` | 真实源表字段映射（int→string, 字段重命名） |
| `lib/import/import-log.ts` | 导入日志记录 |
| `scripts/import-tasks.ts` | CLI 手动触发 tasks 导入 |
| `scripts/import-devices.ts` | CLI 手动触发 devices 导入 |

**注意：** 以上仅为预判，不建议现在就创建。等 dump 恢复验证后再确定。第一版优先做 CLI/script 或 service function 手动触发；是否做 `/api/import/*` 接口由试点结果决定。

---

## 七、真实 Mapper 改造方向

### 7.1 Tasks Mapper

| 源表字段 | 源表声明类型 | 写入目标 | 转换规则 |
|---------|------------|---------|---------|
| id | bigint | source_id | String(id) |
| task_name | varchar(255) | task_name | 直接 |
| task_type | **int** | task_type | **int→string 枚举映射**（0→"backup", 1→"restore", ...） |
| status | **int** | status | **int→string 枚举映射**（1→"ready", 2→"cancelled", ...） |
| create_dt | **datetime** | created_at | **字段名+类型转换**（datetime→timestamptz） |
| update_dt | **datetime** | updated_at | **字段名+类型转换** |
| total_files | bigint | total_files | **直接写入真实值**（当前写 0） |
| total_size | bigint | total_size | **直接写入真实值**（当前写 0） |
| uuid | varchar(64) | raw_data | 进入 raw_data |
| cmt | varchar(500) | notes | 写入 notes 主字段 |
| encrypt | varchar(255) | raw_data | **进入 raw_data**（领导确认非明文） |
| 其他 20+ 字段 | — | raw_data | 全部进入 raw_data（移除敏感字段后） |

**统一字段不变（当前无对应源字段，先写 null）：**
- task_no, phase, priority, data_classification, archive_name, source_path, package_path, operator, department

### 7.2 Devices Mapper

| 源表字段 | 源表声明类型 | 写入目标 | 转换规则 |
|---------|------------|---------|---------|
| lib_id | int | source_id | String(lib_id) |
| name | varchar(200) | device_name | **字段名映射** |
| type | **int** | device_type | **int→string 枚举映射**（1→"gen2_library", 2→"gen2_offline", ...） |
| device_status | **int** | status | **int→string 枚举映射**（0→"offline", 1→"online", ...） |
| IP | varchar(50) | ip_address | **字段名大小写映射** |
| vendor | varchar(50) | manufacturer | **新增写入** |
| model | varchar(50) | model | **新增写入** |
| sn | varchar(50) | serial_no | **新增写入** |
| mags | int | cage_count | **新增写入** |
| slots | int | slot_count | **新增写入** |
| use_status | tinyint | use_status | **新增写入** |
| lib_id | int | device_id | String(lib_id)（第一版，后续可改） |
| site_code | — | site_code | 使用 API 请求中的 siteCode |
| lib_pwd | varchar(50) | raw_data | **进入 raw_data**（领导确认非明文） |
| lib_user | varchar(50) | raw_data | **进入 raw_data** |
| 其他字段 | — | raw_data | 全部进入 raw_data |

**统一字段不变（当前无对应源字段，先写 null）：**
- location, floor, room, total_capacity, used_capacity, mode, current_task_count

---

## 八、日志设计

### 方案 A：复用 sync_job_log

**优点：** 不新增表，现有查询接口可直接查看。

**缺点：** sync_job_log 的语义是"中心拉取同步"，PG Dump 导入不是 sync 语义。字段可能不完全匹配。

### 方案 B：复用 ingest_batch_log

**优点：** 不新增表，语义更接近（数据导入）。

**缺点：** ingest_batch_log 的字段设计针对 JSON POST（有 batch_id, payload_hash 等），PG Dump 导入不需要这些。

### 方案 C：新建 import_job_log

**优点：** 语义清晰，字段完全匹配 PG Dump 导入场景。

**缺点：** 新增表，需要新建查询接口。

### 推荐

**方案 C：新建 import_job_log。** 语义清晰，不污染现有日志表。但真正建表放到实现 Sprint，根据试点流程确认字段后再创建。

建议字段（草案，待试点后确认）：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK | 自动生成 |
| import_id | varchar(100) | 导入批次 ID |
| source_db | varchar(100) | 源数据库名（如 source_restore） |
| source_table | varchar(100) | 源表名（如 tbl_task） |
| target_table | varchar(100) | 目标表名（如 unified_tasks） |
| started_at | timestamptz | 开始时间 |
| finished_at | timestamptz | 结束时间 |
| status | varchar(20) | pending/success/failed |
| rows_read | integer | 读取行数 |
| rows_upserted | integer | 写入行数 |
| rows_skipped | integer | 跳过行数 |
| error_message | text | 错误信息 |
| created_at | timestamptz | 创建时间 |

---

## 九、安全字段处理

### 9.1 领导确认

- encrypt 和 lib_pwd 可随 dump 一起导出
- 存储的是 hash 或加密 base64 字符串，不是明文

### 9.2 处理建议

| 字段 | 是否写入主字段 | 是否进入 raw_data | 脱敏显示 | 日志中打印 | 文档示例 |
|------|-------------|-----------------|---------|----------|---------|
| encrypt | **不写入** | **进入** | 不需要（非明文） | **不暴露** | **不展示** |
| lib_pwd | **不写入** | **进入** | 不需要（非明文） | **不暴露** | **不展示** |
| lib_user | **不写入** | **进入** | 不需要 | 可打印 | 可展示 |
| IP | **写入** ip_address | 进入 | 不需要 | 可打印 | 可展示 |
| sn | **写入** serial_no | 进入 | 不需要 | 可打印 | 可展示 |

### 9.3 原则

- **密码/密钥类字段**：不写入主字段，可保留在 raw_data，但默认不在查询 API、日志、文档示例、前端展示中暴露
- **即使非明文**，也不在主字段展示，避免误导
- **raw_data 完整保留**（非明文），方便后续需要时查询，但访问需有明确理由

---

## 十、最小试点计划

### 10.1 步骤

| 步骤 | 说明 | 产出 |
|------|------|------|
| 1 | 领导提供整库 pg_dump | dump 文件 |
| 2 | 本地恢复到 source_restore 数据库 | 源表可用 |
| 3 | 验证 tbl_task / tbl_disc_lib 存在且有数据 | 确认表结构 |
| 4 | 与 disc_files.sql 对比字段结构 | 确认是否有变化 |
| 5 | 选取少量 records（如 10 条 tasks + 5 条 devices） | 测试数据 |
| 6 | 设计真实 mapper（基于 2B.10 映射草案） | mapper 代码 |
| 7 | 手工执行抽取（Node/TS 或 psql） | unified_tasks / unified_devices 数据 |
| 8 | 验证 counts 和字段映射正确性 | 试点结果报告 |
| 9 | 输出试点结果和下一步建议 | 决策文档 |

### 10.2 试点成功标准

- tbl_task 和 tbl_disc_lib 数据成功写入 unified_tasks / unified_devices
- 字段映射正确（task_type/status int→string 转换正确）
- total_files/total_size 写入真实值
- sensitive 字段不在主字段展示
- raw_data 包含完整源记录（含 encrypt/lib_pwd）

### 10.3 试点不做的事

- 不写站点侧脚本
- 不做自动化导入
- 不做多站点
- 不做增量同步
- 不改现有 API

---

## 十一、不做事项

| 不做 | 原因 |
|------|------|
| 不写业务代码 | 本 Sprint 纯设计 |
| 不导入真实 dump | 等领导提供 |
| 不改 schema | 等试点验证后决定 |
| 不清理 mock | 保留本地验证能力 |
| 不继续 sites/volumes | 等真实字段确认 |
| 不做 ES | 后续 Sprint |
| 不做 UI | 后续 Sprint |
| 不删除 JSON ingest | 作为备选方案保留 |
| 不改 CLAUDE.md | 无长期规则变化 |
| 不接真实站点 | 设计阶段 |

---

## 十二、后续 Sprint 路径预判

```
2B.11 (当前): PG Dump 导入式真实接入方案设计
2B.12 (预判): 收到 dump → 恢复 → 验证 → 设计真实 mapper → 试点
2B.13 (预判): 真实 mapper 实现 + import 模块开发
2B.14 (预判): import API + 日志 + 验收
```

**具体取决于领导提供 dump 的时间。**

---

*文档创建: 2026-06-01*
*Sprint 2B.11: PG Dump 导入式真实接入方案设计*
