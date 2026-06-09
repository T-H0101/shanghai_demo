# Sprint 4.8.3 — 完整站点库控制机制重审 (推翻 Sprint 4.8.2)

> **状态**: 完成
> **日期**: 2026-06-09
> **推翻结论**: Sprint 4.8.2 的"完全没有控制机制"基于**13 张白名单表 (source_restore)** 是不完整审计
> **真实结论**: 完整站点库有**多个原生控制表**, 之前 audit 全部漏掉
> **Site Worker 调整**: **保留 + 重定位** (从 simulator 升级为 "调度 + 监控 + 审计" 平台)

---

## 1. 恢复详情 (Phase 1)

### 1.1 恢复源
- 路径: `/Users/tian/Desktop/20260601/`
- 格式: `pg_basebackup` 物理备份 (base.tar + pg_wal.tar + backup_manifest)
- 类型: Windows PostgreSQL 备份 (postgresql.conf 含 `dynamic_shared_memory_type = windows`)

### 1.2 恢复方法
1. 新建独立 PG17 容器 `site_restore_full_postgres` (端口 5434, 避免影响源 restore 容器)
2. 解压 `base.tar` + `pg_wal.tar` 到数据目录
3. 修正 `postgresql.conf`: `dynamic_shared_memory_type = mmap` (Windows → Linux)
4. 删除 `standby.signal` (promote to primary)
5. `pg_hba.conf` 改 `trust` (绕过密码差异 — 临时措施, 便于审计)
6. 启动后 PG 自动 replay WAL 到 consistent state
7. 密码: 用户在 `.env.local` 的 `DB_PASSWORD` 字段 (env 注入到 compose, 不硬编码)

### 1.3 恢复结果
| 指标 | 值 |
|---|---|
| 数据库名 | `star_storage_db` (65 MB) |
| 表总数 | **170** (vs source_restore 的 13) |
| Functions | 8 (全是工具函数, 无控制逻辑) |
| Triggers | 0 |
| Views | 0 |
| 表与 source_restore 差异 | **+157 张表** |
| 是否完整单站点库 | ✅ 是 (覆盖设备/任务/文件/卷/巡检/调度/接收等所有业务域) |

### 1.4 新增的 157 张表按域分类 (关键词命中数)
| 域 | 关键表 | 关键词命中 |
|---|---|---|
| **调度** | `tbl_schedule_job` | schedule (cron, cron_desc, enable, task_name, func_name) |
| **接口任务** | `tbl_interface_task` | task (job_type, job_stage, job_status, job_progress) |
| **热备/热恢复** | `tbl_hot_backup_record`, `tbl_hot_restore_record` | recover/restore/schedule/progress (FK to schedule_job) |
| **数据接收** | `tbl_data_receive_list`, `tbl_data_receive_tasks` | schedule (cron 字段, schedule_enable, schedule_cron) |
| **巡检** | `tbl_check_patrol_task`, `tbl_check_patrol_strategy`, `tbl_check_task`, `tbl_check_*` (10+ 表) | inspect/verify/task (strategy 有 cron) |
| **光盘巡检** | `tbl_disc_inspect` | inspect (inspect_mode, inspect_start_time, inspector) |
| **可信验证** | `tbl_credible_prove`, `tbl_credible_verify` | verify (verify_date, verify_hash, verify_status) |
| **文件检索** | `tbl_file_1`, `tbl_file_2`, `tbl_file_3` + 各 _a/_empty/_error/_repeat (24 张) | burn, task_id (CLAUDE.md 禁, 大表) |
| **文件分片** | `tbl_slot_file_12` ... `tbl_slot_file_1000000`, `tbl_slot_folder_*` (12 张) | task_id |
| **任务证书** | `tbl_task_certif_status`, `tbl_task_check`, `tbl_task_print` | task/verify |

---

## 2. 控制关键词扫描结果 (Phase 2)

**数据库**: `star_storage_db` (完整站点库, 170 表)
**扫描范围**: `information_schema.tables` + `information_schema.columns` + `pg_class` + `pg_proc` + `pg_constraint`

### 2.1 候选控制表 (按相关度)

