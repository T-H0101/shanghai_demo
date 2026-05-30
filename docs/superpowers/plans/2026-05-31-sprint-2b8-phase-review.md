# Sprint 2B.8 Documentation Plan

> **定位：** 阶段整理 + 真实接入准备 + 验收文档。不写业务代码。

**Goal:** 输出 3 份文档，为真实站点接入做准备。

**约束：** 不写代码、不改 schema、不新增 API、不做 sites/volumes ingest、不抽通用 ingest-service、不接真实站点。

---

## 文档结构

| 文件 | 职责 |
|------|------|
| `docs/database-analysis/sprint-2b8-source-field-audit.md` | 源表字段核对 + mapper 对比 |
| `docs/database-analysis/sprint-2b8-site-communication-checklist.md` | 站点沟通确认清单 |
| `docs/testing/ingest-verification.md` | Ingest 验收文档 |

---

## Task 1: 源表字段核对文档

**File:** Create `docs/database-analysis/sprint-2b8-source-field-audit.md`

**内容结构：**

### 1.1 Tasks 源表字段核对

四列对比表：

| 源表字段 (tbl_task) | TaskSourceRecord | mapTaskForIngest 写入 | unified_tasks 列 |
|-----|-----|-----|-----|

列含义：
- **源表字段**：站点 tbl_task 实际存在的字段（基于现有 TaskSourceRecord，待站点确认）
- **TaskSourceRecord**：当前 TypeScript 类型定义中的字段
- **mapTaskForIngest 写入**：当前 mapper 实际写入 unified_tasks 的目标列，或标记"→ raw_data"
- **unified_tasks 列**：目标表该列的类型和约束

当前已知映射：

| 源表字段 | TaskSourceRecord | mapTaskForIngest | unified_tasks 列 |
|-----|-----|-----|-----|
| id | id: number | → source_id (String(id)) | source_id varchar(100) NOT NULL |
| task_no | task_no: string | 直接写入 | task_no varchar(100) |
| task_name | task_name: string | 直接写入 | task_name varchar(200) |
| task_type | task_type: string | 直接写入 | task_type varchar(50) |
| status | status: string | 直接写入 | status varchar(50) |
| phase | phase: string | 直接写入 | phase varchar(50) |
| priority | priority: string | 直接写入 | priority varchar(20) |
| data_classification | data_classification: string | 直接写入 | data_classification varchar(100) |
| archive_name | archive_name: string | 直接写入 | archive_name varchar(200) |
| source_path | source_path: string | 直接写入 | source_path varchar(1000) |
| package_path | package_path: string | 直接写入 | package_path varchar(1000) |
| operator | operator: string | 直接写入 | operator varchar(100) |
| department | department: string | 直接写入 | department varchar(100) |
| created_at | created_at: Date | 不写入（unified 用 NOW()） | created_at timestamptz DEFAULT NOW() |
| updated_at | updated_at: Date | 不写入（unified 用 NOW()） | updated_at timestamptz DEFAULT NOW() |

unified_tasks 有但 mapper 未写入的列：

| unified_tasks 列 | 类型 | 默认值 | 说明 |
|-----|-----|-----|-----|
| volume_id | varchar(100) | null | 存储卷关联，未来可能需要 |
| device_id | varchar(100) | null | 设备关联，未来可能需要 |
| rack_id | varchar(100) | null | 盘笼关联，未来可能需要 |
| notes | text | null | 任务备注 |
| total_files | bigint | 0 | 写入默认值 0 |
| total_size | bigint | 0 | 写入默认值 0 |

### 1.2 Devices 源表字段核对

同样四列对比表，映射关系：

