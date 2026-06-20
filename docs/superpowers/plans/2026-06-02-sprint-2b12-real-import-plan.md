# Sprint 2B.12 真实 source_restore Import 试点实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从 source_restore 读取真实 tbl_task / tbl_disc_lib，通过真实 mapper 转换后 UPSERT 写入 unified_tasks / unified_devices，CLI 手动触发。

**Architecture:** 新增 lib/import/ 模块连接 source_restore，复用现有 upsert.ts 写入 unified_disc_platform。不修改现有 API，不新增 API，不影响 mock sync 和 JSON ingest。

**Tech Stack:** Node.js/TypeScript, PostgreSQL (pg), CLI script

**前置条件：**
- source_restore 数据库已存在于 unified_disc_postgres 容器
- tbl_task 37 条记录，tbl_disc_lib 4 条记录
- unified_disc_platform 中 unified_tasks 13 条、unified_devices 5 条（不受影响）
- pg_restore_test 容器暂保留
- .env.local 需配置 `SOURCE_DATABASE_URL`

---

## 前置条件确认

| 项目 | 状态 |
|------|------|
| source_restore 数据库 | ✅ 已在 unified_disc_postgres 中 |
| tbl_task | ✅ 37 条记录 |
| tbl_disc_lib | ✅ 4 条记录 |
| unified_disc_platform | ✅ 未受影响 |
| pg_restore_test | ✅ 暂保留 |

---

## 文件变更计划

### 新增文件

| 文件 | 职责 |
|------|------|
| `lib/db/source-pool.ts` | source_restore 独立连接池 |
| `lib/import/real-field-mapper.ts` | 真实源表 → unified_* 字段映射（int→string 枚举、字段重命名、敏感字段脱敏） |
| `lib/import/task-importer.ts` | 从 source_restore 读取 tbl_task，映射后写入 unified_tasks |
| `lib/import/device-importer.ts` | 从 source_restore 读取 tbl_disc_lib，映射后写入 unified_devices |
| `scripts/import-from-source.ts` | CLI 入口，支持 `tasks [siteCode]` / `devices [siteCode]` / `all [siteCode]` |

### 修改文件

| 文件 | 修改内容 | 影响范围 |
|------|---------|---------|
| `lib/sync/types.ts` | UnifiedDeviceRecord 新增可选字段：model?, manufacturer?, serial_no?, slot_count?, cage_count?, use_status?, site_code? | 新字段全部 optional，不破坏现有代码 |
| `lib/sync/upsert.ts` | upsertDevicesInTransaction SQL 增加 model, manufacturer, serial_no, slot_count, cage_count, use_status, site_code 列（INSERT + ON CONFLICT UPDATE） | 新增列使用 COALESCE(EXCLUDED.col, old.col) 或直接 EXCLUDED，确保旧调用方传 null 时不覆盖已有值 |
| `.env.example` | 新增 `SOURCE_DATABASE_URL=postgresql://<source_user>:<source_password>@localhost:5432/source_restore` | 仅占位 |
| `package.json` | 新增 scripts（取决于 tsx 方案，见 Task 0） | 仅新增，不改现有 |

### 不修改的文件

| 文件 | 原因 |
|------|------|
| `lib/db/postgres.ts` | 不污染现有中心库连接池 |
| `lib/sync/field-mapper.ts` | mock mapper 保留不动 |
| `lib/sync/tasks-sync.ts` | mock sync 保留 |
| `lib/sync/devices-sync.ts` | mock sync 保留 |
| `lib/ingest/*` | JSON ingest 全部保留 |
| `app/api/*` | 不新增、不修改任何 API 路由 |
| `lib/mock/*` | 前端 mock 数据不动 |

---

## 数据库连接方案

### 新增环境变量

```bash
# .env.local（用户自行配置，不提交）
SOURCE_DATABASE_URL=postgresql://<source_user>:<source_password>@localhost:5432/source_restore
```

### .env.example 占位

```bash
# source_restore 数据库连接（用于真实数据导入）
SOURCE_DATABASE_URL=postgresql://<source_user>:<source_password>@localhost:5432/source_restore
```

### 新增 lib/db/source-pool.ts

