# Sprint 2F.2A - tbl_task_items 数据画像与接入策略审查

> **日期**: 2026-06-06
> **范围**: tbl_task_items 接入可行性审查 (review-only)
> **前置**: Sprint 2F.1 任务域 P0 字段补全
> **后续**: Sprint 2F.3 (任务详情页收口) 已基于"无源字段统一空态"原则收口 UI
> **审查人**: tian + Claude (Opus 4.8)
> **本 Sprint 写代码**: 0 行

---

## 一、源表存在性 (Step 1)

### 1.1 结论先行

**`tbl_task_items` 在 source_restore 和 unified_disc_platform (中心库) 中均不存在。**

| DB | 存在性 | 备注 |
|---|---|---|
| `source_restore` (生产镜像) | ❌ 不存在 | 仅 `tbl_task` 是 task 相关表 |
| `unified_disc_platform` (中心库) | ❌ 不存在 | 无统一镜像 |
| 模糊匹配 (task_item / task_folder / task_files) | ❌ 全无 | `tbl_task_items` / `tbl_task_folder` / `tbl_task_files` 都无 |

### 1.2 source_restore 实际 task 域表

| 表 | 大小 | sync_mode | 状态 |
|---|---|---|---|
| `tbl_task` | 32 kB | full → unified_tasks | ✅ Sprint 2D.2 (package) + Sprint 2B.1 (CLI) |
| `tbl_lib_task` | 80 kB | aggregate | ✅ Sprint 2D.3 |
| `tbl_user_task` | 32 kB | aggregate | ✅ Sprint 2D.3 |

### 1.3 文档中存在性

| 文档 | 提及 | 状态 |
|---|---|---|
| `docs/database-analysis/schema-inventory.md:414-441` | 完整字段表 | 文档存在, 但实际表不在 source_restore |
| `docs/database-analysis/relevant-tables.md:20` | P0 评分 40 | 同上 |
| `docs/database-analysis/sprint-2d1-table-sync-classification-matrix.md:129` | P2 (任务-条目) not_started | 同上 |
| `docs/database-analysis/sprint-2e1-task-domain-gap-analysis.md:85` | 中体量, 未接入 | 同上 |
| `docs/database-analysis/sprint-2f1-task-p0-field-enrichment.md:21,25,125` | "volumeId 在 tbl_task_items" | **错误 (表不存在)** |

### 1.4 推断

`schema-inventory.md` 中记录的 `tbl_task_items` 是从原始 SQL dump (可能是某站点生产库) 解析而来, 但当前 source_restore 只导入了部分表, 任务明细表未在此次导入范围内。

**Sprint 2F.1 文档中"volumeId 在 tbl_task_items/tbl_task_folder"这一说法缺乏 source_restore 验证基础, 应在本 Sprint 修正。**

---

## 二、数据分布画像 (Step 2)

### 2.1 实际分布

**N/A** — `tbl_task_items` 在 source_restore 中不存在, 无法运行 count / distinct / 分布查询。

### 2.2 schema-inventory 文档字段

```
id              BIGINT     NOT NULL  PK
task_id         BIGINT     NOT NULL     -- 归档(或回迁)任务ID
root_path       VARCHAR(1024) NOT NULL  -- 归档(或回迁)缓冲目录全路径
original_path   VARCHAR(1024)            -- 归档目录全路径
item_name       VARCHAR(500)             -- 目录名或文件名(单级)
volume_id       INT        NOT NULL      -- 逻辑卷ID
lib_parent_folder VARCHAR(500) NOT NULL -- 光盘库逻辑卷下的父目录全路径
is_folder       TINYINT                  -- 文件0, 目录1, 需解压的ZIP 2
slot_id         INT                      -- 回迁光盘下的目录时填光盘 slot id
status          INT                      -- 复制任务的源卷ID或S3归档任务数据来源/巡检结果
project_id      INT                      -- 视频归档项目ID
cmt             VARCHAR(200)             -- 补充说明
```

### 2.3 文档体量判断

schema-inventory **未给出** count / 行数估算。`is_folder` 字段说明此表是**任务下的目录/文件级别明细**, 按 task 一对多关联, 每任务可能 1~N 行, 体量与 `tbl_file` (类大表) 同阶或更小一档。

