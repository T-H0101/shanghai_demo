# Sprint 2B.4 - Devices 同步实现设计

> **日期**: 2026-05-30
> **状态**: 设计完成，待审批

---

## 目标

实现第二个同步对象（devices），验证多同步对象模式，同时解决 UPSERT 重复问题。

---

## 对应 requirements.md

| 章节 | 内容 |
|------|------|
| 2.1 站点管理/站点监控 | 设备信息汇聚 |
| 2.3 数据同步/设备信息同步 | 盘库设备数据同步 |
| 4.3 盘笼统一管理前置数据 | 设备数据基础 |
| 6.4 可维护性/状态监控基础 | 同步状态可视化 |

---

## 设计原则

1. **最小 sync-engine**：~50 行公共逻辑，不引入接口/工厂/调度
2. **复用现有 schema**：不 ALTER unified_devices
3. **统一源字段规范**：source_site_id + source_table + source_id
4. **扩展字段存 raw_data**：ip_address/last_heartbeat/operator/device_status

---

## 文件结构

```
databases/sprint-2b4/
└── mock-tbl-disc-lib.sql    # 新增：mock_tbl_disc_lib seed 数据

lib/sync/
├── config.ts                 # 修改：添加 DEVICE_SYNC_CONFIG
├── sync-engine.ts            # 新增：最小同步引擎（~50 行）
├── upsert.ts                 # 已有
├── tasks-sync.ts             # 修改：改用 sync-engine + upsert
├── devices-sync.ts           # 新增
├── types.ts                  # 修改：添加 DeviceSourceRecord
└── dto.ts                    # 已有

app/api/sync/
├── tasks/route.ts            # 已有
└── devices/route.ts          # 新增
```

---

## 核心组件设计

### 1. DEVICE_SYNC_CONFIG

```typescript
// lib/sync/config.ts
export const DEVICE_SYNC_CONFIG = {
  sourceTable: 'tbl_disc_lib',       // 真实源表名
  targetTable: 'unified_devices',   // 目标统一表
  mockSourceTable: 'mock_tbl_disc_lib',  // mock 源表
  sourceSiteCode: DEFAULT_SITE_CODE,
} as const
```

### 2. sync-engine.ts（最小同步引擎）

```typescript
// lib/sync/sync-engine.ts
interface SyncInput {
  config: SyncObjectConfig
  readSource: (lastId: number) => Promise<unknown[]>
  mapToTarget: (source: unknown) => Record<string, unknown>
}

interface SyncResult {
  rowsRead: number
  rowsUpserted: number
  rowsSkipped: number
  maxSourceId: number
}

export async function runSync(input: SyncInput): Promise<SyncResult>
// 职责：读源 → 映射 → UPSERT → 更新进度
// 不做：接口/工厂/调度/定时/重试
```

### 3. devices-sync.ts

```typescript
// lib/sync/devices-sync.ts
export async function syncDevices(): Promise<SyncResult> {
  return runSync({
    config: DEVICE_SYNC_CONFIG,
    readSource: readDiscLibSource,
    mapToTarget: mapDiscLibToTarget,
  })
}
```

### 4. mock_tbl_disc_lib 字段

```sql
-- databases/sprint-2b4/mock-tbl-disc-lib.sql
CREATE TABLE mock_tbl_disc_lib (
  id BIGSERIAL PRIMARY KEY,
  device_no VARCHAR(100) UNIQUE,     -- 映射到 device_id
  device_name VARCHAR(200),
  device_type VARCHAR(50),
  device_status VARCHAR(50),         -- 映射到 status，原始值存 raw_data
  ip_address VARCHAR(100),           -- 存入 raw_data
  location VARCHAR(200),
  room VARCHAR(100),
  floor VARCHAR(50),
  total_capacity BIGINT DEFAULT 0,
  used_capacity BIGINT DEFAULT 0,
  last_heartbeat TIMESTAMPTZ,
  operator VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 字段映射规则

| mock_tbl_disc_lib | unified_devices | 说明 |
|-------------------|------------------|------|
| id | source_id | 转为字符串 |
| device_no | device_id | |
| device_name | device_name | |
| device_type | device_type | |
| device_status | status | 原始值存 raw_data |
| ip_address | - | raw_data |
| location | location | |
| room | room | |
| floor | floor | |
| total_capacity | total_capacity | |
| used_capacity | used_capacity | |
| last_heartbeat | - | raw_data |
| operator | - | raw_data |

**raw_data 结构**：
```json
{
  "device_status": "online",
  "ip_address": "192.168.1.100",
  "last_heartbeat": "2026-05-30T10:00:00Z",
  "operator": "张三"
}
```

---

## 实现顺序

### Phase 1: 解决 UPSERT 重复

1. 重构 tasks-sync.ts 使用 sync-engine + upsert.ts
2. 验证 POST /api/sync/tasks 行为不变
3. 确认 sync_job_log 有记录，unified_tasks 有数据

### Phase 2: 实现 devices 同步

1. 添加 DEVICE_SYNC_CONFIG 到 config.ts
2. 添加 DeviceSourceRecord 类型到 types.ts
3. 创建 mock_tbl_disc_lib（seed 数据）
4. 实现 readDiscLibSource 函数
5. 实现 mapDiscLibToTarget 函数
6. 创建 devices-sync.ts
7. 创建 POST /api/sync/devices

### Phase 3: 验收

1. POST /api/sync/devices → unified_devices 有数据
2. GET /api/sync/status 包含 tbl_task 和 tbl_disc_lib
3. GET /api/sync/logs 包含两类 job

---

## 不做事项

- ❌ 不 ALTER unified_devices
- ❌ 不引入 ISyncHandler/工厂模式
- ❌ 不做定时任务/调度器
- ❌ 不接真实源库
- ❌ 不改 UI
- ❌ 不处理 tbl_file/tbl_folder

---

## 验收标准

| # | 标准 | 验证方式 |
|---|------|----------|
| 1 | tasks 同步仍正常 | POST /api/sync/tasks → sync_job_log 有记录 |
| 2 | devices 同步跑通 | POST /api/sync/devices → unified_devices 有数据 |
| 3 | sync_progress 看到两类 | GET /api/sync/status 包含 tbl_task 和 tbl_disc_lib |
| 4 | sync_job_log 记录两类 | GET /api/sync/logs 包含两类 job |
| 5 | status/logs 接口不用改 | 参数化查询自动支持 |
| 6 | raw_data 包含扩展字段 | 查询 unified_devices raw_data 验证 |

---

*设计完成: 2026-05-30*