# Phase 3: P0 Demo 微调检查

> 文档版本: v1.0
> 更新时间: 2026-05-28

---

## 一、检查范围

基于 `lib/types/` 中的类型定义和 `lib/mock/` 中的 Mock 数据，检查 P0 Demo 需要哪些调整以适配未来数据库接入。

---

## 二、类型系统检查

### 2.1 当前类型状态

| 类型文件 | 当前字段 | 缺少的 DB 字段 |
|----------|---------|---------------|
| `task.ts` | `id`, `name`, `type`, `phase`, `status` 等 | `source_site_id`, `source_id`, `synced_at`, `update_dt` |
| `rack.ts` | `id`, `rackId`, `siteName`, `status` 等 | `source_site_id`, `source_id`, `synced_at`, `update_dt` |
| `site.ts` | `id`, `name`, `code`, `ip`, `lastSyncAt` | 已基本覆盖 |
| `common.ts` | 基础枚举定义 | - |

### 2.2 缺少的溯源字段

根据架构文档 `id-strategy.md`，所有同步表应包含：

```typescript
// 溯源字段（所有同步表都需要）
interface SyncMetadata {
  sourceSiteId: string;    // 来源站点 ID
  sourceTable: string;     // 来源表名
  sourceId: number;       // 原始主键
  syncedAt: string;       // 同步时间
  updateDt?: string;      // 源表更新时间（用于增量同步）
}
```

---

## 三、字段差异分析

### 3.1 任务表 (tbl_task vs TaskItem)

| 源表字段 | 类型定义字段 | 差异说明 |
|----------|-------------|----------|
| `id` | `id: string` | ✓ 已有，但需要新增 `sourceId: number` |
| `uuid` | - | 需要保留原始 UUID |
| `task_type` | `type: TaskType` | ✓ 类型映射 |
| `task_name` | `name: string` | ✓ 已有 |
| `status` | `status: TaskStatus` | ✓ 类型映射 |
| `burn_status` | - | 需要新增 `burnStatus` |
| `total_files` | `fileCount?: number` | ✓ 已有 |
| `total_size` | `totalSize?: string` | ✓ 已有 |
| `create_dt` | `startedAt: string` | ✓ 语义相同 |
| `update_dt` | `updatedAt: string` | ✓ 语义相同 |
| **缺少** | `sourceSiteId` | 新增溯源字段 |
| **缺少** | `sourceTable` | 新增溯源字段 |
| **缺少** | `sourceId` | 新增原始 ID |
| **缺少** | `syncedAt` | 新增同步时间 |

### 3.2 设备表 (tbl_disc_lib vs Rack)

| 源表字段 | 类型定义字段 | 差异说明 |
|----------|-------------|----------|
| `lib_id` | `id: string` | ✓ 已有 |
| `name` | `rackName: string` | ✓ 语义相同 |
| `device_status` | `status: RackStatus` | ✓ 类型映射 |
| `type` | `deviceType?: string` | ✓ 已有 |
| `ip` | `ip?: string` | ✓ 已有 |
| `mags` | `cages: string[]` | ⚠️ 需要调整 |
| `slots` | `totalSlots: number` | ✓ 已有 |
| `group_id` | - | 需要新增分组关联 |
| `use_status` | `mode?: DeviceMode` | ⚠️ 需要调整 |
| **缺少** | `sourceSiteId` | 新增溯源字段 |
| **缺少** | `sourceId` | 新增原始 ID |
| **缺少** | `syncedAt` | 新增同步时间 |
| **缺少** | `updateDt` | 新增更新时间 |

### 3.3 告警表 (tbl_early_warning)

当前未找到独立的 Alert 类型，需要确认是否在 `common.ts` 或其他文件中定义。

---

## 四、微调建议

### 4.1 类型扩展（非破坏性修改）

根据 CLAUDE.md 约束「禁止修改 Mock 数据结构」，优先扩展类型：

```typescript
// lib/types/task.ts 新增
export interface TaskSyncMetadata {
  sourceSiteId: string;    // 来源站点 ID
  sourceTable: string;    // 固定值 'tbl_task'
  sourceId: number;       // 原始 ID
  syncedAt: string;       // 同步时间
  updateDt: string;       // 源表更新时间
}

// TaskItem 可选扩展字段
export interface TaskItemWithSync extends TaskItem {
  syncMetadata?: TaskSyncMetadata;
}
```

### 4.2 Mock 数据适配

当前 Mock 数据结构保持不变，未来后端接入时可新增字段：

```typescript
// lib/mock/tasks.ts 示例扩展
const task: TaskItem = {
  id: "task_001",
  name: "2026年档案备份",
  // ... 现有字段

  // 新增溯源字段（后端接入后启用）
  syncMetadata: {
    sourceSiteId: "site_shanghai",
    sourceTable: "tbl_task",
    sourceId: 1001,
    syncedAt: "2026-05-28T10:00:00Z",
    updateDt: "2026-05-28T09:55:00Z",
  }
}
```

### 4.3 API 层预留

后端接入时，API 层应预留溯源字段：

```typescript
// app/api/tasks/route.ts 预留
export async function GET(request: Request) {
  const tasks = await db.query(`
    SELECT
      id,
      name,
      status,
      source_site_id,
      source_id,
      synced_at,
      update_dt
    FROM unified_tasks
  `);

  return Response.json(tasks);
}
```

---

## 五、不需要修改的部分

根据检查，以下部分暂不需要调整：

| 模块 | 状态 | 说明 |
|------|------|------|
| 页面路由 | ✓ 无需修改 | 路由结构已定 |
| UI 组件 | ✓ 无需修改 | Radix UI 组件库 |
| Mock 认证 | ✓ 无需修改 | Site-based 权限隔离 |
| 数据关联 | ✓ 无需修改 | 任务↔站点↔设备↔存储卷 |
| 列表筛选 | △ 待扩展 | 增加站点筛选 |

---

## 六、Phase 3 结论

```
┌─────────────────────────────────────────────────────────────┐
│                    Phase 3 检查结论                        │
├─────────────────────────────────────────────────────────────┤
│  ✓ P0 Demo 类型系统可扩展支持数据库字段                     │
│  ✓ 无需破坏性修改，保持 Mock 数据结构                       │
│  △ 未来接入时需新增：                                       │
│    - TaskItem.syncMetadata                                  │
│    - Rack.syncMetadata                                      │
│    - Site.syncMetadata                                      │
│  ○ UI 展示暂不需要调整                                      │
│  ○ API 层后端接入时预留字段                                 │
└─────────────────────────────────────────────────────────────┘
```

**结论**：P0 Demo 无需立即修改，保留扩展点供后端接入时使用。

---

## 七、行动项

| 序号 | 行动项 | 优先级 | 状态 |
|------|--------|--------|------|
| 1 | 在 TypeScript 类型中新增 `SyncMetadata` 接口 | P2 | 未来 |
| 2 | API 层预留 source_site_id 等字段 | P2 | 未来 |
| 3 | 页面列表增加站点筛选下拉（可选） | P2 | 未来 |
| 4 | Dashboard 站点切换逻辑扩展 | P2 | 未来 |