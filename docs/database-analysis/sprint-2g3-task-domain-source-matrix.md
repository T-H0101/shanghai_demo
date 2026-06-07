# Sprint 2G.3 — 任务域真实表盘点与接入路线设计

> 状态: ✅ 盘点完成 (本 Sprint 无业务变更)
> 范围: 仅 SQL 盘点 + 文档, 不改任何代码
> Sprint 目标: 寻找 progress / runtime / phase / error / sm3 等字段的真实来源

---

## 1. 背景

Tasks 页面已显示真实任务数据, 但大量详情字段为空 (progress / currentPhase / runtime / errorMessage / sm3Status / volumeId / sourcePath / packagePath / completedAt / currentFile)。

Sprint 2F.2A 已确认 `tbl_task_items` 在 source_restore 不存在, 终止了"任务项"接入路线。本 Sprint 重新盘点任务域所有真实存在的源表, 寻找上述字段的物理来源。

## 2. 扫描结果

### 2.1 任务域相关源表 (13 张 tbl_* 中, 关键词命中 3 张)

| 关键词 | 命中 |
|---|---|
| `task` | `tbl_task`, `tbl_lib_task`, `tbl_user_task` |
| `job` | (无) |
| `backup` | (无) |
| `certif` | (无) |
| `progress` | (无) |

**任务域总共只有 3 张源表**。

### 2.2 白名单 7 张扩展表 — 全部不存在

| 表 | 存在 |
|---|---|
| `tbl_interface_task` | ❌ |
| `tbl_task_check` | ❌ |
| `tbl_task_certif_status` | ❌ |
| `tbl_task_history` | ❌ |
| `tbl_task_log` | ❌ |
| `tbl_hot_backup_record` | ❌ |
| `tbl_task_result` | ❌ |

**核心结论**: 历史 schema 假设的"任务执行过程表"全部不存在。Sprint 2F.2A 之后, 任何"过程/历史/日志"子表都不应再做"假定存在"。

## 3. 表画像

### 3.1 `tbl_task` (主任务表) — 37 行

| 维度 | 值 |
|---|---|
| 主键 | `id` (bigint) |
| task_id | ✅ (`id` 本身) |
| 进度字段 | ❌ 无任何 progress/percent/ratio/step |
| 错误字段 | ⚠️ `ret_msg` (35/37 是空或 "0" 占位, **无真实错误**) |
| 时间字段 | ✅ `create_dt`, `update_dt` |
| 状态字段 | ✅ `status` (0/2/7/19/20), `burn_status` (0/2) |
| 业务有效列 | 13: id, status, burn_status, task_name, task_type, task_mode, burn_mode, burn_speed, verify_mode, save_hash, total_files, total_size, ret_value |
| json_path | 2/37 非空, 且是非标准 edb 格式 (`\|` 代替 `:`) |

**`status` 实际取值**:

| 值 | 数量 | 含义推测 |
|---|---|---|
| 0 | 27 | 已配置 / 待启动 (dur 19s-5m31s 不等) |
| 2 | 1 | 执行中? (ret_value=-1) |
| 7 | 1 | 完成 (id=17, dur 28s) |
| 19 | 4 | 失败/异常 (ret_value=-1) |
| 20 | 4 | 失败/异常 (ret_value=0, ret_msg="") |

### 3.2 `tbl_lib_task` (任务-库-盘片关系) — 86 行

| 维度 | 值 |
|---|---|
| 主键 | `id` (bigint) |
| task_id | ✅ (`task_id`) |
| 进度字段 | ❌ 无 |
| 错误字段 | ❌ 无 |
| 时间字段 | ✅ `start_dt`, `end_dt` |
| 状态字段 | ✅ `task_status` (0/1) |
| 业务价值 | **可推算 runtime** (end_dt - start_dt) |

**`command` 取值**: `CopyHdDrive` (6), `StartOneMakeIso` (44), `BurnOneDrive` (36)。

**runtime 推算样例**:

