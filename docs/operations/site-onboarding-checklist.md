# 新站点接入清单 (Site Onboarding Checklist)

> **目的**: 把"新站点接入总控"拆成可勾选的步骤, 让总控 + 站点运维 + 站点 app 团队三方在同一份清单上协作。
>
> **依据**:
> - `docs/source/requirements.md` (整体架构, 数据同步, 任务管理)
> - `docs/source/site-agent-contract.md` (R.88)
> - `docs/database-analysis/r84-source-table-classification.md` (R.84)
> - `docs/database-analysis/r86-file-index-incremental-sync.md` (R.86)
> - ADR 0003 (Site Agent pull-based 控制)
> - CLAUDE.md §四 §五 §六 (强约束)
>
> **状态**: `complete` (清单 + 责任矩阵 + 验证流程落地)。

---

## 0. 接入原则

1. **总控是调度 / 审计 / 视图层**; 站点 app 才是执行层 (ADR 0003)。
2. **每个接入点都有责任人**; 跨团队的事项不混在一人责任里。
3. **每个验证步骤都有可执行命令或 SQL**; 不允许"目测通过"或"差不多"。
4. **不允许把"同步链路完成"说成"需求完成"** (CLAUDE.md §一); 站点接入成功 ≠ §4.2 任务控制完成。

---

## 1. 接入前: 信息收集

| 项 | 内容 | 责任人 |
|---|---|---|
| 站点标识 | `site_id` (e.g. `SH02`) | 总控 |
| 业务名 | 站点名称 / 城市 / 数据中心 | 站点运维 |
| 站点库版本 | PostgreSQL / 其它? 17+? | 站点运维 |
| 站点 app | 现存? 自研? 接入方? | 站点 app 团队 |
| 现有监控 | 站点端是否已有心跳/告警 | 站点运维 |
| 网络可达 | 总控 -> 站点 HTTP 出站是否允许 | 总控 + 站点运维 |
| 数据规模 | 文件索引 `tbl_file` / `tbl_folder` 行数预估 | 站点运维 |

---

## 2. 总控侧准备 (platform 责任)

### 2.1 中心库 schema

- [ ] **`unified_<site_id>_info`** — 站点信息表已建 (CLAUDE.md §2.1)。
- [ ] **`unified_<site_id>_sync`** — 同步白名单记录 (R.83 dispatcher)。
- [ ] **`unified_<site_id>_audit`** — 审计日志分区。
- [ ] **`control_command` 已就绪** — 控制命令表 + 索引 (R.4.5)。
- [ ] **`file_index_jobs` 已就绪** — 文件索引调度账本 (R.86, `databases/sprint-r86/01-file-index-jobs.sql`)。

### 2.2 R.84 源表分类

- [ ] 把站点库 170 张表接入 R.84 `classify-source-tables.ts`, 全部归类 (`pg_unified` / `file_index_es` / `site_control` / `source_only` / `deprecated_or_empty`)。
- [ ] **强约束**: `needs_decision == 0` 才允许进入下一步。

```bash
pnpm audit:classify-source-tables  # 必须 0 needs_decision
```

### 2.3 R.83 dispatcher 白名单

- [ ] 把站点库 `pg_unified` 表 (e.g. 141 张) 接入 `ALLOWED_PACKAGE_TABLES` (R.83.9)。
- [ ] 验证: `pnpm smoke:sync` 对新站点 (`--siteCode=<site_id>`) 通过。

### 2.4 R.86 文件索引 bootstrap

- [ ] 跑 `bootstrap` 给新站点 × 29 张 `file_index_es` 表插默认 `pending` 行:

```bash
pnpm tsx scripts/index/file-index-job-bootstrap.ts --sites <site_id>
```

- [ ] 验证: `SELECT COUNT(*) FROM file_index_jobs WHERE source_site_id = '<site_id>';` = 29。

### 2.5 凭证签发

- [ ] 站点 `hmac_secret` 签发 (走 secret store, 禁止明文邮件)。
- [ ] `agent_id` 不由总控签发, 由站点 app 启动时本地生成并持久化。
- [ ] 凭证轮换策略: 90 天 (生产), 30 天 (开发)。

---

## 3. 站点侧准备 (站点 app 团队责任)

### 3.1 凭证配置