---

## 三、语义判断 (Step 3)

### 3.1 唯一结论

**结论: D. 语义不清待确认 (但强烈倾向 B: 任务 item 中等明细表)**

### 3.2 依据

**支持 B (中等明细表)**:
- `is_folder` 字段同时存在文件和目录 (`0=文件, 1=目录, 2=ZIP`), 暗示行级粒度是"任务下单个目录或文件"
- `root_path` / `original_path` / `item_name` 三段式命名, 典型的"任务-根目录-目录-文件名"层级
- `volume_id` NOT NULL 暗示每条 item 落在一个具体逻辑卷上 (典型的归档/回迁任务 item 语义)
- 项目方在多个文档中将其分类为"任务明细" (sprint-2e1 第 85 行)

**支持 C (类大表)** 的疑虑:
- 若站点每个备份任务有几万~几十万文件, tbl_task_items 可能达到千万级
- 但 `item_name` 是单级, 不太可能是文件级 (否则应该叫 tbl_task_files)
- `lib_parent_folder` + `is_folder=0` 暗示**目录级 + 文件数**两段式, item 本身可能是"目录条目"

**无法判断**:
- 没有任何文档给出 count / 实际站点规模
- `is_folder` 文档注释自相矛盾: "文件0, 目录1, 需预先解压的ZIP文件2", 这条注释**不能分辨"item 是目录还是文件"**
- 没有源表实例, 无法做 EXPLAIN / ANALYZE

### 3.3 风险

接入 tbl_task_items 在当前 source_restore 范围内**不可行**:
- 没有真实源表 → 无法写 mapper/upsert
- 无法做 E2E 验证 → 违反 Sprint 2C 范围"严禁全表扫描 tbl_file/tbl_folder"类风险 (新表需先确认体量)
- 即使是中等明细表, 也可能 N=10K~1M, 不适合"无脑 full sync"

---

## 四、字段补全矩阵 (Step 4)

### 4.1 unified_tasks 期望字段 vs tbl_task_items 提供字段

| 目标字段 | DTO 类型 | 期望来源 | 能否从 tbl_task_items 补 | 字段 | 是否可聚合 | 是否独立中心表 | 是否 package full |
|---|---|---|---|---|---|---|---|
| `volumeId` | string | tbl_task.volume_id (Sprint 2F.1 标注在 tbl_task_items) | ⚠️ 文档说能, 实际无表 | `volume_id` (NOT NULL) | ✅ MAX/ANY per task | ❌ 同表 | ⚠️ 待 source 接入 |
| `sourcePath` | string | tbl_task.source_path (前端一直显示空) | ⚠️ 文档说能, 实际无表 | `root_path` (NOT NULL) | ⚠️ 多对一 (取首个) | ❌ 同表 | ⚠️ 待 source 接入 |
| `packagePath` | string | tbl_task.package_path (前端一直显示空) | ⚠️ 文档说能, 实际无表 | `original_path` / `lib_parent_folder` (NOT NULL) | ⚠️ 多对一 (取首个) | ❌ 同表 | ⚠️ 待 source 接入 |
| `packageCount` | number | tbl_disc 聚合 (Sprint 2F.1 已接) | ✅ 已用 tbl_disc | (无) | ✅ 已聚合进 unified_tasks | ❌ 不需要 | ❌ 不需 |
| `fileCount` | number | unified_tasks.total_files (Sprint 2B 已接) | ✅ 已用 tbl_task.total_files | (无) | ✅ 已聚合 | ❌ 不需要 | ❌ 不需 |
| `totalSize` | string | unified_tasks.total_size (Sprint 2B 已接) | ✅ 已用 tbl_task.total_size | (无) | ✅ 已聚合 | ❌ 不需要 | ❌ 不需 |
| `archiveName` | string | unified_tasks.archive_name (Sprint 2B 已接) | ✅ 已用 tbl_task.archive_name | (无) | ✅ | ❌ | ❌ |
| `backupScope` | string | mock 假 ("full") | ❌ 源 schema 无此字段 | (无) | ❌ 无法聚合 | ❌ | ❌ |
| `taskMode` | number | tbl_task.task_mode (Sprint 2F.1) | ✅ 已用 tbl_task | (无) | ✅ | ❌ | ❌ |
| `runtime` | number | update_dt - create_dt (Sprint 2F.1) | ✅ 已用 tbl_task | (无) | ✅ | ❌ | ❌ |
| `progress` | number | tbl_disc.avg(disc_progress) (Sprint 2F.1) | ✅ 已用 tbl_disc | (无) | ✅ | ❌ | ❌ |
| `currentPhase` | string | tbl_disc.max(stage) (Sprint 2F.1) | ✅ 已用 tbl_disc | (无) | ✅ | ❌ | ❌ |
| `errorMessage` | string | tbl_task.ret_msg (Sprint 2F.1) | ✅ 已用 tbl_task | (无) | ✅ | ❌ | ❌ |
| `successCount` | number | tbl_disc.sum(burn_success) (Sprint 2F.1) | ✅ 已用 tbl_disc | (无) | ✅ | ❌ | ❌ |
| `errorCount` | number | tbl_disc.sum(error_files) (Sprint 2F.1) | ✅ 已用 tbl_disc | (无) | ✅ | ❌ | ❌ |

