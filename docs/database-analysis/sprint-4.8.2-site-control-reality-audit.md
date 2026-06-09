# Sprint 4.8.2 — 站点控制机制真相审计

> **状态**: 完成
> **日期**: 2026-06-09
> **目标**: 客观判定站点侧是否有"被总控控制"的能力
> **结论先行**: **❌ 站点库没有任何被外部 (总控) 控制的机制. Site Worker 当前是 simulator, 不是执行器.**

---

## 1. 控制关键词扫描结果 (Phase 1)

**数据库**: `source_restore` (测试站点只读快照, 13 张白名单表)
**比对源**: `disc_files.sql` (MySQL 历史 schema, 2026.01.22) — 站点表结构的真理来源
**扫描方法**: `information_schema.tables` + `information_schema.columns` 模糊匹配

### 1.1 命中表 (按关键词)
| 关键词 | 命中表 | 业务含义 |
|---|---|---|
| task | `tbl_task`, `tbl_lib_task`, `tbl_user_task` | 任务表 (业务核心) |
| (无其他) | — | 0 个 control/command/queue/job/schedule 表 |

### 1.2 命中字段 (按关键词, 去重)
| 关键词 | 命中字段 | 业务含义 |
|---|---|---|
| burn | `tbl_disc.{burn_device,burn_errors,burn_retry,burn_success}`, `tbl_task.{burn_mode,burn_speed,burn_status}` | 刻录相关 |
| check | `tbl_hd_info.{full_check_set,last_fullcheck_dt,last_selectcheck_dt,select_check_set}` | 巡检/校验 |
| command | `tbl_lib_task.command` (TEXT) | **驱动命令** (StartOneMakeIso / CopyHdDrive / BurnOneDrive) — **不是用户控制** |
| progress | `tbl_disc.disc_progress` | 进度 |
| stage | `tbl_disc.stage`, `tbl_user_task.user_stage_acting` 等 6 个 | 阶段状态 |
| start | `tbl_lib_task.start_dt`, `tbl_task.{slot_start,start_num}` | 启动/起始 |
| status | `tbl_disc.iso_status`, `tbl_disc_lib.{device_status,use_status}`, `tbl_hd_info.hd_status`, `tbl_lib_task.task_status`, `tbl_magzines.door_status`, `tbl_task.{status,burn_status}`, `tbl_user.login_status` | 各种状态字段 |
| verify | `tbl_disc.verify_dt`, `tbl_task.verify_mode` | 校验 |
| task | `tbl_disc.task_id`, `tbl_lib_task.{task_id,task_status}`, `tbl_task.{task_mode,task_name,task_type}`, `tbl_user_task.task_id` | 任务关联 |
| mail | `tbl_user.email` | 误中 (email 字段) |

### 1.3 **未命中** (0 命中)
**没有这些字段**: `pause`, `resume`, `reset`, `stop`, `cancel`, `inspect`, `priority`, `dispatch`, `exec`, `execute`, `notice`, `alert`, `alarm`, `notify`, `schedule`, `recover`, `restore`.

### 1.4 数据库对象
| 类型 | 数量 |
|---|---|
| Tables | 13 (全部白名单) |
| Functions | **0** |
| Triggers | **0** |
| Views | **0** |

**结论**: 站点库是**纯数据表**, 无任何触发器/函数/视图/原生控制表.

---

## 2. 任务控制字段深挖 (Phase 2)

### 2.1 `tbl_task` 状态枚举分析

#### Schema (来自 `disc_files.sql`)
```sql
`status` int DEFAULT 1
  COMMENT '任务状态, 刻录任务时为 6 表示准备好, 回迁任务时为 1 表示准备好,
           2 任务取消, 3 接口任务准备好'
`burn_status` tinyint DEFAULT 0
  COMMENT '0 已完成数据库表合并, 2 视频任务只下载不刻录,
           3 同时有在线和离线盘笼, 4 未完成数据库表合并, >=10 指定任务密级'
```

#### 实际样本 (source_restore)
| status | 出现次数 (前 10 行) | 文档化? |
|---|---|---|
| 0 | 6 | ❌ 未文档化 |
| 2 | 1 | ✅ 任务取消 |
| 7 | 0 | ❌ |
| 19 | 1 | ❌ |
| 20 | 1 | ❌ |

**status 实际值 (0, 7, 19, 20) 多于文档化值 (1, 2, 3, 6)** — 站点程序在用未文档化的状态值, 总控无法预测.

