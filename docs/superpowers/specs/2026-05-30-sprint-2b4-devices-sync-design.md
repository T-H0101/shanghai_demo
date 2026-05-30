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
4. **扩展字段存 raw_data**：last_heartbeat/operator/device_status

---

## unified_devices 字段核对

| mock 字段 | unified_devices 字段 | 处理 |
|-----------|----------------------|------|
| id | source_id | ✅ |
| device_no | device_id | ✅ |
| device_name | device_name | ✅ |
| device_type | device_type | ✅ |
| device_status | status | ✅ 主字段存储，原始值存 raw_data |
| ip_address | ip_address | ✅ 直接映射（主字段 VARCHAR(50)） |
| location | location | ✅ |
| room | room | ✅ |
| floor | floor | ✅ |
| total_capacity | total_capacity | ✅ |
| used_capacity | used_capacity | ✅ |
| last_heartbeat | - | raw_data |
| operator | - | raw_data |

**结论**：现有 unified_devices 字段足够，ip_address 直接映射，无需 ALTER。

---

## 文件结构

```
databases/sprint-2b4/
└── mock-tbl-disc-lib.sql    # 新增：mock_tbl_disc_lib seed（幂等）

lib/sync/
├── config.ts                 # 修改：添加 DEVICE_SYNC_CONFIG
├── sync-engine.ts            # 新增：最小同步引擎（~50 行）
├── upsert.ts                 # 修改：新增 upsertDevice/upsertDevicesInTransaction
├── tasks-sync.ts             # 修改：改用 sync-engine + upsert
├── devices-sync.ts           # 新增
├── types.ts                  # 修改：添加 DeviceSourceRecord/UnifiedDeviceRecord
├── source-reader.ts          # 修改：新增 readDiscLibSource
├── field-mapper.ts           # 修改：新增 mapDiscLibToTarget
└── dto.ts                    # 已有

app/api/sync/
├── tasks/route.ts            # 已有
└── devices/route.ts          # 新增
```

---

## SyncResult 结构（必须与现有类型一致）

```typescript
// lib/sync/types.ts
interface SyncResult {
  status: 'success' | 'skipped' | 'failed'
  rowsRead: number
  rowsUpserted: number
  rowsSkipped: number
  startedAt: string
  finishedAt: string
  lastSourceIdBefore: number
  lastSourceIdAfter: number
  message?: string
  error?: string
}
```

**sync-engine 返回必须与此结构一致**，确保 /api/sync/tasks 行为不变。

---

## UPSERT 策略

**最小可控方案**：保留 upsertTask，新增 upsertDevice，共享工具函数

```typescript
// lib/sync/upsert.ts

// 已有
export async function upsertTask(record: UnifiedTaskRecord): Promise<number>
export async function upsertTasksInTransaction(
  records: UnifiedTaskRecord[],
  onProgressUpdate: (maxSourceId: number, syncedRows: number) => Promise<void>
): Promise<{ rowsUpserted: number; maxSourceId: number }>

// 新增
export async function upsertDevice(record: UnifiedDeviceRecord): Promise<number>
export async function upsertDevicesInTransaction(
  records: UnifiedDeviceRecord[],
  onProgressUpdate: (maxSourceId: number, syncedRows: number) => Promise<void>
): Promise<{ rowsUpserted: number; maxSourceId: number }>
```

**不做**：通用 SQL 生成器、动态表名 SQL 拼接。

---

## sync-engine 设计

```typescript
// lib/sync/sync-engine.ts
interface SyncInput<T> {
  config: SyncObjectConfig
  readSource: (lastId: number) => Promise<T[]>
  mapToTarget: (source: T) => Record<string, unknown>
  getSourceId: (source: T) => number  // 提取 source id
  upsertBatch: (
    records: Record<string, unknown>[],
    onProgressUpdate: (maxSourceId: number, syncedRows: number) => Promise<void>
  ) => Promise<{ rowsUpserted: number; maxSourceId: number }>
}

export async function runSync<T>(input: SyncInput<T>): Promise<SyncResult>
// 返回结构与现有 types.ts SyncResult 完全一致
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

### 2. devices-sync.ts

```typescript
// lib/sync/devices-sync.ts
export async function syncDevices(): Promise<SyncResult> {
  return runSync({
    config: DEVICE_SYNC_CONFIG,
    readSource: readDiscLibSource,
    mapToTarget: mapDiscLibToTarget,
    getSourceId: (source) => source.id,
    upsertBatch: upsertDevicesInTransaction,
  })
}
```

### 3. mock_tbl_disc_lib（幂等）

```sql
-- databases/sprint-2b4/mock-tbl-disc-lib.sql

