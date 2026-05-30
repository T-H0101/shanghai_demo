# 站点沟通确认清单

> 用于与领导/站点沟通，确认源表结构和推送能力。

---

## 目的

统一管控平台已具备接收数据的 API 能力，需要站点配合确认源表结构和推送能力，以便进入真实数据对接阶段。

---

## 一、源表结构确认

### A. tbl_task（任务表）

| 序号 | 问题 | 说明 |
|-----|------|------|
| A1 | tbl_task 完整字段列表及类型 | 请提供 DDL 或 SHOW CREATE TABLE 输出 |
| A2 | tbl_task 主键字段 | 当前假设为 id (integer) |
| A3 | status 字段的合法值 | 如：进行中/已完成/已取消，还是用数字编码？ |
| A4 | task_type 字段的合法值 | 如：刻录/回迁/巡检 |
| A5 | phase 字段的含义 | 与 status 的关系是什么？ |
| A6 | priority 字段的合法值 | 如：高/中/低，还是用数字？ |
| A7 | data_classification 字段的含义 | 数据分类维度是什么？ |
| A8 | source_path 和 package_path 的路径格式 | 绝对路径/相对路径/URL？ |
| A9 | 是否有软删除标记？ | deleted_at 或 is_deleted 字段？ |

### B. tbl_disc_lib（设备表）

| 序号 | 问题 | 说明 |
|-----|------|------|
| B1 | tbl_disc_lib 完整字段列表及类型 | 请提供 DDL 或 SHOW CREATE TABLE 输出 |
| B2 | tbl_disc_lib 主键字段 | 当前假设为 id (integer) |
| B3 | device_status 字段的合法值 | 如：online/offline/maintenance |
| B4 | device_type 字段的合法值 | 如：optical_library/tape_library |
| B5 | tbl_disc_lib 是否就是"设备表"？ | 还是有其他设备表（如 tbl_device）？ |
| B6 | total_capacity / used_capacity 的单位 | 字节/MB/GB/光盘数？ |
| B7 | last_heartbeat 的含义 | 是否为设备最后一次上报时间？ |
| B8 | 是否有软删除标记？ | deleted_at 或 is_deleted 字段？ |

### C. 通用确认

| 序号 | 问题 | 说明 |
|-----|------|------|
| C1 | id 字段是否保证唯一且递增？ | 用于判断是否可作为增量同步的游标 |
| C2 | 两张表是否有 updated_at 字段？ | 用于后续增量同步方案设计 |
| C3 | updated_at 是否有索引？ | 影响增量查询性能 |
| C4 | 是否有 deleted_at 或 is_deleted？ | 影响同步是否需要处理删除 |

---

## 二、数据规模确认

| 序号 | 问题 | 说明 |
|-----|------|------|
| D1 | tbl_task 当前记录数 | 评估单次推送数据量 |
| D2 | tbl_disc_lib 当前记录数 | 同上 |
| D3 | tbl_task 每日新增/更新记录数 | 评估增量大小 |
| D4 | tbl_disc_lib 每日新增/更新记录数 | 同上 |
| D5 | 预计未来 1 年最大记录数 | 评估当前 10000 条/批限制是否足够 |
| D6 | 是否有季节性数据高峰？ | 如月底批量任务激增 |

---

## 三、职责边界确认

| 序号 | 问题 | 说明 |
|-----|------|------|
| E1 | 站点是否接受由总控统一定义数据包格式？ | 总控制定 JSON 格式规范，站点按规范导出 |
| E2 | 站点是否接受每小时推送小表全量快照？ | 当前方案：每小时将 tasks/devices 全表数据推送到总控 |
| E3 | 站点是否有能力维护推送脚本？ | 需要技术人员部署和监控 |
| E4 | 站点是否能配置定时任务？ | cron 或 Windows 计划任务 |
| E5 | 推送失败时站点是否有告警机制？ | 还是完全依赖总控侧监控 |

---

## 四、推送能力确认

| 序号 | 问题 | 说明 |
|-----|------|------|
| F1 | 站点服务器是否能发起 HTTP POST 请求？ | 调用中心平台 API |
| F2 | 站点是否能按 JSON 格式导出数据？ | JSON 格式见附录 |
| F3 | 站点服务器操作系统？ | Linux/Windows，影响推送脚本选型 |
| F4 | 站点是否有 Python/curl/PowerShell？ | 推送脚本的运行环境 |
| F5 | 站点能否保管 API Key？ | 安全存储要求，建议文件权限 600 |