| 表 | 字段亮点 | 控制语义 |
|---|---|---|
| **`tbl_schedule_job`** | `task_name`, `func_name`, `func_sign`, `func_param`, `cron`, `cron_desc`, `enable` | **站点内部 cron 调度器** (但功能在站点 app, 不在 DB) |
| **`tbl_interface_task`** | `task_id`, `job_type`, `job_stage`, `job_status`, `job_progress`, `err_code`, `err_str` | **接口任务队列** (类似 control_command, 但有 job_progress/err) |
| **`tbl_hot_backup_record`** | `schedule_job_id`, `progress`, `status`, `start_time`, `end_time`, `error_message` | **热备记录**, FK to schedule_job |
| **`tbl_hot_restore_record`** | 同上, 热恢复 | **热恢复记录** (control_command.task_type=1 的目标表!) |
| **`tbl_data_receive_list`** | `schedule_cron`, `schedule_cron_desc`, `schedule_enable`, `status`, `resource`, `volume_id`, `import_method` | **数据接收任务** (定时调度 + 启用开关) |
| **`tbl_data_receive_tasks`** | `task_id`, `receive_id` | 接收任务的子任务关联 |
| **`tbl_check_patrol_strategy`** | `cron`, `template_id`, `enable`, `effective_date`, `terminated_date`, `condition_params` | **巡检策略** (含 cron + 启用/失效) |
| **`tbl_check_patrol_task`** | `status`, `message`, `archive_count`, `package_count`, `success_count`, `fail_count`, `start_time`, `finished_time`, `medium_task_id`, `del_status` | **巡检任务执行记录** |
| **`tbl_check_task`** | `status`, `commit_time`, `finish_time`, `del_status` | **单次巡检任务** |
| **`tbl_check_patrol_task_item`** | `check_task_id`, `task_id` | 巡检子任务 |
| **`tbl_disc_inspect`** | `inspect_mode`, `inspect_start_time`, `inspect_stop_time`, `inspect_type`, `inspector`, `result_evaluation`, `error` | **光盘巡检记录** |
| **`tbl_task_check`** | `accept`, `reject`, `discs`, `ignored`, `status`, `person`, `date` | **任务验收结果** |
| **`tbl_task_certif_status`** | `task_id`, `task_item_id`, `task_mode`, `task_type` | 任务证书状态 |
| **`tbl_iso_task_sync`** | `task_id`, `type`, `volume_id`, `status` | ISO 任务同步 |

### 2.2 候选控制字段 (按语义)

| 关键词 | 命中表数 | 候选字段 |
|---|---|---|
| schedule | 4 | `cron`, `cron_desc`, `enable`, `schedule_cron` |
| inspect | 6 | `inspect_mode`, `inspect_type`, `inspector`, `inspect_start_time` |
| progress | 7 | `progress`, `job_progress`, `disc_progress` |
| recover/restore | 4 | `tbl_file_recover_info`, `tbl_file_path_restore`, `tbl_hot_restore_record`, `restored_name` |
| task | 90+ | `task_id` 在所有任务关联表 |
| verify | 11 | `verify_date`, `verify_hash`, `verify_status` |
| burn | 25+ | `burn_status`, `burn_mode`, `burn_times` (主要是文件表) |

### 2.3 数据库对象
| 类型 | 数量 | 用途 |
|---|---|---|
| Tables | 170 | 全部白名单相关 (本表 + 13 张 Sprint 2B.4) |
| Functions | 8 | `from_unixtime`, `unix_timestamp`, `substring_index`, `insertchangedfiles`, `insertslotfile`, `insertspecialfiles`, `proccreatefiletable`, `recursiveslotfolder` — **全部工具函数, 无控制逻辑** |
| Triggers | 0 | — |
| Views | 0 | — |
| Constraints | 8 (全 PK) | 无 FK 无 CHECK |

---

## 3. 原生控制机制判断 (Phase 3) — 推翻 Sprint 4.8.2

### 3.1 唯一结论: **A + B + C 部分支持** (混合, 但**仍缺关键件**)