CREATE TABLE IF NOT EXISTS mock_tbl_disc_lib (
  id BIGSERIAL PRIMARY KEY,
  device_no VARCHAR(100) UNIQUE NOT NULL,
  device_name VARCHAR(200),
  device_type VARCHAR(50),
  device_status VARCHAR(50),
  ip_address VARCHAR(100),
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

-- 幂等 seed 数据
INSERT INTO mock_tbl_disc_lib (device_no, device_name, device_type, device_status, ip_address, location, room, floor, total_capacity, used_capacity, last_heartbeat, operator)
VALUES
  ('DL-SH01-001', '光盘库-上海01', 'disc_library', 'online', '192.168.1.101', '上海数据中心', 'A区机房', '1楼', 10000000000000, 5000000000000, NOW(), '张三'),
  ('DL-SH01-002', '光盘库-上海02', 'disc_library', 'offline', '192.168.1.102', '上海数据中心', 'A区机房', '2楼', 8000000000000, 2000000000000, NOW(), '李四'),
  ('DL-SH02-001', '光盘库-苏州01', 'disc_library', 'online', '192.168.2.101', '苏州数据中心', 'B区机房', '1楼', 12000000000000, 8000000000000, NOW(), '王五')
ON CONFLICT (device_no) DO NOTHING;
```

---

## 字段映射规则

| mock_tbl_disc_lib | unified_devices | 处理 |
|-------------------|------------------|------|
| id | source_id | 转为字符串 |
| device_no | device_id | ✅ |
| device_name | device_name | ✅ |
| device_type | device_type | ✅ |
| device_status | status | ✅ 主字段存储 |
| ip_address | ip_address | ✅ 直接映射 |
| location | location | ✅ |
| room | room | ✅ |
| floor | floor | ✅ |
| total_capacity | total_capacity | ✅ |
| used_capacity | used_capacity | ✅ |
| last_heartbeat | - | raw_data |
| operator | - | raw_data |

**raw_data 结构**（保存完整 source record）：
```json
{
  "device_no": "DL-SH01-001",
  "device_status": "online",
  "last_heartbeat": "2026-05-30T10:00:00Z",
  "operator": "张三"
}
```

---

## 实现顺序（必须分步验收）

### Phase 1: 解决 UPSERT 重复 + tasks 重构

1. **重构 tasks-sync.ts 使用 sync-engine + upsert**
2. **单独验收 tasks**：
   ```
   # 干净环境
   pnpm db:down && pnpm db:up
   pnpm db:init
   pnpm db:init:sync

   # 验收 tasks 同步
   curl -X POST http://localhost:3000/api/sync/tasks

   # 验证返回结构
   - status: "success" 或 "skipped"
   - rowsRead, rowsUpserted, rowsSkipped
   - startedAt, finishedAt
   - lastSourceIdBefore, lastSourceIdAfter

   # 验证数据
   SELECT * FROM unified_tasks;
   SELECT * FROM sync_job_log WHERE source_table = 'tbl_task';
   ```

   **必须行为不变**：返回结构、记录数、状态与重构前一致

### Phase 2: 实现 devices 同步

1. 添加 `DEVICE_SYNC_CONFIG` 到 config.ts
2. 添加 `DeviceSourceRecord` / `UnifiedDeviceRecord` 类型到 types.ts
3. 创建 `mock_tbl_disc_lib`（seed 数据）
4. 实现 `readDiscLibSource` 函数（source-reader.ts）
5. 实现 `mapDiscLibToTarget` 函数（field-mapper.ts）
6. 新增 `upsertDevice` / `upsertDevicesInTransaction`（upsert.ts）
7. 创建 `devices-sync.ts`
8. 创建 `POST /api/sync/devices`

### Phase 3: 验收

1. `POST /api/sync/devices` 首次同步 rowsRead=3, rowsUpserted=3
2. 第二次 `POST /api/sync/devices` status=skipped（无新数据）
3. `GET /api/sync/status` 同时出现 `tbl_task` 和 `tbl_disc_lib`
4. `GET /api/sync/logs` 同时出现 `tbl_task` 和 `tbl_disc_lib` 的 job
5. 查询 `unified_devices` raw_data 包含扩展字段

---

## 不做事项

- ❌ 不 ALTER unified_devices
- ❌ 不引入 ISyncHandler/工厂模式
- ❌ 不做定时任务/调度器
- ❌ 不接真实源库
- ❌ 不改 UI
- ❌ 不处理 tbl_file/tbl_folder
- ❌ 不做通用 SQL 生成器

---

## 验收标准

| # | 标准 | 验证方式 |
|---|------|----------|
| 1 | tasks 同步仍正常 | POST /api/sync/tasks 返回结构与原来一致 |
| 2 | devices 首次同步 | POST /api/sync/devices → rowsRead=3, rowsUpserted=3 |
| 3 | devices 二次同步 | 再次 POST → status=skipped |
| 4 | sync_progress 两类 | GET /api/sync/status 包含 tbl_task 和 tbl_disc_lib |
| 5 | sync_job_log 两类 | GET /api/sync/logs 包含两类 job |
| 6 | raw_data 完整 | 查询 unified_devices raw_data 验证 last_heartbeat/operator/device_status |

---

*设计完成: 2026-05-30*
*修正: ip_address 直接映射、验收命令修正、SyncResult 结构对齐*