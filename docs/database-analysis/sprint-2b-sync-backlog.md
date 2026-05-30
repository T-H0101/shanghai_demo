# Sprint 2B 同步模块 Backlog

> 日期: 2026-05-30
> 状态: 待处理

---

## 一、已完成

| Sprint | 内容 | 状态 |
|--------|------|------|
| Sprint 2B.1 | Docker PostgreSQL + 中心库初始化 | ✅ |
| Sprint 2B.2 | tasks 同步闭环 | ✅ |
| Sprint 2B.3 | status/logs 查询接口 | ✅ |
| Sprint 2B.3.1 | 同步模块架构清理 | ✅ |

---

## 二、后续重构项

### 2.1 UPSERT SQL 重复

**问题**: `tasks-sync.ts` 与 `upsert.ts` 存在 UPSERT SQL 重复

**现状**:
- `lib/sync/upsert.ts` 提供 `upsertTask()` / `upsertTasksInTransaction()`
- `lib/sync/tasks-sync.ts` 内嵌了相同的 UPSERT SQL（70+ 行）
- 当前 tasks-sync 内联实现更细粒度（逐条处理 + 获取 maxSourceId）

**建议时机**: 后续扩展多表同步前统一封装

**涉及文件**:
- `lib/sync/tasks-sync.ts`
- `lib/sync/upsert.ts`

---

### 2.2 client 类型改进

**问题**: `updateProgressInTransaction` 参数 `client: any` 应改为 `PoolClient`

**现状**:
- `@/lib/db/postgres.ts` 导出 `PoolClient` 类型
- 但 `@/lib/db/index.ts` 未导出
- 当前使用 `any` 是为了避免导入问题

**建议时机**: 扩展多表同步前统一调整

**涉及文件**:
- `lib/sync/sync-progress.ts:59`
- `lib/db/index.ts`（需导出 PoolClient）

---

### 2.3 多表同步封装

**前置条件**:
- [ ] UPSERT 重复已解决
- [ ] client 类型已改进
- [ ] 需要同步 devices/volumes 等新对象

**涉及文件**:
- `lib/sync/config.ts`（新增 DEVICE_SYNC_CONFIG 等）
- `lib/sync/handlers/`（可选，抽象同步处理器）

---

## 三、已验证结论

### 3.1 config.ts 架构验证

```typescript
// 当前结构（验证通过）
export const DEFAULT_SITE_CODE = 'SH01'
export const TASK_SYNC_CONFIG = {
  sourceTable: 'tbl_task',
  targetTable: 'unified_tasks',
  mockSourceTable: 'mock_tbl_task',
  sourceSiteCode: DEFAULT_SITE_CODE,
} as const
```

### 3.2 参数化函数签名（验证通过）

| 函数 | 签名 |
|------|------|
| getProgress | `(siteCode, sourceTable)` |
| getOrCreateProgress | `(siteCode, sourceTable)` |
| updateProgressInTransaction | `(client, siteCode, sourceTable, newSourceId, syncedRows)` |
| updateProgressFailed | `(siteCode, sourceTable, error)` |
| createJobLog | `(siteCode, sourceTable)` |
| getLatestJobLog | `(sourceTable)` |

---

*Backlog 创建: 2026-05-30*
*下次处理时机: Sprint 2B.3.2 或 Sprint 2B.4 扩展多表同步前*