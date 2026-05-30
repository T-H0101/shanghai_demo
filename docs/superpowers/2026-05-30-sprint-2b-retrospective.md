# Sprint 2B 阶段复盘与演示说明

> 日期: 2026-05-30
> 状态: 已完成

---

## 1. 当前已完成能力

| 能力 | 说明 | 技术实现 |
|------|------|----------|
| PostgreSQL 中心库 | Docker 部署 PG17，多站点数据汇聚 | `databases/` SQL 文件 |
| Tasks 同步 | 从 mock_tbl_task 同步到 unified_tasks | `lib/sync/tasks-sync.ts` |
| Devices 同步 | 从 mock_tbl_disc_lib 同步到 unified_devices | `lib/sync/devices-sync.ts` |
| Sync Status 查询 | 查询各源表的同步进度 | `GET /api/sync/status` |
| Sync Logs 查询 | 查询同步执行历史 | `GET /api/sync/logs` |

---

## 2. 对应 requirements.md 章节

| 需求章节 | 对应能力 |
|----------|----------|
| 2.1 站点管理/站点监控 | 设备信息汇聚（devices 同步） |
| 2.3 数据同步 | Tasks/Devices 同步 |
| 4.2 统一任务管理 | Tasks 同步 |
| 5.1 日志管理 | Sync Logs 查询 |
| 6.4 可维护性/状态监控 | Sync Status/Logs 可视化 |

---

## 3. 向领导汇报口径

**已完成：**
- 搭建了 PostgreSQL 中心库，用于汇聚多个站点的数据
- 实现了两个数据同步模块：任务同步和设备同步
- 提供了同步状态查询接口，可监控同步进度
- 同步引擎设计为可扩展，后续可快速接入新数据源

**为什么还在用 Mock 数据：**
- 当前阶段验证同步架构的正确性
- 真实源库接入需要先确认各站点数据库类型和表结构
- Mock 数据确保开发过程中逻辑正确后再接真实数据

**下一步方向：**
- 接入真实源库（需要各站点配合确认表结构）
- 或扩展第三个同步对象（存储卷）
- 或增加同步失败告警机制

---

## 4. 本地演示指南

### 4.1 启动环境

```bash
pnpm db:up        # 启动 PostgreSQL
pnpm db:init      # 初始化数据库
pnpm db:init:sync # 初始化同步表（mock 数据）
pnpm dev          # 启动开发服务器
```

### 4.2 演示流程

**Step 1: 检查数据库健康**

```bash
curl http://localhost:3000/api/system/db-health | jq .
```

预期响应结构：

```json
{
  "service": "db-health",
  "timestamp": "2026-05-30T09:00:08.600Z",
  "database": {
    "status": "healthy",
    "connected": true,
    "latencyMs": 2,
    "pool": { "total": 1, "idle": 1, "waiting": 0 }
  }
}
```

**Step 2: 查看数据汇总**

```bash
curl http://localhost:3000/api/system/db-summary | jq .
```

预期响应结构：返回 `counts` 对象，包含 sites、syncSites、tasks、devices、volumes、alerts 等表记录数

**Step 3: 执行 Tasks 同步**

```bash
curl -X POST http://localhost:3000/api/sync/tasks | jq .
```

首次同步成功响应结构：

```json
{
  "status": "success",
  "rowsRead": 5,
  "rowsUpserted": 5,
  "rowsSkipped": 0,
  "startedAt": "...",
  "finishedAt": "...",
  "lastSourceIdBefore": 0,
  "lastSourceIdAfter": 5
}
```

增量同步（无新数据）响应：

```json
{
  "status": "skipped",
  "rowsRead": 0,
  "rowsUpserted": 0,
  "rowsSkipped": 0,
  "lastSourceIdBefore": "5",
  "lastSourceIdAfter": "5",
  "message": "No new records to sync"
}
```

**Step 4: 执行 Devices 同步**

```bash
curl -X POST http://localhost:3000/api/sync/devices | jq .
```

首次同步成功响应结构：与 tasks 相同，`rowsRead: 3`

**Step 5: 查看同步状态**

```bash
curl http://localhost:3000/api/sync/status | jq .
```

预期响应结构：

```json
{
  "data": [
    {
      "siteId": "SH01",
      "tableName": "tbl_task",
      "lastSourceId": 5,
      "lastSyncTime": "2026-05-30T08:06:59.934Z",
      "lastStatus": "success",
      "syncedRows": 5,
      "lastError": null
    }
  ]
}
```

**Step 6: 查看同步日志**

```bash
curl http://localhost:3000/api/sync/logs | jq .
```

预期响应结构：

```json
{
  "data": [
    {
      "siteId": "SH01",
      "tableName": "tbl_task",
      "jobId": "sync-tbl_task-...",
      "status": "success",
      "rowsRead": 5,
      "rowsUpserted": 5,
      "rowsSkipped": 0,
      "error": null,
      "startedAt": "...",
      "finishedAt": "..."
    }
  ],
  "limit": 10
}
```

### 4.3 演示技巧

1. **先触发同步，再查 status**——展示增量同步逻辑（第二次执行会 skipped）
2. **查 logs 看详细记录**——展示每条同步都有日志留存
3. **db-summary 对比 db-health**——health 只看连接，summary 看数据量

---

## 5. 当前未完成事项

| 未完成 | 说明 |
|--------|------|
| 真实源库连接 | 未接入各站点实际数据库 |
| 定时同步 | 无 Cron Job |
| 统一身份认证/权限系统 | 尚未实现；requirements.md 明确要求，后续需单独规划 |
| 大表检索 | 未处理 tbl_file/tbl_folder |
| ES/ClickHouse | 无搜索引擎接入 |

---

## 6. 下一步候选方向

### 方向 A: 真实源库连接方案 + 源表字段核对

- 确认各站点数据库类型（MySQL/PostgreSQL/SQL Server）
- 核对源表字段与 Mock 表是否匹配
- 设计 ETL 连接层

### 方向 B: 选择一张小表做真实同步试点

- 选择结构简单、数据量小的表作为试点
- 用真实数据跑通整个同步链路
- 积累经验后再扩展到其他表

### 方向 C: Volumes 同步

- 复用现有 sync-engine 模式
- 接入第三个数据源：tbl_disc 或 tbl_volume

### 方向 D: 同步失败重试/告警机制

- 增加同步任务的错误处理
- 失败重试策略
- 告警通知

---

## 7. 推荐顺序

| 优先级 | 方向 | 理由 |
|--------|------|------|
| 第一优先 | 真实源库连接方案 + 源表字段核对 | 这是当前最大瓶颈，其他工作都依赖于此 |
| 第二优先 | 选择一张小表做真实同步试点 | 用试点验证真实数据同步的可行性 |
| 第三优先 | Volumes 同步 | 技术成本低，但收益不如前两者 |
| 第四优先 | 同步失败重试/告警机制 | 属于工程保障层，接入真实数据后更有价值 |

---

**推荐领导沟通策略：**

> "当前 Sprint 完成了数据同步的基础架构，实现了任务和设备两个数据源的同步能力。下一 Sprint 首要任务是确认各站点的源数据库类型和表结构，尽快接入真实数据源。真实源库接入后，优先选择一张小表做试点验证，再逐步扩展到全量数据。"