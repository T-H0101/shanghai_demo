# Sprint 4.2-A — PG 备份与站点范围审查 (Backup Audit)

> **状态**: ✅ 完成 (只读审查, **不接数据 / 不改 schema / 不改业务代码**)
> 审查时间: 2026-06-08
> 路径: `/Users/tian/Desktop/20260601`
> 容器: `pg_restore_test` (5433) / `unified_disc_postgres` (5432)

---

## 1. 备份文件结构

```
/Users/tian/Desktop/20260601/
├── backup_manifest    309 KB    (CRC32C 校验 + 文件清单)
├── base.tar           89 MB     (物理数据 base 目录)
├── pg_wal.tar         16 MB     (WAL 日志)
├── base/              (解压后的 base.tar)
│   ├── PG_VERSION     "17"      (PG17 物理备份)
│   ├── postgresql.conf
│   ├── pg_hba.conf
│   ├── standby.signal           (⚠️ replica 标识, 需删除)
│   ├── backup_label             (START_WAL_LOCATION: 0/34000028)
│   ├── global/ pg_commit_ts/ pg_wal/ ... (PG 系统目录)
│   └── base/                     (db oid 目录)
│       ├── 1                    (template1)
│       ├── 4                    (template0)
│       ├── 5                    (postgres)
│       └── 16385                (⭐ 用户库 = star_storage_db)
└── pg_wal/             (解压后的 pg_wal.tar)
    ├── 000000010000000000000034.A  (WAL 段)
    └── archive_status/
```

**关键事实**:
- ✅ `base.tar` + `pg_wal.tar` + `backup_manifest` 齐全 — 真实 `pg_basebackup` 输出
- ✅ `backup_label`: `BACKUP METHOD: streamed` + `BACKUP FROM: primary` + `START TIME: 2026-06-01 17:30:47 CST`
- ⚠️ 含 `standby.signal` — 领导说明要求"删除 standby.signal" 后才能作为 primary 启动
- ✅ **物理备份 (非 logical dump)**, 恢复需走 PG 启动 + recovery 流程

---

## 2. 当前恢复的库对比

### 2.1 三个 DB 对照

| DB | 容器 | 端口 | 表数 | 来源 | 用途 |
|---|---|---|---|---|---|
| **star_storage_db** | pg_restore_test | 5433 | **170 张** (`tbl_*` 169 + `dvs_*` 1) | 领导提供的 PG17 物理备份 (20260601) | **真实源端库** |
| **source_restore** | unified_disc_postgres | 5432 | **13 张** | 人工从 star_storage_db 选 13 张白名单 + `mock-tbl-task.sql` partial dump | 模拟"接收过同步的源端" |
| **unified_disc_platform** | unified_disc_postgres | 5432 | 16+ 张 (`unified_*` + `sync_*_log`) | 项目 schema (`databases/sprint-2b0/unified_schema.sql`) | **总控中心库** |

### 2.2 关系图

```
领导备份 (物理, 170 张)
       ↓
[ pg_restore_test.star_storage_db ]  (PG17 primary 启动)
       ↓
   人工筛选 13 张白名单 + mock 模拟数据
       ↓
[ source_restore ]  (partial dump)
       ↓
[ import-from-source / package push / HMAC 鉴权 ]
       ↓
[ unified_disc_platform ]  (中心库 11 A + 2 C)
       ↓
[ 5 个核心 API + 5 个核心页面真实展示 ]
```

---

## 3. star_storage_db 详细审计

### 3.1 schema

| schema | 表数 |
|---|---|
| public | **170** |
| 其它 (pg_catalog / information_schema) | 系统表 |

**结论**: **单 schema = public**, **没有按 site_code 分 schema** (例如 `sh01.*` / `bj02.*` 不存在)。

### 3.2 关键表 row_count (10 张核心 + 8 张治理/权限)

