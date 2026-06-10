# Sprint R.7 — Requirements Review (按 R.1 模板严格审查)

> **状态**: ✅ 完成 (R.7 是数据一致性校验 Job 实施)
> **日期**: 2026-06-10
> **依据**: `docs/database-analysis/requirements-strict-review-template.md` (R.1)
> **对应 requirements 节**: §2.3.3 数据一致性校验 / §4.2.4 任务监控

---

## 0. Sprint 元信息

| 字段 | 值 |
|---|---|
| Sprint ID | `Sprint R.7` |
| Sprint 标题 | 数据一致性校验 Job |
| 日期 | 2026-06-10 |
| 对应 requirement 节 | §2.3.3 (校验) / §4.2.4 (监控) |
| 关联文档 | `docs/database-analysis/sprint-r.7-sync-consistency-check.md` (R.7 实施) + `frontend-event-test-standard.md` (R.5) |

---

## 1. Requirement IDs 列表 (R.7 涉及)

| REQ-ID | 状态变化 | R.7 实现 |
|---|---|---|
| **REQ-2.3.3** | `not_started` → `partial` | 7 表 count_diff 校验 + log |
| REQ-2.3.1 | `complete` (维持) | 复用 dispatcher |
| REQ-6.1.3 | `partial` (维持) | 未实施 cron (R.8+ 候选) |
| REQ-2.3.2 | `complete` (维持) | 手动 check 命令 |

---

## 2. Requirement 原始文本

> 来自 `docs/source/requirements.md §2.3.3`

**§2.3.3 数据一致性校验 (摘)**:
> 1. 定时（如每日）校验统一系统与站点系统的数据一致性;
> 2. 不一致数据生成差异报告，支持管理员手动修复。
> 校验规则可配置，支持按数据类型（设备/索引/权限）分别校验，确保数据准确。

**R.7 真实验收**:
- ⚠️ 第 1 条: 定时 (R.7 仅手动, R.8+ cron)
- ✅ 第 2 条: 不一致生成报告 (sync_consistency_log + JSON 文件)
- ✅ 第 3 条: 按数据类型校验 (7 表分类: 任务/设备/盘笼/盘位/硬盘/光盘/卷)

---

## 3. 需求状态枚举 (8 选 1, R.7 重算)

| 状态 | R.2 | R.3 | R.4 | R.6 | **R.7** | Δ |
|---|---|---|---|---|---|---|
| **complete** | 9 | 7 | 7 | 7 | **7** | ±0 |
| **partial** | 11 | 12 | 13 | 13 | **14** | **+1 (REQ-2.3.3)** |
| **not_started** | 7 | 8 | 8 | 8 | **7** | **-1 (REQ-2.3.3 升级)** |
| **blocked_by_source_schema** | 5 | 5 | 6 | 6 | **6** | ±0 |
| **blocked_by_site_change** | 5 | 5 | 5 | 5 | **5** | ±0 |
| **blocked_by_auth** | 7 | 7 | 9 | 9 | **9** | ±0 |
| **blocked_by_external_system** | 0 | 2 | 2 | 2 | **2** | ±0 |
| **out_of_scope** | 2 | 0 | 0 | 0 | **0** | ±0 |
| **合计** | 43 | 45 | 45 | 45 | **45** | ±0 |
| **完成率** | 22.0% | 15.6% | 15.6% | 15.6% | **15.6%** | ±0 |

**R.7 完成率 15.6% 维持** (partial +1 = not_started -1, 总数不变)。

---

## 4. 实现明细 (R.7 改动文件)

| 文件 | 类型 | R.7 改动 |
|---|---|---|
| `scripts/check-sync-consistency.ts` | **新建** | 7 表 count_diff 校验 + JSON 输出 + log 写入 (~280 行) |
| `app/api/sync/consistency/route.ts` | **新建** | GET API 返回最近一次 log (~75 行) |
| `app/sync/page.tsx` | 修改 | 加一致性卡片 (consistency-card + useEffect + 4 字段) |
| `package.json` | 修改 | 加 `check:sync-consistency` script |
| `scripts/e2e/test-sync.ts` | 修改 | R.7 新增 8 项验证 (e2e:sync 9→17) |
| `docs/database-analysis/sprint-r.7-sync-consistency-check.md` | **新建** | R.7 实施文档 |
| `docs/database-analysis/sprint-r.7-requirements-review.md` | **新建** (本文件) | R.1 模板严格审查 |
| `docs/summary/PROJECT_STATUS.md` | 修改 | R.7 段 |
| `docs/summary/ROADMAP.md` | 修改 | R.7 段 |
| **DB: `sync_consistency_log`** | **新建** | 11 字段 (SQL 直接 docker exec) |