| task_id | command | duration | start → end |
|---|---|---|---|
| 23 | BurnOneDrive | 81s | 2026-04-15 08:38 → 08:39 |
| 35 | BurnOneDrive | 81s | 2026-05-19 06:42 → 06:43 |
| 22 | BurnOneDrive | 78s | 2026-04-15 08:17 → 08:18 |
| 26 | BurnOneDrive | 73s | 2026-04-15 10:19 → 10:20 |

### 3.3 `tbl_user_task` (客户端心跳) — 28 行

| 维度 | 值 |
|---|---|
| 主键 | `user_id + task_id` |
| task_id | ✅ |
| 进度字段 | ❌ |
| 错误字段 | ✅ `user_stage_acting`, `user_stage_failedcount`, `user_stage_faileddate` (但**全部 NULL**, 实际无数据) |
| 时间字段 | ✅ `user_stage_faileddate` (NULL) |
| 状态字段 | ❌ |

**结论**: 客户端心跳字段名虽有, 实际全部 NULL, **不可用**。

## 4. 字段-来源矩阵

| 目标字段 | 来源表 | 来源列 | 可行性 | 风险 |
|---|---|---|---|---|
| `progress` | ❌ 无 | — | **不可行** | 3 张任务表均无百分比/进度数字, 源端没有"任务执行中"事实表 |
| `currentPhase` | `tbl_task` | `burn_status` | ⚠️ **弱可行** | 只覆盖烧录阶段 (0/2 两个值, 73% 为 0), 缺失"封包/扫描/校验"等中间阶段 |
| `runtime` | `tbl_lib_task` | `end_dt - start_dt` (按 task_id 聚合) | ✅ **可行** | 86 条完整记录, 3 个 command 阶段; 多 command 任务需要分别展示 |
| `errorMessage` | `tbl_task.ret_msg` | `ret_msg` | ❌ **不可行** | 35/37 是空或 "0" 占位, **源端不存错误文本** |
| `sm3Status` | ❌ 无 | — | **不可行** | 源表无 SM3/校验结果/verify_result/checksum 列 |
| `volumeId` | `tbl_task.json_path` (内嵌 paths 数组) | 解析 edb 字符串 | ⚠️ **弱可行** | 仅 2/37 有 json_path, 非标准 edb 格式 (`\|` 替代 `:`), 解析风险高, 不应做主线 |
| `sourcePath` | `tbl_task.json_path` (内嵌 paths 数组) | paths[].path | ⚠️ **弱可行** | 同上, 2/37 数据, 解析 edb 不可靠 |
| `packagePath` | ❌ 无 | — | **不可行** | 源表无任何"包路径"列 |
| `completedAt` | `tbl_task.update_dt` (当 status=7) | `update_dt` | ✅ **弱可行** | 仅 1/37 是 status=7, 样本量不足; 业务侧需确认 status=7 是否真"完成" |
| `currentFile` | ❌ 无 | — | **不可行** | 需要"任务进度"事实表, 源端无 |

## 5. 唯一推荐接入路线

### P0 — 立即接入 (值得接, 真实可靠)

#### 5.1 runtime 推算

- **来源**: `tbl_lib_task.start_dt`, `tbl_lib_task.end_dt`, 按 `task_id` 聚合
- **覆盖**: 86/86 lib_task 记录, 跨 3 个 command 阶段 (CopyHdDrive/StartOneMakeIso/BurnOneDrive)
- **展示策略**:
  - 单一 command 任务 → 直接 `MAX(end_dt) - MIN(start_dt)`
  - 多 command 任务 → 按 command 分组展示, 总耗时 = 最后 end_dt - 最早 start_dt
- **风险**: 数据源只到 2026-05-19, 之后没新增; 但**当前 demo 站点数据已经能展示**
- **接入位置**: dispatcher `tbl_lib_task` importer, 输出到 `unified_tasks.runtime_seconds` (已有, 需从 0 改为计算值)
- **回滚**: 关闭导入即可

### P1 — 条件接入 (需业务确认)

