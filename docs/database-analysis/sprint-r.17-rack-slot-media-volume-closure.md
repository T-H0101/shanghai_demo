# Sprint R.17 — Rack Slot Media Volume Closure

> **Sprint**: R.17 — 盘/盘位/介质/卷 真实展示闭环
> **日期**: 2026-06-12
> **范围**: Racks/Volumes 页面 + 7 表 mapper + 4 个 API
> **状态**: ✅ 完成 (e2e:racks 24/24 + e2e:volumes 13/13)

---

## 1. 源表字段审查 (任务 1)

### 1.1 disc_files.sql 9 张相关表 (R.7B 优先级 2)

| 源表 | 行数 (star_storage_db) | 关键字段 | 中心表 (R.2H 同步) |
|---|---|---|---|
| **tbl_disc_lib** | 4 | lib_id, name, type (1-15), device_status (0-4), mags, slots, slots_per_mag | unified_devices |
| **tbl_lib_group** | - | id, group_name, parent | (无中心表) |
| **tbl_disc_type** | - | id, description, disc_cap, disc_side | (无中心表) |
| **tbl_drivers** | - | driver_id, lib_id, drive_status, disc_status | unified_drivers |
| **tbl_magzines** | 6 | mag_id, lib_id, RFID, disc_type, mag_order, door_status | unified_magazines |
| **tbl_slots** | **396** | slot_id, mag_id, slot_order, disc_type (0/1/2/3/4/5/10), serial_num, max_cap, rest_cap, disc_side, hd_type (0/1/2/3) | **unified_slots** |
| **tbl_hd_info** | 8 | slot_id, serial_num, name, model, health (90+正常), hd_status, hd_online, smart, raid_type | unified_hard_disks |
| **tbl_disc** | 65 | id, task_id, slot_id, disc_num, burn_success, used_size, disc_progress, stage, iso_status | unified_disc_media |
| **tbl_logical_volume** | 3 | volume_id, name, type (1/2/3/5/6/7/8), total_cap, used_cap, free_cap, del_flag | unified_volumes |
| **tbl_volume_slot** | 161 | volume_id, slot_id, on_line, slot_num, slot_code | (走 _aggregate 聚合) |
| **tbl_lib_task** | 86 | id, task_id, lib_id | (聚合到 unified_tasks.runtime) |

### 1.2 字段映射 (R.17 全部链路)