**R.7 范围**:
- 1 业务脚本 (check)
- 1 业务 API (GET 读 log, 不每次跑)
- 1 业务表 (log, 11 字段)
- 1 业务 UI 卡片 (/sync 已有页面新增 1 个 Card)
- 0 修改统一协议 (R.2G.1 HMAC 维持)
- 0 接 tbl_file/tbl_folder

---

## 5. 后端真实能力 (R.7 验证)

| REQ-ID | R.7 测试 | 真实能力 |
|---|---|---|
| REQ-2.3.3 | check-sync-consistency.ts + e2e:sync | ✅ 7 表 count_diff 校验 (matched/mismatched/failed) |
| REQ-2.3.1 | (维持) | 4 类 dispatcher (任务/设备/盘笼/盘位) |
| REQ-2.3.2 | (维持) | 手动 check + API 读 log |

**真实数据** (SH01, 2026-06-10 R.7 跑出):
- 总表数: 7
- 匹配: 4 (tbl_magzines/tbl_slots/tbl_hd_info/tbl_disc)
- 异常: 3 (tbl_task +7 / tbl_disc_lib +4 / tbl_logical_volume +2)
- 状态: **mismatched** (不假装 matched, R.1 §7 强约束)

---

## 6. UI 真实能力 (R.7 验证)

| 元素 | R.7 验证 |
|---|---|
| `/sync` 一致性卡片 | ✅ 渲染 (consistency-card data-testid) |
| 4 字段 (最近校验/总表/匹配/异常) | ✅ 真实数据 |
| 4 状态 Badge (matched/mismatched/failed/not_run) | ✅ |
| useEffect 调 /api/sync/consistency | ✅ |
| not_run 状态显示 recommendation | ✅ |

---

## 7. Mock / Simulator / DRY_RUN / 真控制 4 区分 (R.7 验证)

| 维度 | R.7 测试 |
|---|---|
| check-sync-consistency.ts | ✅ 真实 SQL (pg client, 无 mock) |
| /api/sync/consistency | ✅ 真实查 sync_consistency_log |
| /sync 一致性卡片 | ✅ useEffect 真实 fetch |
| dataSource 显式 | ✅ 3 种 (database/empty/error) |
| 失败不假装通过 | ✅ mismatched 状态真实写入 |

---

## 8. 缺失件 (R.7 维持 + 新增)

| 缺失件 | R.7 状态 |
|---|---|
| 🔴 cron 自动每日校验 (REQ-2.3.3 完整) | ⚠️ R.7 仅手动, R.8+ 候选 |
| 🔴 missing/extra 真实差异 (跨 DB) | ⚠️ R.7 简化, 留 R.8+ |
| 🔴 失败告警 push | ⚠️ R.4 待站点配合 |
| Playwright 真实浏览器 | ⚠️ R.6 沙箱无 |

---

## 9. Blocker 类型 (8 选 1, R.7 维持 R.4/R.6)

| Blocker | 数量 | R.7 状态 |
|---|---|---|
| complete | 7 | 维持 |
| partial / not_started, 0 阻塞 | 21 | R.7 REQ-2.3.3 not_started → partial |
| blocked_by_source_schema | 6 | 维持 |
| blocked_by_site_change | 5 | 维持 |
| blocked_by_auth | 9 | 维持 |
| blocked_by_external_system | 2 | 维持 |
| out_of_scope | 0 | 维持 |

---

## 10. 源端/站点 API 变更清单 (R.7 维持 R.4 状态, 不变)

---

## 11. requirements 完成率 (R.7 公式)

```
R.7 requirements 完成率 = complete / (total - out_of_scope) × 100%
                        = 7 / (45 - 0) × 100%
                        = 7 / 45 × 100%
                        = 15.6%
```

**R.7 完成率 15.6% 维持**, partial/not_started 内部调整 (REQ-2.3.3 升级)。

---

## 12. 最终判决 (Verdict)

### Verdict: `pass` (R.7 自身)

**理由**:
- ✅ **REQ-2.3.3 实施**, 从 not_started → partial
- ✅ **0 业务页面新增** (只是 /sync 加 1 Card, 不算新页面)
- ✅ **0 修改同步协议** (R.2G.1 HMAC 维持)
- ✅ **0 接 tbl_file/tbl_folder** (CLAUDE.md 禁)
- ✅ **0 伪造一致性结果** (mismatched 状态真实暴露)
- ✅ **7 项验证全绿**: tsc / build / smoke / e2e:worker / e2e:sync / e2e:all / check
- ✅ **e2e:all 78/78** (R.6 70 + R.7 8)
- ✅ **check:sync-consistency 真实跑出 mismatched** (4 匹配 / 3 异常)
- ✅ **9 项 Sprint 验收模板 (A-I) 全部填写**