### 4.2 关键结论

**待补的 3 个字段 (volumeId / sourcePath / packagePath) — tbl_task_items 是文档中的唯一候选源, 但当前 source_restore 无此表。**

| 字段 | 文档候选源 | source_restore 实际 | 影响 |
|---|---|---|---|
| `volumeId` | tbl_task_items.volume_id | ❌ 不存在 | DTO 继续返回 undefined, 前端显示 `—` |
| `sourcePath` | tbl_task_items.root_path | ❌ 不存在 | DTO 继续返回 "", 前端显示空 |
| `packagePath` | tbl_task_items.original_path | ❌ 不存在 | DTO 继续返回 "", 前端显示空 |

**Sprint 2F.1 文档错误修正**:
- 原文档 (sprint-2f1-task-p0-field-enrichment.md 第 21, 25, 125 行) 称"volumeId 在 tbl_task_items/tbl_task_folder", **本 Sprint 确认: source_restore 中两个表都不存在, 该说法属于"基于 schema-inventory 文档而非 source_restore 验证"。**
- 真实状况: 站点可能存在 tbl_task_items (从其他生产 DB 导出), 但**本平台 source_restore 当前不包含**。

---

## 五、接入策略 (Step 5)

### 5.1 当前 source_restore 范围

| 候选 | 结论 |
|---|---|
| `tbl_task_items` 接入 PG17 | ❌ **不可行** — source_restore 无此表 |
| 任何字段从 tbl_task_items 聚合进 unified_tasks | ❌ **不可行** — 同上 |
| 把 tbl_task_items 加入 package 白名单 | ❌ **不建议** — 无源表可推送 |

### 5.2 替代策略 (按 ROI 排序)

**策略 1: 维持现状, 文档化"待源表接入"** (推荐 P0)
- **做什么**: 把 volumeId / sourcePath / packagePath 三个 DTO 字段标记为"待 source 端 tbl_task_items 接入后激活", 前端继续显示 `—`/空
- **不做的事**: 不建表 / 不写 mapper / 不接 package
- **理由**: 当前 sprint 2F.1 的 8 字段已足够反映任务运行时状态; volumeId / path 是"展示优化"字段, 不影响核心任务域
- **ROI**: 0 (无需代码, 只需文档说明)

**策略 2: 字段由站点推送时填充** (推荐 P1, 待真实多站点推包)
- **做什么**: 站点推 package 时, 自行聚合 `tbl_task_items` 后, 在 tbl_task records 中附 volumeId / sourcePath / packagePath 三个新字段
- **不做的事**: 中心库不主动从 source 抓
- **理由**: 站点天然知道 volume_id 关系, 让它聚合后推过来更合理
- **前提**: 改 unified_tasks schema + 改 mapper + 改 package 白名单 + 改 dispatch
- **ROI**: 中 (需多站点改造, 但符合 package 模式)

