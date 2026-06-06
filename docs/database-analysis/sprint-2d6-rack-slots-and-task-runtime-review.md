# Sprint 2D.6 盘位详情与任务实时字段审查

## 1. 结论

- Racks 汇总字段来自 `unified_devices`，盘位格子此前来自前端默认推断，不是真实明细。
- 原 `/api/racks/[id]/slots` 实际读取 mock，现已改为只读中心库 `unified_slots`。
- 中心库目前有 `unified_slots`，但只有 1 条 `TEST_PKG10` 测试记录，且其 `device_id=DEV-9001` 与设备 `device_id=9001` 不一致，无法安全关联。
- `source_restore.tbl_slots` 有 396 条，但前端 API 不直接读取源库，本 Sprint 也不补做临时直连。
- 非完成任务没有可靠实时进度、速度和剩余时间来源，前端统一使用空态，不伪造动态值。

## 2. Racks 数据流

| 数据 | 当前来源 | 状态 |
|---|---|---|
| 设备列表 | `/api/racks` → `unified_devices` | 真实 |
| totalSlots / usedSlots | CLI 聚合 `tbl_slots + tbl_magzines` 后写 `unified_devices` | 真实汇总 |
| totalCapacity / remainingCapacity | `unified_devices` | 真实汇总 |
| cages / slots | `/api/racks/[id]/slots` → `unified_slots` | 真实明细，当前大多为空 |
| mock slots | mock provider | 仅 mock mode |

此前 API mode 的 `RackDTO.slots` 为空，页面却按 `totalSlots` 生成格子，因此所有未知盘位被错误显示为“空闲”。

## 3. 中心盘位数据

`unified_slots` 已存在，字段包括：

- 关联：`source_site_id`、`source_table`、`source_id`、`device_id`、`magazine_id`
- 盘位：`slot_id`、`slot_index`、`status`、`occupied`
- 介质：`media_id`、`media_type`、`capacity`
- 元数据：`raw_data`

审查时记录数：

| 指标 | 数值 |
|---|---:|
| unified_slots | 1 |
| occupied | 1 |
| source sites | 1 |
| source_restore.tbl_slots | 396 |

`tbl_slots` CLI 当前只参与设备容量和盘位数量聚合，不把 396 条明细写入 `unified_slots`。

## 4. Slot API

接口：

```text
GET /api/racks/{rackId}/slots?siteCode={siteCode}
```

规则：

- 只查询 `unified_devices`、`unified_slots`、`unified_magazines`。
- 使用 `siteCode + device_id/source_id` 关联，避免多站点同 ID 串数据。
- 返回 `cages[]` 和 `slots[]`，包含 source IDs、盘笼、盘位、状态、容量和介质字段。
- 无明细返回 HTTP 200、`source=empty` 和空数组。
- 缺少 `siteCode` 且设备 ID 跨站点重复时返回 HTTP 400。

前端 API mode 进入设备详情时延迟请求该接口；空数据只显示“盘位明细未同步，当前仅展示汇总”。

## 5. Package 字段风险

2D.3 `tbl_slots` dispatcher 当前按以下规范化字段写入：

```text
id, slot_id, slot_index, device_id, magazine_id, status,
occupied, media_id, media_type, capacity
```

真实 `tbl_slots` 字段是：

```text
slot_id, mag_id, slot_order, disc_type, serial_num,
max_cap, rest_cap, disc_side, hd_type, group_id, cmt
```

两者不一致，且 dispatcher 的 source ID 当前取 `id`，真实记录只有 `slot_id`。按 Sprint 限制，本次不修改 package dispatcher；后续必须先定义真实 mapper，再推送盘位全量小表。

## 6. Tasks 实时字段

| 字段 | 当前来源 | API mode 展示 |
|---|---|---|
| status / phase | `unified_tasks.status` 映射 | 展示 |
| progress | 完成状态映射为 100，其余无可靠来源 | 完成 100%，其余 `—` |
| speed | mock-only / 中心表无字段 | `—` |
| remainingTime | 无中心字段、无站点来源 | `—` |
| sm3Status | mock-only | 未同步时 `—` |

不实现自动增长动画，不根据状态或时间估算进度与剩余时间。

## 7. 控制接口

- API mode：模式切换、扫描、RAID 校验、生成任务、挂载、添加介质和恢复任务均提示“设备控制接口未接入”。
- mock mode：保留原 mock 操作逻辑。
- 本 Sprint 不新增开机、关机或任务设置后端接口。

## 8. 后续站点推送需求

### 盘位明细

站点需要按真实源字段推送 `tbl_slots`，总控 mapper 负责：

- `mag_id → magazine_id`
- `slot_order + 1 → slot_index`
- `disc_type → status/occupied`
- `serial_num → media_id`
- `max_cap/rest_cap → capacity/usedCapacity/remainingCapacity`
- `hd_type → media_type`
- 通过 `tbl_magzines.mag_id → lib_id` 得到 `device_id`

### 任务实时字段

需要领导确认站点是否能提供：

- `progress_percent`
- `processed_files / total_files`
- `processed_bytes / total_size`
- `speed_bytes_per_sec`
- `estimated_remaining_seconds`
- `runtime_updated_at`

这些字段进入中心表前必须明确采样频率、过期判断和任务终态规则。
