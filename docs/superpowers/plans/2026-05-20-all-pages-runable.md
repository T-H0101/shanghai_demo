# 全页面跑通计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将所有页面的 CRUD 操作接入 mock-providers，实现状态持久化（localStorage），为真实后端接入做准备。

**Architecture:** 在现有 Provider 接口和 mock-providers 实现基础上，改造各页面：去除直接操作 localState，改为调用 provider 方法，由 provider 层统一管理 localStorage 持久化和模拟延迟。

**Tech Stack:** Next.js 16.2.6, React 19, localStorage, mock-providers 架构

---

## 文件变更总览

| 页面 | 修改文件 | 核心改动 |
|------|---------|---------|
| `/sites` | `app/sites/page.tsx` | 接入 `mockSiteProvider` 替代 localState |
| `/tasks` | `app/tasks/page.tsx` | 接入 `mockTaskProvider` 替代 localState |
| `/users` | `app/users/page.tsx` | 接入 `mockUserProvider` 替代 localState |
| `/logs` | `app/logs/page.tsx` | 接入 `mockAuditProvider` 替代 localState |
| `/search` | `app/search/page.tsx` | 接入 `mockSearchProvider` 替代 client-side filter |
| `/racks` | `app/racks/page.tsx` | 接入 `mockRackProvider` 替代 localState |
| `/settings` | `app/settings/page.tsx` | 接入 `mockSettingsProvider` 替代 localState |
| `/` (Dashboard) | `app/page.tsx` + components | 接入各 provider 获取实时数据 |

---

## Phase 1: 基础设施改造

### Task 1.1: 改造 mock-providers 支持 localStorage 持久化

**Files:**
- Modify: `lib/api/mock-providers.ts`

**目标:** 所有 provider 方法在执行后同步到 localStorage，下一次页面加载时从 localStorage 恢复状态。

**实现方式:** 在每个 provider 方法末尾调用 `saveToStorage()`，在 provider 初始化时调用 `loadFromStorage()`。

```typescript
// lib/api/mock-providers.ts 头部添加工具函数
function saveToStorage<T>(key: string, data: T): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS[key] || `mock_${key}`, JSON.stringify(data))
  }
}

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEYS[key] || `mock_${key}`)
    if (stored) return JSON.parse(stored)
  }
  return fallback
}

const STORAGE_KEYS: Record<string, string> = {
  sites: 'mock_sites',
  tasks: 'mock_tasks',
  users: 'mock_users',
  racks: 'mock_racks',
  settings: 'mock_settings',
}
```

**变更 mockSiteProvider.createSite():**
```typescript
createSite: async (siteData) => {
  await simulateDelay()
  const newSite = { id: `site-${Date.now()}`, ...siteData, status: 'offline', syncStatus: 'pending' }
  mockSites.push(newSite)
  saveToStorage('sites', mockSites)  // 新增
  return newSite
}
```

**变更 mockSiteProvider.syncSite():**
```typescript
syncSite: async (id: string) => {
  await simulateDelay()
  const site = mockSites.find(s => s.id === id)
  if (site) {
    site.syncStatus = 'syncing'
    saveToStorage('sites', mockSites)
  }
  setTimeout(() => {
    const s = mockSites.find(s => s.id === id)
    if (s) { s.syncStatus = 'synced'; saveToStorage('sites', mockSites) }
  }, 2000)
  return site
}
```

---

## Phase 2: 各页面改造

### Task 2.1: `/sites` 页面跑通

**Files:**
- Modify: `app/sites/page.tsx`
- Verify: `lib/api/mock-providers.ts:siteProvider` 方法签名

**改动点:**
1. 移除 `const [sites, setSites] = useState(mockSites)` 改为 `useState(loadFromStorage('sites', mockSites))`
2. `handleCreateSite` 调用 `mockSiteProvider.createSite()` 后用返回值更新状态
3. `handleToggleStatus` 调用 `mockSiteProvider.updateSiteStatus()`
4. `handleSync` 调用 `mockSiteProvider.syncSite()` 并正确处理异步状态更新
5. 初始化时调用 `mockSiteProvider.getAll()` 填充数据

**关键代码替换:**

```typescript
// 原来:
const [sites, setSites] = useState(mockSites)
const handleSync = () => {
  setSites(prev => prev.map(s => ({ ...s, syncStatus: 'syncing' })))
  setTimeout(() => {
    setSites(prev => prev.map(s => ({ ...s, syncStatus: 'synced' })))
  }, 2000)
}

// 改造后:
const [sites, setSites] = useState(() => {
  const stored = loadFromStorage('sites', null)
  return stored || mockSites
})

const handleSync = async (siteId: string) => {
  await mockSiteProvider.syncSite(siteId)
  // provider 内部会更新 localStorage，页面需要监听变化
  // 使用 setInterval 刷新本地状态或通过事件通知
}
```

---

### Task 2.2: `/tasks` 页面跑通

**Files:**
- Modify: `app/tasks/page.tsx`
- Verify: `lib/api/mock-providers.ts:taskProvider`

**改动点:**
1. 初始化时调用 `mockTaskProvider.getAll()` 获取任务列表
2. `handleCreateTask` 调用 `mockTaskProvider.createTask()`
3. `handlePause` 调用 `mockTaskProvider.pauseTask(id)`
4. `handleResume` 调用 `mockTaskProvider.resumeTask(id)`
5. `handleRetry` 调用 `mockTaskProvider.retryTask(id)`
6. `handleReset` 调用 `mockTaskProvider.resetTask(id)`
7. 定时刷新：页面加载后启动 setInterval 每 5s 调用 `mockTaskProvider.getAll()` 刷新任务状态

