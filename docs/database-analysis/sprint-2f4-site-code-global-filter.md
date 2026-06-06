# Sprint 2F.4 - siteCode 全局筛选与多站点视角收口

> **日期**: 2026-06-07
> **范围**: 全局 siteCode 状态 + 4 个 API + 3 个页面 + file-index 防跨站点
> **前置**: Sprint 2F.1 (任务域 P0) + Sprint 2F.2A (tbl_task_items 拒绝) + Sprint 2F.3 (字段空态)
> **后续**: -

---

## 一、本次修改文件清单 (9 files)

| 文件 | 类型 | 说明 |
|---|---|---|
| `lib/site/site-context.tsx` | 新增 | SiteProvider + useSite hook (localStorage + URL 同步) |
| `components/site/site-selector.tsx` | 新增 | Header 站点选择器 |
| `components/layout/app-shell.tsx` | 修改 | 挂载 SiteProvider (Suspense 包裹) |
| `components/dashboard/header.tsx` | 修改 | Header 加 SiteSelector |
| `app/tasks/page.tsx` | 修改 | loadFiltered 注入 siteCode; 切换重载 |
| `app/racks/page.tsx` | 修改 | loadRacks 注入 siteCode; 切换重载 |
| `app/sync/page.tsx` | 修改 | loadPackages 注入 siteCode; 切换重载 |
| `app/api/tasks/[id]/files/route.ts` | 修改 | 接受 siteCode 防 source_id 跨站点冲突 |
| `components/tasks/task-file-index-panel.tsx` | 修改 | 透传 siteCode 到 API |
| `docs/database-analysis/sprint-2f4-site-code-global-filter.md` | 新增 | 本文档 |
| `docs/summary/PROJECT_STATUS.md` | 更新 | 反映全局站点能力 |
| `docs/summary/SYNC_ARCHITECTURE.md` | 更新 | 同步侧补 siteCode |
| `docs/summary/ROADMAP.md` | 更新 | 2F.4 标记完成 |

---

## 二、当前 siteCode 支持矩阵 (Step 1)

| API/Page | 之前 siteCode 支持 | 来源 | 状态 |
|---|---|---|---|
| `/api/tasks` | ✅ 已支持 `?siteCode=` | query | 沿用 |
| `/api/tasks/[id]/files` | ⚠️ 通过 taskId 内部 lookup, 无显式 siteCode | internal | **Sprint 2F.4 补齐** |
| `/api/racks` | ✅ 已支持 `?siteCode=` | query | 沿用 |
| `/api/racks/[id]/slots` | ✅ 已支持 `?siteCode=` (必需) | query | 沿用 |
| `/api/volumes` | ✅ 已支持 `?siteCode=` | query | 沿用 |
| `/api/sync/packages` | ✅ 已支持 `?siteCode=` | query | 沿用 |
| `/api/sync/packages/[id]/tables` | ✅ 透出 site_code (response) | response | 沿用 |
| Tasks 页面 | ❌ 无 siteCode filter | none | **Sprint 2F.4 接入** |
| Racks 页面 | ❌ 无 siteCode filter | none | **Sprint 2F.4 接入** |
| Sync Center | ⚠️ 本地 input filter | local state | **Sprint 2F.4 增强全局** |

---

## 三、Site selector 实现方案 (Step 2)

### 3.1 选型

**采用方案 D: localStorage + URL query 组合**

| 维度 | 设计 |
|---|---|
| 状态层 | React Context (`SiteContext`) |
| 持久化 | `localStorage[unified.selectedSiteCode]` |
| URL 同步 | `?siteCode=SH01` (在切换时主动 replace) |
| 默认值 | `null` = All Sites |
| 候选列表 | 固定 (`SITE_CANDIDATES`), 不依赖 tbl_site |

### 3.2 关键 API

```ts
const { siteCode, isAllSites, setSiteCode, isReady } = useSite()
// siteCode: string | null
// isAllSites: boolean
// setSiteCode(code: string | null): void
// isReady: boolean  // 首次 hydration 后
```

