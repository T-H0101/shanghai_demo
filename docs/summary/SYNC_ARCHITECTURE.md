# Sync Architecture

> **总控中心 + 站点侧** 数据流

## 数据流

```
┌─────────────────────────────────────────────────────────┐
│                       站点侧 (source)                     │
│  tbl_task / tbl_disc_lib / tbl_magzines / tbl_slots /    │
│  tbl_hd_info / tbl_lib_task / tbl_disc /                 │
│  tbl_logical_volume / tbl_volume_slot / tbl_user_task   │
└─────────────────────────────────────────────────────────┘
                            │
                  站点定期导出 (每小时) → 推送 package
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    总控中心 (unified)                     │
│                                                           │
│  POST /api/sync/package                                   │
│         ↓                                                 │
│  validatePackagePayload()  (lib/sync/package-schema)      │
│         ↓                                                 │
│  findPackageByBatch() 幂等检查                            │
│         ↓                                                 │
│  createPackageLog + markPackageRunning                   │
│         ↓                                                 │
│  dispatchTable()  (lib/sync/package-dispatcher)         │
│         ↓                                                 │
│  ┌─────────────┬─────────────┬──────────────┐            │
│  │ mapRealTask │ mapRealDev  │ mapRealDisc  │  ...        │
│  │ upsertTasks │ upsertDevs  │ upsertDiscs  │            │
│  └─────────────┴─────────────┴──────────────┘            │
│         ↓                                                 │
│  createTableLog + markTableSuccess                       │
│         ↓                                                 │
│  markPackageSuccess / Failed                              │
│         ↓                                                 │
│  sync_package_log / sync_table_log                       │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    中心库 (PG17)                          │
│  unified_tasks / unified_devices / unified_volumes /    │
│  unified_disc_media / unified_hard_disks                │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                       API 层                             │
│  /api/tasks  /api/racks  /api/volumes                    │
│  /api/tasks/[id]/files                                    │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                      前端页面                             │
│  /tasks  /racks  /volumes  /logs                         │
└─────────────────────────────────────────────────────────┘
```

## 分层存储

| 数据类型 | 存储 | 理由 |
|---|---|---|
| 小表 / 关系 / 字典 | **PG17** | full snapshot + UPSERT |
| 大表 (文件/目录) | **ES** (待接入) | 全文检索、跨站点搜索 |
| 高频日志 | **ClickHouse** (待接入) | 列式压缩、长保留 |
| 站点原始数据 | **不复制** | PG17 不是站点副本 |

## 同步原则

1. **小表全量同步** — UPSERT 到 unified_*
2. **大表增量同步** — file-index taskId + watermark + limit
3. **文件表最后做 ES** — 不进 PG17
4. **每小时同步** — 站点定时推送
5. **总控定义协议** — package schema 由总控统一定义
6. **站点导出推送** — 站点只负责导出和推送
7. **总控接收校验** — 总控负责接收、校验、入库、日志
8. **不直接修改站点** — 总控不写回
9. **多站点视角** (Sprint 2F.4) — 4 个 list API 全部支持 `?siteCode=`, Header 全局选择器 + URL 同步 + localStorage 记忆, 支持 All Sites 总览

## 领导口径 (Sprint 4.2 收敛 — 2026-06-08)

| 项 | 领导口径 | 当前实现状态 | 缺什么 |
|---|---|---|---|
| 接口文档 | **没有现成接口文档** | 站点侧用 `scripts/export-package.ts` 模拟 | 真实站点需自行开发 Client (或走 SQL 拉数) |
| 实时性 | **不要求实时, 定期查询** | sync 是 pull model, 走 HMAC push | ✅ 已满足 |
| 同步周期 | **每小时** | 当前需手动 `pnpm export-and-push` | **缺 cron 调度器** (生产部署时站点侧 cron) |
| 管控能力 | **严格按 requirements.md, 不只展示** | Sprint 4.1 评估 7 任务控制动作 0 真实, 全 mock | **缺控制链路 (见 sprint-4.2-control-architecture)** |
| 源端类型 | **PG17 物理备份, 库名 star_storage_db** | 容器 `pg_restore_test` 端口 5433, 170 张表 | 当前 `source_restore` 只接 13 张白名单 = 7.6% |
| 部署环境 | **Mac + Docker 模拟, 非 Linux 服务器** | 当前 `docker-compose.yml` PG17 容器, Mac 本地 | 生产需换 Linux + Docker / K8s |

## 当前已实现的同步链路 (10/12)

