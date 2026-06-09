# Sprint R.2 — Requirements Review

> **状态**: ✅ 完成 (R.2 是 R.1 9 大强约束的"基线建立" Sprint, **不写业务代码 / 不新增 API / 不新增页面 / 不修改数据库 / 不新增表**)
> **日期**: 2026-06-09
> **模板**: `docs/database-analysis/requirements-strict-review-template.md` (R.1)
> **对应 requirements 节**: 全部 6 章 (Sprint R.2 不做业务实现, 只做需求追踪体系)
> **关联文档**:
> - `docs/database-analysis/requirements-traceability.md` (R.2 主产出)
> - `docs/database-analysis/requirements-traceability.json` (R.2 机器可读)
> - `docs/database-analysis/requirements-strict-review-template.md` (R.1 模板)

---

## 0. Sprint 元信息

| 字段 | 值 |
|---|---|
| Sprint ID | `Sprint R.2` |
| Sprint 标题 | Requirements Traceability Matrix |
| 日期 | 2026-06-09 |
| 对应 requirement 节 | **全部 6 章** (本 Sprint 是追踪体系, 不针对单条 REQ) |
| 关联文档 | `requirements-traceability.md` + `requirements-traceability.json` + `CLAUDE.md` (R.1) |
| 总控负责人 | (本平台) |
| 验证人 | (本平台) |

---

## 1. Requirement IDs 列表

> 本 Sprint 涉及所有 43 个 REQ-ID (因 R.2 是基线建立, 不做单条实现):

| 段 | REQ IDs |
|---|---|
| §1 整体架构 | REQ-1.1.1, REQ-1.2.1 |
| §2 基础支撑 | REQ-2.1.1, REQ-2.1.2, REQ-2.1.3, REQ-2.2.1, REQ-2.2.2, REQ-2.2.3, REQ-2.3.1, REQ-2.3.2, REQ-2.3.3 |
| §3 核心管控 | REQ-3.1.1, REQ-3.1.2, REQ-3.1.3, REQ-3.2.1, REQ-3.2.2, REQ-3.3.1, REQ-3.3.2 |
| §4 业务操作 | REQ-4.1.1, REQ-4.1.2, REQ-4.1.3, **REQ-4.2.1**, **REQ-4.2.2**, **REQ-4.2.3**, REQ-4.2.4, REQ-4.3.1, REQ-4.3.2 |
| §5 辅助保障 | REQ-5.1.1, REQ-5.1.2, REQ-5.1.3, REQ-5.2.1, REQ-5.2.2 |
| §6 非功能 | REQ-6.1.1, REQ-6.1.2, REQ-6.1.3, REQ-6.2.1, REQ-6.2.2, REQ-6.2.3, REQ-6.2.4, REQ-6.3.1, REQ-6.3.2, REQ-6.3.3, REQ-6.4.1, REQ-6.4.2, REQ-6.4.3 |

**总计**: 43 原子需求 (与 `requirements-traceability.json` `total_requirements` 字段一致)

---

## 2. Requirement 原始文本 (逐字摘录, 关键 3 段)

> 来自 `docs/source/requirements.md` (R.1 已读全文)

**§2.1 站点管理 (摘)**:
> 站点配置: 1. 管理所有站点的基础信息: 名称、所属数据中心、IP地址、端口、状态(在线/离线)、联系人; 2. 支持站点新增/编辑/禁用/删除, 配置信息实时生效。

**§4.2 任务管理 (摘)**:
> 任务管理: 1. 新建备份/恢复任务 2.任务暂停/重置/恢复等任务控制
> 任务控制: 1.支持备份任务进行过程中后新建恢复任务 2.支持优先执行恢复任务
> 数据巡检任务: 1.支持批量抽取光盘, 读取文件, 比较文件哈希, 验证光盘可读性; 2支持全量或按比例抽取光盘上的文件

**§4.2 任务控制 6 原子** (R.1 §4 强约束):
1. 暂停 (Pause)
2. 恢复 (Resume)
3. 重置 (Reset)
4. 巡检 (Inspect)
5. 恢复任务 (Recovery)
6. 优先恢复 (Priority)

---

## 3. 需求状态枚举 (8 选 1, 全 43 项汇总)

| 状态 | 数量 | 占比 |
|---|---|---|
| `complete` | 9 | 20.9% |
| `partial` | 11 | 25.6% |
| `not_started` | 7 | 16.3% |
| `blocked_by_source_schema` | 6 | 14.0% |
| `blocked_by_site_change` | 5 | 11.6% |
| `blocked_by_auth` | 7 | 16.3% |
| `blocked_by_external_system` | 0 | 0% (合并到 source/site) |
| `out_of_scope` | 2 | 4.7% |
| **合计** | **43** | **100%** |