- [ ] `site_id` 配置到站点 app 配置中心。
- [ ] `hmac_secret` 从 secret store 拉取并缓存在内存 (不写磁盘)。
- [ ] `agent_id` 持久化到本地 KV (e.g. /var/lib/site-agent/agent_id)。
- [ ] HMAC 签名库对接 (按 `site-agent-contract.md §1.3` 规范)。

### 3.2 HTTP 客户端

- [ ] 实现 `GET /api/site-agent/control-commands` 拉取循环。
- [ ] 实现 `POST /api/site-agent/control-commands/{id}/ack`。
- [ ] 实现 `POST /api/site-agent/control-commands/{id}/result`。
- [ ] 实现 `POST /api/site-agent/heartbeat` (30s 周期)。
- [ ] 实现 `GET /api/site-agent/file-index-watermarks` + `POST /api/site-agent/file-index-batch` (R.86 对接)。

### 3.3 控制命令处理

- [ ] 6 个原子动作分发器: `task.new` / `task.pause` / `task.resume` / `task.reset` / `patrol.start` / `restore.task`。
- [ ] 每个动作都有 outcome 上报 (succeeded / failed / paused / rejected)。
- [ ] ack 失败重试 3 次; result 失败重试 5 次 + dead-letter。

### 3.4 断连降级

- [ ] 网络断连时切换本地模式; 本地任务控制走站点原系统。
- [ ] 缓冲 ack / result / heartbeat 到本地队列。
- [ ] 重连后批量回放 (按时间戳排序)。

### 3.5 健康监控

- [ ] 站点 app 自身监控 (CPU / mem / 队列深度)。
- [ ] 心跳失败告警。
- [ ] HMAC 验签失败告警 (可能凭证漂移)。

---

## 4. 网络与安全 (站点运维 + 平台责任)

### 4.1 出入站

- [ ] 总控 -> 站点 app: 站点 app 主动出站 (拉取 + 回写); 站点 app **不需要**暴露端口。
- [ ] 总控 -> 中心库 PG: 仅 platform 内部网络可达。
- [ ] 站点 app -> 站点库 PG: 仅站点内网可达。

### 4.2 TLS

- [ ] 总控 -> 站点 app: TLS 1.2+ (生产)。
- [ ] 站点 app -> 中心库: 不允许 (强制)。
- [ ] 站点 app -> 站点库: 站点内 TLS 或 SSH tunnel (站点运维)。

### 4.3 凭证轮换

- [ ] 90 天 (生产) / 30 天 (开发) 强制轮换。
- [ ] 轮换期间**新旧凭证同时有效 24h** (grace period), 防止中间丢包。
- [ ] 轮换事件写 `audit_log` (event=`credential.rotated`)。

---

## 5. 同步链路验证

### 5.1 站点库 -> 中心库 (R.83 dispatcher)

```bash
# 1. 配置新站点的 SOURCE_DATABASE_URL
export SOURCE_DATABASE_URL="postgres://site_app@<host>:5432/star_storage_db"
export CENTRAL_DATABASE_URL="postgres://unified@localhost:5432/unified_disc_platform"

# 2. 触发全量同步
pnpm scheduler:sync:once --siteCode=<site_id>

# 3. 一致性校验
pnpm check:sync-consistency -- --siteCode=<site_id>
# 期望: matched = pg_unified 表数, failed = 0
```

- [ ] `audit:center-db` 报告 0 unclassified tbl_*。
- [ ] `sync_consistency_log` 7/7 matched (本环境), 生产按站点白名单。

### 5.2 文件索引 (R.86)

```bash
# 1. bootstrap (如果 §2.4 没跑)
pnpm tsx scripts/index/file-index-job-bootstrap.ts --sites <site_id>

# 2. 单表 worker 验证
pnpm tsx scripts/index/file-index-job-runner.ts --site <site_id> --table tbl_file --batch 50
# 期望 JSON { status: "succeeded", scanned: <=50, indexed: <=50, ... }
```

- [ ] `file_index_jobs` 表新增行状态 = `succeeded`。
- [ ] OpenSearch/ES `disc_file_index` 含 `source_site_id=<site_id>` 文档。
- [ ] `/api/search?q=...&siteCode=<site_id>` 命中真实文档。

### 5.3 控制链路 (R.88+)

```bash
# 1. 总控发起命令 (UI 或 API)
POST /api/control/commands
Body: { site_id: "<site_id>", command_type: "task.pause", target_id: "TASK-001" }

# 2. 站点 app 拉取 + ack + 执行 + 回写 (站点 app 测试套件)
./site-agent-test --scenario full-control-loop

# 3. 总控侧验证
SELECT status, acknowledged_at, executed_at, outcome
FROM control_command
WHERE site_id = '<site_id>' ORDER BY issued_at DESC LIMIT 5;
# 期望: 至少 1 行 status=executed outcome=succeeded
```

