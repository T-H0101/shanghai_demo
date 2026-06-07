# Sprint 2H.1R — Dispatcher 覆盖率 Reality Check

> 状态: ✅ 完成 (审计 + 文档, 无业务代码变更)
> 范围: SQL 验证 + Dispatcher 源码审查 + 文档, 不改 dispatcher
> Sprint 目标: 让 "package success" 与 "真实落库" 之间的差异变得透明

---

## 1. 背景

Sprint 2H.1 验证中发现:

```text
tbl_magzines        processed=6   inserted=0
tbl_slots           processed=396 inserted=0
tbl_logical_volume  processed=3   inserted=0
```

但 `sync_package_log.status = success`, 7/7 表全 success。这暴露了:

> package success ≠ 真实落库成功

需要重新审查 Dispatcher 真实覆盖率, 区分 **Fully Working** / **Partial** / **Placeholder** / **Broken**。

## 2. 覆盖率矩阵 (13 张白名单表)

### 2.1 数据来源

- `source_count`: source_restore
- `package_received/inserted/updated/skipped/failed`: `sync_table_log` 聚合
- `unified_count`: 中心库 `unified_*` 行数
- SH01 push (Sprint 2H.1): `SH01-2026-06-07T10-24-28-302Z`, 7 张表

### 2.2 全表矩阵

| # | 源表 | 目标表 | source | received | inserted | updated | failed | unified (SH01) | 分类 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `tbl_task` | `unified_tasks` | 37 | 62 | 60 | 2 | 0 | 44 | **A** |
| 2 | `tbl_disc_lib` | `unified_devices` | 4 | 25 | 23 | 0 | 2 | 6 | **A** |
| 3 | `tbl_hd_info` | `unified_hard_disks` | 8 | 9 | 9 | 0 | 0 | 8 | **A** |
| 4 | `tbl_disc` | `unified_disc_media` | 65 | 66 | 66 | 0 | 0 | 65 | **A** |
| 5 | `tbl_user` | `unified_users` | 3 | 1 | 1 | 0 | 0 | 0* | **A** |
| 6 | `tbl_magzines` | `unified_magazines` | 6 | 7 | 1 | 0 | 0 | **0** | **D** |
| 7 | `tbl_slots` | `unified_slots` | 396 | 397 | 1 | 0 | 0 | **0** | **D** |
| 8 | `tbl_logical_volume` | `unified_volumes` | 3 | 4 | 1 | 0 | 0 | 5† | **D** |
| 9 | `tbl_lib_task` | (聚合, 不直写) | 86 | 1 | 0 | 0 | 0 | n/a | **C** |
| 10 | `tbl_volume_slot` | (聚合, 不直写) | 161 | 1 | 0 | 0 | 0 | n/a | **C** |
| 11 | `tbl_user_task` | (聚合, 不直写) | 28 | 1 | 0 | 0 | 0 | n/a | **C** |
| 12 | `tbl_site` | `unified_sites` | **0** (源表空) | 0 | 0 | 0 | 0 | 0 | **C** |
| 13 | `tbl_platform` | `unified_platforms` | **0** (源表空) | 0 | 0 | 0 | 0 | 0 | **C** |

> *`tbl_user` SH01=0, 但 TEST_PKG push 留了 1 行 (跨站点总和 4)
> †`tbl_logical_volume` SH01=5 来自历史 `pnpm import:volumes`, **不是 package 写入**

## 3. A/B/C/D 分类

### 3.1 A — Fully Working (5 张)

```text
tbl_task, tbl_disc_lib, tbl_hd_info, tbl_disc, tbl_user
```

- 走完整 `mapRealX` / `mapX` + 事务 upsert
- 真实写入 unified_*
- 可被 package 链路正确使用

### 3.2 B — Partial (0 张)

无。部分情况由 source 数据缺失导致, 不是 dispatcher 缺陷。

### 3.3 C — Placeholder (5 张)