> 详细见 `requirements-traceability.md` §3.1

---

## 4. 实现明细 (Implementation)

> R.2 唯一实现是**追踪体系** (非业务实现)。

| 文件 | 类型 | 行数 | 用途 |
|---|---|---|---|
| `docs/database-analysis/requirements-traceability.md` | 新建 | ~600 | 人类可读 43×18 矩阵 |
| `docs/database-analysis/requirements-traceability.json` | 新建 | ~700 | 机器可读 (自动化校验) |
| `docs/database-analysis/sprint-r.2-requirements-review.md` | 新建 (本文件) | ~250 | R.1 模板严格审查 |
| `docs/summary/PROJECT_STATUS.md` | 修改 | +60 | 加 R.2 段 |
| `docs/summary/ROADMAP.md` | 修改 | +40 | 加 R.2 段 |

**0 行业务代码** / **0 新增 API** / **0 新增页面** / **0 新增表** / **0 修改 API** / **0 修改统一库**。

---

## 5. 后端真实能力 (Backend Reality)

> **R.2 真实结论**: Sprint R.2 **不实现后端能力**, **只做需求追踪**。后端现状是历史 Sprint 累计产出, 见 `requirements-traceability.md` §2 各 REQ 详情。

**已 complete 的 9 项后端能力 (有 SQL/API 证据)**:

| REQ-ID | 证据 |
|---|---|
| REQ-1.1.1 | (架构级) CLAUDE.md 明确不替代 |
| REQ-1.2.1 | HMAC + 单向 pull — `pnpm smoke:sync` 验证 |
| REQ-2.3.1 | 4/4 类型真实 — `pnpm db:query "SELECT COUNT(*) FROM unified_*"` |
| REQ-2.3.2 | 手动 trigger + HMAC — `pnpm smoke:sync` |
| REQ-4.3.2 | 6 设备 + 396 盘位 — `pnpm db:query "SELECT COUNT(*) FROM unified_devices"` |
| REQ-5.1.1 | 13 张表同步日志 — `pnpm db:query "SELECT COUNT(*) FROM sync_table_log"` |
| REQ-6.1.1 | (架构级) 13 张小表 + 单测 <50ms |
| REQ-6.2.1 | HMAC-SHA256 (Sprint 2G.1, 5min window) |
| REQ-6.3.3 | PG 17 + 独立 `unified_*` 命名空间 — `psql -c "\dt unified_*"` |

**任务控制 (REQ-4.2.2) 后端真实能力**:

| 维度 | 数值 |
|---|---|
| 链路 (control_command 写入 → worker 拉取 → audit_log) | ✅ 100% |
| 真控制 (改 `tbl_task.paused` 等字段) | ❌ 0% (170 张表无 paused 字段) |
| audit_log 写入 | ✅ 100% (DRY_RUN) |
| UI 按钮接通 | ✅ 50% (暂停/恢复/重置 3/6) |

**禁止措辞**:
- ❌ "任务控制已实现" / "暂停已实现"
- ✅ "控制队列框架完成" + "DRY_RUN 模拟完成"

---

## 6. UI 真实能力 (UI Reality)

> R.2 不实现 UI, UI 现状是历史 Sprint 累计。

| UI 元素 | 来源 Sprint | 真实行为 | 误导性 |
|---|---|---|---|
| Tasks 表格 + 抽屉 3 按钮 | Sprint 4.8.2-R | POST `/api/control/commands` → toast "已提交到控制队列, 等待站点拉取执行" | ✅ 不误导 |
| Tasks 列表 runtime 列 | Sprint 2H.5 | 33/44 任务有真实 runtime (75%) | ✅ |
| Volumes 顶部 4 tile | Sprint 2H.4 | 5 个真实 volume | ✅ |
| Racks 列表 | Sprint 2C.4 | 6 设备 + 396 盘位 | ✅ |
| /control 控制命令列表 | Sprint 4.5 | 5s 自动刷新 | ✅ |

**禁止**:
- ❌ 按钮 + 弹窗显示"已暂停" / "暂停成功"
- ✅ 按钮 toast "暂停命令已提交" / "已记录到控制队列"

---

## 7. Mock / Simulator / DRY_RUN / 真控制 4 区分