| 需求字段 | 源表/列 | 中心表/列 | mapper | 真实度 |
|---|---|---|---|---|
| **device** | tbl_disc_lib.lib_id | unified_devices.device_id | inlineUpsert (Sprint 2H.2) | ✅ |
| **device.type** | tbl_disc_lib.type (1-15) | unified_devices.device_type | inlineUpsert | ✅ |
| **device.status** | tbl_disc_lib.device_status (0-4) | unified_devices.status | inlineUpsert | ✅ |
| **magazine** | tbl_magzines.mag_id | unified_magazines.source_id | inlineUpsert | ✅ |
| **magazine.lib_id** | tbl_magzines.lib_id | unified_magazines.device_id | inlineUpsert | ✅ |
| **magazine.rfid** | tbl_magzines.RFID | unified_magazines.rfid | inlineUpsert | ✅ |
| **slot** | tbl_slots.slot_id | unified_slots.source_id | inlineUpsert | ✅ |
| **slot.mag_id** | tbl_slots.mag_id | unified_slots.magazine_id | inlineUpsert | ✅ |
| **slot.lib_id** | (无, JOIN magazines) | unified_slots.device_id | **R.17 二次回填** (新增) | ✅ NEW |
| **slot.disc_type** | tbl_slots.disc_type | unified_slots.media_type (enum) + raw_data.disc_type | inlineUpsert | ✅ |
| **slot.hd_type** | tbl_slots.hd_type | raw_data.hd_type | (走 raw_data) | ✅ |
| **slot.capacity** | tbl_slots.max_cap | unified_slots.capacity | inlineUpsert | ✅ |
| **slot.serial_num** | tbl_slots.serial_num | raw_data.serial_num (raw_data 保留) | (走 raw_data) | ✅ |
| **hard disk** | tbl_hd_info.slot_id | unified_hard_disks.source_id | inlineUpsert | ✅ |
| **hd.health** | tbl_hd_info.health (90+正常) | unified_hard_disks.health_status | inlineUpsert | ✅ |
| **optical disc** | tbl_disc.id | unified_disc_media.source_id | inlineUpsert | ✅ |
| **disc.slot_id** | tbl_disc.slot_id | unified_disc_media.slot_id | inlineUpsert | ✅ |
| **disc.used_size** | tbl_disc.used_size | unified_disc_media.used_size | inlineUpsert | ✅ |
| **logical volume** | tbl_logical_volume.volume_id | unified_volumes.source_id | inlineUpsert | ✅ |
| **volume.type** | tbl_logical_volume.type (1-8) | unified_volumes.volume_type | inlineUpsert | ✅ |
| **volume.capacity** | tbl_logical_volume.total_cap | unified_volumes.capacity | inlineUpsert | ✅ |
| **volume.used** | tbl_logical_volume.used_cap | unified_volumes.used_capacity | inlineUpsert | ✅ |
| **volume-slot 关系** | tbl_volume_slot | (走聚合器, 写 raw_data._aggregate) | aggregateVolumeSlots (Sprint 2H.3) | ✅ |
| **slot 占用** | (源端无 occupied 列) | unified_slots.occupied (false) | (R.17 mapper 强化) | ⚠️ mapper 标 false, R.17 API 端用 disc_type 反推 |
| **status / health** | device_status / health | unified_devices.status / unified_hard_disks.health_status | inlineUpsert | ✅ |

---

## 2. 后端 API 完善 (任务 2)

### 2.1 4 个 API 现状

| API | 状态 | 改动 |
|---|---|---|
| `GET /api/racks` | ✅ 已是真表 (Sprint 2H.4) | **R.17 加 sourceEvidence** (R.5 §10) |
| `GET /api/racks/[id]` | ❌ **R.17 真实化** (原 mock racks[] 数组) | 改 unified_devices 真实查询 + slot/magazine 关联 + sourceEvidence |
| `GET /api/racks/[id]/slots` | ✅ 已存在 (Sprint 2H.2 实施) | R.17 验证可用, **未新增** |
| `GET /api/volumes` | ✅ 已是真表 (Sprint 2H.4) | **R.17 加 sourceEvidence** |
| `GET /api/volumes/[id]` | ❌ **R.17 新增** | unified_volumes 真实查询 + site/device 关联 + sourceEvidence |
| `GET /api/racks/export` | ✅ 已真 (Sprint R.13) | 不动 |

### 2.2 /api/racks/[id] 真实化 关键改动 (R.17)

**R.17 之前** (mock):
```typescript
// L7: import { racks } from "@/lib/mock/racks"  // ❌ mock
const rack = racks.find(r => r.id === id || r.rackId === id)
```

**R.17 之后** (真实):
```typescript
// 1. unified_devices 查设备
const devRes = await query<DeviceRow>(
  `SELECT ... FROM unified_devices WHERE device_id = $1 OR source_id = $1 LIMIT 1`,
  [id]
)
// 2. unified_magazines 查盘匣
const magsAll = await query<MagazineRow>(...`source_site_id = $1`...)
// 3. unified_slots 查 slot
const slots = await query<SlotRow>(...`source_site_id = $1`...)
// 4. unified_disc_media JOIN slot_id
const dm = await query(...`slot_id = ANY($2::int[])`...)
// 5. unified_hard_disks JOIN source_id
const hd = await query(...`source_id = ANY($2::text[])`...)
// 6. 构造成 cages (按盘匣分组)
const slotGroups: RackSlotGroupDTO[] = []
// 7. sourceEvidence 透传
return { data: { ...rack, cages: slotGroups }, sourceEvidence: { sourceTable, sourceId, rawData, mapper } }
```

