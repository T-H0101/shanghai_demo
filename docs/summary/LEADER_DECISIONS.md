# Leader Decisions

> **领导确认的同步策略** (Sprint 2D 阶段固化)

## 一、数据同步原则

### 1. 小表全量同步
- 适用: 配置表、字典表、关系表、设备/任务/卷/介质小表
- 方式: full snapshot + UPSERT 到 PG17 unified_*
- 频率: 初版每小时一次

### 2. 大表增量同步
- 适用: 文件表、日志表、明细表
- 方式: 增量 (watermark / last_id)
- 存储: **不进 PG17**，走 ES / ClickHouse

### 3. 文件表最后做 ES
- tbl_file / tbl_folder → Elasticsearch 全文检索
- 中心库 PG17 仅保留 file_index 摘要
- ES 用于跨站点搜索/聚合

## 二、协议与责任

### 4. 总控定义协议
- package 数据格式由总控统一定义
- 站点只按规范导出和调用
- schema 校验在总控侧 (`validatePackagePayload`)

### 5. 站点负责导出和推送
- 站点侧执行: 导出数据 → 推送到总控 `/api/sync/package`
- 推送工具: bash + curl 或站点自定义客户端
- 站点不接收总控反向指令

### 6. 总控负责接收、校验、入库、日志
- 接收: POST /api/sync/package
- 校验: schema + 白名单 + checksum
- 入库: dispatch → mapper → upsert
- 日志: sync_package_log + sync_table_log

### 7. 总控不直接修改站点数据
- 总控 PG17 不是站点库副本
- 总控不写回站点
- 单向数据流: 站点 → 总控

## 三、技术约束

### 8. PG17 不是站点库副本
- 只存: 业务摘要、索引状态、同步状态、总控管理表
- 不存: 站点原始明细、文件内容、临时数据

### 9. 大表不进总控 PG17 全量表
- tbl_file / tbl_folder 不做 full-copy unified_files/unified_folders
- 走 ES / file_index (PG17 任务级索引)

### 10. 强安全护栏
- 严禁全表扫描 tbl_file/tbl_folder
- file-index 强制 taskId + watermark + limit (≤ 5000)
- 不在 import:all 自动触发 file-index
- 站点不通过 package 推大表 (白名单 + FORBIDDEN)

## 四、当前落地状态

| 决策 | 状态 | 实现位置 |
|---|---|---|
| 1. 小表全量 | ✅ | 9 个 importer |
| 2. 大表增量 | ✅ | file-index importer |
| 3. 文件表 ES | ⏳ 后续 Sprint | ROADMAP 2D.6 |
| 4. 总控定义协议 | ✅ | lib/sync/package-schema.ts |
| 5. 站点导出推送 | ⏳ 客户端待建 | ROADMAP 2D.4 |
| 6. 总控接收校验 | ✅ | app/api/sync/package/route.ts |
| 7. 不修改站点 | ✅ | 架构约束 |
| 8. PG17 不是副本 | ✅ | unified_* 摘要表 |
| 9. 大表不进 PG17 全量 | ✅ | file-index + ES 路径 |
| 10. 强安全护栏 | ✅ | reader SQL + whitelist |
