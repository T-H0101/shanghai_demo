# API Contract 文档

> 版本: v1.0
> 日期: 2026-05-28
> 状态: Sprint 1 完成

---

## 一、通用规范

### 1.1 基础 URL
```
开发环境: http://localhost:3000
生产环境: https://api.example.com
```

### 1.2 统一响应格式

```typescript
interface ApiResponse<T> {
  code: number       // 0=成功，非0=错误
  message: string    // "ok" / 错误描述
  data: T            // 响应数据
  traceId: string    // 追踪ID
}

interface ApiError {
  code: number
  message: string
  data: null
  traceId: string
}
```

### 1.3 状态码

| HTTP Status | code | 说明 |
|-------------|------|------|
| 200 | 0 | 成功 |
| 200 | - | 业务错误（如无数据） |
| 400 | 400 | 请求参数错误 |
| 401 | 401 | 未认证 |
| 403 | 403 | 无权限 |
| 404 | 404 | 资源不存在 |
| 500 | 500 | 服务器错误 |

---

## 二、分页规范

### 2.1 分页响应格式

```typescript
interface PaginatedResponse<T> {
  items: T[]
  page: number      // 当前页（从1开始）
  pageSize: number  // 每页条数
  total: number     // 总条数
}
```

### 2.2 分页参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| page | number | 1 | 页码 |
| pageSize | number | 20 | 每页条数 |

---

## 三、端点详情

### 3.1 Dashboard

#### GET /api/dashboard/summary

首页统计数据。

**响应**
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "tasks": {
      "total": 10,
      "running": 3,
      "completed": 3,
      "failed": 2,
      "pending": 2
    },
    "devices": {
      "total": 5,
      "online": 3,
      "offline": 1,
      "warning": 1
    },
    "capacity": {
      "totalBytes": 223860567415194,
      "usedBytes": 176801469746381,
      "usagePercent": 73,
      "displayTotal": "203.6 TB",
      "displayUsed": "161 TB"
    },
    "alerts": {
      "total": 2,
      "critical": 1,
      "warning": 1
    },
    "sites": {
      "total": 24,
      "online": 23,
      "offline": 1
    },
    "sync": {
      "syncing": 3,
      "failed": 1,
      "lastSyncAt": "2026-05-28T10:00:00Z"
    }
  },
  "traceId": "api-1234567890"
}
```

---

### 3.2 任务管理

#### GET /api/tasks

任务列表。

**参数**
| 参数 | 类型 | 说明 |
|------|------|------|
| page | number | 页码（默认1） |
| pageSize | number | 每页条数（默认20） |
| status | string | 状态筛选 |
| type | string | 类型筛选 |
| siteCode | string | 站点筛选 |

**响应**
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "items": [
      {
        "id": "t0",
        "name": "苏州市档案馆全量封包",
        "taskNo": "TK-20260526-001",
        "type": "full_package",
        "phase": "packaging",
        "status": "running",
        "priority": "high",
        "progress": 58,
        "archiveName": "苏州市档案馆",
        "siteName": "上海数据中心",
        "siteCode": "SH-RD-01",
        "operator": "张建国",
        "startedAt": "2026-05-26 08:30:00",
        "updatedAt": "2026-05-26 15:40:00"
      }
    ],
    "page": 1,
    "pageSize": 20,
    "total": 10
  }
}
```

#### GET /api/tasks/[id]

任务详情。

**路径参数**
| 参数 | 类型 | 说明 |
|------|------|------|
| id | string | 任务ID |

**响应**: 单个 TaskDTO 对象

---

### 3.3 盘架管理

#### GET /api/racks

盘架列表。

**参数**
| 参数 | 类型 | 说明 |
|------|------|------|
| siteCode | string | 站点筛选 |
| status | string | 状态筛选（normal/warning/fault/maintenance） |

**响应**: RackDTO[]

#### GET /api/racks/[id]

