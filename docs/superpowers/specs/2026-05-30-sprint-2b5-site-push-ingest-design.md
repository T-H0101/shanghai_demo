# Sprint 2B.5：站点推送式同步设计

> 日期: 2026-05-30
> 状态: 设计阶段
> Sprint 类型: 纯设计，不含开发

---

## 1. 背景与领导确认结论

### 1.1 问题陈述

原方案规划中心库跨城市直连各站点 PostgreSQL 同步数据。但经评估：

| 方案 | 问题 |
|------|------|
| 中心库直连 | 跨城市延迟高、稳定性风险大、网络策略复杂 |

**领导决策：不做中心库跨城市直连。**

### 1.2 最终架构确认

```
[站点系统]
  → 默认每小时推送一次（后续可按表调整）
  → POST /api/ingest/{table}
  → [中心平台接收、校验、UPSERT 入库]
```

### 1.3 数据分层策略

| 类型 | 处理方式 | 说明 |
|------|----------|------|
| 小表/核心元数据 | 全量快照进入 PostgreSQL | tasks、devices、sites、volumes |
| 大表/文件索引 | 暂不进入 | tbl_file、tbl_folder 后续走 ES 增量检索 |

**理由：**
1. 小表数据量不大，变化不大，全量快照最简单可靠
2. 大表数据量大，不能全量进入中心库
3. 避免跨城市数据库直连的延迟和稳定性风险
4. 符合 requirements.md 的松耦合、异步同步、最终一致性原则

---

## 2. 第一版范围

### 2.1 进入同步的表

| 表名 | 说明 | 对应需求 |
|------|------|----------|
| tasks | 任务表 | 4.2 统一任务管理 |
| devices | 设备表（盘库设备） | 2.1 站点监控、2.3 数据同步 |

### 2.2 暂缓的表

| 表名 | 原因 |
|------|------|
| sites | 字段待确认，可用中心端配置替代 |
| volumes | 字段待确认 |
| permissions | 安全风险高，涉及统一身份认证，需单独 Sprint |
| alerts | 依赖设备状态、任务异常规则，建议基础稳定后再做 |

### 2.3 明确排除

| 表名 | 原因 |
|------|------|
| tbl_file | 大表，不进入第一版 |
| tbl_folder | 大表，不进入第一版 |
| 其他大表 | 后续走 ES 增量检索 |

---

## 3. Ingest API 设计

