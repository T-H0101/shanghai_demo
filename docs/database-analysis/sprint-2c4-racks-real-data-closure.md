# Sprint 2C.4 — Racks 页面企业级收口 + 数据源标识

> **日期**: 2026-06-04
> **前置**: 2C.1 API 接入、2C.2 容量聚合、2C.3 task status mapper

---

## 一、设备真实数据链路

```
source_restore.tbl_disc_lib（设备主表）
source_restore.tbl_magzines（盘笼表，lib_id 关联）
source_restore.tbl_slots（盘位表，mag_id → tbl_magzines.lib_id）
    │
    ▼
lib/import/real-field-mapper.ts     ← mapRealDevice()
lib/import/device-capacity-aggregator.ts  ← aggregateAllCapacity()
lib/import/device-importer.ts       ← importDevices()
    │
    ▼
unified_devices 表（unified_disc_platform）
    │
    ▼
app/api/racks/route.ts              ← GET /api/racks
    │
    ▼
lib/api/api-providers.ts            ← apiRackProvider.getAll()
    │
    ▼
app/racks/page.tsx                  ← Racks 页面展示
```

## 二、字段来源说明

| 展示字段 | 数据源 | 说明 |
|----------|--------|------|
| device_name | tbl_disc_lib.name | 设备名称 |
| device_type | tbl_disc_lib.type → DEVICE_TYPE_MAP | 设备类型枚举映射 |
| status | tbl_disc_lib.device_status → DEVICE_STATUS_MAP | 在线/离线状态 |
| ip_address | tbl_disc_lib.ip | IP 地址 |
| slot_count | tbl_slots COUNT(*) | 总盘位数 |
| used_slots | tbl_slots COUNT(*) WHERE max_cap > rest_cap | 已使用盘位数 |
| cage_count | tbl_magzines COUNT(*) | 盘笼数 |
| total_capacity | tbl_slots SUM(max_cap) | 总容量（字节） |
| used_capacity | tbl_slots SUM(max_cap - rest_cap) | 已用容量（字节） |
| remaining_capacity | tbl_slots SUM(rest_cap) | 剩余容量（字节） |
| usage_percent | used_capacity / total_capacity | 使用率 |
| location | 无数据源 | 未配置 |
| room | 无数据源 | 未配置 |
| floor | 无数据源 | 未配置 |

## 三、数据源标识方案

**API 响应**：`/api/racks` 返回 `source: "database"` 字段。

**Provider 追踪**：`apiRackProvider.getAll()` 检查响应中的 `source` 字段，通过 `getRacksDataSource()` 暴露给前端。

**前端展示**：
- API mode + database → 正常展示
- API mode + fallback → 显示 amber 提示条："当前数据库不可用，正在显示模拟数据"
- Mock mode → 正常展示 mock 数据，不显示提示

## 四、空态修正

| 设备 | totalSlots | usedSlots | usagePercent | 容量显示 |
|------|-----------|-----------|-------------|---------|
| HD32-X | 96 | 8 | 24% | 291.0 TB / 221.8 TB |
| BD200 | 200 | 48 | 24% | 130.4 GB / 99.6 GB |
| BD100 | 100 | 15 | 14% | 65.2 GB / 55.9 GB |
| ntest | 0 | — | — | — / — |
| SH01 设备 | 96/200/100 | —/—/— | — | — / — |

- 无容量数据时：usagePercent 显示 "—"（不显示 0%）
- totalSlots=0 时：盘位列显示 "—"
- totalSlots>0 但 usedSlots 无数据时：显示 "—/96"

## 五、多 siteCode 策略

当前 /api/racks 返回所有 siteCode 的设备（TEST_CLEAN + SH01 + JSON ingest）。

**当前处理**：
- 不删除任何数据
- 不硬编码 siteCode 筛选
- /api/racks 已支持 `?siteCode=` 参数

**正式环境建议**：
- 由前端站点选择器控制 siteCode 筛选
- 或通过环境变量 `DEFAULT_SITE_CODE` 指定默认站点

## 六、当前限制

1. **device_config 未建**：location/room/floor 无数据源，暂显示未配置
2. **DB fallback mock**：仅用于开发/兜底，生产环境应禁用或明确提示
3. **多 siteCode 数据**：需正式站点筛选机制
4. **ntest 测试设备**：无容量数据，显示空态
5. **SH01 早期 import**：无容量聚合数据，需重跑 import 补充
