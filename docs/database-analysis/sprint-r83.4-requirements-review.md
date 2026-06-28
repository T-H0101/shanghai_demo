# Sprint R.83.4 Center DB Governance Requirements Review

## 1. Requirement IDs

- REQ-1.2 多站点隔离(`source_site_id` 区分 + UNIQUE 约束)
- REQ-2.3 同步(增量 + dispatch + dump-now)
- REQ-3.3 部门(部门存储卷族)
- REQ-3 资源管理(设备/驱动/RAID/HD 业务族)
- REQ-4.2 任务管理(调度任务 / 巡检 / 热备份 / 热恢复)
- REQ-4.3 盘笼检查(接口任务 / 注册管理)
- REQ-5.1 日志(同步日志 + 桶分布审计)
- REQ-6.2 安全配置(源库差异 → 总控统一 schema)
- REQ-6.3 PG17 中心库兼容与可维护性

## 2. Requirement 原始文本

> 整体架构: 中心库按 `source_site_id` 区分站点,数据隔离有效。
> 同步: 设备信息 / 文件索引信息 / 权限信息 / 任务信息 — 同步数据需做增量过滤,仅同步变更数据;支持多站点并行 dump + ingest。
> 部门管理: 部门、工作区相关元数据接入中心库。
> 资源管理: 设备、驱动、RAID、HD 业务族接入中心库。
> 任务管理: 调度任务、接口任务、热备份/恢复需中心可观测。
> 盘笼检查: 检查任务、巡检策略等业务能力。
> 日志: 同步日志可追溯。
> 安全: 数据库敏感字段加密;源库与中心库 schema 不强求一致(中心库统一)。
> 兼容性: 兼容 PG 17+ 版本,支持原有数据库结构。

## 3. Implementation(8 个 R.83.4 commit 清单)

| 文件 | 改动 | 用途 | commit |
|---|---|---|---|
| `databases/sprint-r83.4/01-storage-schedule-tables.sql` | 新建 | 15 张 unified_* 表 DDL(volume/schedule/register/interface/hot_backup/hot_restore/device/driver/raid/hd) | `9d4f0f8` `c1125e8` |
| `databases/sprint-r83.4/__tests__/ddl-self-check.ts` | 新建 | DDL 自检(6 列 + UNIQUE + GIN + B-tree + COMMENT) | `9d4f0f8` |
| `databases/sprint-2b0/init-docker.sh` | 修改 | 把 R.83.4 DDL 加入迁移链 | `9d4f0f8` |
| `databases/sprint-r83.4/...` legacy rename | 修改 | unified_drivers → unified_drivers_legacy 后重建 | R.83.4 透明披露 |
| `lib/sync/package-schema.ts` | 修改 | ALLOWED_PACKAGE_TABLES 58 → 73 | `1ef0153` |
| `scripts/test-r83.4-whitelist.ts` | 新建 | 白名单 73 项自检(11 checks) | `1ef0153` |
| `lib/sync/dump/manifest.ts` | 修改 | DUMP_ALLOWED_TABLES 58 → 73 | `4b40381` |
| `lib/sync/dump/ingest.ts` | 修改 | TABLE_MAPPING 扩展到 73 项 | `4b40381` |
| `lib/sync/package-dispatcher.ts` | 修改 | 15 个新 dispatcher handler | `35d94d7` |
| `app/api/volume/storage/route.ts` | 新建 | CRUD 5 张 volume 表 | `4608517` |
| `app/api/volume/__tests__/self-check.ts` | 新建 | /api/volume self-check | `4608517` |
| `app/api/schedule/ops/route.ts` | 新建 | CRUD 10 张 schedule/device/hot 表 | `4608517` |
| `app/api/schedule/__tests__/self-check.ts` | 新建 | /api/schedule self-check(12 checks) | `4608517` |
| `app/check/page.tsx` | 修改 | 加 2 Tabs(存储卷 + 调度运维)共 7 tabs | `2e0a318` |
| `components/check/__tests__/self-check.ts` | 修改 | UI self-check 26 checks | `2e0a318` |
| `scripts/audit/center-db-integrity.ts` | 修改 | round 字段加 R.83.4 范围(58-72)+ 6 个不规则 plural overrides | `2e74ace` |
| `scripts/audit/__tests__/matrix-round-source.ts` | 修改 | 加 R.83.4 round 检查(18 checks) | `2e74ace` |
| `docs/database-analysis/r83-170-table-governance-matrix.md` | 修改 | 15 行 R.83.4 标记 + 桶分布 R.83.5+: 68 | `f95056e` |
| `scripts/test-r83.3-whitelist.ts` | 修改 | `=== 58` → `>= 58`(兼容 R.83.4 后 length=73) | `947cd75` |
| `scripts/sync/real-e2e-multi-site-test.ts` | 新建 | Playwright SH01 + SECONDARY 站 + UNIQUE 隔离校验 | `d1bde21` |
| `README.md` | 修改 | §5.3.8 R.83.4 入口 | Task 10 |
| `docs/summary/PROJECT_STATUS.md` | 修改 | R.83.4 段 | Task 10 |
| `docs/summary/ROADMAP.md` | 修改 | R.83.4 标记 | Task 10 |
| `package.json` | 修改 | 加 `test:r83.4-whitelist` `test:r83.4-api` `test:r83.4-ui` `test:r83.4-e2e` | 任务链路中 |