```text
tbl_lib_task       (skip: true, 设计上由聚合器后置)
tbl_volume_slot    (skip: true, 同上)
tbl_user_task      (skip: true, 同上)
tbl_site           (源表 0 行, 从未推过)
tbl_platform       (源表 0 行, 从未推过)
```

- 3 张关系表 (`lib_task` / `volume_slot` / `user_task`): 设计上 skip, 等聚合器实现
- 2 张源表 (site/platform): 源端没有数据, 只能等站点提供

### 3.4 D — Broken (3 张) ← 真实问题

```text
tbl_magzines, tbl_slots, tbl_logical_volume
```

**根因**: `inlineUpsert` 用 `sourceIdField: 'id'`, 但 source_restore 表的主键不是 `id`:

| Dispatcher 期望 | 实际主键 | 后果 |
|---|---|---|
| `tbl_magzines.id` | `mag_id` | sourceId 永远是空字符串, **dispatcher 静默 continue** |
| `tbl_slots.id` | `slot_id` | 同上 |
| `tbl_logical_volume.id` | `volume_id` | 同上 |

**为什么 `sync_table_log` 看到 inserted=1**:
- 早期某次独立测试, 用了 mock 或合成 records, 这些 records 里碰巧有 `id` 字段
- 后续真实 SH01 push 全部 inserted=0, 但**package 仍标 success**

**为什么 `unified_*.source_table='tbl_magzines'` 总数为 1**:
- 1 条历史测试记录, 之后无新增

## 4. 真实完成度

| 指标 | 数值 | 占比 |
|---|---|---|
| 白名单表数 | 13 | 100% |
| **真实可用 (A)** | 5 | **38.5%** |
| 占位 (C) | 5 | 38.5% |
| **失效 (D)** | 3 | **23.1%** |
| 部分 (B) | 0 | 0% |

**真实可用率: 38.5%** (5/13)。Dashboard / Sync Center 上看到的 `successTableCount=7/7` 反映的是**dispatcher 没抛错**, **不等于真实落库**。

## 5. 哪些表需要补实现 (D 类修复路径)

### 5.1 `tbl_magzines`

- 修改 dispatcher `inlineUpsert` 配置: `sourceIdField: 'mag_id'`
- 同时检查 dispatcher 期望的列 (magazine_id / barcode / rfid / device_id / status / position / slot_count) 是否与 source 列匹配
- source 实际列: `mag_id, lib_id, rfid, disc_type, mag_order, door_status, earliest_time, latest_time`
- 错配: dispatcher 期望 `magazine_id` 但 source 是 `mag_id`; 期望 `barcode` 但 source 没有; 期望 `position` 但 source 是 `mag_order`

### 5.2 `tbl_slots`

- 修改: `sourceIdField: 'slot_id'`
- 列错配: dispatcher 期望 `slot_id, slot_index, device_id, magazine_id, status, occupied, media_id, media_type, capacity`
- source 实际: `slot_id, mag_id, slot_order, disc_type, serial_num, max_cap, rest_cap, disc_side, hd_type, group_id, cmt`
- `slot_index` 应映射 `slot_order`, `magazine_id` 应映射 `mag_id`, `capacity` 应映射 `max_cap`, `occupied` / `media_id` / `media_type` 在 source 不存在 → 应留空

### 5.3 `tbl_logical_volume`

- 修改: `sourceIdField: 'volume_id'`
- 列错配: dispatcher 期望 `volume_name, volume_type, capacity, used_capacity, status`
- source 实际: `volume_id, group_id, type, uuid, name, total_cap, used_cap, free_cap, max_file_id, create_time, update_time, create_user, update_user, remark, mount_id, del_flag`
- `volume_name` → `name`, `volume_type` → `type`, `capacity` → `total_cap`, `used_capacity` → `used_cap`, `status` → 派生 from `del_flag`

### 5.4 修复位置 (后续 Sprint)

`lib/sync/package-dispatcher.ts`:
- `dispatchMagzines` (line 91-96)
- `dispatchSlots` (line 98-103)
- `dispatchLogicalVolume` (line 130-135)

