# Sprint R.3 — Historical Misjudgement (历史误判打假)

> **日期**: 2026-06-10
> **原则**: 不相信任何历史 Sprint 结论; R.3 重算所有数字
> **范围**: Sprint 3.0 / 3.0R / 4.0 / 4.5 / 4.8.2 / 4.8.2-R / R.1 / R.2 全部

---

## 0. TL;DR

| 类别 | 数量 | 严重度 |
|---|---|---|
| 历史被高估的功能 | 5 项 | 🔴 |
| 历史被低估的功能 | 5 项 | ✅ |
| 历史错误结论 | 5 项 | 🔴 |
| 当前最大谎言 | 1 项 | 🔴 |
| 当前最大惊喜 | 1 项 | ✅ |

---

## A. 历史被高估的功能 (5 项)

### A.1 "业务完成度 85%" (Sprint 3.0)

**声明**: Sprint 3.0 业务完成度 85%

**真实度**: 误导

**证据**:
- 4/4 同步类型 (设备/文件/权限/任务) 100% 覆盖
- 但只占 **4 个 REQ** (REQ-2.3.1 + REQ-5.1.1 + 部分 REQ-2.1.1/3.1.1)
- 不等于**业务** 85%
- requirements 43 项中只 ~9 项 complete, 真实 22.0% (R.2) / 15.6% (R.3)

**R.3 修正**: "**同步链路完成度 100%** (4/4 类型), requirements 完成度 15.6% (7/45)"

### A.2 "需求完成度 22.0%" (R.2)

**声明**: R.2 报告 9/41 = 22.0%

**真实度**: 偏高 6.4%

**证据**:
- REQ-4.1.1 检索 R.2 标 partial, 实际 /api/search 404 → not_started
- REQ-4.2.1 新建任务 R.2 标 partial, 实际 /api/tasks POST 不存在 → not_started
- REQ-2.2.2 账号映射 R.2 标 out_of_scope, 实际是 blocked_by_auth (违反 R.1 §1)
- REQ-3.2.1 权限分配 R.2 标 out_of_scope, 实际是 blocked_by_auth
- REQ-4.1.1/4.1.2 检索性能 R.2 标 partial/blocked_by_source_schema, 实际是 blocked_by_external_system (ES)
- /api/tasks/[id] R.2 隐含 pass, 实际 100% 404

**R.3 重算**: 7/45 = **15.6%**

### A.3 "/api/sites 真实数据" (R.2 隐含)

**声明**: /api/sites 是真实 API

**真实度**: **完全假**

**证据**:
```typescript
// app/api/sites/route.ts
import { sites as mockSites } from "@/lib/mock/sites"  // 🔴 100% mock
```

- 6 站点 (上海/北京/广州/成都/南京/武汉) 全是 mock
- `unified_sites` 表 0 行
- /api/sites 路由**从不读真实表**

**R.3 修正**: R.2 未发现。`/sites` 真实度 10/100。

### A.4 "Sprint 4.8.2-R 暂停/恢复/重置按钮接通" (隐含 "控制能力完成")

**声明**: Sprint 4.8.2-R 恢复 3 按钮, 通路 OK

**真实度**: 部分 (按钮接通 OK, 但 executor L342 假执行)

**证据**:
- 按钮接通 ✅
- POST /api/control/commands ✅ (37 行真实)
- audit_log 写入 ✅ (35 行)
- **executor.ts L342 用 centralQuery 假执行** — Sprint 4.8.2-R 未发现
- 3 个 success 的 task_pause 实际**没改 `tbl_task`**

**R.3 修正**: 框架完成 100%, **真控制 0%**

### A.5 "/api/tasks 真实" (R.2 隐含)

**声明**: 87 任务真数据, complete

**真实度**: 部分 (列表真, 详情 404)

**证据**:
- 列表 `/api/tasks` 返回 87 行, ID 真实
- 详情 `/api/tasks/[id]` **100% 404** (DB 有 87 行, 路由坏了)
- 详情抽屉 (Eye 按钮) 打开就 404