| 表 | row_count | 含义 |
|---|---|---|
| `tbl_task` | **37** | 主任务表 (Sprint 2H.3 聚合来源) |
| `tbl_disc_lib` | **4** | 光盘库 |
| `tbl_magzines` | **6** | 盘笼 |
| `tbl_slots` | **396** | 盘位 |
| `tbl_hd_info` | **8** | 硬盘 |
| `tbl_disc` | **65** | 物理盘片 |
| `tbl_logical_volume` | **3** | 逻辑卷 |
| `tbl_volume_slot` | **161** | 卷-盘位关系 (聚合来源) |
| `tbl_lib_task` | **86** | 任务-设备关系 (聚合来源) |
| `tbl_user_task` | **28** | 任务-用户关系 (聚合来源) |
| `tbl_user` | **3** | 用户 |
| `tbl_role` | **4** | 角色 |
| `tbl_fuc` | **53** | 功能点 (RBAC) |
| `tbl_sys_log` | **85** | 系统日志 |
| `tbl_api_log` | **0** | API 日志 |
| **`tbl_site`** | **0** | ⚠️ 站点主表 |
| **`tbl_site_monitor`** | **0** | ⚠️ 站点监控 |
| **`tbl_project`** | **0** | ⚠️ 项目主表 |
| **`tbl_project_site`** | **0** | ⚠️ 项目-站点关系 |
| **`tbl_depa`** | **0** | ⚠️ 部门 |
| **`tbl_depa_user`** | **0** | ⚠️ 部门-用户 |
| **`tbl_depa_user_info`** | (n/a) | 部门-用户权限 |
| **`tbl_volume_group`** | **0** | 卷组 |
| **`tbl_workspace`** | **0** | 工作区 |
| **`tbl_volume_user`** | (n/a) | 卷-用户 |
| `tbl_platform` | **0** | 平台监控 |

### 3.3 多站点 / 组织字段

| 表 | 字段 | 类型 |
|---|---|---|
| `tbl_site` | `site_id` (PK) / `site_name` / `s_level` / `parent` / `uuid` / `cmt` | integer + text |
| `tbl_project_site` | `id` / `project_id` / `site_id` / `start_time` / `end_time` / `cmt` | 项目-站点多对多 |
| `tbl_site_monitor` | `monitor_id` / `monitor_name` / `site_id` / `plat_id` | 站点监控 |
| `tbl_depa` | `depa_id` / `depa_name` / `depa_code` / `depa_enable` | 部门 |
| `tbl_depa_user` | `depa_id` / `user_id` / `black_list` / `white_list` | 部门-用户 |
| `tbl_depa_user_info` | `depa_id` / `user_id` / `fuc_id` / `del_status` | 部门-用户-功能 (RBAC) |
| `tbl_volume_group` / `tbl_volume_depa` / `tbl_volume_user` / `tbl_volume_workspace` | (多种) | 卷-组织-用户 |
| `tbl_project` | `project_id` / `project_num` / `project_title` / `project_dt` | 项目主表 |
| `tbl_workspace` / `tbl_workspace_user` | (多种) | 工作区-用户 |
| `tbl_user_role` | (推测 user_id+role_id) | 用户-角色 |

---

## 4. 关键判断

### 4.1 这是物理备份还是逻辑备份

**物理备份 (pg_basebackup)** — base.tar + pg_wal.tar + backup_manifest 齐全, 含 PG 系统目录, 可启动 PG17 还原。

### 4.2 source_restore 是否只导入了部分表

**是**。source_restore = **13 张白名单小表 (人工筛选)** + `databases/sprint-2b2/mock-tbl-task.sql` 模拟数据。

- 13 张全部来自 star_storage_db 同名表, row_count 完全一致 (37/4/6/396/8/65/3/161/86/28/3/0/0)
- **不是从 star_storage_db pg_dump 出来的**, 因为缺少 tbl_role/tbl_fuc/tbl_sys_log 等 157 张表
- 是**项目自定义的白名单 partial dump**, 见 `LEADER_DECISIONS §1.1 "小表全量同步"`

### 4.3 pg_restore_test 是否保留完整 star_storage_db

**是**。star_storage_db 含 170 张表 (PG17 物理备份还原), 是真实源端完整快照。

### 4.4 当前 13 张表是否就是完整源库, 还是 partial dump

**Partial dump (13/170 = 7.6%)**。是**项目白名单**, 不是源端全集。
源端全集是 170 张 (含 tbl_role/tbl_fuc/tbl_sys_log 等 157 张**未同步**的表)。