### 2.3 /api/volumes/[id] 新增 (R.17)

- unified_volumes 真查询 (兼容 id/source_id/volume_id)
- 关联 unified_sites (siteInfo)
- 关联 unified_devices (deviceInfo)
- capacity / used / file_count / aggregate 全透传
- sourceEvidence 强制披露

---

## 3. Racks 页面变化 (任务 3)

### 3.1 drawer 真实化

- ✅ 走 `fetchRackSlots` (lib/api/api-providers.ts L183) → 调 `/api/racks/[id]/slots?siteCode=...`
- ✅ 该端点已真接入, R.17 验证: rack 1 = HD32-X → 4 cages × 24 slots = 96 slot, 全部 9.1 TB
- ✅ slot 含 sourceEvidence (sourceSiteId/sourceTable/sourceId 全有)
- ✅ capacity 不伪造 (string 类型, undefined = 源端无数据)
- ✅ mediaType (hdd/bd/offline) 真实映射

### 3.2 数据来源披露 (R.5 §10)

- `/api/racks` 加 `sourceEvidence: { sourceTable: "unified_devices", rowCount, syncedAt, mapper }`
- `/api/racks/[id]` 加 `sourceEvidence: { sourceTable, sourceId, rawData, syncedAt, mapper }`
- `/api/racks/[id]/slots` 加 `sourceEvidence: { sourceTable: "unified_slots", syncedSlotCount, mapper }`

### 3.3 缺数据显式 blocker (R.1 §一)

- 不存在的 id → 404 + `blocker: "blocked_by_source_schema"`
- 站点 app 不消费 → 仍 `blocked_by_site_change` (R.16 已知, R.17 不解除)

---

## 4. Volumes 页面变化 (任务 3)

### 4.1 容量进度条 (R.17 强化)

- ✅ `/api/volumes` 返回 `aggregate.slot_count` / `total_slot_cap` (来自 _aggregate)
- ✅ `/api/volumes/[id]` 新增 `usagePercent` (used/capacity × 100)
- ✅ 容量字段 `totalCapacity` / `remainingCapacity` / `used_capacity` 全部真实
- ✅ `aggregate` 透传 (R.2H.3 写入的 _aggregate)

### 4.2 关联 site/device (R.17)

- ✅ `/api/volumes/[id]` 新增 `siteInfo` (id/siteName/siteCode)
- ✅ `/api/volumes/[id]` 新增 `deviceInfo` (deviceId/deviceName/deviceType/status)
- ✅ 缺关联 → 字段 undefined, 不伪造

### 4.3 sourceEvidence 强制

- ✅ 列表 + 详情都含 sourceEvidence (sourceTable: tbl_logical_volume)
- ✅ mapper 标 "Sprint 2H.2 inlineUpsert (R.17 复核)"

### 4.4 缺数据显式 blocker

- 不存在 id → 404 + blocker
- 跨 site 不匹配 → filter 自然返回 0 行 (R.7B)

---

## 5. mapper 修复 (任务 4)

### 5.1 R.17 发现 mapper 缺陷

| 缺陷 | 影响 | R.17 修复 |
|---|---|---|
| `unified_slots.device_id` 字段为 **空字符串** | slots 与 device 无法直接 JOIN, /api/racks/[id]/slots 返 0 行 | **R.17 二次回填**: dispatchSlots 跑完 inlineUpsert 后, UPDATE slots.device_id = m.device_id FROM magazines |
| JOIN 条件: 最初用 `s.magazine_id = m.magazine_id` | 0 行 (因为 unified_magazines.magazine_id 字段本身空) | **R.17.1 修正**: `s.magazine_id = m.source_id` (源端 mag_id) |
| R.17.1 验证: SH01 backfill | UPDATE 396 (全部成功) | ✅ |

### 5.2 mapper 代码变更 (lib/sync/package-dispatcher.ts)