**R.3 修正**: 列表 100/100, 详情 0/100

---

## B. 历史被低估的功能 (5 项)

### B.1 HMAC 鉴权 (Sprint 2G.1)

**R.2 评价**: complete

**R.3 评价**: complete ✅ (但实际更精确: HMAC + 5min + rawBody + timingSafeEqual, 401 无签名确认)

**真实度**: **100/100** (R.3 验证 HTTP 401)

### B.2 audit_log 1:1 关联 (Sprint 4.8.1)

**R.2 评价**: complete

**R.3 评价**: complete ✅ (35 行真实, 与 control_command 1:1)

**真实度**: **100/100**

### B.3 Volumes aggregate (Sprint 2H.3)

**R.2 评价**: complete

**R.3 评价**: complete ✅ (3 行真实 aggregate)

**真实度**: **100/100**

### B.4 Tasks 列表 runtime (Sprint 2H.5)

**R.2 评价**: complete (隐含)

**R.3 评价**: complete ✅ (33/44 任务真实 runtime)

**真实度**: **100/100**

### B.5 Racks 17 设备

**R.2 评价**: complete (隐含)

**R.3 评价**: complete ✅ (17 设备真, DL_BJ02_001 真)

**真实度**: **100/100**

---

## C. 历史错误结论 (5 项, R.3 推翻)

### C.1 "170 张表 0 paused/priority 字段 = 真实控制无法实现"

**来源**: Sprint 4.8.2-R

**错误之处**: 严格说没错 (170 表 0 命中), 但**未提**:
- 中心库 `unified_tasks` 有 `status` 字段 (含 8 行 paused 历史)
- 5 张候选 control 表 (`tbl_check_patrol_task` 等) schema 完整, 0 行
- 缺一半图景

**R.3 修正**:
- 站点表 0 paused/priority 字段 ✅ 准确
- 中心库 8 行 paused 真实 ✅ 准确 (但与 Sprint 4.8.2-R 无关)
- 5 张候选表 schema 完整, 0 行 ✅ 准确 (Sprint 4.8.2-R 未提)

### C.2 "Sprint 4.8.2-R 3 个 task_pause success"

**来源**: Sprint 4.8.2-R

**错误之处**: success 标签**不代表真控制成功**

**证据**:
- 3 个 success 的 target_id=1 (真统一任务)
- executor.ts L342 用 centralQuery 假执行
- `tbl_task.id=1` **实际未改** (docker exec psql 验证)
- success 只是 worker 主循环没出错

**R.3 修正**:
- 3 个 success 是 audit 链路成功, 不是真控制成功
- 真控制成功标准: `tbl_task.paused` 字段被改 (但无此字段)

### C.3 "8 行 unified_tasks.paused = 任务控制完成度证据"

**来源**: R.2 隐含

**错误之处**: 8 行 paused 是 Sprint 2F.1 之前**历史数据**

**证据**:
- Sprint 2F.1 加 status 字段时已含 8 行 paused (mock seed 或迁移遗留)
- Sprint 4.8.2-R 真实 3 个 task_pause (ui-sim) **全部 failed** (task not found)
- 8 行 paused 与 Sprint 4.8.2-R **无关**

**R.3 修正**:
- 8 行 paused 是历史, 不应作为"任务控制完成"证据
- 真控制完成度仍是 0%

### C.4 "out_of_scope 2 项 (REQ-2.2.2 / 3.2.1)"

**来源**: R.2

**错误之处**: **违反 R.1 §1 强约束** ("不允许把需求降级 / 删除")

**证据**:
- REQ-2.2.2 账号映射: CLAUDE.md 禁 + 源端无 AD 通道 → 真实是 `blocked_by_auth + blocked_by_site_change`
- REQ-3.2.1 权限分配: CLAUDE.md 禁 + 源端无 role → 真实是 `blocked_by_auth + blocked_by_source_schema`