- [ ] `control_command` 表写入 (`status=pending`)。
- [ ] 站点 app 在 ≤ 5s 内 ack。
- [ ] 站点 app 在合理时间内 result 回写。
- [ ] `audit_log` 写入 `control.issued` + `control.acknowledged` + `control.executed`。

> **重要**: 控制链路成功 ≠ `requirements §4.2` 完成。仅当**真实控制证据**存在 (4 条件全满足, 见 CLAUDE.md §四) 才能标记 §4.2 为 `complete`。

---

## 6. 心跳与监控

### 6.1 心跳

```bash
# 总控侧: 心跳缺失检测 (R.87 接管, 当前 Sprint 仅 schema 准备)
SELECT site_id, MAX(received_at) AS last_heartbeat
FROM site_agent_heartbeat
WHERE site_id = '<site_id>'
GROUP BY site_id;
# 期望: last_heartbeat 距当前 ≤ 90s
```

### 6.2 告警阈值 (R.87 接管)

| 指标 | 阈值 | 责任 |
|---|---|---|
| 心跳缺失 | > 90s | R.87 |
| queue_depth > 1000 | 持续 5min | R.87 |
| agent_version 落后 | ≥ 1 大版本 | R.87 |
| HMAC 验签失败 | 连续 ≥ 5 次 | R.87 |
| 死信 (control / file_index) | status = dead_letter | R.87 |

---

## 7. 验收与签字

### 7.1 总控侧签字 (platform)

- [ ] 中心库 schema 全部就绪。
- [ ] R.84 源表分类 0 needs_decision。
- [ ] R.83 dispatcher smoke 通过。
- [ ] R.86 file_index_jobs bootstrap 通过。
- [ ] 凭证签发流程已走完。

### 7.2 站点 app 团队签字

- [ ] HMAC 签名/验签 + 凭证存储就绪。
- [ ] 5 个 HTTP endpoint 客户端实现。
- [ ] 控制命令处理 + 断连降级 + 重连回放。
- [ ] 站点 app 自测通过 (ack/result/heartbeat)。

### 7.3 站点运维签字

- [ ] 网络可达 + TLS 配置。
- [ ] 凭证接收与存储。
- [ ] 监控告警通道就绪。

### 7.4 端到端签字 (三方联合)

- [ ] 同步链路 smoke。
- [ ] 文件索引 bootstrap + worker。
- [ ] 控制链路 (拉取 -> ack -> result)。
- [ ] 心跳正常。
- [ ] **decision log** 写入: "新站点 `<site_id>` 接入完成" (含日期 + 三方签字)。

---

## 8. 留待 R.87 接管

| 项 | 备注 |
|---|---|
| 心跳健康监控 endpoint | R.87 |
| 告警通道 (邮件 / IM / SMS) | R.87 |
| 死信重放 CLI | R.87 |
| 凭证自动轮换 cron | R.87 |
| 站点 app 版本落后告警 | R.87 |

---

## 9. 禁止 (CLAUDE.md §一)

- ❌ 不允许未走 §2/§3/§5 全部步骤就"宣称站点接入完成"。
- ❌ 不允许把"心跳存在"说成"§2.1 站点监控完成"。
- ❌ 不允许把"control_command 有数据"说成"§4.2 任务控制完成"。
- ❌ 不允许把 `hmac_secret` / 数据库密码 / 真实源库连接提交到 git。
- ❌ 不允许跳过断连降级测试。

---

## 10. 关联文档

- `docs/source/requirements.md` — 需求规格
- `docs/source/site-agent-contract.md` — R.88 协议级契约
- `docs/database-analysis/r84-source-table-classification.md` — 源表分类矩阵
- `docs/database-analysis/r86-file-index-incremental-sync.md` — 增量同步设计
- `docs/architecture/adr/0001-pg-for-metadata-es-for-file-index.md` — PG/ES 分工
- `docs/architecture/adr/0002-ports-and-adapters-boundary.md` — 端口/适配器
- `docs/architecture/adr/0003-site-agent-pull-control.md` — pull-based 控制
- `docs/operations/deployment.md` — 部署手册

---

_End of R.88 site onboarding checklist._