| # | 环节 | 状态 | 实现位置 |
|---|---|---|---|
| 1 | 站点拉源端小表 (白名单 13 张) | ✅ | `scripts/export-package.ts` (Sprint 2H.1) |
| 2 | 生成 package.json (含 batchId/siteCode/tables) | ✅ | 同上 |
| 3 | HMAC-SHA256 签名 (5min 窗口) | ✅ | `lib/sync/package-auth.ts` (Sprint 2G.1) |
| 4 | POST `/api/sync/package` 推送 | ✅ | `app/api/sync/package/route.ts` |
| 5 | 接收校验 (HMAC + x-site-code + payload.siteCode) | ✅ | Sprint 2G.1 |
| 6 | `validatePackagePayload()` schema 校验 | ✅ | `lib/sync/package-schema.ts` |
| 7 | 幂等检查 (`findPackageByBatch`) | ✅ | Sprint 2D.2 |
| 8 | dispatcher (13 张表) | ✅ | `lib/sync/package-dispatcher.ts` |
| 9 | inlineUpsert (RETURNING xmax = 0) | ✅ | Sprint 2H.6 |
| 10 | 写 sync_package_log / sync_table_log | ✅ | `lib/sync/sync-job-log.ts` |
| 11 | **每小时 cron 调度** | ❌ | 缺 — 见 4.4 路线图 |
| 12 | **页面展示 sync 最新结果 + 失败可见** | ✅ | `/sync` 页面 + `/logs` 页面 |

## 还缺什么 (基于领导口径)

| 缺口 | 估时 | Sprint |
|---|---|---|
| 站点侧每小时 cron 调度 (拉源 → 推 package) | 1d | 4.4 |
| 真实站点 Client (替代 export-package 模拟) | 站点负责 | — |
| 总控侧定时校验 job (源 vs unified_* 一致性) | 2d | 4.4 |
| 控制队列表 + 站点轮询 (Sprint 4.1 TC-01~06) | 3d | 4.5 |
| SSO 跳转占位 (REQ-003) | 1d | 4.7 |
| TaskControlProvider 抽象 | 1d | 4.6 |
| 巡检/恢复控制方案 | 3d | 4.8 |

## 每小时同步如何在生产部署

### Mac/Docker 开发环境 (当前)

```bash
# 手动模式 (当前实现)
pnpm export-and-push SH01
# 或测试用
pnpm smoke:sync
```

### 生产 Linux 部署方案 (设计)

```bash
# 站点侧 (每台 star_storage_db 服务器)
/etc/cron.d/unified-sync
  0 * * * * unified /opt/unified/export-and-push.sh $(hostname)
# → 每小时整点跑 export-package + push-package

# 或 systemd timer (更精细)
[Unit]
Description=Unified Sync Package Push
[Timer]
OnCalendar=hourly
Persistent=true
[Service]
ExecStart=/opt/unified/export-and-push.sh
User=unified
```

### 容器化方案 (k8s CronJob)

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: unified-sync-push
spec:
  schedule: "0 * * * *"  # 每小时
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: sync
            image: unified/sync-client:latest
            env:
            - name: SOURCE_DATABASE_URL
              valueFrom: { secretKeyRef: { name: site-secrets, key: db-url } }
            - name: SYNC_PACKAGE_SECRET
              valueFrom: { secretKeyRef: { name: site-secrets, key: hmac-secret } }
            - name: SYNC_CONTROL_URL
              value: "https://control.unified.example.com"
          restartPolicy: OnFailure
```

### 总控侧对应

- **不需要 cron** — 写入由站点 push 触发
- **可选: 定时校验 job** — 每天 1 次对比源 vs unified_*, 写差异报告 (Sprint 4.4)

## 严格边界 (CLAUDE.md + 领导口径)

- ❌ **tbl_file / tbl_folder 不进 PG17 全量** (LEADER_DECISIONS §9, 永远禁止)
- ❌ **不接 ES / ClickHouse** (CLAUDE.md, 留 Sprint 2D.6 / 4.x 后)
- ❌ **不伪造控制成功** (Sprint 4.1 已确认 mock 0 真实)
- ❌ **不改 HMAC 协议** (Sprint 2G.1 已定型, strict + rawBody)
- ❌ **不接真实 ADFS** (CLAUDE.md, 走 Mock UI 演示)
- ✅ **不破坏** package sync / dashboard / tasks / racks / volumes / sync center

## 包级别追踪

| 日志 | 字段 | 用途 |
|---|---|---|
| `sync_package_log` | site_code + batch_id | 包级唯一 |
| `sync_table_log` | site_code + batch_id + table_name | 表级唯一 |
| `unified_file_index` | source_site_id + source_table + source_id | 行级唯一 |
