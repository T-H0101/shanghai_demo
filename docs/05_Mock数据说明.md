# 统一光盘库管理平台 - Mock 数据说明

## 1. Mock 数据类型

### 1.1 数据总览

| 数据模块 | 文件位置 | 类型 | 数据量 |
|----------|----------|------|--------|
| 站点数据 | `lib/mock/sites.ts` | `Site[]` + `SiteStats` | 6 个站点 + 统计 |
| 盘架数据 | `lib/mock/racks.ts` | `Rack[]` + `RackStats` | 6 个盘架 + 槽位 |
| 任务数据 | `lib/mock/tasks.ts` | `TaskItem[]` + `TaskStats` + 日志/告警 | 7 个任务 + 日志 |
| 用户数据 | `lib/mock/users.ts` | `User[]` + `UserStats` | 5 个用户 + 权限 |
| 审计日志 | `lib/mock/audit.ts` | `AuditLog[]` + `AuditStats` | 6 条日志 + 统计 |
| 检索数据 | `lib/mock/search.ts` | `SearchFile[]` + 筛选选项 | 8 个文件 |
| 系统设置 | `lib/mock/settings.ts` | `SystemSettings` + `ServiceMonitor[]` | 完整设置 + 6 服务 |

### 1.2 数据结构详解

#### 1.2.1 站点数据（`lib/mock/sites.ts`）

```typescript
export const siteStats: SiteStats = {
  total: 24,
  online: 21,
  offline: 1,
  degraded: 2,
  syncing: 3,
  avgStorageUsed: 62,
}

export const sites: Site[] = [
  {
    id: "s1",
    name: "上海研发中心",
    code: "SH-RD-01",
    status: "online",
    ip: "10.12.8.101",
    port: 8443,
    datacenter: "浦东 IDC-A",
    contact: "李明",
    contactPhone: "138****2201",
    deviceCount: 48,
    lastSyncAt: "2026-05-18 14:28:03",
    syncStatus: "synced",
    storageUsedPercent: 68,
    storageTotal: "120 TB",
    storageUsed: "81.6 TB",
    region: "华东",
    ssoEnabled: true,
    rackCount: 6,
    taskCount: 12,
    description: "核心研发数据归档站点，承载临床试验与影像数据。",
  },
  // ... 5 more sites
]
```

#### 1.2.2 任务数据（`lib/mock/tasks.ts`）

```typescript
export const taskStats: TaskStats = {
  total: 156,
  running: 42,
  paused: 8,
  failed: 5,
  completedToday: 89,
}

export const tasks: TaskItem[] = [
  {
    id: "t1",
    name: "临床试验数据回迁_A09",
    type: "restore",
    status: "running",
    priority: "high",
    progress: 78,
    siteName: "上海研发中心",
    siteCode: "SH-RD-01",
    operator: "张建国",
    startedAt: "2026-05-18 13:00:00",
    updatedAt: "2026-05-18 14:28:00",
    speed: "420 MB/s",
    discNo: "DISC-2026-00891",
    estimatedEnd: "14:45",
  },
  // ... 6 more tasks
]

export const taskLogs: TaskLogEntry[] = [
  { id: "l1", taskId: "t1", timestamp: "14:28:03", level: "info", message: "[RESTORE] 块 1842/2360 已写入..." },
  // ... 6 more logs
]

export const taskAlerts: TaskAlert[] = [
  { id: "ta1", taskName: "磁盘健康度批量校验_H1", level: "critical", message: "I/O ERROR：广州生产基地 S04 盘位...", time: "14:22:05" },
  // ... 1 more alert
]
```

#### 1.2.3 审计日志（`lib/mock/audit.ts`）

```typescript
export const auditStats: AuditStats = {
  total24h: 12847,
  successRate: 99.2,
  securityEvents: 23,
  failedOps: 42,
  complianceReports: 6,
}

export const auditLogs: AuditLog[] = [
  {
    id: "al1",
    logId: "LOG-20260518-12847",
    type: "operation",
    typeLabel: "操作流水",
    taskType: "RESTORE",
    siteName: "上海研发中心",
    operator: "张建国",
    operatedAt: "2026-05-18 14:28:03",
    deviceId: "DEV-SH-048",
    discNo: "DISC-2026-00891",
    result: "success",
    summary: "发起临床试验数据回迁任务 A09",
    signatureValid: true,
    detail: { action: "task.create", taskId: "t1", params: {...} },
    traceChain: [
      { service: "API Gateway", latency: "12ms", status: "200" },
      // ...
    ],
  },
  // ... 5 more logs
]
```

---

## 2. Mock 数据服务的页面

### 2.1 一对一关系