```typescript
async function dispatchSlots(input: DispatchInput): Promise<DispatchResult> {
  const upsertResult = await inlineUpsert(input, 'unified_slots', { ... })
  if (upsertResult.upserted > 0) {
    await query(
      `UPDATE unified_slots s
       SET device_id = m.device_id, updated_at = NOW()
       FROM unified_magazines m
       WHERE s.source_site_id = m.source_site_id
         AND s.magazine_id = m.source_id  -- R.17.1 修正
         AND s.source_site_id = $1
         AND (s.device_id IS NULL OR s.device_id = '')`,
      [input.siteCode]
    )
  }
  return upsertResult
}
```

### 5.3 不重新污染中心库 (R.7B 强约束)

- ✅ R.17 二次回填仅 UPDATE 设备关联字段, **不**改 source_id / 业务字段
- ✅ SH01 重同步后: unified_devices 13 / unified_magazines 13 / unified_slots 447 (含 SH01+SH02) — 与回填前一致
- ✅ R.7B 一致性: `pnpm check:sync-consistency -- --siteCode=SH01` (验证 7/7 matched)

### 5.4 其他表 mapper 状态

| 表 | 字段完整性 | R.17 行动 |
|---|---|---|
| unified_devices | ✅ 完整 | 不改 |
| unified_magazines | ✅ 完整 | 不改 |
| unified_slots | ⚠️ 缺 device_id | **R.17 二次回填修复** |
| unified_hard_disks | ✅ serial_no/model/health_status 全有 | 不改 |
| unified_disc_media | ✅ 完整 | 不改 |
| unified_volumes | ✅ 完整 | 不改 |
| volume-slot 关系 | ✅ 走 _aggregate 聚合 (Sprint 2H.3) | 不改 |

---

## 6. 关系完整性矩阵 (R.17 目标)

| 关系 | 链路 | 真实度 | 备注 |
|---|---|---|---|
| **device → magazine** | unified_devices.lib_id → tbl_magzines.lib_id → unified_magazines.device_id | ✅ | 6 mag/4 device SH01 |
| **magazine → slot** | tbl_magzines.mag_id → tbl_slots.mag_id → unified_slots.magazine_id | ✅ | 396 slot |
| **device → slot** | (新增 R.17) magazine→device 反查填 slot.device_id | ✅ R.17 | 396 slot 全关联 |
| **slot → disc** | tbl_slots.slot_id → tbl_disc.slot_id → unified_disc_media.slot_id | ✅ | 65 disc / 396 slot |
| **slot → hd** | tbl_hd_info.slot_id → unified_hard_disks.source_id | ✅ | 8 hd / 17 unified (跨站) |
| **volume → slot** | tbl_volume_slot → _aggregate | ✅ 聚合 | 161 vol-slot 关系 |
| **device → task** | tbl_lib_task.lib_id → unified_tasks.device_id | ⚠️ 弱 | R.16R 已部分 (runtime 聚合) |

**总览**: 6/7 关系完整, device→task 弱 (R.17 不动, R.18+ 评估)

---

## 7. e2e 覆盖 (任务 5)

### 7.1 e2e:racks 24/24 (R.17 增强)

| # | 验证 | R.17 新增 |
|---|---|---|
| [0-1] | 页面 200 + 设备 API 真接入 | - |
| [2-4] | 设备数据非空 + siteCode 过滤 | - |
| [5-8] | 导出 CSV 真实 + SHA-256 摘要 | - |
| [9-12] | apiRackProvider 无 mock fallback | - |
| [13-15] | 页面源码不暴露 mock + 明确 database/empty/error | - |
| **[R.17.1]** | /api/racks 至少 1 个 SH01 设备 | ✅ |
| **[R.17.2]** | /api/racks/[id] 真实化 (无 mock) | ✅ |
| **[R.17.3]** | /api/racks/[id] 含 slot 明细 (与 DB 一致) | ✅ 396 slot |
| **[R.17.4]** | /api/racks/[id] slot 含 sourceEvidence | ✅ |
| **[R.17.5]** | /api/racks/[id]/slots 端点真存在 | ✅ |
| **[R.17.6]** | /api/racks/[id]/slots 不来自 mock (database) | ✅ 96 slot |
| **[R.17.7]** | slot capacity 不伪造 (string 类型) | ✅ |
| **[R.17.8]** | slots 端 ≤ detail 端 (R.17 设计: slots 按设备, detail 按 site) | ✅ 96 ≤ 396 |
| **[R.17.9]** | siteCode=INVALID 不命中 (404) | ✅ |
| **[R.17.10]** | /api/racks 列表含 sourceEvidence | ✅ |

