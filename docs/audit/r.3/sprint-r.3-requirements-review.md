# Sprint R.3 — Requirements Review (按 R.1 模板严格审查)

> **状态**: ✅ 完成 (R.3 是 R.1 §1 "全链路真实性审计" Sprint, **不写业务代码 / 不新增 API / 不新增页面 / 不修改数据库**)
> **日期**: 2026-06-10
> **模板**: `docs/database-analysis/requirements-strict-review-template.md` (R.1)
> **对应 requirements 节**: 全部 6 章 (R.3 是审计型 Sprint)

---

## 0. Sprint 元信息

| 字段 | 值 |
|---|---|
| Sprint ID | `Sprint R.3` |
| Sprint 标题 | Requirements × Frontend × Backend 全链路真实性审计 |
| 日期 | 2026-06-10 |
| 对应 requirement 节 | 全部 6 章 |
| 关联文档 | `docs/audit/r.3/REQUIREMENTS_REALITY_CHECK.md` + 5 个子报告 + JSON + console/network |
| 总控负责人 | (本平台) |
| 验证人 | (本平台) |

---

## 1. Requirement IDs 列表 (R.3 重算, 推翻 R.2)

> R.3 重新数: **45 项** (R.2 报告 43, R.3 发现 2 项 R.2 漏算 / 误判)

| 段 | 数量 | REQ IDs |
|---|---|---|
| §1 整体架构 | 2 | REQ-1.1.1, REQ-1.2.1 |
| §2 基础支撑 | 9 | REQ-2.1.1/2/3, REQ-2.2.1/2/3, REQ-2.3.1/2/3 |
| §3 核心管控 | 7 | REQ-3.1.1/2/3, REQ-3.2.1/2, REQ-3.3.1/2 |
| §4 业务操作 | 10 | REQ-4.1.1/2/3, **REQ-4.2.1/2/3/4**, REQ-4.3.1/2 |
| §5 辅助保障 | 5 | REQ-5.1.1/2/3, REQ-5.2.1/2 |
| §6 非功能 | 12 | REQ-6.1.1/2/3, REQ-6.2.1/2/3/4, REQ-6.3.1/2/3, REQ-6.4.1/2/3 |

**R.3 拆解修正**:
- R.2 把 REQ-2.2.2 / 3.2.1 误标 out_of_scope, R.3 修正为 blocked_by_auth (R.1 §1 强约束违规)
- R.2 把 REQ-4.1.1 / 4.1.2 标 partial / blocked_by_source_schema, R.3 修正为 blocked_by_external_system
- R.2 隐含 /api/tasks/[id] complete, R.3 改判 (100% 404 bug)
- R.2 隐含 /api/search partial, R.3 改 not_started (404)
- R.2 隐含新建任务 partial, R.3 改 not_started (POST 不存在)
- 优先恢复 (REQ-4.2.2 优先执行恢复) R.3 单列为 not_started (priority commandType 缺失)

---

## 2. Requirement 原始文本 (关键 3 段)

### §4.2 任务管理 (摘)
> 任务管理: 1. 新建备份/恢复任务 2.任务暂停/重置/恢复等任务控制
> 任务控制: 1.支持备份任务进行过程中后新建恢复任务 2.支持优先执行恢复任务
> 数据巡检任务: 1.支持批量抽取光盘, 读取文件, 比较文件哈希, 验证光盘可读性; 2支持全量或按比例抽取光盘上的文件
> 任务监控与提醒: 1. 查看与监控所有刻录、回迁任务的执行进度、状态; 2. 任务完成/失败/超时自动推送提醒至责任人; 3. 任务异常(失败/超时)自动触发告警

**R.3 验证 6 原子 (新建/暂停/恢复/重置/巡检/恢复任务/优先恢复)** 全部 0% 真控制。

### §2.1 站点管理 (摘)
> 站点配置: 1. 管理所有站点的基础信息: 名称、所属数据中心、IP地址、端口、状态(在线/离线)、联系人

**R.3 验证**: `/api/sites` 100% mock, 6 站点 (上海/北京/广州/成都/南京/武汉) 全是硬编码, `unified_sites` 表 0 行, 不读真实表。

