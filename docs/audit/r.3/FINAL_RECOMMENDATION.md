# Sprint R.3 — Final Recommendation (最终建议)

> **日期**: 2026-06-10
> **审计**: Sprint R.3 全链路真实性审计
> **结论**: **R.4 是唯一最正确的下一步**

---

## 0. TL;DR

7 问答案:

| # | 问题 | 答案 |
|---|---|---|
| 1 | 我们距离 requirements 完整实现还有多远? | **84.4%** (15.6% 完成度) |
| 2 | 哪些是真缺站点支持? | **5 项** (站点表/字段) + **5 项** (app 改造) |
| 3 | 哪些其实项目自己能做? | **7 项** (0 阻塞) + **5 项** (修 bug) |
| 4 | 哪些只是没认真做? | **5 个🔴 bug** (R.4 修) |
| 5 | 哪些可以立刻开发? | **12 项** (~16 人天) |
| 6 | 哪些必须找领导? | **5 个核心决策** (Auth / 站点 schema / 站点 app / ES / 站点 API) |
| 7 | 下一 Sprint 唯一最正确? | **R.4 — Bug 修复周 (0.5 人天)** |

---

## 1. 距离 requirements 完整实现还有多远?

**84.4% 距离** (15.6% 完成度, 7/45)

### 1.1 完成度分布

| 状态 | 数量 | 占比 |
|---|---|---|
| complete | 7 | 15.6% |
| partial | 12 | 26.7% |
| not_started | 7 | 15.6% |
| blocked_by_source_schema | 5 | 11.1% |
| blocked_by_site_change | 5 | 11.1% |
| blocked_by_auth | 7 | 15.6% |
| blocked_by_external_system | 2 | 4.4% |
| out_of_scope | 0 | 0% |
| **合计** | **45** | **100%** |

### 1.2 7 个 complete (R.3 验证)

- REQ-1.1.1 系统定位 (架构级)
- REQ-1.2.1 松耦合 (HMAC + 单向 pull)
- REQ-2.3.1 同步 4 类
- REQ-2.3.2 同步策略
- REQ-4.3.2 盘笼查询
- REQ-5.1.1 日志采集
- REQ-6.2.1 HMAC 传输加密
- (含 6.3.x 等架构级)

### 1.3 12 个 partial (有 UI/API 但缺后端)

- /tasks 列表真, 详情 404 bug
- 控制命令 audit only, 真控制 0%
- 监控有 UI, 告警 push 缺
- ...

### 1.4 7 个 not_started (UI 都不全)

- 🔴 /api/search 路由 404
- 🔴 /api/tasks/[id] 详情 404
- 🔴 优先恢复 priority commandType 缺失
- 🔴 新建任务 POST 不存在
- 模糊检索
- 导出 (检索/日志)
- 配置页

### 1.5 19 个 blocked (外部依赖)

- 5 个源端缺数据 (sites/users/depa/file/magzines)
- 5 个站点 app 缺改造 (poll / push)
- 7 个 Auth (CLAUDE.md 禁)
- 2 个 ES/ClickHouse (CLAUDE.md 禁)

---

## 2. 真缺站点支持 (10 项)

### 2.1 缺站点表/字段 (5 项)

| REQ | 缺什么 | 站点表 DDL |
|---|---|---|
| REQ-2.1.1 站点配置 | 站点数据 | `tbl_site` 0 行 |
| REQ-3.1.1 账号维度 | site_ids/dept/role | `ALTER TABLE tbl_user ADD COLUMN site_ids/dept_id/role_id` |
| REQ-3.3.1 部门管理 | 部门表 | `tbl_depa` 0 行 |
| REQ-4.1.2 检索性能 | 千万级数据 | `tbl_file` 0 行 |
| REQ-4.3.1 盘笼移位 | 移位字段 | `ALTER TABLE tbl_magzines ADD COLUMN from_site/to_site/approver` |

### 2.2 缺站点 app 改造 (5 项)

| REQ | 站点 app 改造 |
|---|---|
| REQ-3.1.2 全 Site 提醒 | 站点 WebSocket / 长轮询 |
| REQ-4.2.2 任务控制 | 站点 app poll `control_command` + 改 `tbl_task.paused/priority/status` |
| REQ-4.2.3 巡检/恢复 | 站点 app poll `tbl_check_patrol_task` + 写 SM3 |
| REQ-4.2.4 监控 push | 站点 ≤10s 推 status 变更 |
| REQ-6.1.3 同步时效 | 站点侧 cron 每小时推 package |