独立连接池，与 lib/db/postgres.ts 的 getPool() 完全分离。

```typescript
import { Pool } from 'pg'

let sourcePool: Pool | null = null

export function getSourcePool(): Pool {
  if (!sourcePool) {
    const connectionString = process.env.SOURCE_DATABASE_URL
    if (!connectionString) {
      throw new Error('SOURCE_DATABASE_URL is not configured')
    }
    sourcePool = new Pool({
      connectionString,
      min: 2,
      max: 5,
      idleTimeoutMillis: 30000,
    })
    sourcePool.on('error', (err) => {
      console.error('[SourceDB] Unexpected pool error:', err)
    })
  }
  return sourcePool
}

export async function closeSourcePool(): Promise<void> {
  if (sourcePool) {
    await sourcePool.end()
    sourcePool = null
  }
}
```

---

## Mapper 规则表

### Tasks Mapper

| source_restore 字段 | 类型 | → unified_tasks 字段 | 转换规则 |
|-----|-----|-----|-----|
| id | bigint | source_id | String(id) |
| — | — | source_site_id | CLI 参数，默认 "SH01" |
| — | — | source_table | 固定 "tbl_task" |
| — | — | synced_at | new Date() |
| id | bigint | task_no | String(id)（临时方案） |
| task_name | text | task_name | **空值 → null**，非空直接写入 |
| task_type | integer | task_type | 0→"backup"，其余→"unknown_type_{value}" |
| status | integer | status | **统一 "raw_status_{value}"**（不猜测业务含义） |
| — | — | phase | null |
| — | — | priority | null |
| — | — | data_classification | null |
| — | — | archive_name | null |
| — | — | source_path | null |
| — | — | package_path | null |
| — | — | operator | null |
| — | — | department | null |
| total_files | bigint | total_files | 直接写入真实值 |
| total_size | bigint | total_size | 直接写入真实值 |
| cmt | text | notes | 直接（null 保持 null） |
| encrypt | text | raw_data.encrypt | **"[REDACTED]"**（非空时），null 保持 null |
| 全部字段 | — | raw_data | 完整源记录，encrypt 替换为 "[REDACTED]" |

**task_type 枚举映射：**

```typescript
const TASK_TYPE_MAP: Record<number, string> = {
  0: 'backup',        // 备份任务
  1: 'restore',       // 恢复任务
  2: 'burn_and_seal', // 刻录并直接封盘
  3: 'api_task',      // 接口任务
  4: 'scan',          // 扫描任务
  5: 'optical_copy',  // 磁光复制任务
  6: 'volume_copy',   // 卷复制任务
  7: 's3',            // S3任务
  8: 'package',       // 封包任务
  9: 'evidence',      // 存证任务
  10: 'power_on',     // 加电任务
  11: 'remote_backup', // 异地热备任务
}

function mapTaskType(value: number): string {
  return TASK_TYPE_MAP[value] ?? `unknown_type_${value}`
}
```

**status 处理：**

```typescript
// 第一版不猜测业务含义，统一 raw_status_<value>
function mapTaskStatus(value: number): string {
  return `raw_status_${value}`
}
```

**raw_data 构建：**

```typescript
function buildTaskRawData(source: Record<string, unknown>): Record<string, unknown> {
  return {
    ...source,
    encrypt: source.encrypt ? '[REDACTED]' : null,
  }
}
```

### Devices Mapper

| source_restore 字段 | 类型 | → unified_devices 字段 | 转换规则 |
|-----|-----|-----|-----|
| lib_id | integer | source_id | String(lib_id) |
| — | — | source_site_id | CLI 参数，默认 "SH01" |
| — | — | source_table | 固定 "tbl_disc_lib" |
| — | — | synced_at | new Date() |
| lib_id | integer | device_id | String(lib_id)（第一版） |
| name | text | device_name | 直接（null 保持 null） |
| type | integer | device_type | 枚举映射（见下表） |
| device_status | integer | status | 枚举映射（见下表） |
| ip | text | ip_address | 直接（小写 ip） |
| — | — | location | null |
| — | — | room | null |
| — | — | floor | null |
| — | — | total_capacity | null |
| — | — | used_capacity | null |
| vendor | text | manufacturer | 直接（新增写入） |
| model | text | model | 直接（新增写入） |
| sn | text | serial_no | 直接（新增写入） |
| mags | integer | cage_count | 直接（新增写入） |
| slots | integer | slot_count | 直接（新增写入） |
| use_status | smallint | use_status | 直接（新增写入） |
| — | — | site_code | CLI 参数，默认 "SH01" |
| — | — | mode | null |
| — | — | current_task_count | 0 |
| lib_pwd | text | raw_data.lib_pwd | **"[REDACTED]"**（非空时） |
| lib_user | text | raw_data.lib_user | 直接保留 |
| 全部字段 | — | raw_data | 完整源记录，lib_pwd 替换为 "[REDACTED]" |