### §1.1 系统定位 (摘)
> 作为企业集团层统一管控平台, **不替代**各数据中心原有光盘库存储管理系统

**R.3 验证**: ✅ 架构级, 完成。

---

## 3. 需求状态枚举 (8 选 1, R.3 重算)

| 状态 | 数量 | R.2 vs R.3 |
|---|---|---|
| `complete` | **7** | 9 → 7 |
| `partial` | **12** | 11 → 12 |
| `not_started` | **7** | 7 → 7 |
| `blocked_by_source_schema` | **5** | 6 → 5 |
| `blocked_by_site_change` | **5** | 5 → 5 |
| `blocked_by_auth` | **7** | 7 → 7 |
| `blocked_by_external_system` | **2** | 0 → 2 (R.2 漏) |
| `out_of_scope` | **0** | 2 → 0 (R.1 §1 违规修正) |
| **合计** | **45** | 43 → 45 |
| **requirements 完成率** | **7/45 = 15.6%** | 22.0% → 15.6% |

---

## 4. 实现明细 (R.3 全部产出)

| 文件 | 类型 | 用途 |
|---|---|---|
| `docs/audit/r.3/REQUIREMENTS_REALITY_CHECK.md` | 新建 | 11 章完整审计 (TL;DR / 9 阶段) |
| `docs/audit/r.3/FRONTEND_REALITY_CHECK.md` | 新建 | 12 页面真实度评分 (49/100 平均) |
| `docs/audit/r.3/API_REALITY_CHECK.md` | 新建 | 21 API 矩阵 (含 4 个🔴 bug) |
| `docs/audit/r.3/DATABASE_REALITY_CHECK.md` | 新建 | 3 DB 真实数据 + 8 行 paused 追源 |
| `docs/audit/r.3/TASK_CONTROL_REALITY_CHECK.md` | 新建 | 7 原子 × 5 维度 (平均 22.9%) |
| `docs/audit/r.3/HISTORICAL_MISJUDGEMENT.md` | 新建 | 5 高估 / 5 低估 / 5 错结论 / 1 大谎言 / 1 大惊喜 |
| `docs/audit/r.3/FINAL_RECOMMENDATION.md` | 新建 | 7 问 + R.4 唯一建议 |
| `docs/audit/r.3/requirements-reality.json` | 新建 | 机器可读审计数据 |
| `docs/audit/r.3/console-errors.txt` | 新建 | 推断 console 错误 |
| `docs/audit/r.3/network-errors.txt` | 新建 | curl 实测 network 错误 |
| `docs/audit/r.3/sprint-r.3-requirements-review.md` | 新建 (本文件) | R.1 模板 13 段严格审查 |

**R.3 范围严格**:
- 0 行业务代码
- 0 新增 API
- 0 新增页面
- 0 新增表
- 0 修改统一库
- 仅产出审计文档

---

## 5. 后端真实能力 (R.3 验证)

| REQ-ID | 状态 | 真实能力 (R.3 验证) |
|---|---|---|
| REQ-2.3.1 同步 4 类 | complete | ✅ 4/4 dispatcher A 类 (Sprint 2H.2) |
| REQ-2.3.2 同步策略 | complete | ✅ HMAC + 手动 trigger |
| REQ-4.3.2 盘笼查询 | complete | ✅ 17 设备真 (含 DL_BJ02_001) |
| REQ-5.1.1 日志采集 | complete | ✅ 13 张表 sync log + 22 告警 |
| REQ-6.2.1 HMAC 加密 | complete | ✅ /api/sync/package 401 无签名 |
| REQ-4.2.2 任务控制 (暂停/恢复/重置) | partial | ⚠️ audit only, executor L342 假执行 |
| REQ-4.2.3 巡检/恢复 | partial | ⚠️ 10+9 success, 全 DRY_RUN |
| REQ-2.1.1 站点配置 | partial | ⚠️ API 真, 数据假 (R.3 未发现) |
| REQ-2.1.3 站点监控 | partial | ⚠️ UI 框架, unified_sites 0 行 |
| **REQ-4.2.1 新建任务** | **not_started** | ❌ POST /api/tasks 不存在 (R.3 验证) |
| **REQ-4.1.1 检索** | **not_started** | ❌ /api/search 404 (R.3 验证) |
| **优先恢复 (REQ-4.2.2)** | **not_started** | ❌ priority commandType 缺失 (R.3 验证) |