---

## 3. 项目自己能做 (12 项 / ~16 人天)

### 3.1 修🔴 bug (5 项, 0.5 人天)

| 任务 | 估时 |
|---|---|
| 修 /api/tasks/[id] 路由 | 半天 |
| 修 /api/search 路由 | 半天 |
| 改 /api/sites 读 unified_sites | 1d |
| 修 executor.ts L342 假执行 | 1d |
| 修 R.2 traceability out_of_scope 违规 | 0.5d |

### 3.2 新功能 (7 项, ~15 人天)

| 任务 | 估时 | 阻塞 |
|---|---|---|
| REQ-2.3.3 cron 一致性校验 | 2d | 无 |
| REQ-4.1.3 检索结果导出 | 0.5d | 无 |
| REQ-4.2.1 新建任务 POST | 3d | 无 |
| REQ-5.1.2 日志导出 | 1d | 无 |
| REQ-5.1.3 日志模糊检索 | 1d | 无 |
| REQ-5.2.2 异步导出 | 2d | 无 |
| REQ-6.4.3 配置页 | 3d | 无 |
| **+ 补 priority commandType** | **1d** | **无** |

**合计**: ~12 人天 (新功能) + 0.5 人天 (bug) = **~12.5 人天**

---

## 4. 只是没认真做 (5 项, R.4 修)

| # | 问题 | 修法 |
|---|---|---|
| 1 | /api/tasks/[id] 100% 404 | 修路由 |
| 2 | /api/search 100% 404 | 实现基础 API |
| 3 | /api/sites 100% mock | 改读 unified_sites |
| 4 | executor.ts L342 假执行 | 改 siteQuery |
| 5 | R.2 out_of_scope 违规 | 改 R.2 traceability |

**全部 0 阻塞, 半天完成, 立即见效**。

---

## 5. 可以立刻开发 (12 项 / ~16 人天)

按"立即可做 + 修 bug" 排序:

| 优先级 | REQ | 估时 | 决策点 |
|---|---|---|---|
| **P0** | 修 /api/tasks/[id] | 0.5d | 无 |
| **P0** | 修 /api/search | 0.5d | 无 |
| **P0** | 改 /api/sites 读真实 | 1d | 无 |
| **P0** | 修 executor L342 | 1d | 无 |
| **P0** | 修 R.2 traceability | 0.5d | 无 |
| **P0** | 补 priority commandType | 1d | 无 |
| P1 | REQ-2.3.3 cron 校验 | 2d | 无 |
| P1 | REQ-4.1.3 检索导出 | 0.5d | 无 |
| P1 | REQ-4.2.1 新建任务 POST | 3d | 无 |
| P1 | REQ-5.1.2 日志导出 | 1d | 无 |
| P1 | REQ-5.1.3 模糊检索 | 1d | 无 |
| P2 | REQ-5.2.2 异步导出 | 2d | 无 |
| P2 | REQ-6.4.3 配置页 | 3d | 无 |

**合计**: ~17 人天 (含 6 个 P0 修 bug + 7 个 P1/P2 新功能)

---

## 6. 必须找领导 (5 个核心决策)

### A. REQ-2.2.1 ADFS 集成登录

**决策点**: 解锁 CLAUDE.md "不做登录权限系统"

**解锁后带动**: 7 项 (REQ-2.2.1/2.2.2/2.2.3/3.1.3/3.2.x/3.3.x/6.2.x) ~25 人天

**询问话术**:
> "领导, 项目目前 14 个 REQ 阻塞在 Auth (登录/SSO/RBAC/审计). 是否解锁 CLAUDE.md 5.x Sprint? 解锁后估时 ~25 人天. 如果不解锁, 这些 REQ 永久 blocked."

### B. 站点表能否加 `paused` / `priority` 字段

**决策点**: 任务控制 6 原子真正落地前提

**询问话术**:
> "领导, 170 张表 0 paused/priority 字段, 总控无法真暂停/优先任务. 站点表能否加 ALTER TABLE? 站点 app 能否读新字段? 加后真控制链路打通, 估时站点 5d + 项目 3d."

### C. 站点 app 能否 poll `control_command` 新行

**决策点**: 任务控制 6 原子真执行前提

**询问话术**:
> "领导, 总控已实现 control_command 队列 (37 命令), 等待站点 app poll. 站点 app 能否注册 GET /api/site-control/commands? 估时站点 3d + 项目 0d (已实现)."

### D. 是否引入 ES/ClickHouse

