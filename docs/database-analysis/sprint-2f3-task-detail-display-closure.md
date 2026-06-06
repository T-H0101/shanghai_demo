# Sprint 2F.3 - 任务详情页收口 + 缺失字段空态强化

> **日期**: 2026-06-06
> **范围**: Tasks 页面 (app/tasks/page.tsx) 字段展示语义收口
> **前置**: Sprint 2F.1 (8 字段补全) + Sprint 2F.2A (确认 tbl_task_items 不存在)
> **后续**: -

---

## 一、本次修改文件清单

| 文件 | 类型 | 说明 |
|---|---|---|
| `app/tasks/page.tsx` | 修改 | 数据源徽章、运行时提示、字段格式化、API/mock 模式差异 |
| `lib/types/task.ts` | 修改 | 补 `taskMode / runtime / currentPhase` 字段到 TaskItem (与 DTO 对齐) |
| `docs/database-analysis/sprint-2f3-task-detail-display-closure.md` | 新增 | 本文档 |
| `docs/database-analysis/sprint-2f2a-task-items-profile.md` | 更新 | 补充 2F.3 视角 |
| `docs/summary/PROJECT_STATUS.md` | 更新 | 反映 2F.3 收口状态 |
| `scripts/sprint-2f3-verify-sh01.ts` | 新增 | 验证 SH01 disc 数据, 排查 bigint type 误判 |

---

## 二、Tasks 字段分类 (Step 1)

### A. 真实字段 (DB 直读, Sprint 2B+)
- 基础: `id, taskNo, name, type, phase, status, priority`
- 业务: `archiveName, siteName, siteCode, operator, department`
- 时间: `startedAt, updatedAt`
- 统计: `fileCount, totalSize, deviceId, deviceName`

### B. 真实字段 (nullable, Sprint 2F.1 接入)
- `progress: number | null` — completed=100, 否则 tbl_disc 聚合或 null
- `runtime: number | null` — update_dt - create_dt (秒)
- `packageCount, successCount, errorCount: number | null` — tbl_disc 聚合
- `errorMessage: string | null` — tbl_task.ret_msg (常见值 "0")
- `taskMode: number | null` — tbl_task.task_mode
- `currentPhase: string | null` — tbl_disc.max(stage)

### C. 无源字段 (Sprint 2F.2A 确认不可接)
- `volumeId` — tbl_task_items.volume_id (表不在 source_restore)
- `sourcePath, packagePath` — tbl_task_items.root_path/original_path (同上)
- `speed, remainingTime, currentFile` — 实时运行字段, 源 schema 无持久化
- `sm3Status, sm3Progress` — tbl_task_certif_status 不在 source_restore
- `retryCount, lastRetryAt` — 源表无此字段
- `completedAt` — 源表无完成时间字段
- `packagingThreads` — 源 schema 无线程级实时数据
- `recentLogs` — 源 schema 无日志流接入

### D. mock-only 字段 (mock 模式默认, API 模式无真实值)
- `dataClassification` — 默认 "馆藏档案"
- `packagingMode` — 默认 "scan_while_package"
- `backupScope` — 默认 "full"
- `packagedSize` — mock 随机数
- `restoreMode / selectedFiles / recoveryLogs` — mock 演示用

---

## 三、修复的展示语义 (Step 2)

### 3.1 进度 (progress)
| 状态 | 显示 |
|---|---|
| phase=completed | "100%" |
| 有真实 progress > 0 | "${progress}%" + 进度条 |
| null / 0 | "—" (不再显示 "0%") |

### 3.2 运行耗时 (runtime)
| 值 | 显示 |
|---|---|
| null/undefined | "—" |
| 0-59s | "Xs" (e.g. "28s") |
| 60-3599s | "XmYs" (e.g. "5m31s") |
| ≥3600s | "XhYm" (e.g. "1h12m") |

**新工具函数** `formatRuntime(seconds)` 在 `app/tasks/page.tsx` 中实现。

### 3.3 计数字段 (packageCount / successCount / errorCount)
| 值 | 显示 |
|---|---|
| null/undefined | "—" |
| 0 | "0" (重要: 真实 0 区别于 null) |
| > 0 | 数字 |

**新工具函数** `formatCount(n)` 强制保留 0 值, 避免把"无错误"误判为"无数据"。

### 3.4 错误信息 (errorMessage)
| 值 | 显示 |
|---|---|
| null/undefined/空字符串/"0" | "—" (不在页面上显示) |
| 其他 | 红色"失败原因"提示条 |

**新工具函数** `formatErrorMessage(msg)` 过滤占位符 "0"。

### 3.5 实时运行字段 (speed/remainingTime)
| 模式 | 显示 |
|---|---|
| API 模式 (isApiMode=true) | "暂无实时数据" (明确告知) |
| mock 模式 | mock 中的假数据 |

### 3.6 SM3 / 阶段 / 模式
- `sm3Status`: completed=通过 / failed=失败 / in_progress=进行中 / pending=待校验 / undefined=—
- `taskMode`: 数字 → "模式 N" (e.g. "模式 0")
- `currentPhase`: 字符串直接显示, 缺失 → "—"

### 3.7 路径字段 (volumeId/sourcePath/packagePath)
- API 模式 + 空值 → "—"
- 其他 → 真实值 (mock 模式仍展示)

### 3.8 日志 (recentLogs)
- API 模式 + 空 → "运行日志未接入"
- mock 模式 + 空 → "暂无日志"

### 3.9 多线程封包 (packagingThreads)
- **API 模式**: 整段隐藏 (无源数据)
- **mock 模式**: 保留原展示