---

## 五、网络确认

| 序号 | 问题 | 说明 |
|-----|------|------|
| G1 | 站点到中心平台的网络连通性 | 需要能访问中心平台 HTTP/HTTPS 端口 |
| G2 | 是否需要 VPN 或专线？ | 影响推送方案 |
| G3 | 是否有防火墙限制？ | 需要开放的端口和 IP |
| G4 | 网络延迟和稳定性 | 影响超时和重试策略 |
| G5 | 站点是否有固定公网 IP 或域名？ | 用于 API Key 绑定和 IP 白名单 |

---

## 六、安全确认

| 序号 | 问题 | 说明 |
|-----|------|------|
| H1 | API Key 如何分配和保管？ | 建议每个站点独立 Key，总控统一分发 |
| H2 | 推送数据是否需要加密传输？ | HTTPS 或其他加密方式 |
| H3 | 是否需要 IP 白名单？ | 限制只有站点 IP 可调用 |
| H4 | 推送数据中是否包含敏感字段？ | 如密码、密钥等需要脱敏的字段 |

---

## 附录 A：推送 JSON 格式示例

### tasks 数据包

```json
{
  "siteCode": "SH01",
  "sourceTable": "tbl_task",
  "batchId": "sh01-tasks-20260531-100000",
  "snapshotAt": "2026-05-31T10:00:00Z",
  "recordCount": 2,
  "records": [
    {
      "id": 1001,
      "task_no": "TASK-20260531-001",
      "task_name": "数据备份任务A",
      "task_type": "backup",
      "status": "completed",
      "phase": "finished",
      "priority": "high",
      "data_classification": "机密",
      "archive_name": "20260531-备份A",
      "source_path": "/data/project-a",
      "package_path": "/archive/20260531/backup-a",
      "operator": "admin",
      "department": "IT",
      "created_at": "2026-05-31T08:00:00Z",
      "updated_at": "2026-05-31T09:30:00Z"
    }
  ]
}
```

### devices 数据包

```json
{
  "siteCode": "SH01",
  "sourceTable": "tbl_disc_lib",
  "batchId": "sh01-devices-20260531-100000",
  "snapshotAt": "2026-05-31T10:00:00Z",
  "recordCount": 1,
  "records": [
    {
      "id": 5001,
      "device_no": "DEV-SH01-001",
      "device_name": "光盘库A",
      "device_type": "optical_library",
      "device_status": "online",
      "last_heartbeat": "2026-05-31T09:55:00Z",
      "operator": "admin",
      "ip_address": "192.168.1.100",
      "location": "上海数据中心",
      "room": "A101",
      "floor": "1F",
      "total_capacity": 1000,
      "used_capacity": 350,
      "created_at": "2026-01-01T00:00:00Z",
      "updated_at": "2026-05-31T09:55:00Z"
    }
  ]
}
```

### batchId 命名建议

```
{siteCode}-{sourceTable}-{YYYYMMDD}-{HHMMSS}
示例：SH01-tbl_task-20260531-100000
```

---

## 附录 B：当前已完成能力

统一管控平台已具备：

- **API Key 认证**：每个站点独立 Key，请求时通过 x-api-key header 传递
- **siteCode 校验**：API Key 与请求体中 siteCode 必须匹配
- **请求体校验**：必填字段、recordCount 一致性检查
- **记录数限制**：单次最多 10000 条
- **幂等防重复**：batchId + payload_hash，重复推送不会重复写入
- **数据写入**：PostgreSQL 事务内 UPSERT，保证数据一致性
- **错误响应**：结构化 JSON 错误码，便于站点排查
- **批次日志**：ingest_batch_log 记录每次推送的完整生命周期

---

## 附录 C：当前字段映射草案

详见 `docs/database-analysis/sprint-2b8-source-field-audit.md`。

简要说明：
- **tasks**：15 个源字段 → 12 个写入 unified_tasks（3 个不写入，6 列为空）
- **devices**：15 个源字段 → 12 个写入 unified_devices（3 个不写入，9 列为空）
- **raw_data**：保留完整源数据，可用于补充查询

此映射基于假设的源表结构，需站点提供实际 DDL 后确认或修正。

---

*文档创建: 2026-05-31*
*Sprint 2B.8: 站点沟通准备*