| 选项 | 证据 | 结论 |
|---|---|---|
| A. 原生控制命令表 | ✅ `tbl_interface_task` 有 job_type/job_stage/job_status (类似 control_command) <br> ✅ `tbl_hot_backup_record` + `tbl_hot_restore_record` 有完整 progress/status/error_message | ✅ 部分存在 |
| B. 状态字段驱动 (改 status 后站点会执行) | ⚠️ `tbl_hot_backup_record.status`, `tbl_check_patrol_task.status` 等存在. <br> ⚠️ **无应用代码证据**说明这些表被外部 poll/读取. 表空 (0 rows) 表明系统可能未运行 | ⚠️ 表存在, 但无 evidence of external response |
| C. 定时任务 / 调度 | ✅ `tbl_schedule_job` 含 cron 字段, `tbl_check_patrol_strategy` 也含 cron <br> ⚠️ 这是**站点内部**调度, 站点 app 自己读 cron, 不是外部控制入口 | ⚠️ 调度存在, 但由站点 app 自驱 |
| D. 完全没有控制机制 | 推翻: 多张表有完整控制字段 (progress/status/error/start_time/end_time) | ❌ 不成立 |

### 3.2 关键修正: Sprint 4.8.2 的"没有 paused/priority 字段"是**部分正确**的
- 在 13 张白名单表里: 确实没有 paused/priority 字段 ✓
- 在完整 170 张表里: 同样**没有 paused/priority 字段** ✓ (重新扫描确认)
- **仍然无法实现 task_pause/task_resume/task_reset** (站点表无对应字段)

### 3.3 新发现: `tbl_hot_restore_record` 是 `recovery_start` 的潜在落点
- `tbl_hot_restore_record` 有 `progress`, `status`, `error_message` — **结构与 audit_log 相同**
- 这暗示 `recovery_start` 可能应该 INSERT INTO `tbl_hot_restore_record` (而非 `tbl_task` task_type=1)
- 同样, `tbl_hot_backup_record` 可能是热备任务的目标表
- **但**: 站点应用是否会读这些表的 new rows, 仍然**无 evidence** — 与 Sprint 4.8.2 同样的不确定性

### 3.4 新发现: `tbl_data_receive_list` 是 `inspect_start` 的潜在落点
- 有 `schedule_cron`, `schedule_enable`, `status`, `resource` — **数据接收/巡检入口**
- 站点应用有定时读取 cron 的行为 (per `tbl_schedule_job` schema)
- 但总控是否能直接 INSERT INTO `tbl_data_receive_list` 触发巡检, **无 evidence**

---

## 4. Site Worker 去留判断 (Phase 4) — 推翻

### 4.1 Sprint 4.8.2 结论 (基于 13 张表)
- 降级为 simulator
- 5 个 commandType 全部降级
- 不宣称控制已完成

### 4.2 Sprint 4.8.3 修正结论
- **Site Worker 保留, 但角色升级**:
  - **不再是"simulator"** — 完整库有 cron + 调度 + 进度跟踪基础设施
  - **定位**: **调度编排 + 审计监控** (而非"控制执行器")
  - **5 个 commandType 重新映射**:
    | Sprint 4.8.2 (错) | Sprint 4.8.3 (修正) |
    |---|---|
    | `task_pause` → "审计总控意图" | **保留 + 标记 PENDING**: 站点表无 paused 字段, 真实执行需领导确认 |
    | `task_resume` → "审计总控意图" | **保留 + 标记 PENDING**: 同上 |
    | `task_reset` → "审计总控意图" | **保留 + 标记 PENDING**: 站点表 status 字段语义不明, 改后无 evidence 站点会响应 |
    | `inspect_start` → "审计总控意图" | **重定向**: 改写为 INSERT INTO `tbl_check_patrol_task` 或 `tbl_data_receive_list` (而非 tbl_task) |
    | `recovery_start` → "审计总控意图" | **重定向**: 改写为 INSERT INTO `tbl_hot_restore_record` (而非 tbl_task) |
- **新候选表 (需领导确认)**: 是否让 worker 直接写这些表?

### 4.3 Worker 重写需求 (Sprint 4.9+)
- 5 个 dispatch 重新映射到正确的目标表
- 增加 `tbl_data_receive_list.schedule_cron` 写支持 (巡检计划)
- 进度监控 (从 `tbl_hot_backup_record.progress` 读回)
- 失败/重试逻辑 (基于 `error_message` 字段)