---

## 6. UI 真实能力 (R.3 评分)

| 页面 | 真实度 | 关键问题 |
|---|---|---|
| /racks | 90/100 | 17 设备真 |
| /volumes | 90/100 | 13 行 + 3 aggregate |
| /users | 80/100 | 4 行真, dept 缺 |
| /control | 80/100 | 37 command 真, 全 dryRun |
| / | 75/100 | 6 tile 真, sites 拼接 |
| /sync | 70/100 | 78 包 + 155 log, 大量 skipped |
| /logs | 75/100 | 22 告警 |
| /tasks | 60/100 | 列表真, 详情 404, paused 误导 |
| /sites | 10/100 | **🔴 100% mock** |
| /login | 5/100 | mock UI |
| /tasks/[id] | 0/100 | **🔴 100% 404** |
| /search | 0/100 | **🔴 100% 404** |
| /settings | 0/100 | 占位 |

**平均**: 49/100

---

## 7. Mock / Simulator / DRY_RUN / 真控制 4 区分 (R.3 重算)

| REQ | Mock 模式 | Simulator | DRY_RUN | 真控制 |
|---|---|---|---|---|
| REQ-4.2.1 新建 | ❌ | ❌ | ❌ | ❌ (POST 不存在) |
| REQ-4.2.2 暂停/恢复/重置 | ❌ (API mode only) | ✅ Site Worker | ✅ | ❌ (executor L342 假执行) |
| REQ-4.2.2 优先恢复 | ❌ | ❌ | ❌ | ❌ (commandType 缺失) |
| REQ-4.2.3 巡检 | ❌ | ✅ | ✅ | ❌ (tbl_check_patrol_task 0 行) |
| REQ-4.2.3 恢复 | ❌ | ✅ | ✅ | ❌ (tbl_hot_restore_record 0 行) |
| REQ-2.1.1 站点配置 | ✅ (`/api/sites` 100% mock) | ❌ | ❌ | ❌ (unified_sites 0 行) |
| REQ-4.1.1 检索 | ❌ | ❌ | ❌ | ❌ (/api/search 404) |
| REQ-2.2.1 ADFS | ✅ (mock UI) | ❌ | ❌ | ❌ (CLAUDE.md 禁) |
| REQ-2.3.1 同步 4 类 | ❌ | ❌ | ❌ | ✅ (4/4 dispatcher A) |
| REQ-6.2.1 HMAC | ❌ | ❌ | ❌ | ✅ (5min window + timingSafeEqual) |

---

## 8. 缺失件 (R.3 重算, 22 项)