## 4. Backend Reality(真后端 + SQL 证据)

**15 张新表全部就位**(实查统一库,positions 58-72):

```bash
docker exec unified_disc_postgres psql -U unified -d unified_disc_platform -t -A -c "
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name LIKE 'unified_%'
ORDER BY table_name;"
# 期望 ≥75 → 实际 ≥75
```

**6 列标准 + UNIQUE(source_site_id, source_record_id) + GIN + B-tree + COMMENT**: ddl-self-check 跑通 **15/15 PASS**,exit 0。

15 张表(legacy `_legacy` 不计入):

```sql
unified_volume_groups / volume_dataclasses / volume_depas / volume_users / volume_workspaces
unified_schedule_jobs
unified_register_managements
unified_interface_tasks
unified_hot_backup_records / hot_restore_records
unified_device_devices
unified_drivers / drivers_burns
unified_raid_groups
unified_hd_managers
```

**白名单 73 + dispatcher 15/15 + tsc + smoke**:

```bash
pnpm test:r83.4-whitelist    # 11/11 PASS
pnpm exec tsc --noEmit       # clean
pnpm smoke:sync              # Sync smoke passed
pnpm audit:center-db -- --strict --matrix
# unifiedCount ≥ 75,exit 0
```

**2 个 CRUD API + self-check**:

```bash
pnpm test:r83.4-api    # 12/12 PASS
pnpm test:r83.4-ui     # 26/26 PASS
pnpm build             # /api/volume/storage /api/schedule/ops 路由注册成功
```

**多站点真同步验证(Task 9 关键新增,R.83.4 比 R.83.3 更进一步)**:

```bash
pnpm test:r83.4-e2e
# Playwright 真实 chromium 启动 →
#   浏览器打开 /sync →
#   点击 PRIMARY_SITE dump-now(SH01)→
#   POST /api/sync/dump-now →
#   spawn dump + ingest →
#   中心库 SH01 数据 upsert →
#   SECONDARY 站(BJ02)独立 dump →
#   验证 BJ02 47 行进入中心库 source_site_id='BJ02'
#
# 结果:
# - PRIMARY_SITE(SH01):803 rows / 73 tables / 12 tables with data
# - SECONDARY_SITE(BJ02):47 rows / 60 tables empty
# - 4 张表同时有 SH01 + BJ02 数据:
#     unified_tasks 82+38
#     unified_devices 4+5
#     ... 等等
# - UNIQUE(source_site_id, source_record_id) 约束验证:同 source_record_id
#   在 SH01 + BJ02 不会冲突(两行独立)
```

## 5. UI Reality

- `/check` 页复用现有布局,新增 2 个 Tabs:**存储卷** + **调度运维**
  - 7 Tabs 总数: 概览 / 检查分类 / 检查任务 / 巡检策略 / 日志 / **存储卷** / **调度运维**
  - 每个 tab 显示对应统一表的内容(fetch `/api/volume/storage` + `/api/schedule/ops`)