**device_type 枚举映射：**

```typescript
const DEVICE_TYPE_MAP: Record<number, string> = {
  1: 'gen2_library',
  2: 'gen2_offline',
  3: 'gen1_legacy',
  4: 'gen1_new',
  5: 'gen1_offline',
  6: 'gen3_library',
  7: 'publisher',
  8: 'hdd_library',
  9: 'tape_library',
  10: 'tape_drive',
  11: 'sas_hdd_library',
  12: 'film_library',
  13: 'nas',
  14: 'alarm',
  15: 'gen4_library',
}

function mapDeviceType(value: number | null): string | null {
  if (value === null || value === undefined) return null
  return DEVICE_TYPE_MAP[value] ?? `unknown_type_${value}`
}
```

**device_status 枚举映射：**

```typescript
const DEVICE_STATUS_MAP: Record<number, string> = {
  0: 'offline',
  1: 'online',
  2: 'deleted',
  3: 'warning',
  4: 'error',
}

function mapDeviceStatus(value: number | null): string | null {
  if (value === null || value === undefined) return null
  return DEVICE_STATUS_MAP[value] ?? `unknown_status_${value}`
}
```

**raw_data 构建：**

```typescript
function buildDeviceRawData(source: Record<string, unknown>): Record<string, unknown> {
  return {
    ...source,
    lib_pwd: source.lib_pwd ? '[REDACTED]' : null,
  }
}
```

---

## UPSERT 兼容性方案

### upsertTasksInTransaction

**无需修改。** 现有 SQL 已覆盖全部 19 个写入字段，与 UnifiedTaskRecord 完全匹配。

### upsertDevicesInTransaction

**需要扩展。** 现有 SQL 只写 15 列，需新增 7 列。

**扩展方式：**

在 INSERT 列表和 VALUES 列表中追加：
```sql
model, manufacturer, serial_no, slot_count, cage_count, use_status, site_code
```

在 ON CONFLICT UPDATE SET 中追加：
```sql
model = EXCLUDED.model,
manufacturer = EXCLUDED.manufacturer,
serial_no = EXCLUDED.serial_no,
slot_count = EXCLUDED.slot_count,
cage_count = EXCLUDED.cage_count,
use_status = EXCLUDED.use_status,
site_code = EXCLUDED.site_code,
```

**兼容性保证：**

现有调用方（/api/sync/devices 和 /api/ingest/devices）传入的 UnifiedDeviceRecord 中新增字段为 undefined。INSERT 时 undefined → null，ON CONFLICT UPDATE 时会将这些列更新为 null。

**问题：** 这会把 mock sync / JSON ingest 写入的已有值覆盖为 null。

**解决方案：** ON CONFLICT UPDATE 中对新增列使用条件更新：

```sql
model = COALESCE(EXCLUDED.model, unified_devices.model),
manufacturer = COALESCE(EXCLUDED.manufacturer, unified_devices.manufacturer),
serial_no = COALESCE(EXCLUDED.serial_no, unified_devices.serial_no),
slot_count = COALESCE(EXCLUDED.slot_count, unified_devices.slot_count),
cage_count = COALESCE(EXCLUDED.cage_count, unified_devices.cage_count),
use_status = COALESCE(EXCLUDED.use_status, unified_devices.use_status),
site_code = COALESCE(EXCLUDED.site_code, unified_devices.site_code),
```

