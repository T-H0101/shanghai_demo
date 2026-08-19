# Sprint R.98 Requirements Review — 跨站点盘笼移位登记

> **模板**: `docs/database-analysis/requirements-strict-review-template.md`  
> **Sprint**: R.98  
> **日期**: 2026-08-18  
> **对应 requirement 节**: `requirements.md` §4.3 盘笼统一管理、§4.1 统一检索  
> **Verdict**: `partial`

---

## 0. Sprint 元信息

| 字段 | 值 |
|---|---|
| Sprint ID | Sprint R.98 |
| Sprint 标题 | 总控盘笼移位登记 + 检索按目标站扩 RFID |
| 日期 | 2026-08-18 |
| 对应 requirement 节 | `requirements.md` §4.3 / §4.1 |
| 关联文档 | `databases/sprint-r98/01-cage-move-register.sql` |
| 总控负责人 | — |
| 验证人 | — |

---

## A. Requirement 对照

| Req ID | 需求原文 (≤30 字) | 状态枚举 |
|---|---|---|
| REQ-4.3.1 | 盘笼移位登记（全流程日志 + 移入自动报告） | `partial` |
| REQ-4.3.2 | 盘笼统一查询 / 导出 | `not_started`（本 Sprint 未做） |
| REQ-4.1.1 | 跨维度检索并标注数据归属 | `partial`（本 Sprint 仅补 RFID 跨站归属） |

本 Sprint **不关闭** REQ-4.3.1：缺站点自动上报、缺审批人、缺站点移位表/应用执行。

---

## 2. Requirement 原始文本 (逐字摘录)

```
4.3 盘笼统一管理
核心：实现盘笼统一管理，支持盘笼移位登记、盘笼统一查询。

盘笼移位登记|1.盘笼移出记录盘笼移位全流程日志，支持追溯移位历史；日志包含：盘笼ID、原站点、目标站点、移位时间、操作人、审批人、状态；2.盘笼移入后自动报告给统一管理平台。|移位日志保留≥1年，不可篡改，满足合规追溯要求。

4.1 统一检索
核心：实现跨存储卷、跨光盘库节点、跨数据中心的统一检索，解决数据割裂问题，支持从检索结果直接发起回迁任务。

检索范围与维度|支持按文件名称/后缀/创建时间/所属部门/存储卷/光盘编号/站点等维度跨维度检索，检索结果需标注数据归属；仅授权账号可查看对应权限范围内的检索结果。
```

---

## B. 前端变更清单 (8 项强制披露)

| # | 项 | 说明 |
|---|---|---|
| 1 | 新增页面/组件 | `components/racks/cage-move-view.tsx`（非新导航页） |
| 2 | 修改按钮/交互 | `/racks` 增加第 4 个 Tab「盘笼移位」；表单提交「登记移位」 |
| 3 | 删除按钮/交互 | 无 |
| 4 | UI-only | 无。历史表读 `GET /api/racks/cage-moves` |
| 5 | 真实后端 | POST 写 `unified_cage_move_register` + `audit_log`；检索按登记表扩 `magazine_rfid` |
| 6 | simulator / DRY_RUN | 无。不走 `control_command`，不宣称站点已执行 |
| 7 | 是否超出 requirements | 否。总控登记是 §4.3.1 日志能力的中心侧实现；检索扩条件支撑 §4.1.1 归属 |
| 8 | 超出理由 | — |

Toast / 文案：**「盘笼移位已登记到总控，检索将按目标站点归属，等待站点库同步盘笼位置」**。禁止「移位成功 / 已移位」。

---