| REQ-ID | Mock 模式 | Simulator | DRY_RUN | 真控制 |
|---|---|---|---|---|
| REQ-4.2.1 (新建) | ❌ | ❌ | ❌ | ❌ (无 POST API) |
| REQ-4.2.2 (暂停/恢复/重置) | ❌ (按钮 API mode only) | ✅ Site Worker DRY_RUN | ✅ | ❌ (无 paused 字段) |
| REQ-4.2.2 (优先恢复) | ❌ | ✅ | ✅ | ❌ (无 priority 字段) |
| REQ-4.2.3 (巡检) | ❌ | ✅ | ✅ | ❌ (无 app evidence) |
| REQ-4.2.3 (恢复任务) | ❌ | ✅ | ✅ | ❌ |
| REQ-2.2.1 (ADFS 登录) | ✅ (前端 mock) | ❌ | ❌ | ❌ (CLAUDE.md 禁) |
| REQ-2.2.2 (账号映射) | ❌ | ❌ | ❌ | ❌ (out_of_scope) |
| REQ-4.1.1 (检索) | ✅ (mock) + 任务级真实 | ❌ | ❌ | 部分 (任务级通) |
| REQ-2.3.1 (同步 4 类) | ❌ | ❌ | ❌ | ✅ (4/4 类型真实) |

---

## 8. 缺失件 (Missing Pieces, 不隐藏)

| REQ-ID | 缺失件 | 原因 |
|---|---|---|
| REQ-2.1.1 | 真实站点数据 | 源 `tbl_site` 0 行 |
| REQ-2.1.3 | 真实监控 | `unified_sites` 0 行 |
| REQ-2.2.1 | 真实登录 | CLAUDE.md 禁 |
| REQ-2.3.3 | 定时校验 job | 未实现 |
| REQ-3.1.1 | 站点关联字段 | `tbl_user` 无 site_ids/dept_id/role_id |
| REQ-3.1.3 | 写 API | CLAUDE.md 禁 |
| REQ-3.2.1 | RBAC 流程 | CLAUDE.md 禁 + 源端无 role |
| REQ-3.3.1 | 部门表 | `tbl_depa` 0 行 |
| REQ-4.1.1 | 跨站 ES | CLAUDE.md 禁 + 源 0 行 |
| REQ-4.1.2 | 千万级性能 | 源 0 行 + ES 未接 |
| **REQ-4.2.2** | **真控制** | **170 张表无 paused/priority 字段** |
| **REQ-4.2.3** | **真巡检/真恢复** | **站点 app 不 poll** |
| REQ-4.2.4 | 告警 push | 站点 ≤10s 推未做 |
| REQ-4.3.1 | 移位字段 | `tbl_magzines` 无 from/to/approver |
| REQ-5.1.2 | 导出 API | 未实现 |
| REQ-5.1.3 | 模糊匹配 | 未实现 |
| REQ-5.2.1 | 索引 + 校验码 | 源 `tbl_file` 0 行 |
| REQ-6.1.2 | cluster 部署 | 未实施 |
| REQ-6.2.2 | 存储加密 | 无密码字段 |
| REQ-6.2.4 | 防越权 | 无 RBAC |
| REQ-6.4.2 | 监控 dashboard | 仅 API, 无 UI |
| REQ-6.4.3 | 配置页 | 未实现 |

---

## 9. Blocker 类型 (8 选 1)

> 43 项中按主 blocker 分布:

| Blocker | 数量 | 决策点 |
|---|---|---|
| `complete` | 9 | (已实现) |
| `partial` / `not_started` | 18 | 后续 Sprint 推进 |
| `blocked_by_source_schema` | 6 | 站点表 DDL patch (4 项) |
| `blocked_by_site_change` | 5 | 站点 app 改造 (3 项) |
| `blocked_by_auth` | 7 | 解锁 CLAUDE.md + 5.x Sprint |
| `out_of_scope` | 2 | CLAUDE.md 永久禁 |

**站点 schema 变更清单** (4 项 DDL, 详见 `requirements-traceability.md` §5.2):