### 3.1 接口列表

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/ingest/tasks` | POST | 任务数据接收 |
| `/api/ingest/devices` | POST | 设备数据接收 |

### 3.2 接口路径设计原则

1. 按表分接口，便于逐个实现、测试和验收
2. 复用现有 mapper/upsert 能力；是否复用 sync-engine 由实现阶段评估
3. 后续扩展按需增加 `/api/ingest/sites`、`/api/ingest/volumes`

---

## 4. JSON 请求体格式

### 4.1 完整请求体结构

```json
{
  "siteCode": "SH01",
  "sourceTable": "tbl_task",
  "batchId": "SH01-tbl_task-20260530-1000",
  "snapshotAt": "2026-05-30T10:00:00Z",
  "recordCount": 5,
  "records": [
    {
      "id": 1,
      "task_no": "TASK-001",
      "task_name": "刻录任务",
      "task_type": "archive",
      "status": "pending",
      "phase": "preparing",
      "priority": "normal",
      "data_classification": "confidential",
      "archive_name": "项目A数据",
      "source_path": "/data/project-a",
      "package_path": "/output/project-a.zip",
      "operator": "zhangsan",
      "department": "IT部",
      "created_at": "2026-05-01T09:00:00Z",
      "updated_at": "2026-05-30T09:00:00Z"
    }
  ]
}
```

### 4.2 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| siteCode | string | 是 | 站点代码，如 SH01 |
| sourceTable | string | 是 | 源表名，如 tbl_task |
| batchId | string | 是 | 批次号，格式：{siteCode}-{table}-{timestamp} |
| snapshotAt | string | 是 | ISO 8601 时间戳，站点生成快照的时间 |
| recordCount | number | 是 | records 数组长度 |
| records | array | 是 | 数据记录数组 |

### 4.3 站点侧 fallback

如果站点暂时无法提供 batchId/snapshotAt：
- 中心端用 `siteCode + sourceTable + receivedAt` 生成内部批次号
- 将 `batch_source` 标记为 `generated`
- 正式接口规范仍要求站点后续按规范提供

---

## 5. 认证策略

### 5.1 认证方式

| 方式 | 说明 |
|------|------|
| API Key | 每个站点配置独立 key，用于识别 siteCode |
| IP 白名单 | 可选，中心限定允许推送的站点 IP |
| HTTPS | 必须，全部 ingest 接口走 HTTPS |

### 5.2 API Key 管理要求

| 要求 | 说明 |
|------|------|
| 不入库明文 | 使用环境变量或 secrets manager |
| 不写入代码仓库 | 禁止提交到 git |
| 不提交 .env.local | .env.local 已在 .gitignore，但仍需注意 |
| 站点独立 key | 每个站点配置独立 key，便于管理 |

### 5.3 认证失败响应

| 场景 | HTTP 状态码 | code |
|------|------------|------|
| API Key 缺失 | 401 | AUTH_ERROR |
| API Key 错误 | 401 | AUTH_ERROR |
| siteCode 与 key 不匹配 | 403 | AUTH_ERROR |
| IP 不在白名单 | 403 | AUTH_ERROR |

### 5.4 后续升级方向

- API Key + HMAC 签名
- mTLS 双向认证

---

## 6. 幂等策略

### 6.1 batchId 幂等

```
站点推送 batchId=X
  → 中心检查 X 是否已处理
    → 已 success → 返回 { status: "success", duplicated: true }
    → 已 failed → 允许重新处理或要求站点重推
    → 未处理 → 继续校验和写入
```

**原则：重复请求返回成功比拒绝更适合网络重试场景。**

### 6.2 unified_* 表 UPSERT 幂等

| 表 | 唯一键 | 说明 |
|------|--------|------|
| unified_tasks | source_site_id + source_table + source_id | 任务表 |
| unified_devices | source_site_id + source_table + source_id | 设备表 |

**UPSERT 实现：**
```sql
INSERT INTO unified_tasks (...)
VALUES (...)
ON CONFLICT (source_site_id, source_table, source_id)
DO UPDATE SET
  task_no = EXCLUDED.task_no,
  task_name = EXCLUDED.task_name,
  ...
  synced_at = NOW()
```

### 6.3 幂等校验流程

1. 校验 batchId 是否已成功处理
2. 校验通过后，开始事务
3. 事务内执行 UPSERT
4. 写入 ingest_batch_log
5. 事务提交

---

## 7. 校验与写入策略

### 7.1 校验规则

| 校验项 | 说明 |
|--------|------|
| siteCode | 非空，在 sites 表中存在 |
| sourceTable | 非空，在允许列表中 |
| batchId | 非空 |
| recordCount | 等于 records.length |
| records | 每条必填字段完整 |

### 7.2 数据量限制

| 限制 | 值 | 说明 |
|------|-----|------|
| 单次最大记录数 | 10000 | 超过则站点分包推送 |
| 每包独立 batchId | - | 每个包都有独立批次号 |

### 7.3 写入流程

```
1. 接收请求
2. 校验 batchId 幂等（已成功则直接返回）
3. 校验必填字段
4. 校验 recordCount
5. 校验 sourceTable 在允许列表
6. 校验通过后，开启事务
7. 执行 UPSERT 批量写入
8. 写入 ingest_batch_log
9. 事务提交
10. 返回成功响应
```

### 7.4 失败处理

| 场景 | 处理 |
|------|------|
| 校验失败 | 返回错误响应，不写入 unified_* 表 |
| 写入失败 | 整批回滚，写入 ingest_batch_log（failed） |
| 事务异常 | 回滚，写入 ingest_batch_log（failed） |

**原则：不做部分成功，避免中心库出现半包数据。**

---

## 8. 日志设计

### 8.1 新建 ingest_batch_log 表

**设计原则：**
- 与 sync_job_log 分开记录
- ingest 记录站点推送批次，sync 记录中心拉取任务
- 便于后续审计、重试、排错

### 8.2 表结构

```sql
CREATE TABLE ingest_batch_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id VARCHAR(100) NOT NULL,
  site_code VARCHAR(20) NOT NULL,
  source_table VARCHAR(50) NOT NULL,
  snapshot_at TIMESTAMP WITH TIME ZONE,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) NOT NULL,  -- pending/running/success/failed/skipped
  rows_received INTEGER DEFAULT 0,
  rows_upserted INTEGER DEFAULT 0,
  error_message TEXT,
  duplicated BOOLEAN DEFAULT FALSE,
  payload_hash VARCHAR(64),  -- 用于判断同 batchId 重复推送时内容是否一致
  batch_source VARCHAR(20) DEFAULT 'provided',  -- provided/generated
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE (batch_id, site_code, source_table)
);

