# R.19C Site Agent 混合同步闭环设计

> 日期: 2026-06-15
> 状态: 用户已确认
> 范围: 仅实现可部署 Site Agent 的小表同步闭环

## 1. Requirement 对照

本单元对应:

- `requirements.md §1.2`: 总控与站点松耦合，站点断连恢复后自动补传。
- `requirements.md §2.3`: 设备、权限基础数据、任务数据增量过滤；实时、定时和手动同步；失败重试。
- `requirements.md §6.1`: 单站点增量同步不超过 10 秒，任务状态同步不超过 5 秒。

本单元只能改善上述 requirement，不能将其整体标记为 `complete`。完整文件索引、完整权限关系、最终失败告警和页面配置写入仍缺失。

## 2. 已验证基线

- 完整测试站点库 `star_storage_db` 包含 170 张表。
- 当前 package 白名单包含 13 张小表，共 797 行测试数据。
- `tbl_task` 存在 `id`、`create_dt`、`update_dt`，可建立增量游标。
- 其余白名单表不能统一依赖更新时间字段。
- 中心端 `POST /api/sync/package` 已具备:
  - HMAC-SHA256 鉴权；
  - 13 表白名单；
  - `tbl_file` / `tbl_folder` 禁止规则；
  - `(site_code, batch_id)` 幂等；
  - package/table 日志；
  - dispatcher 和中心表 upsert。
- 独立 Site Agent 已具备真实站点数据库探活和 heartbeat。

## 3. 范围

### 3.1 本轮实现

1. Site Agent 从 `SITE_DATABASE_URL` 读取真实站点库。
2. 首次运行对 13 张白名单小表执行 bootstrap。
3. `tbl_task` 后续执行真实增量读取。
4. 其余 12 张小表通过确定性 SHA-256 快照哈希检测变化，变化后发送完整小表快照。
5. package 先持久化到本地 spool，再发送至现有 `/api/sync/package`。
6. 网络或服务失败时保留 package，并按有界指数退避重试。
7. Agent 重启后优先补传未完成 package。
8. heartbeat 上报真实 `lastSyncAt` 和 `spoolDepth`。
9. 提供一次性运行参数，支持白盒测试和人工触发同步。

### 3.2 明确不做

- 不新增 API、页面或数据库表。
- 不实现控制命令 poll/ack/result。
- 不引入 SQLite、消息队列或新 npm 依赖。
- 不全量同步 `tbl_file`、`tbl_folder`。
- 不实现 ES、ClickHouse、ADFS、JWT 或 RBAC。
- 不使用 mock、simulator 或 DRY_RUN 作为完成证据。
- 不进行浏览器审查；本轮仅做代码、数据库、API 和自动化白盒验证。

## 4. 架构

主架构风格为 Client/Server，站点 Agent 是客户端，总控 package API 是服务端。Agent 内部使用 Pipe-and-Filter 与 Ports and Adapters:

```text
Site PostgreSQL
  -> PgSourceReader
  -> ChangeDetector
  -> PackageBuilder
  -> FileStateStore / FileSpool
  -> PackageTransport
  -> POST /api/sync/package
  -> Existing Dispatcher
  -> unified_* + sync logs
```

职责划分:

| 模块 | 职责 |
|---|---|
| `PgSourceReader` | 只负责参数化读取白名单源表 |
| `ChangeDetector` | 任务游标和小表快照哈希判定 |
| `PackageBuilder` | 构建既有 package schema 和 checksum |
| `FileStateStore` | 原子保存 watermark、hash 和最近成功时间 |
| `FileSpool` | 原子写入、列出和删除待发送 package |
| `PackageTransport` | HMAC 签名并调用现有 package API |
| `SyncCoordinator` | 编排恢复补传、读取、构包、发送和状态提交 |

模块依赖接口而不是直接创建具体实现，测试可以注入临时文件系统、测试数据库连接和本地 HTTP 服务。

## 5. 同步算法

### 5.1 Bootstrap

没有本地成功状态时:

1. 读取全部 13 张白名单小表。
2. 每张表按稳定主键或全行稳定序列化排序。
3. 计算每张表 SHA-256。
4. 构建 `mode=mixed` package。
5. 原子写入 spool。
6. 调用 package API。
7. 仅在中心确认成功或 duplicated 后:
   - 删除 spool 文件；
   - 保存 `tbl_task` 游标；
   - 保存 12 张快照表 hash；
   - 更新 `lastSyncAt`。

### 5.2 `tbl_task` 真增量

游标结构:

```json
{
  "maxId": 37,
  "maxUpdateDt": "2026-06-15T00:00:00.000Z"
}
```

查询需要同时覆盖新增和更新:

```sql
SELECT *
FROM tbl_task
WHERE id > $1
   OR update_dt >= $2
ORDER BY COALESCE(update_dt, create_dt), id
```

规则:

- `maxId` 捕获 `update_dt IS NULL` 的新增行。
- 时间游标使用可配置重叠窗口，默认回退 10 秒，避免数据库与 Agent 时钟差或边界丢行。
- 重叠产生的重复记录由中心 upsert 和 batch 幂等吸收。
- 游标只在 package 被中心确认后推进。