**provider 方法已在 mock-providers.ts 中实现但未被调用:**
- `mockTaskProvider.createTask()` - 第125行
- `mockTaskProvider.updateTask()` - 第144行
- `mockTaskProvider.pauseTask()` - 第152行
- `mockTaskProvider.resumeTask()` - 第158行
- `mockTaskProvider.retryTask()` - 第164行

---

### Task 2.3: `/users` 页面跑通

**Files:**
- Modify: `app/users/page.tsx`
- Verify: `lib/api/mock-providers.ts:userProvider`

**改动点:**
1. 初始化时调用 `mockUserProvider.getAll()` 获取用户列表
2. `handleCreateUser` 调用 `mockUserProvider.createUser()`
3. `handleUnlock` 调用 `mockUserProvider.updateUserStatus()`
4. `handleBan` 调用 `mockUserProvider.updateUserStatus()`
5. `handleSyncPermissions` 调用 `mockUserProvider.syncPermissions()`

**注意:** 用户管理页面有 admin 角色校验逻辑，改造时保留此逻辑。

---

### Task 2.4: `/logs` 页面跑通

**Files:**
- Modify: `app/logs/page.tsx`
- Verify: `lib/api/mock-providers.ts:auditProvider`

**改动点:**
1. 初始化时调用 `mockAuditProvider.getLogs(filters)` 获取审计日志
2. 筛选器变化时调用 `mockAuditProvider.getLogs(newFilters)` 重新查询
3. `handleExport` 调用 `mockAuditProvider.exportLogs()` 生成文件
4. 登录流水 Tab 继续使用 `useLoginAuditStore()`，该 store 已正常工作

---

### Task 2.5: `/search` 页面跑通

**Files:**
- Modify: `app/search/page.tsx`
- Verify: `lib/api/mock-providers.ts:searchProvider`

**改动点:**
1. 搜索表单提交时调用 `mockSearchProvider.search(params)` 而非本地 filter
2. 初始化时调用 `mockSearchProvider.getFilterOptions()` 获取筛选项
3. 分页调用 `mockSearchProvider.search({ ...params, page, pageSize })`
4. `handleConfirmExport` 调用 `mockSearchProvider.exportIndex()`

**注意:** 当前是客户端 filter，改为服务端模拟（provider 中实现）

---

### Task 2.6: `/racks` 页面跑通

**Files:**
- Modify: `app/racks/page.tsx`
- Verify: `lib/api/mock-providers.ts:rackProvider`

**改动点:**
1. 初始化时调用 `mockRackProvider.getAll()` 获取盘架列表
2. `handleTransfer` 调用 `mockRackProvider.registerTransfer()` 登记盘笼移位
3. 同步按钮调用 `mockRackProvider.syncRacks()`

---

### Task 2.7: `/settings` 页面跑通

**Files:**
- Modify: `app/settings/page.tsx`
- Verify: `lib/api/mock-providers.ts:settingsProvider`

**改动点:**
1. 初始化时调用 `mockSettingsProvider.get()` 获取设置
2. `handleSave` 调用 `mockSettingsProvider.update(settings)`
3. `handleReset` 调用 `mockSettingsProvider.reset()`
4. `handleExport` 调用 `mockSettingsProvider.exportSettings()`
5. `handleTestAlert` 改为调用 `mockSettingsProvider.testAlert()`

---

### Task 2.8: Dashboard (`/`) 页面跑通

**Files:**
- Modify: `app/page.tsx`
- Modify: `components/dashboard/` 下各组件

**改动点:**
1. `app/page.tsx` 初始化时并行调用各 provider:
   - `siteProvider.getStats()` 获取站点统计
   - `taskProvider.getAll()` 获取任务列表
   - `auditProvider.getStats()` 获取审计统计
2. 将数据通过 props 传递给子组件，而非子组件内部 hardcode
3. StatsCard, SyncTrendChart, SiteHealthHeatmap, TaskTable, AlertCenter 均改为 props 驱动

---

## Phase 3: 收尾

### Task 3.1: 验证所有页面刷新后状态保持

**测试步骤:**
1. 在 `/tasks` 新建任务 → 刷新页面 → 任务仍在列表中
2. 在 `/users` 创建用户 → 刷新页面 → 用户仍在列表中
3. 在 `/sites` 变更站点状态 → 刷新页面 → 状态保持

### Task 3.2: 文档更新

**Files:**
- Modify: `docs/后端接入清单.md` — 标注已完成的 provider 接入
- Modify: `docs/完整版更新文档.md` — 记录本轮改造

---

## 优先级建议

| 优先级 | 页面 | 理由 |
|--------|------|------|
| P0 | `/tasks` | 操作最密集，最需要状态保持 |
| P0 | `/users` | 刚完成功能，改造工作量小 |
| P1 | `/sites` | 核心业务页面 |
| P1 | `/` (Dashboard) | 展示核心指标 |
| P2 | `/logs`, `/search` | 查询为主 |
| P2 | `/racks`, `/settings` | 操作较少 |

---

**Plan saved:** `docs/superpowers/plans/2026-05-20-all-pages-runable.md`