**效果：** 如果新值为 null，保留旧值；如果新值非 null，更新为新值。既保证真实 import 能写入，又保证 mock sync / JSON ingest 不会把已有值覆盖为 null。

### UnifiedDeviceRecord 类型扩展

```typescript
export interface UnifiedDeviceRecord {
  // 现有字段（必需）
  source_site_id: string
  source_table: string
  source_id: string
  synced_at: Date
  device_id: string
  device_name: string
  device_type: string
  status: string
  ip_address: string
  location: string
  room: string
  floor: string
  total_capacity: number
  used_capacity: number
  raw_data: DeviceSourceRecord

  // 新增字段（全部 optional）
  model?: string | null
  manufacturer?: string | null
  serial_no?: string | null
  slot_count?: number | null
  cage_count?: number | null
  use_status?: number | null
  site_code?: string | null
}
```

---

## import 触发方式

### 运行方式选择

项目当前没有 tsx 或 ts-node 依赖。方案：

| 方案 | 说明 | 推荐 |
|------|------|------|
| A. 新增 tsx 依赖 | `pnpm add -D tsx`，scripts 中用 `tsx scripts/import-from-source.ts` | 推荐，最简单 |
| B. 用 npx tsx | 不安装，每次 `npx tsx scripts/...`，首次会自动下载 | 可行，但慢 |
| C. 用 node --loader ts-node/esm | 需要 ts-node 依赖 | 不推荐 |
| D. 编译后执行 | 先 tsc 编译 scripts/，再 node 执行 | 过重 |

**推荐方案 A：新增 tsx 为 devDependency。**

### CLI 命令

```bash
# 导入 tasks（默认 siteCode=SH01）
pnpm import:tasks

# 导入 tasks（指定 siteCode）
pnpm import:tasks SH01

# 导入 devices（默认 siteCode=SH01）
pnpm import:devices

# 导入 devices（指定 siteCode）
pnpm import:devices SH01

# 导入全部
pnpm import:all

# 导入全部（指定 siteCode）
pnpm import:all SH01
```

### package.json scripts（待确认 tsx 方案后添加）

```json
{
  "import:tasks": "tsx scripts/import-from-source.ts tasks",
  "import:devices": "tsx scripts/import-from-source.ts devices",
  "import:all": "tsx scripts/import-from-source.ts all"
}
```

---

## 日志策略

### 第一版：console report，不建 import_job_log

输出格式：

```
[Import] Starting tasks import from source_restore...
[Import] Site: SH01
[Import] Source: source_restore.tbl_task
[Import] Reading source records...
[Import] Found 37 records
[Import] Mapping records...
[Import] UPSERT to unified_disc_platform.unified_tasks...
[Import] Done: 37 rows upserted, 0 errors
[Import] Duration: 150ms
```

---

## Task 0: 检查 tsx 方案并决定运行方式

**Decision needed:** 选择新增 tsx / npx tsx / 其他方案。

**Files:**
- Check: `package.json`
- Conditionally modify: `package.json`（新增 devDependency + scripts）

- [ ] **Step 1: 确认 tsx 方案**

如果选择新增 tsx：
```bash
pnpm add -D tsx
```

如果选择 npx tsx：无需安装。

- [ ] **Step 2: 新增 package.json scripts**

```json
"import:tasks": "tsx scripts/import-from-source.ts tasks",
"import:devices": "tsx scripts/import-from-source.ts devices",
"import:all": "tsx scripts/import-from-source.ts all"
```

- [ ] **Step 3: 验证**

Run: `pnpm exec tsc --noEmit`
Expected: 通过

---

## Task 1: 新增 source_restore 连接池

**Files:**
- Create: `lib/db/source-pool.ts`

- [ ] **Step 1: 创建 source-pool.ts**

内容如"数据库连接方案"章节所示。独立连接池，读取 `SOURCE_DATABASE_URL` 环境变量。

- [ ] **Step 2: 更新 .env.example**

新增：
```
# source_restore 数据库连接（用于真实数据导入）
SOURCE_DATABASE_URL=postgresql://<source_user>:<source_password>@localhost:5432/source_restore
```

- [ ] **Step 3: 更新 .env.local**

用户自行新增：
```
SOURCE_DATABASE_URL=postgresql://<source_user>:<source_password>@localhost:5432/source_restore
```