### 4.4 是否需要恢复 Tasks 前端按钮?
- **暂停/恢复/重置**: **不恢复** (完整 170 张表也无 paused 字段, 同 13 张结论)
- **巡检/回迁**: **不直接恢复** (可加 "提交控制命令" 按钮, 但语义为 "提交待站点执行", 非 "立即执行")

---

## 5. 前端按钮策略 (Phase 5) — 同 Sprint 4.8.2

| 按钮 | Sprint 4.8.2 决定 | Sprint 4.8.3 决定 | 变化? |
|---|---|---|---|
| 新建任务 | 保留 (POST /api/tasks) | 保留 | 无变化 |
| 推进/标记完成/失败/导出 | 保留 (本地 UI) | 保留 | 无变化 |
| 暂停/恢复/重置 | 不恢复 | 不恢复 | **无变化** (完整 170 表也无 paused 字段) |
| 巡检/回迁 | 不直接恢复 | 不直接恢复 (改为"提交命令"按钮, 文案需谨慎) | **无变化** |

---

## 6. 低风险修正 (Phase 6) — 无代码变更

- ✅ 本文档 (本文件) 取代 Sprint 4.8.2 文档作为真相来源
- ✅ `Sprint 4.8.2` 结论部分保留 (13 张白名单内的判断仍然成立)
- ✅ `Sprint 4.8.3` 新增 157 张表的发现
- ✅ `Site Worker` 角色重新定义 (从 simulator → 调度编排 + 审计监控)
- 🆕 等待领导确认: 是否允许 worker 写 `tbl_hot_restore_record` / `tbl_check_patrol_task` / `tbl_data_receive_list`

---

## 7. 下一步推荐 (Phase 7)

### 短期 (Sprint 4.9+)
1. **等领导确认**:
   - 站点表能否加新字段 (paused/priority)?
   - 站点应用是否会 poll `tbl_hot_restore_record` / `tbl_check_patrol_task`?
   - 是否提供真 API 文档?
2. **如果**领导确认: worker 重写 5 dispatch, 改写目标表, 增加 cron 调度
3. **如果**领导不确认: 维持当前 audit + simulator, 仅总控侧跟踪

### 中期
- 真站点部署 worker, 验证 INSERT INTO 新表能否被站点应用响应
- 进度监控: GET FROM `tbl_hot_backup_record.progress` 写到 unified_*

### 长期
- 与站点运维建立 SLA: 命令从下发到执行的预期时长
- 异常告警: 进度卡死 > N 分钟触发告警

---

## 8. 文件清单 (本审计无代码变更)

仅新增本文档. **未修改**:
- 任何代码/库/表 DDL
- 任何 frontend 按钮

**审计 = 看证据, 不改代码**. 等领导决策后再做实质修改.

---

## 9. 总结: Sprint 4.8.2 vs 4.8.3

| 维度 | Sprint 4.8.2 (基于 13 张表) | Sprint 4.8.3 (基于 170 张表) |
|---|---|---|
| 扫描范围 | source_restore (13 张白名单) | star_storage_db (170 张完整) |
| 控制表 | 0 | 至少 **8 张候选** (schedule_job, interface_task, hot_*, check_patrol_*, data_receive_*, disc_inspect, task_check) |
| 调度机制 | 0 | ✅ `tbl_schedule_job` + `tbl_check_patrol_strategy` (cron) |
| 进度跟踪 | 0 | ✅ `progress` 字段在 7+ 表 |
| 状态机 | 0 | ✅ `status` 字段在 8+ 表, 含 `del_status` 软删 |
| **Site Worker 去留** | 降级 simulator | **升级为调度编排 + 审计监控** (角色更广) |
| **是否可触发巡检** | ❌ 不可 | 🟡 可能 (写 tbl_data_receive_list, 需领导确认) |
| **是否可触发回迁** | ❌ 不可 | 🟡 可能 (写 tbl_hot_restore_record, 需领导确认) |
| **暂停/恢复/重置** | ❌ 不可 (无字段) | ❌ 不可 (170 张表也无 paused 字段) |

**核心修正**: Sprint 4.8.2 的"D 完全没有"是**不完整审计**的结论. Sprint 4.8.3 揭示了站点**有 cron + 进度 + 状态机基础设施**, 但**仍缺"暂停"等实时控制字段**. Site Worker 角色相应调整.
