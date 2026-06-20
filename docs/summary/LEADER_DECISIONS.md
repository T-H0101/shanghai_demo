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

### 5. 站点按总控请求导出 table_backup.sql
- 总控每小时创建同步请求，也支持管理员手动触发。
- 站点 Agent 主动轮询总控命令，收到 sync_full / sync_incremental 后在站点本地执行 pg_dump。
- 站点导出总控白名单需要的表到 table_backup.sql。
- 中心侧接收 table_backup.sql，解析、校验、映射并写入 unified_* / ES / ClickHouse。
- 站点不推 JSON package 作为长期生产协议；JSON package 仅保留为兼容测试入口。

### 6. 站点不接收总控反向指令(已作废)
- R.55 起改为: 站点 Agent 主动 poll 总控命令, 接收 sync_full / sync_incremental / task_create / task_pause / task_resume / task_reset / task_priority_restore / task_inspect / task_recovery / cage_move_register 等反向指令
- 双向数据流: 站点 → 总控(数据) + 总控 → 站点(命令)

### 7. 总控负责接收、校验、入库、日志
- 接收: POST /api/sync/package (JSON package, 兼容测试入口) + /api/sync/dump (table_backup.sql, 生产协议)
- 校验: schema + 白名单 + checksum
- 入库: dispatch → mapper → upsert
- 日志: sync_package_log + sync_table_log

### 8. 总控不直接修改站点数据
- 总控 PG17 不是站点库副本
- 总控不直接写回站点, 但通过 Site Agent 控制队列下发命令 (task_create / pause / resume / reset 等) 间接改变站点状态
- 单向数据流: 站点 → 总控(数据)
- 命令流: 总控 → 站点 Agent(命令) → 站点 DB 变更 → 站点 → 总控(同步)

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
| 3. 文件表 ES | ✅ (R.56) | lib/search/es-client.ts |
| 4. 总控定义协议 | ✅ | lib/sync/package-schema.ts |
| 5. 站点导出 table_backup.sql | ✅ (R.55) | scripts/sync/export-restore-dump.ts |
| 6. 站点接收反向指令 | ✅ (R.50/55/58) | lib/site-agent/control/coordinator.ts |
| 7. 总控接收校验 | ✅ | app/api/sync/package + app/api/sync/dump |
| 8. 不修改站点数据 | ✅ | 站点只接收 Agent 命令 |
| 9. PG17 不是副本 | ✅ | unified_* 摘要表 |
| 10. 大表不进 PG17 全量 | ✅ | file-index + ES 路径 |
| 11. 强安全护栏 | ✅ | reader SQL + whitelist |

## 五、读源规则 (R.55)

### 11. 页面读中心存储
- 业务页面必须读中心拥有的数据存储：PG17 unified_*、ES/OpenSearch、ClickHouse。
- source_restore / site_restore_db / restore DB 只能作为同步来源、测试来源或审计来源。
- UI 可以展示 "最近同步来源: SH01 restore 测试库"，但不能把 restore DB 作为产品页面长期读取源。