- [ ] **Step 4: 验证 TypeScript 编译**

Run: `pnpm exec tsc --noEmit`
Expected: 通过

---

## Task 2: 扩展 UnifiedDeviceRecord 和 upsertDevicesInTransaction

**Files:**
- Modify: `lib/sync/types.ts`
- Modify: `lib/sync/upsert.ts`

- [ ] **Step 1: 扩展 UnifiedDeviceRecord**

在 `lib/sync/types.ts` 中，UnifiedDeviceRecord 末尾追加 optional 字段：

```typescript
  // 新增字段（真实 import 专用，optional 保证不破坏现有调用）
  model?: string | null
  manufacturer?: string | null
  serial_no?: string | null
  slot_count?: number | null
  cage_count?: number | null
  use_status?: number | null
  site_code?: string | null
```

- [ ] **Step 2: 扩展 upsertDevicesInTransaction SQL**

在 `lib/sync/upsert.ts` 的 upsertDevicesInTransaction 函数中：

INSERT 列表追加：`model, manufacturer, serial_no, slot_count, cage_count, use_status, site_code`

VALUES 追加：`$16, $17, $18, $19, $20, $21, $22`

ON CONFLICT UPDATE SET 追加：
```sql
model = COALESCE(EXCLUDED.model, unified_devices.model),
manufacturer = COALESCE(EXCLUDED.manufacturer, unified_devices.manufacturer),
serial_no = COALESCE(EXCLUDED.serial_no, unified_devices.serial_no),
slot_count = COALESCE(EXCLUDED.slot_count, unified_devices.slot_count),
cage_count = COALESCE(EXCLUDED.cage_count, unified_devices.cage_count),
use_status = COALESCE(EXCLUDED.use_status, unified_devices.use_status),
site_code = COALESCE(EXCLUDED.site_code, unified_devices.site_code),
```

client.query 参数列表追加：
```typescript
record.model ?? null,
record.manufacturer ?? null,
record.serial_no ?? null,
record.slot_count ?? null,
record.cage_count ?? null,
record.use_status ?? null,
record.site_code ?? null,
```

同步修改 upsertDevice 单条函数（如有）。

- [ ] **Step 3: 验证 TypeScript 编译**

Run: `pnpm exec tsc --noEmit`
Expected: 通过

- [ ] **Step 4: 验证构建**

Run: `pnpm build`
Expected: 通过

---

## Task 3: 创建真实 field mapper

**Files:**
- Create: `lib/import/real-field-mapper.ts`

- [ ] **Step 1: 创建 real-field-mapper.ts**

内容包含：
- TASK_TYPE_MAP 枚举
- mapTaskType(value) 函数
- mapTaskStatus(value) 函数（统一 raw_status_<value>）
- DEVICE_TYPE_MAP 枚举
- mapDeviceType(value) 函数
- mapDeviceStatus(value) 函数
- buildTaskRawData(source) 函数（encrypt → "[REDACTED]"）
- buildDeviceRawData(source) 函数（lib_pwd → "[REDACTED]"）
- mapRealTask(source, siteCode) 函数 → UnifiedTaskRecord
- mapRealDevice(source, siteCode) 函数 → UnifiedDeviceRecord

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `pnpm exec tsc --noEmit`
Expected: 通过

---

## Task 4: 创建 task importer

**Files:**
- Create: `lib/import/task-importer.ts`

- [ ] **Step 1: 创建 task-importer.ts**

```typescript
// 1. 从 source_restore 读取 tbl_task
// 2. 调用 mapRealTask 转换
// 3. 通过 transaction + upsertTasksInTransaction 写入 unified_tasks
// 4. 输出 console report
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `pnpm exec tsc --noEmit`
Expected: 通过

---

## Task 5: 创建 device importer

**Files:**
- Create: `lib/import/device-importer.ts`

- [ ] **Step 1: 创建 device-importer.ts**

结构同 task-importer.ts，读取 tbl_disc_lib，调用 mapRealDevice，写入 unified_devices。

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `pnpm exec tsc --noEmit`
Expected: 通过

---

## Task 6: 创建 CLI 入口

**Files:**
- Create: `scripts/import-from-source.ts`

- [ ] **Step 1: 创建 CLI 入口**

```typescript
// 解析命令行参数：
//   node script tasks [siteCode]
//   node script devices [siteCode]
//   node script all [siteCode]
//
// 默认 siteCode = "SH01"
//
// 调用对应的 importer
// 输出 console report
// 关闭连接池
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `pnpm exec tsc --noEmit`
Expected: 通过