盘架详情。

**响应**: 单个 RackDTO 对象

#### GET /api/racks/[id]/slots

盘位列表。

**响应**: RackSlotDTO[]

---

### 3.4 存储卷

#### GET /api/volumes

存储卷列表。

**参数**
| 参数 | 类型 | 说明 |
|------|------|------|
| siteCode | string | 站点筛选 |
| type | string | 类型筛选（optical/magnetic/composite） |

**响应**: VolumeDTO[]

---

### 3.5 告警管理

#### GET /api/alerts

告警列表。

**参数**
| 参数 | 类型 | 说明 |
|------|------|------|
| page | number | 页码 |
| pageSize | number | 每页条数 |
| level | string | 级别筛选（critical/warning） |
| status | string | 状态筛选（active/resolved/acknowledged） |
| siteCode | string | 站点筛选 |

**响应**: PaginatedResponse<AlertDTO>

---

### 3.6 站点管理

#### GET /api/sites

站点列表。

**参数**
| 参数 | 类型 | 说明 |
|------|------|------|
| status | string | 状态筛选（online/offline） |

**响应**: SiteDTO[]

---

### 3.7 用户管理

#### GET /api/users

用户列表。

**参数**
| 参数 | 类型 | 说明 |
|------|------|------|
| page | number | 页码 |
| pageSize | number | 每页条数 |
| keyword | string | 关键词搜索 |
| siteCode | string | 可访问站点筛选 |
| role | string | 角色筛选 |

**响应**: PaginatedResponse<UserDTO>

---

## 四、数据类型定义

### 4.1 枚举值

| 类型 | 值 |
|------|-----|
| TaskType | full_package, incremental_package, backup, restore, full_scan, incremental_scan, migrate, device_scan, raid_check, other |
| TaskPhase | pending, scanning, preparing, splitting, packaging, verifying, writing, completed, failed, paused, idle |
| TaskStatus | running, paused, completed, failed, pending_dispatch |
| Priority | critical, high, normal, low |
| RackStatus | normal, warning, fault, maintenance |
| OnlineStatus | online, offline |
| SlotStatus | free, used, error, empty |
| MediaType | hdd, bd, offline |
| VolumeType | optical, magnetic, composite |
| AlertSeverity | critical, warning |
| AlertStatus | active, resolved, acknowledged |
| SiteStatus | online, offline |
| SyncStatus | synced, syncing, failed, pending |
| UserRole | admin, operator, viewer |
| UserStatus | active, disabled |

### 4.2 时间格式

所有时间字段使用 ISO 8601 格式：
- `2026-05-28T10:00:00Z`
- 或本地格式 `2026-05-28 10:00:00`

---

## 五、错误处理

### 5.1 错误响应示例

```json
{
  "code": 404,
  "message": "Task not found",
  "data": null,
  "traceId": "api-1234567890"
}
```

### 5.2 常见错误

| code | message | 说明 |
|------|---------|------|
| 400 | Invalid parameter | 参数错误 |
| 401 | Unauthorized | 未登录 |
| 403 | Forbidden | 无权限 |
| 404 | Not found | 资源不存在 |
| 500 | Internal server error | 服务器错误 |

---

## 六、后续扩展

### 6.1 待实现接口

| 接口 | 说明 | Sprint |
|------|------|--------|
| POST /api/tasks | 创建任务 | Sprint 2 |
| PATCH /api/tasks/[id] | 更新任务 | Sprint 2 |
| POST /api/racks/[id]/transfer | 盘笼移位 | Sprint 2 |
| POST /api/auth/login | 登录 | Sprint 2 |
| GET /api/sync/status | 同步状态 | Sprint 2 |

### 6.2 权限控制

Sprint 2/3 实现基于角色的权限控制：
- admin: 全部权限
- operator: 操作权限
- viewer: 只读权限

---

*Document generated: 2026-05-28*
