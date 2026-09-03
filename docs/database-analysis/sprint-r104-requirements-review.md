# Sprint R.104 — 盘笼移位（目标区域）与统一检索改造 Requirements Review

**Sprint**: R.104  
**对应 requirements**: §4.3 盘笼移位登记、§4.1 统一检索归属展示  
**Verdict**: `partial`

---

## 1. Requirement IDs

| Req ID | 状态 |
|--------|------|
| REQ-4.3.1 盘笼移位登记 | partial |
| REQ-4.1.1 跨站/跨区域检索归属 | partial |

---

## 2. Implementation

| 层级 | 变更 |
|------|------|
| DDL | `databases/sprint-r104/01-cage-move-region.sql` — source/target_region_code；目标站/设备可空 |
| 登记 | `lib/control/cage-move-register.ts`、API、Dialog、历史列表 |
| 检索 | `lib/search/hit-enrichment.ts`、`search-region-scope.ts`、search/count/export API |
| UI | 检索页区域下拉、区域/站点展示、迁入禁用回迁 |

---

## 3. Backend reality

- 登记表写入 `source_region_code` / `target_region_code`；`target_site_code`/`target_device_ip` 本阶段 NULL
- 检索 ES 条件：区域下业务站 + inbound/outbound RFID（`relocationFilterFromRegion`）
- enrich 后展示逻辑区域；无站点执行、无回迁扇出

---

## 4. UI reality

- 移位 Dialog：源站/设备/盘笼 → 目标区域 + 只读预览
- 检索：区域下拉；未迁 `{区域}/{站}` + 完整备份位置；迁入 `{区域} · 盘笼移位（站点未定）` + RFID·盘位·盘面
- 迁入结果「发起回迁」禁用并提示

---

## 5. Mock / Simulator / DRY_RUN

- 登记为总控 audit + DB 记录；**不代表站点已移笼**
- 检索归属为逻辑映射；ES 文档未改

---

## 6. Missing pieces

- 站点 app 执行真实移笼与 RFID 位置回写
- 区域回迁扇出与设备认领
- 迁入后设备盘位叠加（本阶段区域目标不叠加，符合设计）

---

## 7. Blocker type

`blocked_by_site_change`（无站点执行）+ 回迁 `out_of_scope`（本 Sprint 明确不做）

---

## 8. Verdict

`partial` — 总控登记与检索逻辑区域链路完成；真实移笼与回迁闭环未完成。

---

## 9. 是否允许 commit

满足 R.5 事件测试（`scripts/e2e/test-cage-move.ts` 已更新）→ **pass**（待本地 tsc/build/e2e 绿）