- [ ] **Step 3: 验证构建**

Run: `pnpm build`
Expected: 通过

---

## Task 7: 验收测试

- [ ] **Step 1: tsc 检查**

Run: `pnpm exec tsc --noEmit`
Expected: 通过

- [ ] **Step 2: build 检查**

Run: `pnpm build`
Expected: 通过

- [ ] **Step 3: 导入 tasks**

Run: `pnpm import:tasks SH01`
Expected: 37 rows upserted

- [ ] **Step 4: 验证 unified_tasks**

```bash
docker exec -i unified_disc_postgres psql -U unified -d unified_disc_platform \
  -c "SELECT count(*) FROM unified_tasks WHERE source_site_id='SH01' AND source_table='tbl_task';"
```
Expected: 37

- [ ] **Step 5: 导入 devices**

Run: `pnpm import:devices SH01`
Expected: 4 rows upserted

- [ ] **Step 6: 验证 unified_devices**

```bash
docker exec -i unified_disc_postgres psql -U unified -d unified_disc_platform \
  -c "SELECT count(*) FROM unified_devices WHERE source_site_id='SH01' AND source_table='tbl_disc_lib';"
```
Expected: 4

- [ ] **Step 7: 验证幂等性**

再次执行 `pnpm import:all SH01`
Expected: 37 + 4 rows upserted，count 不变

- [ ] **Step 8: 验证 task_name 空值 → null**

```bash
docker exec -i unified_disc_postgres psql -U unified -d unified_disc_platform \
  -c "SELECT source_id, task_name FROM unified_tasks WHERE source_site_id='SH01' AND source_table='tbl_task' LIMIT 3;"
```
Expected: task_name 为 null（不是空字符串）

- [ ] **Step 9: 验证 status 映射**

```bash
docker exec -i unified_disc_postgres psql -U unified -d unified_disc_platform \
  -c "SELECT DISTINCT status FROM unified_tasks WHERE source_site_id='SH01' AND source_table='tbl_task';"
```
Expected: raw_status_0, raw_status_19, raw_status_20

- [ ] **Step 10: 验证 task_type 映射**

```bash
docker exec -i unified_disc_postgres psql -U unified -d unified_disc_platform \
  -c "SELECT DISTINCT task_type FROM unified_tasks WHERE source_site_id='SH01' AND source_table='tbl_task';"
```
Expected: backup

- [ ] **Step 11: 验证 device_type 映射**

```bash
docker exec -i unified_disc_postgres psql -U unified -d unified_disc_platform \
  -c "SELECT DISTINCT device_type FROM unified_devices WHERE source_site_id='SH01' AND source_table='tbl_disc_lib';"
```
Expected: gen3_library, hdd_library

- [ ] **Step 12: 验证 device status 映射**

```bash
docker exec -i unified_disc_postgres psql -U unified -d unified_disc_platform \
  -c "SELECT DISTINCT status FROM unified_devices WHERE source_site_id='SH01' AND source_table='tbl_disc_lib';"
```
Expected: online, offline

- [ ] **Step 13: 验证 raw_data 中 encrypt 为 [REDACTED]**

```bash
docker exec -i unified_disc_postgres psql -U unified -d unified_disc_platform \
  -c "SELECT source_id, raw_data->>'encrypt' as encrypt FROM unified_tasks WHERE source_site_id='SH01' AND source_table='tbl_task' LIMIT 3;"
```
Expected: "[REDACTED]" 或 null

- [ ] **Step 14: 验证 raw_data 中 lib_pwd 为 [REDACTED]**

```bash
docker exec -i unified_disc_postgres psql -U unified -d unified_disc_platform \
  -c "SELECT source_id, raw_data->>'lib_pwd' as lib_pwd FROM unified_devices WHERE source_site_id='SH01' AND source_table='tbl_disc_lib';"
```
Expected: "[REDACTED]" 或 null