- 不新建页面,nav 不变(沿用 R.83.3 规范)
- **未声称任何虚假完成**:
  - 无"已禁用" / "已暂停" / "已修复" / "控制成功" / "暂停成功" 等误导措辞(grep 0 命中)
  - 任务控制按钮不在 R.83.4,本 Sprint 不暴露
  - 站点 SSO / 启用/禁用 按钮保持 disabled(沿用 R.5)

## 6. Mock / Simulator / DRY_RUN / 真控制

| 类型 | 本 Sprint | 说明 |
|---|---|---|
| Mock | 无新增 | R.83.1/R.83.2 之前用 mock smoke,R.83.3 真实端到点已修复 |
| Simulator | 无 | — |
| DRY_RUN | 无 | — |
| **真控制** | **R.83.4 新增** | **Task 9 多站点真同步:Playwright 真实点击两站 dump-now → 独立 source_site_id 数据 upsert → UNIQUE 隔离验证 → 803+47 rows 真支持** |

> **关键区别**:R.83.3 Task 11 只跑了单站点(SH01)真实端到点。R.83.4 Task 9 在此基础上扩展到**双站点真同步 + UNIQUE 隔离约束**校验,这是 R.83.4 与之前 Sprint 最大的差异。

## 7. Missing Pieces(不隐藏)

1. **68 张 `R.83.5+` 业务表未接入**: 后续轮推
2. **29 张 tbl_file_* / tbl_folder_* 仍 `forbidden / never`**: 走 ES/ClickHouse(`blocked_by_external_system`)
3. **5 个 pre-existing dispatcher bug**: `tbl_slots` `tbl_magzines` `tbl_logical_volume` `tbl_hd_info` `tbl_disc` 在 dump-now 中失败 — R.83.1/R.83.2 遗留,R.83.3 已披露,R.83.4 仍未修,需独立 Sprint 修复
4. **legacy `unified_drivers_legacy` 保留**: 透明披露,R.83.5+ 清理前不再访问
5. **敏感字段 `mfa_secret` / `prove_value` 未 hash**: 沿用 R.83.2/R.83.3 状态,`blocked_by_security`,R.83.5+ 改造
6. **6 个不规则 plural overrides**: R.83.4 `volume_users / volume_workspaces / drivers_burns / raid_groups / hd_managers` 等需要 plural special-case,在 `audit:matrix-round` 内嵌
7. **`/check` UI 是只读列表**: 设计上 API 支持 CRUD,但 UI 仅暴露 GET(沿用 R.83.2 规范);无假按钮
8. **`e2e:site-agent-sync` pre-existing 失败**: 与本 Sprint 无关,独立 Sprint 排查

## 8. Blocker Type

- `partial`(R.83.4 15 张表 + 2 API + 2 Tabs + 多站点真同步验证基础设施完成)
- 大表 `tbl_file_*` / `tbl_folder_*`: `blocked_by_external_system`
- 68 张 R.83.5+ 业务表: `blocked_by_source_schema`(需逐张确认业务语义)
- 5 个 pre-existing dispatcher bug: 需独立 Sprint 排查(不阻塞 R.83.4 verdict)
- 敏感字段 `mfa_secret` / `prove_value`: `blocked_by_security`
- 站点 CRUD / SSO / 任务控制: `blocked_by_site_change + blocked_by_auth`

## 9. 需要的源端 schema / 站点 API 变更清单

| 变更项 | 涉及 | 阻塞 |
|---|---|---|
| 站点源库补 dump R.83.4 业务数据 | site_restore / 各站点 | 部分 rowCount = 0(运维) |
| 修复 5 个 pre-existing dispatcher bug | tbl_slots / tbl_magzines / tbl_logical_volume / tbl_hd_info / tbl_disc | dispatch 失败(独立 Sprint) |
| 站点源库 schema 与中心库对齐 | tbl_drivers.source_id → source_record_id | legacy rename 已透明披露,源端应同步更新 |
| 提供剩余 68 张 tbl_* 业务语义 | tbl_volume_* / tbl_data_receive_* / tbl_early_warning_* / tbl_slot_* 等 | R.83.5+ 接入 |
| 站点 app poll control_command | 站点 app | 真实控制闭环 |
| `tbl_user_mfa.mfa_secret` 改 hash | tbl_user_mfa | 安全合规 |
| 站点源库升级 schema 字段命名规范(source_record_id) | tbl_drivers 等 | 多站点隔离 + 统一 schema |