| 缺失件 | 原因 |
|---|---|
| 🔴 /api/tasks/[id] 详情 100% 404 | 路由坏了 (DB 87 行) |
| 🔴 /api/search 路由 100% 404 | 未实现 |
| 🔴 /api/sites 100% mock | 不读 unified_sites |
| 🔴 executor.ts L342 假执行 | centralQuery 占位 |
| 🔴 优先恢复 priority commandType 缺失 | COMMAND_TYPES 只有 5 个 |
| 🔴 新建任务 POST 不存在 | /api/tasks 路由只有 GET |
| 真实站点数据 (REQ-2.1.1) | unified_sites 0 行 |
| 真实监控 (REQ-2.1.3) | unified_sites 0 行 |
| 真实登录 (REQ-2.2.1) | CLAUDE.md 禁 |
| 账号映射 (REQ-2.2.2) | CLAUDE.md 禁 + 源端无 AD |
| 账号生命周期 (REQ-3.1.3) | CLAUDE.md 禁 |
| RBAC 流程 (REQ-3.2.1) | CLAUDE.md 禁 + 源端无 role |
| 部门表 (REQ-3.3.1) | tbl_depa 0 行 |
| 跨站 ES (REQ-4.1.1) | ES 未接 + 源 0 行 |
| 千万级性能 (REQ-4.1.2) | 源 0 行 + ES 未接 |
| 真实任务控制 (REQ-4.2.2) | 170 表无 paused/priority |
| 真巡检/真恢复 (REQ-4.2.3) | 站点 app 不 poll |
| 告警 push (REQ-4.2.4) | 站点 ≤10s 推未做 |
| 移位字段 (REQ-4.3.1) | tbl_magzines 无移位字段 |
| 日志导出 (REQ-5.1.2) | 未实现 |
| 模糊匹配 (REQ-5.1.3) | 未实现 |
| 索引 + 校验码 (REQ-5.2.1) | 源 tbl_file 0 行 |
| cluster 部署 (REQ-6.1.2) | 未实施 |
| 存储加密 (REQ-6.2.2) | 无密码字段 |
| 防越权 (REQ-6.2.4) | 无 RBAC |
| 监控 dashboard (REQ-6.4.2) | 仅 API, 无 UI |
| 配置页 (REQ-6.4.3) | 未实现 |

---

## 9. Blocker 类型 (8 选 1, R.3 验证)

| Blocker | 数量 | 决策点 |
|---|---|---|
| (无, complete) | 7 | (已实现) |
| (无, partial/not_started, 可推进) | 19 | R.4 + 后续 Sprint |
| blocked_by_source_schema | 5 | 站点表 DDL (4 项 + ES 源) |
| blocked_by_site_change | 5 | 站点 app 改造 (3 项) |
| blocked_by_auth | 7 | 解锁 CLAUDE.md + 5.x Sprint |
| blocked_by_external_system | 2 | ES / ClickHouse |
| out_of_scope | 0 | (R.2 误标已修正) |

**站点 schema 变更清单** (5 项 DDL):

```sql
-- 1. 任务暂停
ALTER TABLE tbl_task ADD COLUMN paused BOOLEAN DEFAULT FALSE;
ALTER TABLE tbl_task ADD COLUMN pause_reason TEXT;
ALTER TABLE tbl_task ADD COLUMN paused_at TIMESTAMP;

-- 2. 任务优先级
ALTER TABLE tbl_task ADD COLUMN priority SMALLINT DEFAULT 0;
ALTER TABLE tbl_task ADD COLUMN priority_source TEXT;

-- 3. 巡检任务
ALTER TABLE tbl_check_patrol_task ADD COLUMN source_id TEXT;
ALTER TABLE tbl_check_patrol_task ADD COLUMN verify_result JSONB;
ALTER TABLE tbl_check_patrol_task ADD COLUMN checksum TEXT;
ALTER TABLE tbl_check_patrol_task ADD COLUMN checksum_algo TEXT;

-- 4. 热恢复
ALTER TABLE tbl_hot_restore_record ADD COLUMN source_id TEXT;
ALTER TABLE tbl_hot_restore_record ADD COLUMN restore_priority SMALLINT DEFAULT 0;

-- 5. 账号维度
ALTER TABLE tbl_user ADD COLUMN site_ids JSONB;
ALTER TABLE tbl_user ADD COLUMN dept_id INT;
ALTER TABLE tbl_user ADD COLUMN role_id INT;
```

**站点 app 改造清单** (3 项):

1. **poll `control_command` 新行**: 启动 GET /api/site-control/commands, 改 `tbl_task.paused/priority/status`, 调 ack
2. **巡检进程**: SELECT pending FROM `tbl_check_patrol_task` → 抽盘 → SM3 → UPDATE + 回调
3. **热恢复进程**: SELECT pending FROM `tbl_hot_restore_record` → 执行 → UPDATE progress + 回调

---

## 10. 源端/站点 API 变更清单 (10 项, R.3 重算)