### 3.3 候选列表

```ts
export const SITE_CANDIDATES = [
  { code: ALL_SITES, label: "全部站点" },
  { code: "SH01", label: "SH01" },
  { code: "TEST_CLEAN", label: "TEST_CLEAN" },
  { code: "TEST_PKG", label: "TEST_PKG" },
  { code: "TEST_SMOKE", label: "TEST_SMOKE" },
  { code: "BJ02", label: "BJ02" },
]
```

**不依赖 tbl_site** 的原因:
- Sprint 2E.3 确认 tbl_site 是监控域, 非总控站点主表
- 候选列表基于"已确认在 source_restore 中存在任务的 siteCode"硬编码
- 后续可扩展 (用户加新站点时改 `SITE_CANDIDATES`)

### 3.4 行为

| 操作 | 行为 |
|---|---|
| 首次访问 | 读 URL > localStorage > 默认 All Sites |
| 切换 siteCode | localStorage.setItem + URL.replace (不刷页) |
| All Sites (null) | URL `?siteCode=__all__`, localStorage `__all__` |
| 切换页面 | URL 自带 siteCode, context 重新初始化, 自动保持视角 |
| mock mode | 行为一致, mock 数据通过 `mockTaskProvider` 不受 siteCode 影响 |

---

## 四、页面接入结果 (Step 3)

### 4.1 Tasks 页面 (`app/tasks/page.tsx`)

- `useSite()` 拿到 siteCode + isAllSites
- `loadFiltered` 在 isAllSites=false 时把 siteCode 注入 `taskProvider.getAll({ siteCode })`
- `useEffect` 监听 `siteReady` 后启动, siteCode 切换会自动重载
- 测试:
  - All Sites → 87 条 (跨 SH01/TEST_CLEAN/TEST_PKG/TEST_SMOKE/BJ02/PKG_TEST/TEST_PKG10)
  - SH01 → 44 条
  - TEST_CLEAN → 37 条

### 4.2 Racks 页面 (`app/racks/page.tsx`)

- `useSite()` 拿到 siteCode
- `loadRacks` 注入 `rackProvider.getAll(siteCode)` 和 `rackProvider.getStats(siteCode)`
- 切换站点时自动重载
- 测试:
  - All Sites → 14 racks (6 站点)
  - SH01 → 6 racks

### 4.3 Sync Center (`app/sync/page.tsx`)

- `useSite()` 注入 siteCode
- `loadPackages` 优先级: 全局 siteCode > 页面本地 filter (兼容)
- URL `?siteCode=SH01` 时, 即便页面输入框为空, 也以全局为准
- 切换站点重载

### 4.4 Header 集成

- `SiteSelector` 组件放在 Header 右侧 (SYSTEM 健康度 之前)
- `isReady=false` 时显示 "站点加载中…", 避免 hydration mismatch
- 切换站点有视觉反馈 (Select trigger 边框高亮)

---

## 五、API 校验和补齐结果 (Step 4)

### 5.1 已有 siteCode 支持的 API (4 个, 全部沿用)

| API | 实现 | 测试 |
|---|---|---|
| `/api/tasks` | `WHERE source_site_id = $1` | 200, 过滤准确 |
| `/api/racks` | `WHERE source_site_id = $1` | 200, 过滤准确 |
| `/api/volumes` | `WHERE source_site_id = $1` | 200, 过滤准确 |
| `/api/sync/packages` | `WHERE site_code = $1` | 200, 过滤准确 |

### 5.2 Sprint 2F.4 补齐的 API (1 个)

`/api/tasks/[id]/files`:
- **之前**: `WHERE id::text = $1 OR source_id = $1` (跨站点 source_id 冲突风险)
- **现在**: `WHERE id::text = $1 OR (source_id = $1 AND ($2 = '' OR source_site_id = $2))`
- 接受 `?siteCode=...` 限定, 与全局 siteCode 配合防冲突
- 测试: 传错 siteCode 返回 "missing" (符合预期)