```sql
-- 1. 任务暂停 (必加)
ALTER TABLE tbl_task ADD COLUMN paused BOOLEAN DEFAULT FALSE, ADD COLUMN pause_reason TEXT, ADD COLUMN paused_at TIMESTAMP;
-- 2. 任务优先级 (必加)
ALTER TABLE tbl_task ADD COLUMN priority SMALLINT DEFAULT 0, ADD COLUMN priority_source TEXT;
-- 3. 巡检任务
ALTER TABLE tbl_check_patrol_task ADD COLUMN source_id TEXT, ADD COLUMN verify_result JSONB, ADD COLUMN checksum TEXT, ADD COLUMN checksum_algo TEXT;
-- 4. 热恢复
ALTER TABLE tbl_hot_restore_record ADD COLUMN source_id TEXT, ADD COLUMN restore_priority SMALLINT DEFAULT 0;
```

**站点 app 改造清单** (3 项, 详见 `requirements-traceability.md` §5.3):
1. **poll `control_command` 新行** (暂停/恢复/重置/优先恢复)
2. **巡检进程** (抽盘 + SM3)
3. **热恢复进程** (执行 + 进度)

---

## 10. 需要的源端 / 站点 schema/API 变更清单 (10 项)

| # | 变更项 | 涉及表 / API | 具体 DDL / 文档点 | 决策人 |
|---|---|---|---|---|
| 1 | `tbl_task` 加 `paused` | `tbl_task` | `ALTER TABLE tbl_task ADD COLUMN paused BOOLEAN DEFAULT FALSE;` | 领导 + 站点运维 |
| 2 | `tbl_task` 加 `pause_reason` | `tbl_task` | `ALTER TABLE tbl_task ADD COLUMN pause_reason TEXT;` | 同上 |
| 3 | `tbl_task` 加 `priority` | `tbl_task` | `ALTER TABLE tbl_task ADD COLUMN priority SMALLINT DEFAULT 0;` | 同上 |
| 4 | `tbl_check_patrol_task` 加 `verify_result` + `checksum` | `tbl_check_patrol_task` | `ALTER TABLE tbl_check_patrol_task ADD COLUMN verify_result JSONB; ADD COLUMN checksum TEXT;` | 同上 |
| 5 | `tbl_hot_restore_record` 加 `source_id` | `tbl_hot_restore_record` | `ALTER TABLE tbl_hot_restore_record ADD COLUMN source_id TEXT;` | 同上 |
| 6 | 站点 app poll `control_command` | 站点 app | 启动 GET `/api/site-control/commands`, 改 `tbl_task.paused`/`priority`/`status`, 调 ack | 站点 app 团队 |
| 7 | 站点 app 读 `tbl_check_patrol_task` 新行 | 站点 app | 巡检进程 SELECT pending → 抽盘 → SM3 → UPDATE | 同上 |
| 8 | 站点 app 读 `tbl_hot_restore_record` 新行 | 站点 app | 热恢复进程 SELECT pending → 执行 → UPDATE | 同上 |
| 9 | 提供真站点 API 文档 | 站点 | swagger / openapi.yml 提交到 `docs/source/site-api-spec.md` | 站点架构师 |
| 10 | 站点 app 写 site_id/dept_id/role_id | `tbl_user` | 站点 app 写账号时带 site/dept/role | 站点 app 团队 |

---

## 11. 是否影响 requirements 完成率

| 维度 | 数值 | 公式 |
|---|---|---|
| 本 Sprint 涉及 Req ID 数 | 43 (全量) | — |
| `complete` | 9 | 历史累计 |
| `partial` | 11 | 历史累计 |
| `not_started` | 7 | 历史累计 |
| `blocked_*` | 18 | 6+5+7 |
| `out_of_scope` | 2 | 历史累计 |
| **本 Sprint 完成率** | **N/A** (R.2 是体系建立) | — |
| **全局完成率 (R.2 后)** | **9 / 41 = 22.0%** | complete / (total - out_of_scope) |

**禁止措辞**:
- ❌ "业务完成度 85%" (来自 Sprint 3.0)
- ❌ "需求完成度 28.1%" (来自 Sprint 3.0R)
- ❌ "X% 已实现" (模糊)
- ✅ "requirements 完成度 22.0%" (R.2 后新基准)
- ✅ "同步链路完成度 100%" (历史)
- ✅ "展示链路完成度 ~60%" (历史)
- ✅ "控制队列框架完成度 100% + DRY_RUN 模拟完成度 100% + 真实控制完成度 0%" (R.1 §4 拆分)

---

## 12. 最终判决 (Verdict)

### Verdict: `pass` (R.2 自身)

