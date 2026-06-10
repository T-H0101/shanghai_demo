# Sprint R.6 — Requirements Review (按 R.1 模板严格审查)

> **状态**: ✅ 完成 (R.6 是 R.5 占位脚本 → 真实 e2e 实施, **0 业务代码 / 0 新增 API / 0 新增页面 / 0 修改 DB**)
> **日期**: 2026-06-10
> **模板**: `docs/database-analysis/requirements-strict-review-template.md` (R.1)
> **对应 requirements 节**: R.6 是测试基线, 不针对单条 REQ 实施

---

## 0. Sprint 元信息

| 字段 | 值 |
|---|---|
| Sprint ID | `Sprint R.6` |
| Sprint 标题 | 前端事件 e2e 实施 (R.5 占位 → 真实) |
| 日期 | 2026-06-10 |
| 对应 requirement 节 | (R.6 是测试基线建立, 不针对单条 REQ 实施) |
| 关联文档 | `docs/database-analysis/sprint-r.6-e2e-event-test-implementation.md` (R.6 实施) + `frontend-event-test-standard.md` (R.5 规范) |

---

## 1. Requirement IDs 列表 (R.6 涉及)

> R.6 是测试基线, 不实施新功能。涉及 REQ 是**测试覆盖** (验证 R.4 修复 + 历史实现真实可用):

| REQ-ID | R.6 测试覆盖 |
|---|---|
| REQ-2.1.1 站点配置 | ✅ test-sites.ts (derived 验证) |
| REQ-2.3.1 同步 4 类 | ✅ test-sync.ts (HMAC + packages + logs) |
| REQ-2.3.2 同步策略 | ✅ test-sync.ts (手动 trigger) |
| REQ-4.1.1 跨维度检索 | ✅ test-search.ts (not_implemented 显式) |
| REQ-4.1.2 检索性能 | ⚠️ (R.6 仅验证 not_implemented, 性能待 ES 接入) |
| REQ-4.2.1 任务管理 | ✅ test-tasks.ts (列表 + 详情 + 过滤) |
| REQ-4.2.2 任务控制 | ✅ test-tasks.ts + test-control.ts (6 commandType) |
| REQ-4.2.3 巡检 | ✅ test-control.ts (inspect_start) |
| REQ-4.3.2 盘笼查询 | (R.6 未覆盖) |
| REQ-5.1.1 日志采集 | ✅ test-sync.ts (sync_table_log) |
| REQ-6.2.1 HMAC | ✅ test-sync.ts (401 无签名) |

---

## 2. Requirement 原始文本 (R.6 不实施新需求, 无原文摘录)

> R.6 范围严格, 不改任何需求。R.5 已读 requirements.md 全文, R.6 验证历史 Sprint 实施与 R.1 §10 强约束合规性。

---

## 3. 需求状态枚举 (8 选 1, R.6 维持 R.4 数字)

| 状态 | R.2 | R.3 | R.4 | **R.6** | Δ vs R.4 |
|---|---|---|---|---|---|
| **complete** | 9 | 7 | 7 | **7** | ±0 (R.6 修 e2e, 不增能力) |
| **partial** | 11 | 12 | 13 | **13** | ±0 |
| **not_started** | 7 | 8 | 8 | **8** | ±0 |
| **blocked_by_source_schema** | 5 | 5 | 6 | **6** | ±0 |
| **blocked_by_site_change** | 5 | 5 | 5 | **5** | ±0 |
| **blocked_by_auth** | 7 | 7 | 9 | **9** | ±0 |
| **blocked_by_external_system** | 0 | 2 | 2 | **2** | ±0 |
| **out_of_scope** | 2 | 0 | 0 | **0** | ±0 |
| **合计** | 43 | 45 | 45 | **45** | ±0 |
| **完成率** | 22.0% | 15.6% | **15.6%** | **15.6%** | ±0 |

**R.6 完成率 15.6% 维持**, R.6 仅建立测试基线, 不增加能力。

---

## 4. 实现明细 (R.6 改动文件)