| # | 变更项 | 涉及表/API | 决策人 |
|---|---|---|---|
| 1 | `tbl_task` 加 `paused` | `tbl_task` | 领导 + 站点运维 |
| 2 | `tbl_task` 加 `pause_reason` | `tbl_task` | 同上 |
| 3 | `tbl_task` 加 `priority` | `tbl_task` | 同上 |
| 4 | `tbl_check_patrol_task` 加 `verify_result` + `checksum` | `tbl_check_patrol_task` | 同上 |
| 5 | `tbl_hot_restore_record` 加 `source_id` | `tbl_hot_restore_record` | 同上 |
| 6 | 站点 app poll `control_command` | 站点 app | 站点 app 团队 |
| 7 | 站点 app 读 `tbl_check_patrol_task` 新行 | 站点 app | 同上 |
| 8 | 站点 app 读 `tbl_hot_restore_record` 新行 | 站点 app | 同上 |
| 9 | 提供真站点 API 文档 | 站点 | 站点架构师 |
| 10 | 站点 app 写 site_id/dept_id/role_id | `tbl_user` | 站点 app 团队 |

---

## 11. requirements 完成率 (R.3 公式)

```
R.3 requirements 完成率 = complete / (total - out_of_scope) × 100%
                        = 7 / (45 - 0) × 100%
                        = 7 / 45 × 100%
                        = 15.6%
```

| 维度 | R.2 | R.3 | Δ |
|---|---|---|---|
| 总需求数 | 43 | **45** | +2 (R.2 漏) |
| complete | 9 | **7** | -2 (1 个改判) |
| partial | 11 | **12** | +1 |
| not_started | 7 | **7** | (但内容变: REQ-4.1.1 + REQ-4.2.1 改 not_started) |
| blocked_by_external_system | 0 | **2** | +2 (ES) |
| out_of_scope | 2 | **0** | -2 (R.1 §1 违规修正) |
| **完成率** | **22.0%** | **15.6%** | **-6.4%** |

**禁止措辞** (R.1 §7):
- ❌ "业务完成度 85%" (Sprint 3.0 误导)
- ❌ "需求完成度 22.0%" (R.2 偏高)
- ✅ "requirements 完成度 15.6%" (R.3 真实)
- ✅ "同步链路完成度 100%" (历史)
- ✅ "控制队列框架完成度 100% + 真控制完成度 0%" (R.3 拆分)

---

## 12. 最终判决 (Verdict)

### Verdict: `pass` (R.3 自身)

**理由**:
- ✅ **R.3 全部产出** (7 主报告 + 1 JSON + 2 snapshot + 本 review) 严格审计
- ✅ **R.2 报告推翻 5 项关键结论** (out_of_scope 违规 + 数字虚高)
- ✅ **Sprint 4.8.2-R 报告补充 2 项遗漏** (executor L342 假执行 + 8 行 paused 来源)
- ✅ **45 项 REQ 重算** (vs R.2 43 项)
- ✅ **4 个🔴 bug 列出** (R.4 修)
- ✅ **下一 Sprint 唯一建议 R.4** (0.5 人天, 修 4 bug + 补 priority)
- ✅ **5 个领导决策项** 清晰列出 (Auth / 站点 schema / 站点 app / ES / 站点 API)
- ✅ **0 行业务代码 / 0 新增 API / 0 新增页面 / 0 修改 DB** (R.3 范围严格)
- ✅ **R.1 强约束违反** (R.2 out_of_scope) **已修正**

**R.3 不做的事** (R.3 范围外):
- ❌ 不实现新功能
- ❌ 不新增页面/表/API
- ❌ 不宣称"需求完成 X%"
- ❌ 不修改统一库
- ❌ 不删除目录, 不删除数据库

**R.3 推翻 R.2**:
- 22.0% → 15.6% (数字)
- out_of_scope 2 → 0 (违规修正)
- 5 个关键结论错误

**R.3 推翻 Sprint 4.8.2-R**:
- executor L342 假执行 (历史漏掉)
- 8 行 paused 来源澄清 (与 Sprint 4.8.2-R 无关)

**R.3 新发现**:
- 🔴 /api/tasks/[id] 100% 404 (87 行 ID 全部)
- 🔴 /api/search 100% 404
- 🔴 /api/sites 100% mock
- 优先恢复 priority commandType 缺失