**注意**: 修复需要同步 source 端真实列结构, 建议先做 **source schema 画像 + 列映射文档**, 再改 dispatcher。

## 6. 哪些表应移出 package 白名单

**当前不建议移出**, 理由:

1. Sprint 2H.1 范围明确 7 张表包含这 3 张
2. 修复 dispatcher 比"移出白名单"更有价值 (恢复可用)
3. 移出会让 client 端站点停止推送这些表, 真实问题 (dispatcher 错配) 被掩盖

**替代方案**: 在 Sprint 2H.2 (后续) 修复 dispatcher, 让 3 张 D 类表变 A 类。

## 7. 统计口径修正建议

### 7.1 现状

`sync_table_log.inserted_count` = PostgreSQL `INSERT ... ON CONFLICT ... DO UPDATE` 的 `rowCount`。
PostgreSQL 该 rowCount:
- 新插入 → 1
- 冲突更新 → 1
- 冲突无操作 (DO NOTHING) → 0

`inlineUpsert` 实现 (line 285): `upserted += result.rowCount`, 这意味着:

- 每次循环, 即使 ON CONFLICT 命中, 也算 1
- 实际"新插入"和"更新"被合并为 `upserted`, 但代码 line 292 写死 `inserted = upserted` (line 292) 和 `updated = 0` (line 293)

**问题**: `inserted_count` 实际反映的是 "成功执行 ON CONFLICT 路径的行数", 不是 "真正新插入的行数"。

### 7.2 改进建议 (不改代码, 仅文档化)

1. **数据消费者**: 不要把 `inserted_count` 当作 "新增行数", 应理解为 "成功 upsert 行数"
2. **真实新增**: 应该用 `unified_*.created_at` 区分 (需要查表, 慢)
3. **失败检测**: `failed_count` 不可信, 因为 dispatcher 静默 continue 跳过坏数据
4. **建议增加字段**: `skipped_count` 应反映 sourceId 解析失败的行数, 当前 dispatcher 没统计

### 7.3 不修改业务逻辑的理由

Sprint 范围明确: "**禁止** 新表接入" / "**只允许** SQL 验证 / Dispatcher 审查 / 文档 / 修复统计口径"。"修复统计口径" 限定在文档层, 不动 dispatcher 代码。**真正的修复**放到 Sprint 2H.2 (单独 sprint, 改 dispatcher)。

## 8. 已交付清单

- `scripts/sprint-2h1r-coverage.ts` — 13 张表全矩阵
- `scripts/sprint-2h1r-deep.ts` — 3 张 inline upsert 表的 sourceId 解析验证
- `scripts/sprint-2h1r-schema.ts` — source_restore 5 张关键表 schema
- `scripts/sprint-2h1r-sh01-truth.ts` — SH01 最近 push 的真实落库数
- `docs/database-analysis/sprint-2h1r-dispatcher-coverage-audit.md` — 本文档

## 9. 结论

1. **白名单 13 张表里, 只有 5 张 (38.5%) 真实可用**
2. **3 张表 (D) 字段名错配, dispatcher 静默跳过, package success 是误导**
3. **5 张表 (C) 是占位或源端无数据, 不算"broken"**
4. **真实完成度: 5/13 = 38.5%**
5. **修复路径清晰**: Sprint 2H.2 改 3 个 dispatcher 函数 (dispatchMagzines / dispatchSlots / dispatchLogicalVolume)
6. **不建议移出白名单**: 修复比移除更合理

## 10. 后续 Sprint 建议

1. **2H.2 (P0)**: 修复 `dispatchMagzines` / `dispatchSlots` / `dispatchLogicalVolume` 的 sourceIdField + 列名映射
2. **2H.3 (P0)**: 修复 `inlineUpsert` 区分 inserted / updated / skipped, 让 `failed_count` 真实反映错误
3. **2H.4 (P1)**: 实现 3 张占位表 (lib_task / volume_slot / user_task) 的聚合器逻辑
4. **2H.5 (P1)**: 验证 tbl_site / tbl_platform 的源端数据来源 (源表当前 0 行)