| 源表字段 | DeviceSourceRecord | mapDeviceForIngest | unified_devices 列 |
|-----|-----|-----|-----|
| id | id: number | → source_id (String(id)) | source_id varchar(100) NOT NULL |
| device_no | device_no: string | → device_id | device_id varchar(100) |
| device_name | device_name: string | 直接写入 | device_name varchar(200) |
| device_type | device_type: string | 直接写入 | device_type varchar(50) |
| device_status | device_status: string | → status | status varchar(50) |
| ip_address | ip_address: string | 直接写入 | ip_address varchar(50) |
| location | location: string | 直接写入 | location varchar(200) |
| room | room: string | 直接写入 | room varchar(100) |
| floor | floor: string | 直接写入 | floor varchar(50) |
| total_capacity | total_capacity: number | 直接写入 | total_capacity bigint |
| used_capacity | used_capacity: number | 直接写入 | used_capacity bigint |
| last_heartbeat | last_heartbeat: Date/null | → raw_data | raw_data jsonb |
| operator | operator: string | → raw_data | raw_data jsonb |
| created_at | created_at: Date | 不写入 | created_at timestamptz DEFAULT NOW() |
| updated_at | updated_at: Date | 不写入 | updated_at timestamptz DEFAULT NOW() |

unified_devices 有但 mapper 未写入的列：

| unified_devices 列 | 类型 | 默认值 | 说明 |
|-----|-----|-----|-----|
| model | varchar(100) | null | 设备型号 |
| manufacturer | varchar(100) | null | 制造商 |
| serial_no | varchar(100) | null | 序列号 |
| site_code | varchar(50) | null | 站点编码（注意：source_site_id 已写入） |
| slot_count | integer | null | 盘位数 |
| cage_count | integer | 0 | 盘笼数 |
| mode | varchar(50) | null | 设备模式 |
| use_status | smallint | 0 | 使用状态 |
| current_task_count | integer | 0 | 当前任务数 |

### 1.3 raw_data 分析

当前写入 raw_data 的方式：
- **tasks ingest**：`raw_data: source`（整个 TaskSourceRecord 对象）
- **devices ingest**：`raw_data: source`（整个 DeviceSourceRecord 对象）

raw_data 价值：
- 保留源表原始数据，即使 mapper 未映射的字段也可从 raw_data 查询
- 为未来字段扩展提供缓冲
- JSONB 支持索引查询

### 1.4 关键问题标记

文档末尾列出需要站点确认的问题：

1. 源表实际字段是否与 TaskSourceRecord/DeviceSourceRecord 一致？
2. 有哪些源表字段我们尚未覆盖？
3. status / device_status 的合法值枚举是什么？
4. task_type / device_type 的合法值枚举是什么？
5. id 字段是否保证唯一且递增？
6. 是否有软删除标记？

---

## Task 2: 站点沟通确认清单

**File:** Create `docs/database-analysis/sprint-2b8-site-communication-checklist.md`

**内容结构：** 可直接发送给领导/站点的结构化问题清单。

### 2.1 目的说明（一句话）

统一管控平台已具备接收数据的 API 能力，需要站点配合确认源表结构和推送能力，以便进入真实数据对接阶段。

### 2.2 站点需要提供的信息

**A. 源表结构确认**

| 序号 | 问题 | 说明 |
|-----|------|------|
| A1 | tbl_task 表完整字段列表及类型 | 请提供 DDL 或 SHOW CREATE TABLE 输出 |
| A2 | tbl_disc_lib 表完整字段列表及类型 | 同上 |
| A3 | tbl_task 主键字段 | 当前假设为 id (integer) |
| A4 | tbl_disc_lib 主键字段 | 当前假设为 id (integer) |
| A5 | tbl_task 中 status 字段的合法值 | 如：进行中/已完成/已取消 等 |
| A6 | tbl_task 中 task_type 字段的合法值 | 如：刻录/回迁 等 |
| A7 | tbl_disc_lib 中 device_status 字段的合法值 | 如：online/offline/maintenance 等 |
| A8 | tbl_disc_lib 中 device_type 字段的合法值 | 如：optical_library/tape_library 等 |
| A9 | 两张表是否有 updated_at 字段？是否有索引？ | 用于后续增量同步方案设计 |

**B. 数据规模**

| 序号 | 问题 | 说明 |
|-----|------|------|
| B1 | tbl_task 当前记录数 | 评估单次推送数据量 |
| B2 | tbl_disc_lib 当前记录数 | 同上 |
| B3 | tbl_task 每日新增/更新记录数 | 评估增量大小 |
| B4 | tbl_disc_lib 每日新增/更新记录数 | 同上 |
| B5 | 预计未来 1 年最大记录数 | 评估 10000 条/批限制是否足够 |