| 文件 | 类型 | R.6 改动 |
|---|---|---|
| `scripts/e2e/test-dashboard.ts` | 占位 → 真实 | 9 项验证 (R.4 修复 dataSource 显式 + siteCode 切换) |
| `scripts/e2e/test-tasks.ts` | 占位 → 真实 | 11 项验证 (含 /api/tasks/[id] R.4 修复) |
| `scripts/e2e/test-sync.ts` | 占位 → 真实 | 9 项验证 (含 HMAC + failed 直查) |
| `scripts/e2e/test-control.ts` | 占位 → 真实 | 19 项验证 (6 commandType POST + 状态机 + 前端 toast) |
| `scripts/e2e/test-sites.ts` | 占位 → 真实 | 9 项验证 (R.4 derived 修复) |
| `scripts/e2e/test-search.ts` | 占位 → 真实 | 13 项验证 (R.4 显式 not_implemented) |
| `docs/database-analysis/sprint-r.6-e2e-event-test-implementation.md` | **新建** | R.6 实施细节 (70/70 + 修复 3 类) |
| `docs/database-analysis/sprint-r.6-requirements-review.md` | **新建** (本文件) | R.1 模板严格审查 |
| `docs/summary/PROJECT_STATUS.md` | 修改 | R.6 段 |
| `docs/summary/ROADMAP.md` | 修改 | R.6 段 |

**R.6 范围严格**:
- 0 业务代码
- 0 新增 API
- 0 新增页面
- 0 新增表
- 0 修改 DB
- 仅: 6 占位 → 真实 e2e 脚本 + 2 文档 + 2 段

---

## 5. 后端真实能力 (R.6 验证)

| REQ-ID | R.6 测试 | 真实能力 |
|---|---|---|
| REQ-2.1.1 站点 | test-sites.ts ✅ | derived 7 站点, 0 mock |
| REQ-2.3.1 同步 | test-sync.ts ✅ | packages 81 + table log + HMAC |
| REQ-4.1.1 检索 | test-search.ts ✅ | 501 not_implemented + blocker |
| REQ-4.2.1 任务 | test-tasks.ts ✅ | 87 行 + /api/tasks/[id] 接 unified_tasks |
| REQ-4.2.2 控制 | test-control.ts ✅ | 6 commandType 60+ 行, 4 状态 (pending/dry_run_success/failed/success) |
| REQ-4.2.3 巡检 | test-control.ts ✅ | inspect_start POST 真实 |

---

## 6. UI 真实能力 (R.6 验证)

| 元素 | R.6 验证 |
|---|---|
| /tasks 详情 (R.4 修复) | ✅ 接 unified_tasks |
| /search banner (R.4 修复) | ✅ useEffect + amber AlertTriangle |
| /sites derived (R.4 修复) | ✅ 7 站点真 |
| /control 6 commandType (R.4) | ✅ priority + 5 others |
| /tasks 按钮 toast | ✅ "已提交" 合规 (R.1 §7) |
| /tasks 按钮 (R.1 §7) | ✅ 无 "暂停成功" / "已暂停" 误导 |

---

## 7. Mock / Simulator / DRY_RUN / 真控制 4 区分 (R.6 验证)

| 维度 | R.6 测试 |
|---|---|
| 链路 (control_command → worker → audit_log) | ✅ 100% (60+ 行) |
| DRY_RUN 模拟 | ✅ 100% (dry_run_success 显式区分 success) |
| UI 完成 | ✅ 50% (3/6 原子: 暂停/恢复/重置 按钮接通) |
| 真控制 | ❌ 0% (170 张站点表 0 paused/priority, 等站点配合) |
| mock 冒充 | ✅ 已禁止 (R.1 §7 + test-sites/test-search 验证) |
| silent fallback | ✅ 已禁止 (R.4 修复 executor + /api/sites 不 mock) |

---

## 8. 缺失件 (R.6 维持 R.4 状态)

> R.6 不减少/增加缺失件, 仅建立 e2e 基线。

| 缺失件 | R.6 状态 |
|---|---|
| 🔴 Playwright 真实浏览器 | ⚠️ R.6 未实施, R.7+ 候选 |
| 🔴 console.error / React warning 检测 | ⚠️ R.6 无真实 DOM |
| 🔴 network 错误 UI 表现 | ⚠️ R.6 仅 HTTP 验证 |

**R.6 不新增任何业务缺失件** (R.4 6 个 bug 修复 + R.5 测试基线 → R.6 实施)。

---

## 9. Blocker 类型 (8 选 1, R.6 维持 R.4)

> R.6 不改需求 / 不改状态。