## C. API 变更清单

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/api/racks/cage-moves` | `platform:read` | 分页登记历史 `created_at DESC` |
| POST | `/api/racks/cage-moves` | `racks:operate` | 写登记表；`operator_account_id = session.id` |
| GET | `/api/search` | 既有 | 选站点时扩 inbound/outbound RFID |
| GET | `/api/search/count` | 既有 | 与列表同一套 `loadSiteRfidRelocationFilter` |
| GET | `/api/search/export` | 既有 | 同样扩 RFID，避免导出与列表不一致 |

保留旧 `POST /api/racks/cage-move`（控制队列，blocked），**不是**本功能入口。

---

## D. 数据库变更清单

新建中心表 `unified_cage_move_register`（`databases/sprint-r98/01-cage-move-register.sql`，已注册 `databases/sprint-2b0/init-docker.sh`）。

不写站点库；不改 OpenSearch mapping；不重推 file 文档。

当前位置 = 该 `magazine_rfid` 最新一条 `status=registered` 的 `target_site_code` / `target_device_ip`（port 可空）。

---

## 4. Implementation

| Req ID | 文件 / API / 表 | 改动类型 |
|---|---|---|
| REQ-4.3.1 | `databases/sprint-r98/01-cage-move-register.sql` | 新建 |
| REQ-4.3.1 | `lib/control/cage-move-register.ts` | 新建 |
| REQ-4.3.1 | `app/api/racks/cage-moves/route.ts` | 新建 |
| REQ-4.3.1 | `components/racks/cage-move-view.tsx` | 新建 |
| REQ-4.3.1 | `app/racks/page.tsx` | 修改（第 4 Tab） |
| REQ-4.1.1 | `lib/search/es-client.ts` | 修改（站点归属 OR RFID） |
| REQ-4.1.1 | `app/api/search/route.ts` / `count/route.ts` / `export/route.ts` | 修改 |
| REQ-4.3.1 | `scripts/e2e/test-cage-move.ts` | 新建 |

---

## 5. Backend reality

| Req ID | 后端真实能力 | 证据 |
|---|---|---|
| REQ-4.3.1 总控登记 | ✅ 中心库 INSERT + audit_log `cage_move_registered` | `pnpm e2e:cage-move`：POST 201 + `SELECT` 一行 |
| REQ-4.3.1 站点执行移位 | ❌ 未做 | 无人把盘笼放入目标库的应用回写 |
| REQ-4.3.1 移入自动报告 | ❌ 未做 | 无站点上报 API / 无站点移位表 poll |
| REQ-4.3.1 审批人 | ❌ 表无 approver 列 | 需求字段未实现 |
| REQ-4.1.1 跨站归属 | ⚠️ 选站点时 ES filter 扩 RFID；ES 文档 `source_site_id` 仍是归档站 | `siteOwnershipFilter`；全站检索不扩 RFID |
| REQ-4.1.1 权限过滤 | ❌ 本 Sprint 未做 | 既有 `permission_filter_hardening` missing |

---

## 6. UI reality

| 元素 | 真实点击行为 | 是否误导 |
|---|---|---|
| Tab「盘笼移位」 | `data-testid="racks-storage-tab-cage-move"` | 否 |
| 提交「登记移位」 | POST `/api/racks/cage-moves` | 否（登记 ≠ 站点已移位） |
| toast | API `message` 含「已登记到总控」 | 否 |
| 历史表 | GET 真实行 | 状态展示「已登记」= 总控登记态 |

---

## E. 事件测试清单 (10 项)

见 `scripts/e2e/test-cage-move.ts`：Tab selector、GET 前状态、POST、201+message、psql 一行、列表刷新、toast 口径、无 mock、不误导、REQ-4.3.1/4.1.1。

命令: `pnpm e2e:cage-move`（需 dev server + Docker PG）。

---

## F. 浏览器验证结果

本 Sprint e2e 为 HTTP + 页面 HTML/源码断言（与既有 `e2e:racks` 同级），**未跑 Playwright 截图**。`/racks` HTML 含 `racks-storage-tab-cage-move`。

---

## G. Mock / Simulator / DRY_RUN / 真控制

| 类别 | 本 Sprint |
|---|---|
| Mock | 无。登记走中心库，检索走 ES + 登记表 |
| Simulator | 无 |
| DRY_RUN | 无 |
| 真控制 | ❌ 未向站点下发移位，物理迁移仍靠人 |

---

## 7 / H. Missing pieces

| Req ID | 缺失件 | 原因 |
|---|---|---|
| REQ-4.3.1 | 站点移入自动报告 | `blocked_by_site_change` |
| REQ-4.3.1 | 审批人字段与审批流 | 本 Sprint 范围外；表未建 approver |
| REQ-4.3.1 | ≥1 年不可篡改存储 | PG 流水可删；非 WORM |
| REQ-4.3.1 | 站点库移位表 / 应用执行 | `blocked_by_source_schema` / `blocked_by_site_change` |
| REQ-4.1.1 | 真实回迁仍读登记表目标 IP:port | 本 Sprint 明确不做回迁 |
| REQ-4.3.2 | 盘笼统一查询/导出 | 未开工 |

---

## 8 / 9. Blocker type

| 缺失件 | Blocker Type | 解除条件 |
|---|---|---|
| 站点自动上报当前位置 | `blocked_by_site_change` | 站点 app 在盘笼入架后 POST 或写站点移位表并由 Agent 同步 |
| 站点移位执行回写 | `blocked_by_source_schema` | 站点库具备盘笼当前位置字段/表 |
| 审批流 | `blocked_by_auth` / 产品未定 | 领导确认审批人来源后加列 |

---

## 10. 站点 schema / API 变更清单

| 变更项 | 涉及表 / API | 具体点 | 决策人 |
|---|---|---|---|
| 盘笼入架后上报 RFID+设备 IP | 站点 app | 移入完成后通知总控或写可同步表 | 领导 + 站点 app |
| 站点盘笼当前位置 | 站点库 | 以 RFID 为跨站键，记录当前 lib IP/port | 领导 + 站点运维 |
| 移位审批人 | 总控或站点 | 需求要求审批人；本表未建 | 产品 |

---

## 11. requirements 完成率（本 Sprint 涉及项）

| 维度 | 数值 |
|---|---|
| 本 Sprint 涉及 Req ID 数 | 3 |
| `complete` | 0 |
| `partial` | 2（REQ-4.3.1, REQ-4.1.1） |
| `not_started` | 1（REQ-4.3.2） |
| `out_of_scope` | 0 |
| **本 Sprint 完成率** | 0 / 3 = 0% complete（不允许把登记框架算 complete） |

全局完成率不在本文件重算。

---

## 12. Verdict: `partial`

- ✅ 总控登记表 + API + `/racks` Tab + audit
- ✅ 选站点检索按最新登记 RFID 扩条件，**不改 ES 文档**
- ⚠️ REQ-4.3.1 仍为 `partial`：人搬盘笼，总控只记账；站点未执行、未自动上报
- ❌ 不能宣称「移位成功 / 盘笼移位已完成」

---

## I. 是否允许 commit

满足模板 9 项 + 未使用「移位成功」误导措辞 + 提交前 `tsc` / `build` 后允许 commit。需求状态保持 `partial`。

---

## 13. 提交前检查清单

- [x] Req ID 已列
- [x] 每条状态 8 选 1
- [x] Backend 有 SQL/API 证据路径
- [x] mock/DRY_RUN/真控制已区分
- [x] 缺失件未隐藏
- [x] blocker 已标
- [x] 站点变更清单
- [x] 完成率未用「业务完成度」
- [x] verdict `partial`
- [x] 文件名 `sprint-r98-requirements-review.md`