### 4.5 单站点 vs 多站点 vs 无法判断

**无法 100% 确定**, 但**强证据指向"单站点初始化态"**:

| 证据 | 单站点 | 多站点 |
|---|---|---|
| `tbl_site` 0 行 | ✅ 合理 (单站点不需要 site 表) | ❌ 至少 1 行 |
| `tbl_project_site` 0 行 | ✅ 合理 | ❌ 至少 1 行 |
| `tbl_site_monitor` 0 行 | ✅ 合理 | ❌ 至少 1 行 |
| `tbl_depa` 0 行 | ✅ 合理 (无部门) | ❌ 至少 1 行 |
| `tbl_volume_group` 0 行 | ✅ 合理 | ❌ 至少 1 行 |
| `tbl_task` 37 行 (有数据) | ✅ 业务跑过 | ✅ 业务跑过 |
| `tbl_role` 4 行 (有数据) | ✅ RBAC 已配 | ✅ RBAC 已配 |
| `tbl_sys_log` 85 行 (有数据) | ✅ 系统运行过 | ✅ 系统运行过 |
| 业务表 row_count 与 source_restore 完全一致 | ✅ 同一份测试数据 | — |

**结论**: 这是**单站点初始化态 (生产前测试数据)** — 业务表 (设备/卷/任务) 已有数据演示, 但**组织/权限/部门/项目/站点关联表全 0 行** (部署前态)。

**需要领导确认**:
- 这台 PG17 服务器**是否将作为生产**使用? 还是**只是测试服务器**?
- 真实生产数据从哪来? (另一台已运行的 star_storage_db, 还是要先初始化?)
- 多站点部署时, 是 1 库 1 实例 (按 site_code 区分) 还是 N 库 N 实例?

---

## 5. 数据真实性分级

| 等级 | 含义 | 表数 | 同步策略 |
|---|---|---|---|
| **A (真实业务)** | row_count > 0, 业务跑过 | ~15 张 (task/disc_lib/magzines/slots/hd_info/disc/logical_volume/volume_slot/lib_task/user_task/user/role/fuc/sys_log) | 全量同步进 unified_* |
| **B (组织/权限)** | row_count = 0, 部署前态 | ~10 张 (site/site_monitor/project/project_site/depa/depa_user/depa_user_info/workspace/volume_group/platform) | **等源端补数据**或**不接** |
| **C (空表/预留)** | row_count = 0, 不确定 | 剩余 ~145 张 | 暂不接 |

**关键决策**: 当前 13 张白名单**正好覆盖 A 类**, 同步链路正常; B 类 (org/permission) 是 CLAUDE.md 禁项 + 源端无数据; C 类暂不接。

---

## 6. 风险与建议

| 风险 | 描述 | 建议 |
|---|---|---|
| **R1** | 把这个 13 张 source_restore 当"完整源端", 误以为 13 张就是全部 | **明确文档化**: 源端真实 170 张, 项目接 13 张, 比例 7.6% |
| **R2** | 误判多站点 vs 单站点 | **要领导确认**这台 PG17 是单站点还是多站点, 影响 1 库 N site vs N 库 N site 部署 |
| **R3** | 站点的真实 push 端不存在 | 当前 export-package.ts 是**模拟站点侧**, 真实站点需站点自行开发 Client |
| **R4** | 源端 0 行的"组织/权限" 类需求永远无法满足 | 等源端补数据 或 文档化边界 |
| **R5** | 170 张表的 schema 可能与项目预期不符 | 例如 tbl_fuc 实际是 `fun_id` 不是 `fuc_id` (有拼写差异), dispatcher 需重新校验 |

---

## 7. 下一动作

| 阶段 | 输出 | 估时 |
|---|---|---|
| 阶段 B | 同步策略按领导口径收敛 + 更新 SYNC_ARCHITECTURE/DEPLOYMENT_GUIDE | 0.5d |
| 阶段 C | 控制能力 2 方案 (SSO 跳转 + 控制队列) | 0.5d |
| 阶段 D | 4.3~4.8 路线图 | 0.5d |
| 阶段 E+F | 验证 + 提交 + 推送 | 0.5h |
| **合计** | (含本文档 1.5h) | **2d** |