- [ ] **Step 15: 验证 model/manufacturer/serial_no 写入**

```bash
docker exec -i unified_disc_postgres psql -U unified -d unified_disc_platform \
  -c "SELECT source_id, model, manufacturer, serial_no, slot_count, cage_count FROM unified_devices WHERE source_site_id='SH01' AND source_table='tbl_disc_lib';"
```
Expected: 有值

- [ ] **Step 16: 验证 /api/sync/* 不受影响**

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/sync/tasks
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/sync/status
```
Expected: 200

- [ ] **Step 17: 验证 /api/ingest/* 不受影响**

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/ingest/tasks \
  -H "Content-Type: application/json" -H "x-api-key: test-api-key-123" \
  -d '{"siteCode":"SH01","sourceTable":"tbl_task","batchId":"verify-after-import","snapshotAt":"2026-06-02T10:00:00Z","recordCount":0,"records":[]}'
```
Expected: 200

- [ ] **Step 18: 验证 unified_disc_platform 其他表不受影响**

```bash
docker exec -i unified_disc_postgres psql -U unified -d unified_disc_platform \
  -c "SELECT count(*) FROM unified_volumes; SELECT count(*) FROM unified_alerts;"
```
Expected: 3, 2（不变）

- [ ] **Step 19: Commit**

```bash
git add lib/db/source-pool.ts lib/import/ scripts/import-from-source.ts \
        lib/sync/types.ts lib/sync/upsert.ts .env.example package.json
git commit -m "feat: implement real source_restore import pilot"
```

---

## 验收标准汇总

| 检查项 | 预期 |
|--------|------|
| tsc --noEmit | 通过 |
| pnpm build | 通过 |
| pnpm import:tasks SH01 | 37 rows upserted |
| pnpm import:devices SH01 | 4 rows upserted |
| unified_tasks (SH01, tbl_task) | 37 条 |
| unified_devices (SH01, tbl_disc_lib) | 4 条 |
| 重复执行 count 不变 | 幂等 |
| task_name 空值 → null | ✅ |
| status | raw_status_0 / raw_status_19 / raw_status_20 |
| task_type | backup |
| device_type | gen3_library / hdd_library |
| device status | online / offline |
| raw_data.encrypt | "[REDACTED]" 或 null |
| raw_data.lib_pwd | "[REDACTED]" 或 null |
| model/manufacturer/serial_no | 有值 |
| /api/sync/* | 正常 |
| /api/ingest/* | 正常 |
| unified_volumes / unified_alerts count | 不变 |

---

## 风险与待确认

| 编号 | 问题 | 处理方式 |
|------|------|---------|
| 1 | tbl_task.status 0/19/20 含义未知 | 统一 raw_status_<value>，等领导确认 |
| 2 | task_no 用 id 是临时方案 | 后续如有业务编号再调整 |
| 3 | source_site_id 第一版 SH01 | CLI 参数可覆盖 |
| 4 | task_name 为空 | 写入 null，前端后续处理 |
| 5 | 是否需关联其他表获取 operator/department/location | 第一版不导入，后续按需 |
| 6 | upsertDevicesInTransaction 新增列兼容性 | 使用 COALESCE 保证旧调用方不覆盖 |
| 7 | tsx 依赖 | 需确认方案后安装 |

---

## 不做事项

| 不做 | 原因 |
|------|------|
| 不清理 pg_restore_test | 暂保留参考 |
| 不删除 mock | 保留本地验证 |
| 不删除 JSON ingest | 作为备选保留 |
| 不做 UI | 后续 Sprint |
| 不做 sites/volumes | 等试点验证 |
| 不处理 tbl_file/tbl_folder | 不在范围 |
| 不做 ES | 后续 Sprint |
| 不做多站点 | 只做 SH01 试点 |
| 不做自动定时导入 | 只做手动触发 |
| 不建 import_job_log | 第一版 console report 足够 |
| 不新增 API | CLI 触发 |

---

*Plan created: 2026-06-02*
*Sprint 2B.12: 真实 source_restore Import 试点*