**C. 职责边界确认**

| 序号 | 问题 | 说明 |
|-----|------|------|
| C1 | 站点是否接受由总控统一定义数据包格式？ | 总控制定 JSON 格式规范，站点按规范导出 |
| C2 | 站点是否接受每小时推送小表全量快照？ | 当前方案：每小时将 tasks/devices 全表数据推送到总控 |
| C3 | 站点是否有能力维护推送脚本？ | 需要技术人员部署和监控 |

**D. 推送能力确认**

| 序号 | 问题 | 说明 |
|-----|------|------|
| D1 | 站点服务器是否能发起 HTTP POST 请求？ | 调用中心平台 API |
| D2 | 站点是否能按 JSON 格式导出数据？ | 格式见附录 |
| D3 | 站点是否能配置定时任务（cron/计划任务）？ | 每小时推送一次 |
| D4 | 站点是否有技术人员维护推送脚本？ | 需要部署和监控 |
| D5 | 站点能否保管 API Key？ | 安全存储要求 |

**E. 网络确认**

| 序号 | 问题 | 说明 |
|-----|------|------|
| E1 | 站点到中心平台的网络连通性 | 需要能访问中心平台 HTTP/HTTPS 端口 |
| E2 | 是否需要 VPN 或专线？ | 影响推送方案 |
| E3 | 是否有防火墙限制？ | 需要开放的端口和 IP |
| E4 | 网络延迟和稳定性 | 影响超时和重试策略 |

**F. 安全确认**

| 序号 | 问题 | 说明 |
|-----|------|------|
| F1 | API Key 如何分配和保管？ | 建议每个站点独立 Key |
| F2 | 推送数据是否需要加密传输？ | HTTPS 或其他加密方式 |
| F3 | 是否需要 IP 白名单？ | 限制只有站点 IP 可调用 |

### 2.3 附录：推送 JSON 格式示例

提供 tasks 和 devices 的完整请求 JSON 示例（可直接参考当前 curl 测试用例）。

### 2.4 附录：当前已完成能力

简要说明统一管控平台已具备：
- API Key 认证
- 请求体校验
- 幂等防重复
- 数据写入 PostgreSQL
- 错误响应和日志记录

### 2.5 附录：当前字段映射草案

附上 Task 1 的简化映射表，让站点技术人员能快速核对。

---

## Task 3: Ingest 验收文档

**File:** Create `docs/testing/ingest-verification.md`

**内容结构：**

### 3.1 前置条件

```
- Docker PostgreSQL 运行中 (unified_disc_postgres)
- Next.js dev server 运行中 (localhost:3000)
- .env.local 已配置 INGEST_API_KEY_SH01=test-api-key-123
```

### 3.2 环境验证

```bash
# 确认 DB 可连
docker exec -i unified_disc_postgres psql -U unified -d unified_disc_platform -c "SELECT 1;"

# 确认 dev server 可达
curl -s http://localhost:3000/api/sync/status
```

### 3.3 Tasks Ingest 验收（7 项）

| 序号 | 测试项 | 预期 HTTP | 预期 JSON 关键字段 |
|-----|--------|----------|-------------------|
| T1 | 无 API Key | 401 | code: "AUTH_ERROR" |
| T2 | 错误 API Key | 401 | code: "AUTH_ERROR" |
| T3 | siteCode 不匹配 | 403 | code: "AUTH_ERROR" |
| T4 | recordCount 不匹配 | 400 | code: "VALIDATION_ERROR" |
| T5 | sourceTable 错误 | 400 | code: "UNSUPPORTED_SOURCE_TABLE" |
| T6 | records 超过 10000 | 413 | code: "RECORD_LIMIT_EXCEEDED" |
| T7 | 正确请求 | 200 | status: "success", rowsUpserted > 0 |

每项提供完整 curl 命令。

### 3.4 Tasks Ingest 进阶验收（2 项）

| 序号 | 测试项 | 预期 |
|-----|--------|------|
| T8 | 重复 batchId（相同内容） | 200, duplicated: true |
| T9 | 重复 batchId（不同内容） | 409, code: "DUPLICATE_BATCH" |