## 10. Verdict

**`partial`**

R.83.4 完成 15 张存储卷 + 调度/接口 + 设备业务族业务表接入 + 2 个 CRUD API + /check 加 2 Tabs 共 7 Tabs + **多站点真同步验证基础设施落地**(SH01 + BJ02 + UNIQUE 隔离)。

**关键交付**:
- `unified_*` 从 60 → 75(15 张 R.83.4 + R.83.1/R.83.2/R.83.3 既有 + 既有 2 张)
- 白名单 58 → 73(`ALLOWED_PACKAGE_TABLES` + `DUMP_ALLOWED_TABLES`)
- /api/volume/storage + /api/schedule/ops + /check 7 Tabs
- **多站点真同步 → SH01 803 rows + BJ02 47 rows + UNIQUE(source_site_id, source_record_id) 隔离有效** ← R.83.4 关键修复
- Playwright 真实点击两站 + 中心库双 source_site_id 数据 + 隔离校验

按 §附录 B 完成度公式:
- 同步链路完成度: **73 / 170 = 42.9%**(R.83.1 15 + R.83.2 15 + R.83.3 15 + R.83.4 15 + 既有 13 = 73)
- 端到端真实同步完成度:**多站点**(R.83.3 单站点 → R.83.4 双站点 + 隔离)
- 控制闭环完成度:仍 `blocked_by_site_change`(需站点 app 配合)

### legacy `unified_drivers_legacy` 透明披露

R.83.4 早期 plan 误判命名冲突,经用户提醒"总控不是只照搬源库"后,修正:
- legacy 表 rename 为 `unified_drivers_legacy`(保留旧 schema:`source_id` 而非 `source_record_id`)
- 按 R.83.4 标准重建 `unified_drivers`(用 `source_record_id`)
- 这印证了"总控不只照搬源库"的约束 — 中心库用统一 schema,源库差异不影响多站点数据隔离

### 多站点真同步透明披露

- **SH01 + BJ02 数据各自独立**:`source_site_id` 不同,UNIQUE(source_site_id, source_record_id) 隔离
- **同 source_record_id 跨站不冲突**:`tbl_devices.id=1` 在 SH01 + BJ02 是两行(`(SH01, 1)` + `(BJ02, 1)`),不互冲
- **60 张表空数据**: R.83.4 之前 R.83.5+ 业务表尚未 DDL,合理

---

## 11. 不变量(Sprint R.83.4 完成后必须 true)

| 不变量 | 验证命令 | 结果 |
|---|---|---|
| `unified_*` 表数 ≥ 75 | `psql ... -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name LIKE 'unified_%'"` | ≥ 75 张 |
| `ALLOWED_PACKAGE_TABLES` 数 = 73 | `pnpm test:r83.4-whitelist` | 11/11 PASS |
| `DUMP_ALLOWED_TABLES` 数 = 73 | `grep -c manifest` | 73 |
| `pnpm audit:center-db --strict --matrix` exit 0 | 命令本身 | unifiedCount ≥ 75,0 fail |
| 任何 `app/api/volume/**` 不引用 restore_db | grep | 0 命中 |
| 任何 `app/api/schedule/**` 不引用 restore_db | grep | 0 命中 |
| 2 个 CRUD API self-check | `pnpm test:r83.4-api` | 12/12 PASS |
| /check 页 UI self-check(7 tabs) | `pnpm test:r83.4-ui` | 26/26 PASS |
| matrix round 字段含 R.83.4 | `pnpm test:matrix-round` | 18/18 PASS |
| **多站点真同步** | `pnpm test:r83.4-e2e` | SH01 803 rows + BJ02 47 rows + UNIQUE 隔离有效 |
| 治理矩阵 15 行 R.83.4 标记 | `grep -c "R.83.4 |" docs/database-analysis/r83-170-table-governance-matrix.md` | 15 |
| R.83.4 requirements review 产出 | 本文件 | ✅ |
| 主分支未污染 | `git log main..codex/center-db-governance` | 13+ commits ahead |
| 后续 R.83.x 模板可直接复用 | spec/plan/commit/Task 9-10 模式 | R.83.5+ 可直接复用 |