| Mock 文件 | 服务页面 |
|-----------|----------|
| `lib/mock/sites.ts` | `/sites` |
| `lib/mock/racks.ts` | `/racks` |
| `lib/mock/tasks.ts` | `/tasks` |
| `lib/mock/users.ts` | `/users` |
| `lib/mock/audit.ts` | `/logs` |
| `lib/mock/search.ts` | `/search` |
| `lib/mock/settings.ts` | `/settings` |

### 2.2 跨页面使用

| 数据 | 使用位置 |
|------|----------|
| `sites` | `/sites`（列表）、`/tasks`（站点名称） |
| `tasks` | `/tasks`（列表）、`/` 首页 TaskTable |
| `taskStats` | `/tasks`（统计卡片） |
| `defaultSettings` | `/settings`（表单初始值） |
| `siteStats` | `/sites`（统计卡片） |

---

## 3. Mock 数据与真实接口的替换关系

### 3.1 接口对照表

| 页面 | Mock 接口 | 未来真实接口 |
|------|-----------|--------------|
| `/sites` | `getSites()` → `lib/mock/sites.ts` | `GET /api/sites` |
| `/racks` | `getRacks()` → `lib/mock/racks.ts` | `GET /api/racks` |
| `/tasks` | `getTasks()` → `lib/mock/tasks.ts` | `GET /api/tasks` |
| `/users` | `getUsers()` → `lib/mock/users.ts` | `GET /api/users` |
| `/logs` | `getAuditLogs()` → `lib/mock/audit.ts` | `GET /api/logs` |
| `/search` | `searchFiles()` → `lib/mock/search.ts` | `GET /api/files/search` |
| `/settings` | `getSettings()` → `lib/mock/settings.ts` | `GET /api/settings` |

### 3.2 替换示例

**当前使用 Mock**：
```typescript
import { sites } from "@/lib/mock/sites"

export default function Page() {
  const [siteList, setSiteList] = useState(sites)
  // ...
}
```

**未来替换为 API**：
```typescript
// lib/api/sites.ts
export async function getSites(): Promise<Site[]> {
  const res = await fetch('/api/sites')
  return res.json()
}

// 页面使用
export default function Page() {
  const [siteList, setSiteList] = useState([])
  useEffect(() => {
    getSites().then(setSiteList)
  }, [])
  // ...
}
```

### 3.3 进一步优化：React Query

```typescript
// lib/api/sites.ts
export function useSites() {
  return useQuery({
    queryKey: ['sites'],
    queryFn: () => fetch('/api/sites').then(res => res.json()),
    staleTime: 5 * 60 * 1000, // 5 分钟
  })
}

// 页面使用
export default function Page() {
  const { data: sites = [] } = useSites()
  // ...
}
```

---

## 4. 当前 Mock 数据局限

### 4.1 数据量局限

| 数据集 | 当前数量 | 说明 |
|--------|----------|------|
| 站点 | 6 个 | 可演示站点管理基本场景 |
| 盘架 | 6 个 | 可演示盘架列表和槽位可视化 |
| 任务 | 7 个 | 包含 4 种类型，可演示基本交互 |
| 用户 | 5 个 | 包含 5 种角色，可演示权限结构 |
| 审计日志 | 6 条 | 仅每种类型 1 条，无法演示大量数据分页 |
| 检索结果 | 8 个文件 | 无法演示大规模检索性能 |
| 服务监控 | 6 个 | 静态数据，无法演示实时监控 |

### 4.2 数据真实性局限

| 局限 | 说明 |
|------|------|
| 无关联性 | 数据之间无真实业务关联（如任务和站点 ID 可能不匹配） |
| 无时间序列 | 数据时间点固定，无法演示时间范围查询 |
| 无分页数据 | 所有数据一次性返回，无法演示分页加载 |
| 无错误场景 | 所有数据都是"正常"场景，无边界/异常数据 |

### 4.3 状态持久化局限

- 页面刷新后数据恢复初始状态
- 新建的数据（如新建站点、新建任务）不会持久化
- 操作状态（如任务暂停）不会持久化

### 4.4 性能测试局限

- 无法测试大数据量渲染性能
- 无法测试并发用户场景
- 无法测试网络延迟对交互的影响

---

## 5. Mock 数据扩展示例

如需扩展 mock 数据，可参考以下模式：

```typescript
// 生成大量数据的工厂函数
function generateMockSites(count: number): Site[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `s${i + 1}`,
    name: `站点${i + 1}`,
    code: `CODE-${String(i + 1).padStart(3, '0')}`,
    status: ["online", "offline", "degraded"][i % 3] as OnlineStatus,
    // ... 其他字段
  }))
}

// 使用扩展数据
const mockSites = generateMockSites(100)
```

---

*文档生成时间：2026-05-18*