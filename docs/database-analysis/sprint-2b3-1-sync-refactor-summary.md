# Sprint 2B.3.1 同步模块轻量架构清理总结

> 日期: 2026-05-30
> 状态: 完成

## 一、任务概述

对 lib/sync 同步模块做轻量架构清理，减少硬编码，为后续扩展 devices/volumes 同步做准备。

## 二、清理内容

### 2.1 新增文件

| 文件 | 说明 |
|------|------|
| `lib/sync/config.ts` | 统一配置常量 |

### 2.2 修改文件

| 文件 | 修改内容 |
|------|----------|
| `lib/sync/sync-progress.ts` | 参数化 getProgress/getOrCreateProgress/updateProgressInTransaction/updateProgressFailed |
| `lib/sync/sync-job-log.ts` | 参数化 createJobLog/getLatestJobLog |
| `lib/sync/tasks-sync.ts` | 使用统一配置常量，调用参数化函数 |
| `lib/sync/source-reader.ts` | 移除硬编码常量 |
| `lib/sync/field-mapper.ts` | 使用统一配置常量 |

### 2.3 清理的硬编码

| 原硬编码 | 清理方式 |
|----------|----------|
| `SITE_CODE = 'SH01'` | 统一为 `DEFAULT_SITE_CODE` 放在 config.ts |
| `SOURCE_TABLE = 'tbl_task'` | 统一为 `TASK_SYNC_CONFIG.sourceTable` 放在 config.ts |

## 三、配置结构

### 3.1 config.ts

```typescript
export const DEFAULT_SITE_CODE = 'SH01'

export const TASK_SYNC_CONFIG = {
  sourceTable: 'tbl_task',
  targetTable: 'unified_tasks',
  mockSourceTable: 'mock_tbl_task',
  sourceSiteCode: DEFAULT_SITE_CODE,
} as const
```

### 3.2 参数化函数签名

| 文件 | 函数 | 新签名 |
|------|------|--------|
| sync-progress.ts | getProgress | `(siteCode, sourceTable)` |
| sync-progress.ts | getOrCreateProgress | `(siteCode, sourceTable)` |
| sync-progress.ts | updateProgressInTransaction | `(client, siteCode, sourceTable, newSourceId, syncedRows)` |
| sync-progress.ts | updateProgressFailed | `(siteCode, sourceTable, error)` |
| sync-job-log.ts | createJobLog | `(siteCode, sourceTable)` |
| sync-job-log.ts | getLatestJobLog | `(sourceTable)` |

## 四、约束遵守

| 约束 | 状态 |
|------|------|
| 不连接真实源库 | ✅ |
| 不扩展 devices/volumes 同步 | ✅ |
| 不改 UI | ✅ |
| 不替换页面数据源 | ✅ |
| 不做定时任务 | ✅ |
| 不做登录权限 | ✅ |
| 不处理大表 | ✅ |
| 不重构整个项目 | ✅ |
| 不大规模移动文件 | ✅ |
| 不破坏现有 tasks 同步功能 | ✅ |

## 五、测试结果

| 测试项 | 结果 |
|--------|------|
| pnpm exec tsc --noEmit | ✅ |
| pnpm build | ✅ |
| POST /api/sync/tasks | ✅ |
| GET /api/sync/status | ✅ |
| GET /api/sync/status 精确查询 | ✅ |
| GET /api/sync/logs | ✅ |
| GET /api/sync/logs 过滤查询 | ✅ |

## 六、后续扩展

### 6.1 扩展第二个同步对象

当需要同步 devices/volumes 时：

1. 在 config.ts 添加新的配置：
```typescript
export const DEVICE_SYNC_CONFIG = {
  sourceTable: 'tbl_device',
  targetTable: 'unified_devices',
  sourceSiteCode: DEFAULT_SITE_CODE,
} as const
```

2. 在对应的 sync 函数中传入新配置：
```typescript
const progress = await getOrCreateProgress(
  DEVICE_SYNC_CONFIG.sourceSiteCode,
  DEVICE_SYNC_CONFIG.sourceTable
)
```

### 6.2 当前仍然只支持 tasks 同步

- 当前 POST /api/sync/tasks 仍然同步 SH01 + tbl_task
- 默认参数使现有调用保持兼容
- 参数化架构为多站点、多表同步做好准备

## 七、相关文档

| 文档 | 用途 |
|------|------|
| `docs/superpowers/specs/2026-05-30-sync-status-logs-api-design.md` | Sprint 2B.3 接口设计 |
| `docs/testing/sprint-2b3-test-plan.md` | Sprint 2B.3 测试计划 |

---

*总结创建: 2026-05-30*
*Sprint 2B.3.1 - 同步模块轻量架构清理*