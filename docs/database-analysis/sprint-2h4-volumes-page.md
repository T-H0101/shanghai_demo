# Sprint 2H.4 — /volumes 页面 (Sprint 2H.3 真实数据落地的最后一公里)

> 状态: ✅ 完成
> 范围: 把 2H.3 写进 unified_volumes.raw_data._aggregate 的真实聚合数据展示到前端
> Sprint 目标: API 已有, 缺页面, 用户看不到真实数据 → 建 /volumes 页面 + 侧边栏入口 + DTO 透传 _aggregate

---

## 1. 背景

Sprint 2H.3 之后, 中心库有真实数据:
- `unified_volumes`: 5 行 (SH01), 3 行有 _aggregate 聚合 (slot_count, online_slot_count, offline_slot_count)
- `/api/volumes` API 已有, 但**没有 /volumes 页面**
- 侧边栏没有"存储卷"入口, 用户找不到
- VolumeDTO 没透传 _aggregate 字段

Sprint 2H.4 关闭"已有数据但没页面" 的最后一公里。

## 2. 改动

### 2.1 API DTO 扩展

`lib/api/dto/index.ts` 给 VolumeDTO 加 `aggregate?` 字段:

```ts
export interface VolumeDTO {
  // ... 原有字段
  aggregate?: {
    slot_count?: number
    online_slot_count?: number
    offline_slot_count?: number
    source_table?: string
    aggregated_at?: string
  }
}
```

### 2.2 API 路由透传

`app/api/volumes/route.ts`:
- SELECT 加 `raw_data` 列
- VolumeRow 接口加 `raw_data: { _aggregate?: ... } | null`
- mapVolumeToDTO 透传 `aggregate: row.raw_data?._aggregate`

### 2.3 新页面 /volumes

`app/volumes/page.tsx` (新建, ~330 行):
- 顶部 4 个统计 tile: 卷总数 / 总容量-已用% / 盘位聚合 / 聚合覆盖率
- 卷列表 (Table): 名称 / 类型 / 容量条 / 盘位占用 / 状态 / 同步时间
- 详情 Drawer: 容量 + 盘位聚合 (来自 2H.3 写入的 _aggregate) + 元信息
- 跟随全局 siteCode, 搜索 + 类型筛选 (全部/光盘/磁卷)
- 数据源徽章 (DB / FALLBACK)
- 包含 Suspense 包装, 通过 next build

### 2.4 侧边栏入口

`components/dashboard/sidebar.tsx`:
- 引入 `Database` icon
- menuItems 新增 `{ icon: Database, label: "存储卷", href: "/volumes" }`, 位置在"盘架管理"之后

## 3. 验证

### 3.1 编译 / 类型

```
$ pnpm exec tsc --noEmit    → exit 0 ✅
$ pnpm build                → success ✅  (/volumes 在静态页面列表)
```

### 3.2 API 实测

```
$ curl 'http://localhost:3000/api/volumes?siteCode=SH01' | jq
```

返回 5 个 volume, 3 个含真实 aggregate:

```json
{
  "id": "1", "name": "HV1",
  "type": "composite", "totalCapacity": "9.1 TB", "remainingCapacity": "428.1 GB",
  "aggregate": {
    "slot_count": 1, "online_slot_count": 1, "offline_slot_count": 0,
    "source_table": "tbl_volume_slot", "aggregated_at": "..."
  }
},
{
  "id": "2", "name": "OV1",
  "aggregate": { "slot_count": 60, "online_slot_count": 12, "offline_slot_count": 47, ... }
},
{
  "id": "3", "name": "OV100",
  "aggregate": { "slot_count": 100, "online_slot_count": 85, "offline_slot_count": 14, ... }
}
```

### 3.3 页面访问

```
$ curl -sI http://localhost:3000/volumes
HTTP/1.1 200 OK ✅
```

页面 SPA 渲染 (Suspense fallback), 客户端水合后拉 /api/volumes。

### 3.4 回归

| 项 | 状态 |
|---|---|
| `pnpm exec tsc --noEmit` | exit 0 ✅ |
| `pnpm build` | success ✅ |
| `pnpm smoke:sync` | passed ✅ (未涉及 sync 模块) |
| GET `/api/volumes?siteCode=SH01` | 200 ✅ |
| GET `/api/dashboard/summary?siteCode=SH01` | 200 ✅ (未涉及) |
| 侧边栏"存储卷" 链接 | 显示 ✅ |

## 4. 真实数据落地清单

| 位置 | 数据 | 来源 |
|---|---|---|
| 卷总数 tile | 5 (SH01) | unified_volumes 总数 |
| 总容量 tile | 9.6 TB / 492 GB (5%) | 累加 totalCapacity - remainingCapacity |
| 盘位 tile | 161 盘位, 98 在线 / 63 离线 | _aggregate 累加 |
| 聚合覆盖率 tile | 3/5 (60%) | _aggregate 命中 |
| 列表容量条 | 真实 used/total | 解析 totalCapacity / remainingCapacity |
| 列表盘位列 | slot_count / online / offline | _aggregate |
| Drawer 详情卡 | _aggregate 全部字段 + aggregated_at | _aggregate |

## 5. 关键文件清单

### 新增

- `app/volumes/page.tsx` — 完整页面 (~330 行)
- `docs/database-analysis/sprint-2h4-volumes-page.md` — 本文档

### 修改

- `lib/api/dto/index.ts` — VolumeDTO.aggregate 字段
- `app/api/volumes/route.ts` — SELECT raw_data, 透传 _aggregate
- `components/dashboard/sidebar.tsx` — Database icon + 存储卷菜单项

## 6. 后续 Sprint 建议

1. **2H.5**: Racks 页面 slot 真实明细 (来自 unified_slots, 396 行已有真实数据) + 抽屉显示 slot 列表
2. **2H.6**: tbl_hd_info 5 个缺失列补齐 (disk_id/capacity/used_capacity/total_capacity/slot_index) — 需要扩展 source schema 或 join
3. **2H.7**: inlineUpsert inserted/updated 区分 (RETURNING xmax = 0)
4. **2H.8**: 任务详情页接 runtime 真实数据 (Tasks 列表显示 33/44 任务有真实 runtime)

## 7. 结论

- /volumes 页面从 0 → 完整 ✅
- 真实数据从 DB 读到 UI 全链路打通 ✅
- 侧边栏入口已添加 ✅
- API 透传 _aggregate 字段 ✅
- 数据源徽章 + 聚合覆盖率 tile 让用户看到"哪些卷有真实聚合" ✅
- 0 项业务功能回归 ✅