### 3.5 Devices Ingest 验收（同上 9 项结构）

D1-D9，镜像 T1-T9 的结构，使用 tbl_disc_lib 和 devices 数据。

### 3.6 现有 Sync 接口回归（3 项）

| 序号 | 测试项 | 预期 |
|-----|--------|------|
| S1 | POST /api/ingest/tasks（有效空 records 快照） | 200 |
| S2 | POST /api/sync/tasks | 200 |
| S3 | GET /api/sync/status | 200 |

### 3.7 数据库验证

```bash
# 验证 unified_tasks 写入
docker exec -i unified_disc_postgres psql -U unified -d unified_disc_platform \
  -c "SELECT source_site_id, source_id, task_no, task_name, status FROM unified_tasks ORDER BY created_at DESC LIMIT 5;"

# 验证 unified_devices 写入
docker exec -i unified_disc_postgres psql -U unified -d unified_disc_platform \
  -c "SELECT source_site_id, source_id, device_id, device_name, status FROM unified_devices ORDER BY created_at DESC LIMIT 5;"

# 验证 ingest_batch_log 记录
docker exec -i unified_disc_postgres psql -U unified -d unified_disc_platform \
  -c "SELECT batch_id, site_code, source_table, status, rows_upserted, duplicated FROM ingest_batch_log ORDER BY created_at DESC LIMIT 5;"
```

### 3.8 通过标准

- tasks 9 项全部通过
- devices 9 项全部通过
- sync 回归 3 项全部通过
- DB 验证数据正确

---

## Task 4: 修正 Sprint 状态描述

在 `sprint-2b8-source-field-audit.md` 文档开头的 Sprint 状态总结中，使用修正后的描述：

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

## Task 5: 后续路径与 requirements 对齐

在文档末尾的"后续方向"章节：

**后续 Sprint 路径（根据实际情况调整）：**

```
2B.8 (当前): 阶段整理 + 真实接入准备 + 验收文档
2B.9 (待定): 根据站点反馈，决定下一步——
             可能方向 A: 真实小表试点接入 + 字段适配
             可能方向 B: 测试自动化
             可能方向 C: sites/volumes ingest 扩展
             具体取决于站点提供的源表信息和网络环境
```

**requirements.md 对齐表述：**

```
当前已完成能力对应 requirements.md：
- §2.3 数据同步：已实现 tasks/devices 数据接收和写入机制
- §6.2 安全需求：已实现 ingest 接口第一版 API Key/siteCode 校验和统一错误响应；完整统一身份认证、权限、防越权仍需后续规划
- §6.4 可维护性：已实现 batch_log 日志记录

待验证：
- §6.1 性能需求：具体性能指标需结合真实数据量和网络环境验证
- 当前方案为小表每小时全量快照推送，与"实时同步"要求的差距需评估
- 大表（tbl_file/tbl_folder）不在当前范围内
```

---

## Task 6: Commit

```bash
git add docs/database-analysis/sprint-2b8-source-field-audit.md \
        docs/database-analysis/sprint-2b8-site-communication-checklist.md \
        docs/testing/ingest-verification.md
git commit -m "docs: Sprint 2B.8 stage summary, site communication checklist, and ingest verification guide"
```

---

## Execution Order

```
Task 1 (字段核对) → Task 2 (站点清单，引用 Task 1 的映射表) → Task 3 (验收文档) → Task 4+5 (内嵌在 Task 1 文档中) → Task 6 (commit)
```

## Sprint 2B.8 不做

| 不做 | 说明 |
|------|------|
| 不写业务代码 | 本 Sprint 纯文档 |
| 不新增 API | — |
| 不改 schema | — |
| 不做 sites/volumes ingest | 等字段确认 |
| 不抽通用 ingest-service | 过早抽象 |
| 不接真实站点 | 分析阶段 |
| 不做 ES | — |
| 不做 UI | — |
| 不改 CLAUDE.md | — |
| 不改 .env.local | — |
| 不做 scripts/verify-ingest.sh | 先文档后脚本 |

---

*Plan created: 2026-05-31*
*Sprint 2B.8: 阶段整理 + 真实接入准备 + 验收文档*