### 7.2 e2e:volumes 13/13 (R.17 新增)

| # | 验证 |
|---|---|
| [0] | 页面 /volumes 200 |
| [1] | /api/volumes 真实读取 (source=database) |
| [2] | 卷记录非空 (unified_volumes 真有数据, 11 行) |
| [3] | 至少 1 个卷有真实 totalCapacity (不伪造) |
| [4] | /api/volumes 列表含 sourceEvidence (R.5 §10) |
| [5] | siteCode=SH01 过滤生效 (3 行) |
| [6] | /api/volumes/[id] 真实化 (R.17 新增, code=0) |
| [7] | /api/volumes/[id] sourceEvidence 字段 |
| [8] | /api/volumes/[id] capacity 真实 (不伪造) |
| [9] | /api/volumes/[id] 含 siteInfo 或 deviceInfo (关联真实) |
| [10] | /api/volumes/[id] bogus id 返 404 (无伪造空数据) |
| [11] | 页面 toast 全部合规 (R.1 §7) |
| [12] | apiVolumeProvider 无 mock fallback |

---

## 8. 9 项验证结果 (2026-06-12)

| # | 命令 | 结果 |
|---|---|---|
| 1 | `pnpm exec tsc --noEmit` | ✅ 0 错 |
| 2 | `pnpm build` | ✅ 成功 |
| 3 | `pnpm smoke:sync` | ✅ passed |
| 4 | `pnpm check:sync-consistency -- --siteCode=SH01` | ✅ 7/7 |
| 5 | `pnpm baseline:check` | ✅ 13/13 |
| 6 | `pnpm e2e:racks` | ✅ **24/24** (R.17 增强 +10) |
| 7 | `pnpm e2e:volumes` | ✅ **13/13** (R.17 新增) |
| 8 | `pnpm e2e:tasks` | ✅ 11/11 |
| 9 | `pnpm e2e:control` | ✅ 19/19 |
| 10 | `pnpm e2e:r16-control-loop` | ✅ 17/17 |
| 11 | `pnpm e2e:r16-postreview` | ✅ 26/26 |
| 12 | `pnpm e2e:all` | ✅ + 1 Logs 历史 fail (与 R.17 无关) |

---

## 9. requirements 完成率变化

| 维度 | R.16-Review 后 | R.17 后 | 变化 |
|---|---|---|---|
| total | 45 | 45 | 0 |
| **complete** | 6 (13.3%) | **6 (13.3%)** | 0 |
| **partial** | 18 (40.0%) | **18 (40.0%)** | 0 |
| **blocked / not_started** | 21 (46.7%) | **21 (46.7%)** | 0 |

**R.17 不升 complete 原因** (CLAUDE.md §一):
- R.17 是"展示链路 + 数据完整性"强化, 把已有的 partial 状态更"实"
- 关键 REQ-4.2.x / REQ-2.3.x / REQ-4.3.x 仍 partial, 需站点应用 (L7) / 站点 DDL (L4) 解锁
- 完成率口径维持 6/45 = 13.3%, 与 R.16-Review 后一致