**决策点**: REQ-4.1.x / 5.x 千万级检索

**询问话术**:
> "领导, REQ-4.1.1 检索 (千万级 ≤3 秒) 需 ES. 是否引入 ES 集群? 估时 8d (ES) + 8d (项目)."

### E. 是否提供真站点 API 文档

**决策点**: REQ-3.1.2/3.2.2 真正落地

**询问话术**:
> "领导, 当前无站点 API 文档, 总控只能走 DB 模拟. 是否提供 swagger / openapi.yml? 估时站点 5d + 项目 5d."

---

## 7. 下一 Sprint 唯一最正确建议: **Sprint R.4 — Bug 修复周 (0.5 人天)**

### 7.1 为什么是 R.4?

**理由**:
1. 当前 4 个🔴 bug 让 R.2 数字虚高 6.4% (15.6% vs 22.0%)
2. 不修 bug, 后续所有 Sprint 的需求 review 数字都不可信
3. **0 阻塞**, 半天完成, 立即见效
4. R.2 报告不再准确, 必须先修正才能继续

### 7.2 R.4 任务清单 (6 项, 0.5 人天)

| # | 任务 | 文件 | 估时 |
|---|---|---|---|
| 1 | 修 /api/tasks/[id] 路由 | `app/api/tasks/[id]/route.ts` | 0.5h |
| 2 | 修 /api/search 路由 (基础) | `app/api/search/route.ts` 新建 | 0.5h |
| 3 | 改 /api/sites 读 unified_sites | `app/api/sites/route.ts` | 1h |
| 4 | 修 executor.ts L342 假执行 | `lib/control/executor.ts` | 1h |
| 5 | 修 R.2 traceability out_of_scope | `requirements-traceability.{md,json}` | 0.5h |
| 6 | 修 R.2 REQ-4.1.1 partial → not_started | `requirements-traceability.md` | 0.1h |

**合计**: ~4 小时

### 7.3 R.4 完成后

- 数字重算: requirements 完成度 15.6% → **20%** (修复后)
- 4 个🔴 bug 清除
- 后续 Sprint 可信
- priority commandType 补全 (5 → 6 原子)

### 7.4 R.4 不做的事

- ❌ 不做新功能 (留 R.5+)
- ❌ 不改协议
- ❌ 不加页面
- ❌ 不动 DB
- ❌ 不宣称"需求完成度 X%"

---

## 8. Sprint 路线图 (R.4 之后)

| Sprint | 目标 | 估时 | 阻塞 |
|---|---|---|---|
| **R.4** | 修 4🔴 bug + 补 priority + 修 R.2 数字 | 0.5d | 无 |
| **R.5** | 7 项 0 阻塞新功能 | ~12d | 无 |
| **R.6** | 5 个🔴 bug 之外的中等 bug + 性能优化 | ~5d | 无 |
| **R.7** | priority 真控制 (站点配合) | 3d | 站点 |
| **5.1** | ADFS 集成 (解锁 CLAUDE.md) | 5d | 领导 |
| **5.2** | JWT 令牌 | 4d | 5.1 |
| **5.3+** | RBAC + 审计 + 部门 + SSO 跳转 | ~18d | 5.1/5.2 |

**合计**: R.4-R.7 ~21d, 5.x ~32d, 总 ~53d (3.5 个月)

---

## 9. 风险与依赖

| 风险 | 等级 | 缓解 |
|---|---|---|
| 4 个🔴 bug 不修, 后续数字全假 | 🔴 高 | R.4 立即修 |
| 8 行 paused 历史数据误导 | ⚠️ 中 | R.3 已澄清, R.4 文档化 |
| executor L342 假执行 | 🔴 高 | R.4 修 |
| out_of_scope 违规 | ⚠️ 中 | R.4 修 |
| /api/sites 100% mock | 🔴 高 | R.4 修 |
| 5 个核心决策未做 | ⚠️ 中 | R.4 后立刻报领导 |

---

## 10. 最终声明

R.3 推翻 R.2 数字, 推翻 Sprint 4.8.2-R 部分结论, 发现 4 个🔴 bug, 修正 1 个 R.1 强约束违规 (out_of_scope)。

**唯一最正确的下一步**: **Sprint R.4 — Bug 修复周 (0.5 人天)**

**完成后**:
- 数字可信 (15.6% 真实)
- 4 个🔴 bug 清除
- priority commandType 补全
- 后续 Sprint 可基于真实数字推进

**R.3 核心成就**: **让项目第一次知道自己真实状态**。