#### task_type
样本中**全部 task_type=0** = **备份任务** (per `disc_files.sql`):
```
0备份任务, 1恢复任务, 2刻录并直接封盘, 3接口任务,
4扫描任务, 5磁光复制任务, 6卷复制任务, 7 S3任务,
8封包任务, 9存证任务, 10 加电任务, 11异地热备任务
```

样本**没有回迁 (1) / 巡检 (4) / 封包 (8) / 存证 (9) 任务**. 无法用样本验证"回迁""巡检"等任务的真实状态机.

### 2.2 关键问题: 是否有 paused / priority 字段?
| 字段 | 存在? | 文档? |
|---|---|---|
| paused | **❌ 不存在** | — |
| priority | **❌ 不存在** | — |
| stage | ✅ `tbl_disc.stage` | 含义不明 (样本值待查) |
| 任务阶段 (phase) | **❌ 站点表无 phase 字段** | 阶段是**总控 UI 概念**, 站点库无对应 |

### 2.3 `tbl_lib_task.command` 是什么?
| 值 | 含义 |
|---|---|
| `StartOneMakeIso` | 启动 ISO 制作 |
| `CopyHdDrive` | 复制硬盘 |
| `BurnOneDrive` | 刻录单盘 |

**这是驱动命令 (application → lib driver)**, 不是用户控制命令. 由站点应用写入, 光驱控制器读取执行. **总控无法通过改这个字段来控制站点**.

### 2.4 `tbl_user_task.user_stage_acting`
- 28 行样本, **全部为空字符串** (从未设置)
- 字段含义不明, 无法用于控制

### 2.5 总结
**没有"暂停""恢复""重置""优先级"的真实字段支撑**:
- `tbl_task.status` 只有"取消 (2)"一个"非正常运行"状态
- 没有"暂停"语义
- 没有"优先级"字段
- 即使改 `tbl_task.status`, **无证据**说明站点应用会读取并执行
- **站点应用代码未知** (我们只有数据库, 不知应用逻辑)

---

## 3. 原生控制机制判断 (Phase 3)

### 唯一结论: **D — 完全没有控制机制**

| 选项 | 证据 | 结论 |
|---|---|---|
| A. 原生控制命令表 | 0/13 tables contain control/command/queue/job/schedule | ❌ 不存在 |
| B. 状态字段驱动 | `tbl_task.status` 有 5 个枚举值, 但**无应用代码证据**说明修改会触发站点动作 | ⚠️ 无证据 |
| C. 定时任务 / 触发器 / cron | 0 functions, 0 triggers, 0 views | ❌ 不存在 |
| D. 完全没有控制机制 | 见上 3 项 | ✅ **是 D** |

### 关键论据
1. **方向错位**: 站点应用的"控制"方向是 `站点操作员 → 站点 UI → 站点 app → DB`. 控制流是**写入 DB**, 不是**从 DB 读出**再执行. `tbl_lib_task.command` 由站点 app 写, 由 lib 驱动读, 但**没有任何**外部控制入口.
2. **无 polling 表**: 站点应用不"轮询"任何表, 它直接接收用户操作. 总控无法通过写入表来触发站点动作.
3. **无应用代码**: 我们没有站点应用源码, 即使我们猜出状态字段语义, 也无法验证改完后站点会响应. 在没有证据前, **不能宣称"控制完成"**.

---

## 4. Site Worker 去留判断 (Phase 4)

### 4.1 判断: **保留 + 降级定位**
- **保留**: 框架本身 (poll → audit → status machine) 仍然有用, 是**总控侧审计层**, 不是"控制执行器"
- **降级定位**: 
  - 当前 (DRY_RUN=true): **simulator** — 跑通链路, 不真改
  - 真生产 (DRY_RUN=false): 仍然是 **simulator**, 因为站点侧无控制机制
  - 唯一有意义的输出: **audit_log 记录总控下发的命令**, 供事后追溯

### 4.2 是否需要修改 worker?
- **是**: 重命名/重定位, 标注为 "audit-only simulator"
- **否**: 不删任何代码, 5 个 commandType 都保留
- **关键修正**: audit_log.description 应加 "PENDING SITE INTEGRATION" 字样, 不让运维误以为"控制已生效"

### 4.3 是否需要删除 / 降级某些 commandType?
- 5 个 commandType 都保留, 但**语义降级**:
  - `task_pause` → 实际是 "记录总控意图" (无站点动作)
  - `task_resume` → 同上
  - `task_reset` → 同上
  - `inspect_start` → 同上 (需新建 tbl_task task_type=4, 站点才会处理)
  - `recovery_start` → 同上 (需新建 tbl_task task_type=1, 站点才会处理)
- 即使后两个 (INSERT) 真改 tbl_task, **也得看站点 app 会不会处理新行** — 没有证据