**R.3 修正**:
- out_of_scope 0 项 (R.2 误把 2 个需求软关闭)
- 改回 `blocked_by_auth`

### C.5 "5 个 commandType 全部 audit, 链路 100%"

**来源**: Sprint 4.8.2-R / R.2

**错误之处**: 链路 100% OK, 但**漏了优先恢复**

**证据**:
- COMMAND_TYPES 只有 5 个: task_pause / task_resume / task_reset / inspect_start / recovery_start
- **没有 priority commandType**
- 优先恢复 REQ-4.2.2 (支持优先执行恢复任务) **完全未实现**

**R.3 修正**:
- 5 commandType 链路 100% ✅
- 但**优先恢复 0%** (不是 partial, 是 not_started)

---

## D. 当前最大谎言

### "站点数据真实可用"

**证据**:
- `/api/sites` 返回 6 站点 (上海/北京/广州/成都/南京/武汉)
- 用户**看到的是真数据**
- 实际: 100% 来自 `@/lib/mock/sites`
- `unified_sites` 表 0 行
- Dashboard `siteCount: 11` 是 mock 6 + DB 5 拼接

**影响**:
- 站点列表是假的, 不能用于生产决策
- 站点配置 (REQ-2.1.1) 真实度 0%
- 用户看到假数据但不知道

**修复**: 改 `/api/sites/route.ts` 读 `unified_sites` 表

---

## E. 当前最大惊喜

### HMAC-SHA256 鉴权真工作

**证据**:
```bash
# 无签名 → 401
curl -X POST http://localhost:3000/api/sync/package \
  -H "content-type: application/json" -d '{}'
# {"code":401,"message":"x-signature header is required","errorCode":"MISSING_SIGNATURE"}
```

- HMAC-SHA256 ✅
- 5min window ✅ (Sprint 2G.1)
- rawBody 优先签名 ✅
- timingSafeEqual ✅

**意义**:
- 5/21 (24%) API 有真鉴权
- 证明: 鉴权能力**真能实现**, 不缺技术
- 其他 16 个 API 缺的是时间和决策, 不是能力

**应用**: 把 HMAC 模式扩展到 `/api/control/commands` POST (现在无 HMAC)

---

## F. 历史 Sprint 评分 (R.3 重判)

| Sprint | 声明 | R.3 评分 |
|---|---|---|
| Sprint 3.0 业务价值审计 | "85% 业务完成度" | 50 (措辞误导) |
| Sprint 3.0R 需求对照 | "28.1% 需求完成" | 70 (颗粒度粗) |
| Sprint 4.0 40 原子矩阵 | 9 字段 | 60 (未用 R.1 18 字段) |
| Sprint 4.5 control_command MVP | "框架完成" | 90 (准确) |
| Sprint 4.8.2 真相审计 | "D 完全没有" | 70 (结论片面) |
| Sprint 4.8.2-R 170 表重审 | "A+B+C 部分支持" | 75 (缺 executor L342 假执行) |
| R.1 9 大强约束 | "一票否决" | 95 (R.3 验证遵守) |
| R.2 43×18 矩阵 | "22.0% 完成" | 60 (实际 15.6%, 2 个 out_of_scope 违规) |

**平均 R.3 重判**: **70/100** (R.2 严重高估)

---

## G. 结论

R.3 推翻 R.2 5 项关键结论, 推翻 Sprint 4.8.2-R 1 项 (executor L342 假执行), 修正 R.1 强约束 1 项违规 (out_of_scope)。

**核心修正**:
- 22.0% → **15.6%** (真实完成率)
- 43 项 → **45 项** (R.2 漏 2 项 blocked_by_external_system)
- 优先恢复 partial → **not_started** (0%)
- 8 行 paused 与 Sprint 4.8.2-R 无关
- executor L342 假执行 (历史 Sprint 漏掉)

**下一 Sprint R.4**: 修 4 个🔴 bug + 补 priority commandType + 重算 traceability。