CREATE INDEX idx_ingest_batch_log_site_table ON ingest_batch_log(site_code, source_table);
CREATE INDEX idx_ingest_batch_log_status ON ingest_batch_log(status);
CREATE INDEX idx_ingest_batch_log_received_at ON ingest_batch_log(received_at);
```

### 8.3 字段说明

| 字段 | 说明 |
|------|------|
| batch_id | 站点提供的批次号，幂等键 |
| site_code | 站点代码 |
| source_table | 源表名 |
| snapshot_at | 站点生成快照的时间 |
| received_at | 中心接收时间 |
| processed_at | 处理完成时间 |
| status | pending/running/success/failed/skipped |
| rows_received | 收到的记录数 |
| rows_upserted | 实际写入数 |
| error_message | 错误信息 |
| duplicated | 是否重复批次 |
| payload_hash | 请求体哈希，用于判断同 batchId 重复推送时内容是否一致 |
| batch_source | provided（站点提供）/generated（中心生成） |

---

## 9. 错误响应格式

### 9.1 标准错误格式

```json
{
  "status": "error",
  "code": "VALIDATION_ERROR",
  "message": "校验失败",
  "errors": [
    {
      "field": "recordCount",
      "expected": 5,
      "actual": 3,
      "message": "recordCount 与 records.length 不匹配"
    }
  ]
}
```

### 9.2 HTTP 状态码

| HTTP 状态码 | 适用场景 | code |
|-------------|----------|------|
| 400 | 字段校验失败 | VALIDATION_ERROR |
| 401 | API Key 缺失或错误 | AUTH_ERROR |
| 403 | siteCode 与 key 不匹配 / IP 不允许 | AUTH_ERROR |
| 409 | batchId 冲突但内容不一致 | DUPLICATE_BATCH |
| 413 | records 超过 10000 或请求体过大 | RECORD_LIMIT_EXCEEDED |
| 500 | 中心端数据库/系统错误 | DATABASE_ERROR |

### 9.3 code 枚举值

| code | 说明 |
|------|------|
| VALIDATION_ERROR | 字段校验失败 |
| AUTH_ERROR | 认证失败 |
| DUPLICATE_BATCH | 批次号重复但内容不一致 |
| UNSUPPORTED_SOURCE_TABLE | 不支持的源表 |
| RECORD_LIMIT_EXCEEDED | 超过单次记录数限制 |
| DATABASE_ERROR | 数据库错误 |
| INTERNAL_ERROR | 内部错误 |

### 9.4 errors 数组结构

```json
{
  "field": "字段名",
  "expected": "期望值",
  "actual": "实际值",
  "message": "可选，补充说明"
}
```

---

## 10. 与现有 Sprint 2B.1-2B.4 的关系

### 10.1 现有能力保留

| 能力 | 说明 |
|------|------|
| mock_tbl_task → unified_tasks | 现有同步逻辑保留 |
| mock_tbl_disc_lib → unified_devices | 现有同步逻辑保留 |
| POST /api/sync/tasks | 保留，mock 触发 |
| POST /api/sync/devices | 保留，mock 触发 |
| GET /api/sync/status | 保留，查询 sync_progress |
| GET /api/sync/logs | 保留，查询 sync_job_log |

### 10.2 架构演进方向

```
当前（Sprint 2B.1-2B.4）：
  mock_tbl_task → [sync-engine] → unified_tasks
  mock_tbl_disc_lib → [sync-engine] → unified_devices