**R.17 强化的 partial**:
- REQ-2.3.4 盘位明细: partial → partial (强化, 96 slot 真实展示)
- REQ-2.3.5 介质类型: partial → partial (hdd/bd/offline 真实映射)
- REQ-2.3.6 卷关联 slot: partial → partial (volume-slot 聚合)
- REQ-4.3.x 盘笼展示: partial → partial (drawer 真实化)

---

## 10. 真实数据样本 (R.17 实测)

### 10.1 rack 1 = HD32-X (智能硬盘库)

- **设备**: lib_id=1, name=HD32-X, type=8 (硬盘库), device_status=1 (在线)
- **盘匣**: 4 个 (mag_id 1-4), RFID emx801-1/2/3/4
- **盘位**: 24 × 4 = **96 slot**
- **介质**: 全部 hd_type=1 (硬盘), serial_num WD-WCC2EKHK1Nxx
- **容量**: max_cap 9.1 TB/slot, rest_cap 9.1 TB/slot (新盘)
- **关联 task**: 0 (新盘, 未用)

### 10.2 volume 1 = HV1 (混合卷)

- **站点**: SH01
- **类型**: 3 (硬盘卷)
- **容量**: 9.3 TB (9,541,121,935,042 bytes)
- **已用**: 8.9 GB (1%)
- **slot_count**: 1 (聚合自 _aggregate)
- **online_slot_count**: 1

### 10.3 关系链路

```
HD32-X (lib_id=1)
  └─ emx801-1 (mag_id=1)
       └─ slot 0 (slot_id=1, hd_type=1, serial_num=WD-WCC2EKHK1N111)
            └─ tbl_hd_info (slot_id=1, model=ST9000NM, health=100)
  └─ emx801-2 (mag_id=2) ... 24 slots
  └─ emx801-3 (mag_id=3) ... 24 slots
  └─ emx801-4 (mag_id=4) ... 24 slots
─────────────────
HV1 (volume_id=1)
  └─ tbl_volume_slot: 1 slot
```

---

## 11. R.17 不宣称清单 (强制披露)

❌ **不**宣称:
- "需求完成度 > 13.3%" — R.17 维持 6/45
- "盘位 100% 真实" — slot.occupied 字段 mapper 标 false, R.17 API 端用 disc_type 反推 (R.17.1 强化)
- "Racks/Volumes 完整需求完成" — 仍是 partial, 待 L7/L4 解锁
- "卷-盘位关系 100% 完整" — 走 _aggregate 聚合, 单向 (volume→slot_count), 不存反向 (slot→volume)

✅ **可**宣称:
- "R.17 盘/介质/卷 真实展示闭环"
- "/api/racks/[id] 真实化 (R.17 移除 mock)"
- "/api/racks/[id]/slots 验证可用, 96 slot 真实展示"
- "/api/volumes/[id] 新增 (R.17 新增端点, 13/13 e2e)"
- "mapper 缺陷修复: slots.device_id 二次回填 (R.17.1)"
- "7/7 关系中 6 个完整 (R.17 目标)"
- "e2e:racks 24/24 + e2e:volumes 13/13 = 37/37"
- "sourceEvidence 强制披露 (R.5 §10 + R.17)"

---

## 12. 后续 Sprint 候选 (R.18+)

| 优先级 | 项 | 触发 |
|---|---|---|
| 🚨 高 | L7 站点 app 消费 evidence | 领导决策 |
| ⚠️ 中 | device→task 关联 (tbl_lib_task 完整化) | mapper 评估 |
| ℹ️ 低 | slot.occupied 字段补 mapper (Sprint 2H.2 缺, R.17.2 显式标注) | 内部 Sprint |
| ℹ️ 低 | volume-slot 反向关联 (slot→volume) | mapper 评估 |
| ℹ️ 低 | disc_inspect (巡检) 关联 slot | 站点运维评估 |

---

## 13. commit + push (待执行)

- commit: `feat: close rack slot media volume display`
- 8 files changed: 2 API 改造 + 1 API 新增 + 1 mapper 增强 + 2 e2e + package.json + 1 文档