| Blocker | 数量 | R.6 状态 |
|---|---|---|
| complete | 7 | 维持 |
| partial / not_started, 0 阻塞 | 21 | 维持 |
| blocked_by_source_schema | 6 | 维持 |
| blocked_by_site_change | 5 | 维持 |
| blocked_by_auth | 9 | 维持 |
| blocked_by_external_system | 2 | 维持 |
| out_of_scope | 0 | 维持 (R.4 修正) |

---

## 10. 源端/站点 API 变更清单 (R.6 维持 R.4 状态, 不变)

---

## 11. requirements 完成率 (R.6 公式)

```
R.6 requirements 完成率 = complete / (total - out_of_scope) × 100%
                        = 7 / (45 - 0) × 100%
                        = 7 / 45 × 100%
                        = 15.6%
```

**R.6 完成率不变** (R.6 修测试, 不增能力)。

| 维度 | R.2 | R.3 | R.4 | **R.6** |
|---|---|---|---|---|
| 完成率 | 22.0% | 15.6% | 15.6% | **15.6%** |

**R.6 价值**: 数字未变, 但**测试基线建立** — 后续 Sprint 重算数字时, 70 项 e2e 用作验证。

---

## 12. 最终判决 (Verdict)

### Verdict: `pass` (R.6 自身)

**理由**:
- ✅ **6 个 e2e 脚本从占位改为真实可运行**, 70/70 通过
- ✅ **0 业务代码, 0 新增 API/页面/表** (严格符合 CLAUDE.md §10)
- ✅ **0 改需求, 0 降级, 0 伪造完成** (R.1 §1 强约束遵守)
- ✅ **5 项验证全绿**: tsc / build / smoke / e2e:worker / e2e:all
- ✅ **修复 3 类问题**: TS2451 / HTTP 201 / 同步包 failed 验证
- ✅ **9 项 Sprint review 模板 (A-I) 全部填写**
- ✅ **mock/simulator/DRY_RUN 显式标记** (R.1 §7)

**R.6 不做的事** (R.6 范围外):
- ❌ 不实施新功能
- ❌ 不新增页面/表/API
- ❌ 不宣称"需求完成 X%" (R.6 完成率仍 15.6%)
- ❌ 不修改统一库 / 业务逻辑
- ❌ 不删除目录 / 不删除数据库

**R.6 价值**:
- 测试基线从 0 → 70 (e2e 自动化)
- 后续 Sprint 验证不再靠人, 靠 e2e:all
- 修复 3 类隐藏问题 (TS / 201 / failed 验证)

**领导决策项** (R.6 维持 R.4 列出):
- A. **REQ-2.2.1 ADFS** — 解锁 CLAUDE.md, 带动 7 项
- B. **站点表能否加 paused/priority 字段** — 任务控制真控制前提
- C. **站点 app 能否 poll `control_command`** — 真执行前提
- D. **是否引入 ES/ClickHouse** — REQ-4.1.x 千万级检索
- E. **是否提供真站点 API 文档** — 跨站通信前提

---

## 13. 提交前检查清单 (R.1 强制)

- [x] §1 R.6 涉及 REQ ID 已列
- [x] §3 每个 REQ 状态枚举 (维持 R.4)
- [x] §4 R.6 修改文件已列
- [x] §5 后端真实能力验证 (R.6 测试)
- [x] §6 UI 真实能力验证 (R.6 测试)
- [x] §7 mock/simulator/DRY_RUN 显式标记
- [x] §8 缺失件不隐藏
- [x] §9 blocker 类型 8 选 1
- [x] §10 站点 schema/API 变更清单 (R.4 维持, 不变)
- [x] §11 requirements 完成率 15.6% 已计算
- [x] §12 verdict: pass
- [x] 文件命名 `sprint-r.6-requirements-review.md` 放 `docs/database-analysis/`
- [x] PROJECT_STATUS.md / ROADMAP.md 同步更新

---

## 附录 A: 9 项 Sprint 验收模板 (R.5 §7 强制) 完成情况

### A. Requirement 对照 ✅

11 项 REQ 测试覆盖 (见 §1)

### B. 前端变更清单 (8 项强制披露, R.5 §0)

- [x] **新增了哪些页面/组件**: 0 (R.6 范围严格)
- [x] **修改了哪些按钮/交互**: 0
- [x] **删除了哪些按钮/交互**: 0
- [x] **哪些是 UI-only**: 0 (无 UI 变更)
- [x] **哪些是真实后端能力**: 0 (R.6 不动业务)
- [x] **哪些只是 simulator / DRY_RUN**: 0 (无业务)
- [x] **是否新增了 requirements.md 未要求的内容**: **否** (e2e 脚本是测试基线, 不算业务)
- [x] **如果新增了: 必须说明理由**: N/A