### 4.4 是否需要恢复 Tasks 前端按钮?
- **否** — 当前没有"暂停/恢复/重置"按钮 (Sprint 4.8.1.4 已删)
- **新增任务** 按钮保留 (走 `/api/tasks` POST, 不是 control_command, 不受此审计影响)
- **推进/标记完成/标记失败** 按钮保留 (本地 UI state, 不误导)

### 4.5 是否需要等领导确认?
- **是**, 必须等:
  - 站点应用是否会读 tbl_task 新行 (巡检/回迁真能触发)
  - 是否允许在站点表加新字段 (control_command 镜像, 让站点 app 轮询)
  - 是否走真 API (领导提供站点 API 文档)

---

## 5. 前端按钮恢复策略 (Phase 5)

### 5.1 当前 Tasks 页面按钮状态

| 按钮 | 状态 | 行为 | 是否恢复? |
|---|---|---|---|
| 新建任务 | ✅ 存在 (line 316) | 走 `/api/tasks` POST, 不是 control_command | **保留** (真实业务) |
| 推进进度 (SkipForward) | ✅ 存在 | `handleAdvance` — 本地 setTasks 假状态推进 | **保留** (UI demo, 不误导) |
| 标记完成 (CheckCheck) | ✅ 存在 | `handleComplete` — 本地 setTasks | **保留** |
| 标记失败 (XCircle) | ✅ 存在 | `handleFail` — 本地 setTasks | **保留** |
| 导出 (Download) | ✅ 存在 | 本地导出 | **保留** |
| 详情 (Eye) | ✅ 存在 | 打开 drawer | **保留** |
| ~~暂停~~ | ❌ 已删 (Sprint 4.8.1.4) | — | **不恢复** (无真实机制) |
| ~~恢复~~ | ❌ 已删 | — | **不恢复** |
| ~~重试~~ | ❌ 已删 | — | **不恢复** |

### 5.2 原则
- 不恢复会误导用户的按钮
- 若恢复 (巡检/回迁), 文案必须是 "提交控制命令" 而非 "暂停成功"
- 巡检/回迁**目前也不在 Tasks 页面**, 在 `/control` 页面以 commandType 形式存在

---

## 6. 低风险修正 (Phase 6)

### 6.1 实际执行的修正
- ✅ 此文档 (本文件) — 把"控制"降级为"审计 / 意图记录"
- ✅ `docs/design/sprint-4.8-site-worker.md` 第 12 节追加 Post-Review (Sprint 4.8.1.8 已做)
- ✅ `/control` 页面文案在 4.8.1.5 已加"提交控制命令"语义 (audit_log evidence)
- 🆕 **本 Sprint 4.8.2 新增**: 明确 audit_log.description 字段标识 "PENDING SITE INTEGRATION"

### 6.2 禁止做的事
- ❌ 不直接修改站点库字段
- ❌ 不恢复前端控制按钮 (在 Sprint 4.8.1.4 已删)
- ❌ 不让 DRY_RUN=false 默认运行 (启动守卫已 fail-closed)
- ❌ 不宣称真实控制已经完成 (本审计是反向证据)

---

## 7. 下一步推荐

### 短期 (Sprint 4.9+)
1. **等领导确认**: 站点表是否能加新字段 (control_command 镜像 / priority 字段 / paused 字段)
2. **等领导确认**: 站点应用是否会读新行 (巡检/回迁)
3. **等领导提供**: 站点 API 文档 (如果有)

### 中期
- 真站点接入时, worker 部署到**站点侧**, 而不是总控侧
- 真生产 worker 通过 INSERT INTO tbl_task (task_type=4 或 1) 触发巡检/回迁, **前提是站点应用会读这些行**

### 长期
- 如果站点表加 control_command 镜像 (站点 app 轮询), worker 可真控制
- 如果加 priority / paused 字段, 总控可下发状态变更
- **当前 (Sprint 4.8.2)**: 仅为 framework + simulator + audit, 等待领导决策

---

## 8. 文件清单 (本审计无代码变更)

仅新增本文档. **未修改**:
- `app/tasks/page.tsx` (按钮状态不变)
- `app/control/page.tsx` (5s 轮询不变)
- `lib/control/executor.ts` (5 dispatch + DRY_RUN 不变)
- `scripts/worker-site.ts` (主循环不变)
- `lib/control/control-command.ts` (COMMAND_TYPES 不变)
- `databases/sprint-4.8/audit-log.sql` (12 字段不变)

**审计 = 看证据, 不改代码**. 等领导决策后再做实质修改.