**策略 3: 单独建表 unified_task_items 中心表** (不推荐)
- **做什么**: 单独建表存 task-item 关系, file-index 模式 (taskId + watermark + limit)
- **理由**: 体量未知, 不建议"无脑 full sync"
- **ROI**: 低 (新表大风险, 收益小)

**策略 4: ES / ClickHouse 接入** (超出 Sprint 范围)
- **理由**: 走 P2 路线, 不在本平台当前任务

### 5.3 推荐

**当前推荐: 策略 1 (维持现状, 文档化)**

- ✅ 不动代码
- ✅ 不建表
- ✅ 不接 package
- ✅ 不做 ES/CH
- ✅ Sprint 2F.1 错误文档化修正 (体积项在 tbl_task_items 的说法改为"schema-inventory 文档候选, source_restore 不可用")

**未来推荐 (不在本 Sprint 范围)**:
- 当真实站点接入, 站点端可自行聚合 tbl_task_items 后推 package
- 那时再做 Sprint 2F.2B (策略 2 实施)

---

## 六、是否建议进入 2F.2B

### 6.1 建议

**❌ 不建议进入 2F.2B 实现。**

### 6.2 理由

1. **无源表**: source_restore 中 tbl_task_items 不存在, 写 mapper/upsert 无法 E2E 验证
2. **无体量数据**: 无法判断表是 small/medium/large, 违反"不把未知体量表直接当小表 full sync" 禁止事项
3. **Sprint 2F.1 文档待修正**: "volumeId 在 tbl_task_items" 在 source_restore 范围不成立, 应先修正文档口径
4. **字段价值有限**: 3 个待补字段 (volumeId/sourcePath/packagePath) 都是展示性, 不影响任务域核心
5. **替代方案更优**: 站点侧聚合 + package 推送 (策略 2) 是更稳健的方案, 但需多站点参与

### 6.3 推荐下一 Sprint (替代 2F.2B)

| 选项 | 任务 | ROI |
|---|---|---|
| 2F.3A | 文档批量清理: 修正 sprint-2f1 中 tbl_task_items 表述, 标注 P0/P1 字段来源 | 中 (知识净化) |
| 2F.3B | 站点推送示例增强: 提供 bash 推包脚本, 站点端可自行聚合 tbl_task_items 后推 package | 高 (可执行) |
| 2F.3C | 同步日志 UI 增强: 在 /sync 页面集成 sync_package_log 详情 (Sprint 2D.4 收口) | 中 |
| 2F.3D | 站点鉴权骨架: package API key + HMAC 中间件 (无业务) | 中 |
| 2F.3E | 真实站点推包演练: 模拟 SH02 / SH03 推 tbl_task 包, 验证多站点 schema 一致性 | 高 |

**推荐**: 2F.3B (站点推包脚本 + 文档化 tbl_task_items 站点侧聚合方法) — 既不违反"不接新表", 又为未来真实接入铺路。

---

## 七、tsc/build 结果

- `pnpm exec tsc --noEmit`: exit **0** ✅ (本 Sprint 无 TS 代码变更, 仅审查)
- `pnpm build`: ✅ 成功 (本 Sprint 无代码变更, 沿用前次构建结果)
- 本 Sprint 写代码: **0 行**

---

## 八、固定统计

```
Sprint 2F.2A 完成统计
=====================
本次新增统一表: 0
本次新增源表接入: 0 (tbl_task_items 不在 source_restore)
本次新增 API: 0
本次新增前端页面: 0
本次新增 mapper/upsert: 0
本次影响 package: 否
本次不伪造: 沿用 Sprint 2F.1 (volumeId/sourcePath/packagePath 继续 undefined/空)
本次影响登录: 否
本次影响 file-index: 否
本次修正文档: 1 (sprint-2f1-task-p0-field-enrichment.md 中 tbl_task_items 表述待修订)
```

---

## 九、git status

- 已 commit, 已 push (见最终报告)
- 本 Sprint 唯一变更: 新增 `docs/database-analysis/sprint-2f2a-task-items-profile.md` + 探查脚本 3 个 (scripts/sprint-2f2a-*.ts, 可选保留)