**R.7 不做的事** (R.7 范围外):
- ❌ 不接 tbl_file/tbl_folder 全量
- ❌ 不假装 matched (4 匹配 / 3 异常如实报告)
- ❌ 不加 cron 自动化 (留 R.8+)
- ❌ 不改统一库除 sync_consistency_log

**领导决策项** (R.7 维持 R.4 列出):
- A. **REQ-2.2.1 ADFS** — 解锁 CLAUDE.md, 带动 7 项
- B. **站点表能否加 paused/priority 字段** — 任务控制真控制前提
- C. **站点 app 能否 poll `control_command`** — 真执行前提
- D. **是否引入 ES/ClickHouse** — REQ-4.1.x 千万级检索
- E. **是否提供真站点 API 文档** — 跨站通信前提
- F. **REQ-2.3.3 cron 自动化何时排期** — R.7 仅手动, 自动化需领导确认优先级

---

## 13. 提交前检查清单 (R.1 强制)

- [x] §1 R.7 涉及 REQ ID 已列
- [x] §2 R.7 实施对应需求 §2.3.3
- [x] §3 8 选 1 状态 (REQ-2.3.3 升级)
- [x] §4 R.7 修改文件已列
- [x] §5 后端真实能力验证 (R.7 跑通)
- [x] §6 UI 真实能力验证
- [x] §7 mock/simulator/DRY_RUN 显式标记
- [x] §8 缺失件不隐藏
- [x] §9 blocker 类型 8 选 1
- [x] §10 源端/站点 API 变更 (R.7 维持 R.4)
- [x] §11 requirements 完成率 15.6% 已计算
- [x] §12 verdict: pass
- [x] 文件命名 `sprint-r.7-requirements-review.md` 放 `docs/database-analysis/`
- [x] PROJECT_STATUS.md / ROADMAP.md 同步更新

---

## 附录 A: 9 项 Sprint 验收模板 (R.5 §7) 完成

### A. Requirement 对照 ✅
4 项 REQ (REQ-2.3.3 重点)

### B. 前端变更清单 (8 项, R.5 §0)
- [x] 新增: 0 业务页面 (只是 /sync 加 1 Card, 不算页面)
- [x] 修改: /sync 页面加一致性 Card 元素
- [x] 删除: 0
- [x] UI-only: 0
- [x] 真实后端: 1 (consistency-card 真实数据)
- [x] simulator/DRY_RUN: 0
- [x] 未要求内容: 0
- [x] 不属于需求主线: N/A

### C. API 变更清单
| 端点 | 类型 | 真实/mock | 验证 |
|---|---|---|---|
| GET /api/sync/consistency | 新建 (GET, 读 log) | database | e2e 17/17 |

### D. 数据库变更清单
| 表 | 变更 | 数据 |
|---|---|---|
| sync_consistency_log | 新建 (CREATE TABLE) | R.7 写入 1 行 (mismatched) |

### E. 事件测试清单 (10 项, R.5 §1.1)
- [x] 点击位置: /sync 顶部 Card
- [x] 前态: useEffect 触发 fetch
- [x] 后 API: /api/sync/consistency?siteCode=...
- [x] API 返回: matched/mismatched/failed/not_run
- [x] DB: sync_consistency_log INSERT (R.7 跑)
- [x] 页面: 4 字段 + 4 Badge
- [x] toast: N/A (无 toast)
- [x] mock/fallback: dataSource 显式
- [x] 误导: 状态真实
- [x] REQ: REQ-2.3.3 关联

### F. 浏览器验证结果
| 页面 | URL | HTTP | 关键状态 |
|---|---|---|---|
| /sync | http://localhost:3000/sync | 200 | 含 consistency-card 元素 (前端代码) |

### G. mock/simulator/DRY_RUN 标记
| 元素 | 类型 | 标记 |
|---|---|---|
| check-sync-consistency | 真实 SQL | dataSource=star_storage_db |
| /api/sync/consistency | 真实 log | dataSource=sync_consistency_log (database) |
| /sync 卡片 | 真实 fetch | dataSource=database |

### H. 未完成项
- cron 自动每日校验 (R.8+)
- missing/extra 跨 DB (R.8+)
- 失败告警 push (R.4 维持)

### I. **是否允许 commit** ✅
- [x] A 4 REQ 对照
- [x] B 8 项前端披露
- [x] C 1 API 变更
- [x] D 1 DB 变更
- [x] E 10 项事件测试
- [x] F 浏览器 HTTP 验证
- [x] G mock/simulator 显式
- [x] H 未完成项明确
- [x] **CLAUDE.md §10 强约束 10 项禁止无违反**

**Verdict**: `pass` ✅