演进后（Sprint 2B.5+）：
  站点系统 → [数据包推送] → POST /api/ingest/tasks → unified_tasks
  站点系统 → [数据包推送] → POST /api/ingest/devices → unified_devices
```

### 10.3 不破坏现有能力

- ❌ 不修改 POST /api/sync/tasks
- ❌ 不修改 POST /api/sync/devices
- ❌ 不修改 GET /api/sync/status
- ❌ 不修改 GET /api/sync/logs
- ❌ 不删除 mock 同步代码
- ❌ 不修改 sync-engine、upsert、field-mapper

---

## 11. requirements.md 对应关系

| 需求章节 | 对应设计点 |
|----------|------------|
| 1.2 松耦合 | 站点推送式，中心不直连源库 |
| 1.2 异步同步 | 定时全量快照，不实时直连 |
| 1.2 最终一致性 | UPSERT 幂等，重复推送安全 |
| 2.3 数据同步/同步范围 | 小表全量快照进入 PostgreSQL |
| 2.3 数据同步/同步策略 | 定时同步，失败重试 |
| 4.2 统一任务管理 | tasks ingest |
| 5.1 日志管理 | ingest_batch_log 记录 |
| 6.1 性能需求 | 单次 10000 条限制 |
| 6.2 安全需求 | API Key + HTTPS + IP 白名单 |
| 6.2 防越权 | siteCode 与 key 匹配校验 |
| 6.4 可维护性 | ingest_batch_log 便于排错 |

---

## 12. 后续开发 Sprint 建议

### 12.1 下一 Sprint（2B.6）

**最小 ingest API 原型：**

| 任务 | 说明 |
|------|------|
| 1. 新建 /api/ingest/tasks POST 接口 | 框架搭建 |
| 2. 新建 /api/ingest/devices POST 接口 | 框架搭建 |
| 3. 实现 API Key 认证中间件 | 基础认证 |
| 4. 实现 ingest 校验逻辑 | 字段校验 |
| 5. 实现 UPSERT 写入逻辑 | 复用现有 mapper/upsert 能力 |
| 6. 新建 ingest_batch_log 表 | 日志记录 |
| 7. 实现幂等逻辑 | batchId 去重 + payload_hash 校验 |
| 8. 错误响应格式化 | 统一错误格式 |
| 9. 用 mock 数据测试 ingest 接口 | 端到端测试 |
| 10. tsc/build 通过 | 构建验证 |

**不做：**
- 不接真实站点
- 不改现有 mock 同步
- 不做 UI

### 12.2 再下一个 Sprint

| 优先级 | 方向 |
|--------|------|
| 1 | sites ingest |
| 2 | volumes ingest |
| 3 | API Key 持久化配置（配置表） |
| 4 | 同步状态页面整合 ingest 日志 |
| 5 | 大表 ES 增量方案设计 |

---

## 附录：Sprint 2B.5 明确不做事项

| 不做 | 原因 |
|------|------|
| 不写代码 | 纯设计 Sprint |
| 不新增 /api/ingest/* | 下个 Sprint 做 |
| 不改数据库 schema | 下个 Sprint 做 |
| 不改 CLAUDE.md | 不需要 |
| 不做 implementation plan | 只做 design spec |
| 不连接真实源库 | 当前阶段不涉及 |
| 不处理 tbl_file/tbl_folder | 大表暂不进入 |
| 不做 UI | UI 后续单独 Sprint |

---

*文档创建: 2026-05-30*
*状态: 设计阶段，待领导确认方向*