### C. API 变更清单 ✅

| 端点 | 变更类型 | 真实/mock/fallback | 验证 |
|---|---|---|---|
| (无 API 变更) | — | — | R.6 范围 |

### D. 数据库变更清单 ✅

| 表 | 变更类型 | 真实数据 | 证据 |
|---|---|---|---|
| (无 DB 变更) | — | — | R.6 范围 |

### E. 事件测试清单 (10 项, R.5 §1.1) ✅

- [x] **用户在哪里点击**: e2e 脚本覆盖 6 页面 70 项
- [x] **点击前页面状态**: HTTP 200 + 字段非空
- [x] **点击后请求 API**: POST control_command 6 种 + 5 字段验证
- [x] **API 返回**: HTTP 201 (POST) / 200 (GET) / 501 (search)
- [x] **数据库变化**: control_command 60+ 行 + audit_log
- [x] **页面刷新**: N/A (R.6 无真实浏览器)
- [x] **toast 准确**: "已提交" 合规 (R.1 §7 验证)
- [x] **mock/fallback**: 禁止 (R.4 修复 + R.6 验证)
- [x] **误导用户**: 按钮文案合规 (R.6 grep 验证)
- [x] **符合 requirements.md**: 11 项 REQ 关联

### F. 浏览器验证结果 ✅

| 页面 | URL | HTTP | 关键 HTML/CSS 状态 | 截图 |
|---|---|---|---|---|
| / | http://localhost:3000/ | 200 | e2e:dashboard ✅ | (R.7 Playwright) |
| /tasks | http://localhost:3000/tasks | 200 | e2e:tasks ✅ | (R.7 Playwright) |
| /api/tasks/[id] | ... | 200 | 字段真实 | N/A |
| /sync | http://localhost:3000/sync | 200 | e2e:sync ✅ | (R.7) |
| /control | http://localhost:3000/control | 200 | e2e:control ✅ | (R.7) |
| /sites | http://localhost:3000/sites | 200 | e2e:sites ✅ | (R.7) |
| /search | http://localhost:3000/search | 200 | e2e:search ✅ | (R.7) |

### G. mock/simulator/DRY_RUN 标记 ✅

| 元素 | 类型 | 显式标记 | 状态 |
|---|---|---|---|
| /api/sites | derived | dataSource=derived | ✅ |
| /api/search | not_implemented | source=not_implemented | ✅ |
| /api/sync/package | HMAC | 401 无签名 | ✅ |
| executor task_pause (DRY_RUN) | dry_run_success | status=dry_run_success | ✅ |
| /api/alerts | database (老) | source=null | 接受 (R.6 验证) |
| /api/dashboard/* | database | source=database | ✅ |

### H. 未完成项 ✅

| # | 项 | 原因 | 下一 Sprint |
|---|---|---|---|
| 1 | Playwright 浏览器截图 | R.6 沙箱无 | R.7+ |
| 2 | console.error 检测 | 无真实 DOM | R.7+ |
| 3 | New task POST 端到端 | R.6 范围 | R.7+ |
| 4 | 6 脚本扩展 (新页面/按钮) | 现有覆盖足够 | 后续按需 |

### I. **是否允许 commit** ✅

- [x] A 11 项 REQ 测试覆盖
- [x] B 8 项前端披露 (0 业务变更)
- [x] C 0 API 变更
- [x] D 0 DB 变更
- [x] E 10 项事件测试 (70/70 通过)
- [x] F 浏览器 HTTP 验证 (截图 R.7+)
- [x] G mock/simulator/DRY_RUN 显式标记
- [x] H 未完成项明确 (R.7+ 候选)
- [x] **CLAUDE.md §10 强约束 10 项禁止无违反**

**Verdict**: `pass` ✅

---

## 附录 B: 引用

- **R.5 模板**: `docs/database-analysis/frontend-event-test-standard.md`
- **R.5 强约束**: `CLAUDE.md` §10
- **R.4 修复**: `docs/database-analysis/sprint-r.4-requirements-review.md`
- **R.6 实施细节**: `docs/database-analysis/sprint-r.6-e2e-event-test-implementation.md`
- **R.2 矩阵**: `docs/database-analysis/requirements-traceability.md` (R.4 修正 4 处, 维持 R.6)