### 5.3 其他小表快照变化检测

每张表读取后执行:

1. 将 PostgreSQL 值规范化为稳定 JSON。
2. 按稳定行键排序；无统一主键时按规范化整行排序。
3. 对规范化数组计算 SHA-256。
4. 与最后成功 hash 比较。
5. hash 未变则不发送该表；变化则发送整张小表，`syncMode=full`。

快照表规模当前均为小表，本地完整读取不会涉及禁止的大表。

### 5.4 空变化

当 `tbl_task` 没有增量且所有快照 hash 未变化时:

- 不创建空 package；
- 不调用中心 API；
- 记录 `sync_no_change`；
- heartbeat 保留上次真实成功同步时间。

## 6. 本地持久化

默认根目录由 `SITE_AGENT_STATE_DIR` 配置，不提交运行数据:

```text
state/
  sync-state.json
  spool/
    <batchId>.json
```

所有写入采用:

1. 写入同目录临时文件；
2. `fsync` 文件；
3. `rename` 覆盖目标；
4. 必要时 `fsync` 目录。

spool package 写入成功后才允许网络发送。进程异常不会出现“游标已推进但 package 未发送”的状态。

## 7. 失败与恢复

| 场景 | 行为 |
|---|---|
| 站点数据库不可达 | 本轮失败，不修改状态，不伪造同步成功 |
| package API 网络失败/5xx | 保留 spool，指数退避后重试 |
| HTTP 401/400 | 保留 spool并记录不可重试配置/数据错误，进程返回失败 |
| HTTP 207 partial | 保留 spool并返回失败，不推进任何状态 |
| HTTP 200 success | 删除 spool并提交状态 |
| HTTP 200 duplicated | 视为中心已完成，删除 spool并提交相同状态 |
| Agent 重启 | 先按文件名顺序重放 spool，再读取新变化 |
| state 文件损坏 | fail closed，保留损坏文件，不自动当作首次全量覆盖 |

默认重试次数、初始间隔和最大间隔通过安全环境变量配置，不包含 secret。

## 8. 调度

- `SITE_AGENT_TASK_SYNC_INTERVAL_MS`: 默认 5000。
- `SITE_AGENT_SNAPSHOT_SYNC_INTERVAL_MS`: 默认 60000。
- `SITE_AGENT_SYNC_RETRY_MAX_ATTEMPTS`: 默认 5。
- `SITE_AGENT_SYNC_RETRY_BASE_MS`: 默认 1000。
- `SITE_AGENT_SYNC_RETRY_MAX_MS`: 默认 30000。
- `SITE_AGENT_SYNC_OVERLAP_MS`: 默认 10000。
- `SITE_AGENT_STATE_DIR`: 站点本地状态目录。

Agent 采用单进程、单同步执行锁。慢请求期间不启动第二个同步循环，防止同一水位并发构包。

`--once` 执行 heartbeat 加一次恢复/同步周期，作为人工同步和白盒测试入口。

## 9. 安全

- 数据库 URL 和 HMAC secret 仅从环境变量读取。
- 日志只显示 env key ref，不显示连接串或 secret。
- SQL 表名只能来自编译期白名单，不接受用户输入。
- 查询值必须参数化。
- package checksum 使用 SHA-256。
- 沿用现有 package HMAC，不创建第二套签名协议。
- `tbl_file` / `tbl_folder` 在 reader、builder 和 server 三层拒绝。

## 10. 白盒验收

新增 Site Agent sync e2e，至少验证:

1. 首次 bootstrap 从 `star_storage_db` 读取真实 13 表。
2. package 经 HMAC 到达现有 API。
3. 中心 package/table 日志成功。
4. 中心表数据与源端关键计数/记录一致。
5. 无变化时不创建新 package。
6. 修改测试事务内的 `tbl_task.update_dt` 后仅发送任务增量。
7. 修改测试事务内的小表后检测到快照 hash 变化。
8. 中心不可达时 package 留在 spool。
9. 恢复后旧 spool 被补传并删除。
10. 同一 batch 重放返回 duplicated，中心不重复插入。
11. heartbeat 的 `lastSyncAt` 和 `spoolDepth` 来自真实状态。
12. 日志不包含 secret 和数据库连接串。
13. `tbl_file` / `tbl_folder` 始终被拒绝。

数据库测试变更必须放在事务内并回滚，或使用可明确清理的专用测试记录，不污染基线。

提交前执行:

```bash
set -a && source .env.local && set +a
pnpm exec tsc --noEmit
pnpm build
pnpm smoke:sync
pnpm check:sync-consistency -- --siteCode=SH01
pnpm baseline:check
pnpm e2e:all
```

另执行新增的 Site Agent sync 定向测试。

## 11. Requirement 结论口径

本单元完成后允许宣称:

- 可部署 Site Agent 小表同步闭环完成；
- 任务增量同步、快照变化检测、离线 spool 和恢复补传完成；
- package HMAC、批次幂等和中心日志闭环完成。

禁止宣称:

- `REQ-2.3` 整体完成；
- 完整文件索引同步完成；
- 完整权限同步完成；
- 实时告警完成；
- 生产站点部署完成。