#### 5.2 completedAt 推算

- **来源**: `tbl_task.update_dt` WHERE `status=7`
- **样本量**: 1/37 (id=17)
- **接入条件**:
  1. 业务侧确认 `status=7` 真的是"完成" (当前 27/37 是 status=0, 含义未明)
  2. 仅当样本量 > 5 才展示, 否则统一显示 "—"
- **风险**: 样本太少, 容易误读; 不建议在文档站使用
- **建议**: 标记为"暂不接入, 等数据增长", 在中心库 `unified_tasks.completed_at` 字段保留为 NULL

#### 5.3 currentPhase 弱推算

- **来源**: `tbl_task.burn_status` (0/2) + `tbl_task.status` (0/2/7/19/20)
- **映射表**:
  ```
  status=0, burn_status=0  → "待启动" (大多数 27/37)
  status=0, burn_status=2  → "烧录中" (2/37)
  status=2, burn_status=0  → "执行中" (1/37)
  status=7, burn_status=0  → "已完成" (1/37)
  status=19, burn_status=0 → "失败" (4/37)
  status=20, burn_status=0 → "异常" (4/37)
  ```
- **风险**: "待启动"占 73%, 含义与"已完成"差距大, 展示容易误读
- **建议**: **不接入 UI**, 仅在 API DTO 透传 `burn_status` 原始值, 留给前端决定

### P2 — 不接入 (不值得接, 源端根本不存在)

| 字段 | 原因 |
|---|---|
| `progress` | 源端无任务执行进度事实表, **不存在** |
| `errorMessage` | `ret_msg` 是空/0 占位, 源端不存错误文本, **不存在** |
| `sm3Status` | 源表无 SM3/verify 字段, **不存在** |
| `volumeId` | json_path 2/37 覆盖率太低, edb 格式风险高, **不可靠** |
| `sourcePath` | 同上, **不可靠** |
| `packagePath` | 源端无此列, **不存在** |
| `currentFile` | 源端无文件级增量记录, **不存在** |

## 6. 后续 Sprint 建议

1. **2G.4** (任务): 把 `tbl_lib_task` 接入 dispatcher, 输出到 `unified_tasks.runtime_seconds`。Sprint 2G.3 已经验证可行性, **唯一可立即做的 P0 任务**。
2. **2G.5** (可选): 业务侧确认 `status=7/19/20` 含义后再考虑 `completedAt` / `currentPhase` 接入。
3. **2G.6+** (deferred): 等源端补充 `tbl_task_log` 或 `tbl_task_history` 表后, 再做 progress / currentFile / real errorMessage。这依赖源端 schema 演进, 总控不应主动做。

## 7. 关键决策记录

| 决策 | 理由 |
|---|---|
| 不做 `tbl_task_log` 等 7 张"假定存在"表的兜底 schema | 全部不存在, 写兜底是死代码, 违反"不在源端不存在时伪造"原则 |
| 不解析 `tbl_task.json_path` | 2/37 覆盖率 + edb 非标格式 = 解析风险 > 收益 |
| `tbl_user_task` 标记"不可用" | 字段名虽对, 实际全部 NULL, 是源端的占位 schema |
| 推荐 `runtime` 而非 `progress` | runtime 是历史值, 真实可信; progress 需要实时, 源端无通道 |

## 8. 文件清单 (本 Sprint 仅脚本 + 文档, 无业务代码)

- `scripts/sprint-2g3-scan.ts` — 源表清单扫描
- `scripts/sprint-2g3-profile.ts` — 3 张任务表 schema 画像 + 抽样
- `scripts/sprint-2g3-deepdive.ts` — 状态/命令/json_path/runtime 深入分析
- `scripts/sprint-2g3-status-detail.ts` — status x burn_status 完整组合
- `docs/database-analysis/sprint-2g3-task-domain-source-matrix.md` — 本文档

**未修改任何业务文件** (`app/api/`, `components/`, `lib/`, `lib/sync/`, `lib/db/`)。