---

## 六、文件索引 task id 冲突检查 (Step 5)

### 6.1 风险分析

- `unified_tasks.id` = UUID, 全局唯一, 不会跨站点冲突
- `unified_tasks.source_id` = bigint, **可跨站点冲突** (SH01-1, SH02-1, ...)
- 文件索引 API 用 `taskId` 查询 task, 然后用 `(source_site_id, source_id)` 双键定位文件

### 6.2 Sprint 2F.4 解决方案

| 调用方传入 | 处理 |
|---|---|
| UUID (来自 task list) | `WHERE id::text = $1` 命中, 无冲突 |
| source_id + siteCode | `WHERE source_id = $1 AND source_site_id = $2` 安全 |
| source_id 无 siteCode | `WHERE source_id = $1` 旧行为, 兼容 (多站点混测时**前端应带 siteCode**) |

### 6.3 前端配合

`components/tasks/task-file-index-panel.tsx` 在非 All Sites 时自动透传 `siteCode` 到 API, 关闭跨站点 source_id 冲突窗口。

### 6.4 后向兼容

- 不传 siteCode 时**保持原行为** (UUID 优先, source_id 兜底)
- 不破坏现有调用方

---

## 七、测试结果 (Step 6)

### 7.1 API

| API | All Sites | SH01 | TEST_CLEAN | TEST_SMOKE | 备注 |
|---|---|---|---|---|---|
| `/api/tasks` | 87 | 44 | 37 | - | ✅ 200 |
| `/api/racks` | 14 | 6 | - | - | ✅ 200 |
| `/api/sync/packages` | - | - | - | 1 | ✅ 200 |
| `/api/volumes` | - | - | - | - | ✅ 200 |
| `/api/tasks/[id]/files` | - | ✅ | - | - | ✅ 200, wrong siteCode → missing |

### 7.2 页面 (代码层验证)

- Tasks 页面 useEffect 监听 siteReady, 切换时重新加载 ✅
- Racks 页面 useEffect 监听 siteReady + isAllSites + siteCode, 切换时重新加载 ✅
- Sync Center 注入 siteCode 到 fetch URL, useEffect 监听 siteReady ✅
- Header 集成 SiteSelector, 状态来自 useSite ✅

### 7.3 回归

- `pnpm exec tsc --noEmit`: exit **0** ✅
- `pnpm build`: ✅ 成功
- `pnpm smoke:sync`: success ✅
- mock mode: SiteProvider 不影响 mock 渲染 ✅

---

## 八、固定统计

```
Sprint 2F.4 完成统计
=====================
本次新增统一表: 0
本次新增源表接入: 0
本次新增 API: 0
本次新增前端页面: 0
本次新增 components: 2 (site-selector, site-context)
本次新增 hooks: 1 (useSite)
本次影响 package: 否
本次影响 file-index SQL: 微调 (siteCode 透传)
本次不伪造: 全局 siteCode 是用户操作, 不伪造
本次影响登录: 否
本次影响后端 schema: 否
本次 UI 增强: Header 站点选择器 + 3 页面自动联动
```

---

## 九、为什么 siteCode 是总控逻辑站点标识

- `siteCode` 是 `unified_tasks.source_site_id` / `unified_devices.source_site_id` 等统一字段
- 不等于 `tbl_site.code` (Sprint 2E.3: tbl_site 是监控域)
- 不等于 `tbl_platform.code` (Sprint 2E.3: tbl_platform 是监控域)
- 是"源库实例"的逻辑标签 (SH01 = 上海节点 1, TEST_* = 演示/测试节点)

## 十、为什么 All Sites 必须保留

- 总控中心场景: 需要看跨站点全局状态
- 数据来自多站点 source_restore 镜像统一写入 unified_disc_platform
- 站点间数据不重复时, All Sites == 单站点全集; 重复时, All Sites 是合并视图

## 十一、git status / commit / push

- 已 commit, 已 push (见最终报告)