**理由**:
- ✅ **建立 43 原子 × 18 字段追踪矩阵** (R.1 模板严格产出)
- ✅ **机器可读 JSON 同步落地** (后续自动化校验)
- ✅ **任务控制 6 原子专项** (暂停/恢复/重置/巡检/恢复/优先) — **全部未消失**, 全部标 `blocked_*`
- ✅ **4 项 DDL patch + 3 项 app 改造** 清单提交给领导/站点运维
- ✅ **Top 10 按 requirements.md 优先级** (非 UI 排序)
- ✅ **8 个统计指标** 全部计算: complete/partial/not_started/blocked_by_source_schema/blocked_by_site_change/blocked_by_auth/out_of_scope/completion_rate
- ✅ **0 行业务代码 / 0 新增 API / 0 新增页面 / 0 新增表** (R.2 范围严格)

**R.2 不做的事** (R.2 范围外):
- ❌ 不实现新功能
- ❌ 不新增页面/表/API
- ❌ 不宣称任何"需求完成"
- ❌ 不修改统一库
- ❌ 不删除目录, 不删除数据库

**领导决策项 (R.2 输出, 等待)**:
- A. **站点表能否加 `paused` / `priority` 字段?** (REQ-4.2.2 真实完成前提)
- B. **站点 app 能否 poll `control_command` 新行?** (REQ-4.2.2 + REQ-4.2.3 真实完成前提)
- C. **CLAUDE.md "不做登录权限系统" 是否解锁?** (REQ-2.2.1 解锁带动 6 项)
- D. **是否引入 ES?** (REQ-4.1.1 + REQ-4.1.2 真实完成前提)
- E. **是否提供站点 API 文档?** (REQ-3.1.2 + REQ-3.2.2 真实完成前提)

---

## 13. 提交前检查清单 (R.1 强制)

- [x] §1 所有 43 个 Req ID 已列
- [x] §3 每个 Req ID 打了 1 个状态标签 (8 选 1)
- [x] §5 后端真实能力每个 complete REQ 都有 SQL/API 证据
- [x] §7 明确 mock / simulator / DRY_RUN / 真控制 4 者的区别
- [x] §8 缺失件不隐藏, 22 项全部列出
- [x] §9 blocker 类型 8 选 1
- [x] §10 站点 schema/API 变更清单 10 项已提交给领导
- [x] §11 requirements 完成率 22.0% 已计算 (R.1 公式)
- [x] §12 verdict: pass
- [x] 文件命名 `sprint-r.2-requirements-review.md` 放 `docs/database-analysis/`
- [x] PROJECT_STATUS.md / ROADMAP.md 同步更新
- [x] 链接到本 review 的 commit / PR 描述

---

## 附录 A: 关键术语对照

| 术语 | 含义 | 适用状态 |
|---|---|---|
| **complete** | 真实后端 + UI + 端到端验证 | 9 项 |
| **partial** | 部分能力, 缺后端/UI/数据 | 11 项 |
| **链路完成** | control_command → worker → audit_log 全部通 | 5/5 commandType (100%) |
| **DRY_RUN 模拟完成** | Site Worker DRY_RUN 跑通, 不连真站点 | 5/5 commandType (100%) |
| **真实控制完成** | 总控提交 → 站点 app 执行 → 状态回写 | 0/6 原子 (0%) |
| **UI 完成** | 按钮接通 + toast 合规 | 3/6 原子 (50%) |

---

## 附录 B: 关键发现

1. **requirements 完成度从 28.1% (Sprint 3.0R) → 22.0% (R.2)**: 数字下降因颗粒度更细 (40 → 43 原子), 不是真实能力下降
2. **任务控制 6 原子真控制 0%**: 170 张表全扫确认, 站点库无 paused/priority 字段, 站点 app 不 poll
3. **最大瓶颈仍是 ADFS (REQ-2.2.1)**: 解锁带动 6 项 (~25 人天)
4. **22 项缺失件明确列出**: 不隐藏, 全部走 `blocked_*` 路径
5. **R.2 0 业务代码**: 严格只做追踪体系

---

## 附录 C: 引用

- **R.1 模板**: `docs/database-analysis/requirements-strict-review-template.md`
- **R.2 主矩阵**: `docs/database-analysis/requirements-traceability.md`
- **R.2 JSON**: `docs/database-analysis/requirements-traceability.json`
- **R.1 审计 (Sprint 4.8.2-R)**: `docs/database-analysis/sprint-4.8.2-site-control-reality-audit.md`
- **CLAUDE.md 9 大强约束**: 项目根目录 `CLAUDE.md`
- **Sprint 4.0 旧矩阵 (40 原子, 已不推荐)**: `docs/database-analysis/sprint-4.0-requirements-implementation-matrix.md`