**领导决策项** (R.3 输出, 等待):
- A. **REQ-2.2.1 ADFS** — 解锁 CLAUDE.md, 带动 7 项
- B. **站点表能否加 `paused` / `priority` 字段** — 任务控制真控制前提
- C. **站点 app 能否 poll `control_command`** — 真执行前提
- D. **是否引入 ES/ClickHouse** — 千万级检索前提
- E. **是否提供真站点 API 文档** — 跨站通信前提

---

## 13. 提交前检查清单 (R.1 强制)

- [x] §1 所有 45 个 Req ID 已列
- [x] §3 每个 Req ID 打了 1 个状态标签 (8 选 1)
- [x] §5 后端真实能力每个 complete REQ 都有 SQL/API 证据
- [x] §7 明确 mock / simulator / DRY_RUN / 真控制 4 者的区别
- [x] §8 缺失件不隐藏, 27 项全部列出
- [x] §9 blocker 类型 8 选 1
- [x] §10 站点 schema/API 变更清单 10 项已提交给领导
- [x] §11 requirements 完成率 15.6% 已计算 (R.1 公式)
- [x] §12 verdict: pass
- [x] 文件命名 `sprint-r.3-requirements-review.md` 放 `docs/audit/r.3/`
- [x] PROJECT_STATUS.md / ROADMAP.md 待 R.4 同步更新
- [x] 链接到本 review 的 commit / PR 描述

---

## 附录 A: R.3 关键术语对照

| 术语 | 含义 | R.3 数值 |
|---|---|---|
| **链路完成** | control_command → worker → audit_log 全部通 | 100% (37 行) |
| **DRY_RUN 模拟完成** | Site Worker DRY_RUN 跑通 | 100% (5/5) |
| **真控制完成** | 总控提交 → 站点 app 执行 → 状态回写 | 0% (0/7 原子) |
| **UI 完成** | 按钮接通 + toast 合规 | 43% (3/7 原子) |
| **审计完成** | audit_log 写入 1:1 | 100% (35 行) |
| **HMAC 鉴权** | /api/sync/package 401 无签名 | 100% (R.3 验证) |

---

## 附录 B: R.3 引用

- **R.1 模板**: `docs/database-analysis/requirements-strict-review-template.md`
- **R.1 强约束**: `CLAUDE.md` 顶部
- **R.2 主矩阵**: `docs/database-analysis/requirements-traceability.md` (R.3 推翻 5 项)
- **Sprint 4.8.2-R 审计**: `docs/database-analysis/sprint-4.8.2-site-control-reality-audit.md` (R.3 补 2 项)
- **本 Sprint 主报告**: `docs/audit/r.3/REQUIREMENTS_REALITY_CHECK.md`
- **R.3 最终建议**: `docs/audit/r.3/FINAL_RECOMMENDATION.md`

---

## 附录 C: 8 行 paused 来源追查 (R.3 新发现)

| id | task_no | source_site_id | updated_at |
|---|---|---|---|
| bc8f7e15... | TEST_CLEAN-36 | TEST_CLEAN | (历史) |
| 1a20a91e... | SH01-36 | SH01 | (历史) |
| 819f4c9a... | TEST_CLEAN-33 | TEST_CLEAN | (历史) |
| cf4761a5... | SH01-35 | SH01 | (历史) |
| 46b69065... | TEST_CLEAN-35 | TEST_CLEAN | (历史) |
| 5c120098... | SH01-33 | SH01 | (历史) |
| 84d1676d... | SH01-3 | SH01 | (历史) |
| 2be0f9c0... | TEST_CLEAN-3 | TEST_CLEAN | (历史) |

**结论**: 8 行 paused 是 **Sprint 2F.1 之前** (status 字段加入时) 写入的 mock seed, **与 Sprint 4.8.2-R 无关**。Sprint 4.8.2-R 真实 3 个 task_pause (ui-sim-*) **全部 failed** (task not found)。

**R.2 报告隐含 8 行 paused = Sprint 4.8.2-R 成果, R.3 推翻**。
