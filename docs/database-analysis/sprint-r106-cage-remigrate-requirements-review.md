# Sprint R.106 — 盘笼再迁（区域选笼 + 仅最新可撤）

## Requirement IDs

- REQ-4.3.1 盘笼移位登记 — `partial`（再迁与撤销链完善；仍无站点物理执行）

## Requirement 原始文本（摘录）

> 盘笼移位登记：1.盘笼移出记录盘笼移位全流程日志，支持追溯移位历史；日志包含：盘笼ID、原站点、目标站点、移位时间、操作人、审批人、状态；2.盘笼移入后自动报告给统一管理平台。

本 Sprint：支持「区域→再区域」登记；首次仍写原站/设备便于追溯；再迁原站/设备可空；同一 RFID 仅最新 `registered` 可撤销。

## Implementation

| 项 | 内容 |
|---|---|
| DDL | `databases/sprint-r106/01-cage-move-source-nullable.sql`；已登记 `init-docker.sh` |
| 登记 | `createCageMoveRegister`：`sourceRegionCode` 必填；`relocated` 再迁无站/设备 |
| 选笼 | `listRegionCageCandidates` + `GET /api/racks/magazines/by-region` |
| 撤销 | 仅最新 registered；列表 `is_latest_registered` 控制按钮置灰 |
| 历史筛选 | `?magazineRfid=` / `?rfidsOnly=1`；筛选项来自登记表 RFID |
| UI | Dialog：区域→盘笼（迁移标记）；History：RFID 筛选 + 撤销置灰 |
| 权限 | 页权限即可全站；登记/列表/撤销不做站级裁剪 |

## Backend reality

- 真写 `unified_cage_move_register`；不代表站点已移笼
- 再迁：`source_site_code` / `source_device_ip` 可为 NULL

## UI reality

- 未迁：展示所属站/设备；缺 IP 不可提交
- 迁入：一句「迁入本区域（站点未定）」
- 非最新撤销按钮 disabled

## Mock / Simulator / DRY_RUN / 真控制

| 能力 | 标记 |
|---|---|
| 总控登记/撤销 | 真实 DB |
| 站点物理移笼 | 未做 |

## Missing pieces

- 站点执行与 RFID 位置回写
- 再迁后无物理源时的盘位叠加（跳过无源站设备的 overlay）

## Blocker type

`blocked_by_site_change`（物理执行）

## Verdict

`partial` — 再迁交互与撤销链完成；物理闭环未宣称。

## 是否允许 commit

- 前端变更已披露（Dialog/History）；无假「移位成功」
- `tsc --noEmit` 通过；self-check 通过
- 部署需执行 R.106 DDL