### 3.10 重试次数 (retryCount)
- API 模式: "—" (无源)
- mock 模式: 数字 (默认 0)

---

## 四、API mode / mock mode 差异 (Step 3)

| 组件 | API mode (统一视图) | Mock mode (演示) |
|---|---|---|
| 数据源徽章 (header) | 绿色 "DB" | 黄色 "MOCK" |
| 实时运行提示条 | ✅ 显示 | ❌ 隐藏 |
| 速度/剩余时间 | "暂无实时数据" | mock 假数据 |
| 进度 > 0 才显示 | ✅ | ✅ |
| 运行耗时格式化 | ✅ (28s/5m31s/1h12m) | 兼容 |
| 错误信息过滤 "0" | ✅ | 兼容 |
| 计数字段保留 0 | ✅ | 兼容 |
| 多线程封包段 | 隐藏 | 显示 |
| 重试次数 | "—" | 数字 |
| 数据分类 | 空时 "—" | 默认 "馆藏档案" |
| 路径字段 | 空时 "—" | 保留 |
| 任务操作按钮 | 仅"详情/暂停/恢复" | mock 中所有按钮可用 |

**关键改动**: 新增 `isApiMode` import + `DataSourceBadge` + `RuntimeDataNotice` 两个轻量组件, **不影响 mock 模式演示样式**。

---

## 五、API 检查结果 (Step 5)

### 5.1 SH01 抽样

```json
{
  "taskNo": "SH01-1",
  "progress": 100,
  "runtime": 26,
  "packageCount": 1,
  "successCount": 1,
  "errorCount": 0,
  "currentPhase": null,
  "taskMode": 0,
  "errorMessage": "0"
}
```

✅ 8 个 nullable 字段全部正确返回
✅ 无伪造 speed/remainingTime/currentFile/sm3Status
✅ null 表示"无 disc 记录", 0 表示"有 disc 但计数为 0"

### 5.2 已知模式

| 任务类型 | 字段表现 |
|---|---|
| 有 disc 记录 (1, 5, 18-33 等) | packageCount/successCount/errorCount 有真实值 |
| 无 disc 记录 (10-17, 30+ 等) | 计数为 null, progress null, currentPhase null |
| 有 stage 字段 (5, 20+) | currentPhase 真实值 |
| 无 stage 字段 | currentPhase null |
| 所有任务的 ret_msg | "0" (Sprint 2F.1 验证过) |

### 5.3 数据库 bigint 类型

`tbl_disc.task_id` 和 `tbl_task.id` 都是 `bigint` 类型。Sprint 2F.1 验证导入时 type 一致, 聚合查询正常 (脚本 `sprint-2f3-verify-sh01.ts` 复现)。

---

## 六、页面验证 (Step 6)

- `pnpm exec tsc --noEmit`: exit **0** ✅
- `pnpm build`: ✅ 成功
- `pnpm smoke:sync`: success, duplicateDetected=true ✅
- `/api/tasks?siteCode=SH01&pageSize=20` 200, 字段齐全
- mock mode 兼容: `DataSourceBadge` 改为 "MOCK", `RuntimeDataNotice` 不渲染, `packagingThreads` 段正常显示

---

## 七、仍然无法显示的字段 (Step 6)

| 字段 | 原因 | 后续路径 |
|---|---|---|
| `volumeId` | tbl_task_items 不在 source_restore | 2F.2A 文档化待源表 |
| `sourcePath` / `packagePath` | tbl_task_items 不在 source_restore | 同上 |
| `speed` / `remainingTime` / `currentFile` | 实时字段, 源 schema 无持久化 | 等站点推实时状态 |
| `sm3Status` / `sm3Progress` | tbl_task_certif_status 不在 source_restore | 等 SM3 校验源接入 |
| `retryCount` / `lastRetryAt` | 源表无此字段 | 等源端改造 |
| `completedAt` | 源表无此字段 | 等源端改造 |
| `packagingThreads` | 无线程级实时数据 | 等站点推 |
| `recentLogs` | 无日志流接入 | 等日志通道 |

---

## 八、为什么不接 tbl_task_items

- Sprint 2F.2A 确认 `tbl_task_items` 在 `source_restore` **不存在**
- 即使存在, 体量未知, 不符合"不把未知体量表直接当小表 full sync" 禁止事项
- 推荐策略: 站点侧聚合后通过 package 推送 (Sprint 2F.3B 方向)

---

## 九、为什么不伪造进度/速度

- 项目约束: ❌ 不伪造 speed / remainingTime / currentFile / volumeId / sourcePath / packagePath
- 业务约束: 伪造数据会让运维误判, 比"显示 —"更危险
- 显示策略: 真实数据 → 准确值, 无数据 → "—" 或 "暂无实时数据" (明确提示)
- API mode: 用 "暂无实时数据" 提示用户等待站点推送
- mock mode: 保留原演示数据, 不影响 UX

---

## 十、固定统计

```
Sprint 2F.3 完成统计
=====================
本次新增统一表: 0
本次新增源表接入: 0
本次新增 API: 0 (扩展 /api/tasks 返回类型无变化)
本次新增前端页面: 0
本次新增 mapper/upsert: 0
本次影响 package: 否
本次不伪造: speed/remainingTime/currentFile/sm3Status/packagingThreads/retryCount
本次影响登录: 否
本次影响 file-index: 否
本次影响后端 schema: 否
本次 UI 增强: 6 处 (progress/runtime/counts/errorMessage/speed/logs)
本次类型字段补全: 3 个 (taskMode/runtime/currentPhase 加到 lib/types/task.ts)
```

---

## 十一、git status / commit / push

- 已 commit, 已 push (见最终报告)
