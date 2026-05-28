# Sprint 1 测试计划

> 日期: 2026-05-28
> 目标: 验证 API Skeleton + Mock Response

---

## 一、环境准备

### 1.1 启动命令

```bash
# 安装依赖（如需要）
pnpm install

# 启动开发服务器
pnpm dev

# 确认服务器运行在 http://localhost:3000
```

### 1.2 API 基础 URL

```
http://localhost:3000/api/
```

---

## 二、API 测试列表

### 2.1 Dashboard

| 测试项 | 请求 | 期望状态码 | 期望字段 |
|--------|------|-----------|----------|
| 首页统计 | GET /api/dashboard/summary | 200 | code: 0, tasks.total, devices.total, capacity.usagePercent |
| 响应格式 | - | 200 | code, message, data, traceId |

**curl 测试**
```bash
curl -s http://localhost:3000/api/dashboard/summary | jq .
```

### 2.2 任务管理

| 测试项 | 请求 | 期望状态码 | 期望字段 |
|--------|------|-----------|----------|
| 任务列表 | GET /api/tasks | 200 | items[].id, items[].name, total |
| 任务分页 | GET /api/tasks?page=1&pageSize=5 | 200 | page: 1, pageSize: 5 |
| 任务筛选-状态 | GET /api/tasks?status=running | 200 | items[].status = running |
| 任务筛选-类型 | GET /api/tasks?type=full_package | 200 | items[].type = full_package |
| 任务详情-存在 | GET /api/tasks/t0 | 200 | id: t0, name |
| 任务详情-不存在 | GET /api/tasks/invalid | 404 | code: 404 |

**curl 测试**
```bash
# 任务列表
curl -s http://localhost:3000/api/tasks | jq .

# 任务详情
curl -s http://localhost:3000/api/tasks/t0 | jq .

# 任务不存在
curl -s http://localhost:3000/api/tasks/invalid
```

### 2.3 盘架管理

| 测试项 | 请求 | 期望状态码 | 期望字段 |
|--------|------|-----------|----------|
| 盘架列表 | GET /api/racks | 200 | items[].id, items[].rackName |
| 盘架筛选-站点 | GET /api/racks?siteCode=SH-RD-01 | 200 | items[].siteCode = SH-RD-01 |
| 盘架筛选-状态 | GET /api/racks?status=normal | 200 | items[].status = normal |
| 盘架详情-存在 | GET /api/racks/r1 | 200 | id: r1, slots[] |
| 盘架详情-不存在 | GET /api/racks/invalid | 404 | code: 404 |
| 盘位列表 | GET /api/racks/r1/slots | 200 | items[].id, items[].index |

**curl 测试**
```bash
# 盘架列表
curl -s http://localhost:3000/api/racks | jq .

# 盘架详情
curl -s http://localhost:3000/api/racks/r1 | jq .

# 盘位列表
curl -s http://localhost:3000/api/racks/r1/slots | jq .
```

### 2.4 存储卷

| 测试项 | 请求 | 期望状态码 | 期望字段 |
|--------|------|-----------|----------|
| 存储卷列表 | GET /api/volumes | 200 | items[].id, items[].name |
| 存储卷筛选-站点 | GET /api/volumes?siteCode=SH-RD-01 | 200 | items[].name |

**curl 测试**
```bash
curl -s http://localhost:3000/api/volumes | jq .
```

### 2.5 告警管理

| 测试项 | 请求 | 期望状态码 | 期望字段 |
|--------|------|-----------|----------|
| 告警列表 | GET /api/alerts | 200 | items[].id, items[].severity |
| 告警分页 | GET /api/alerts?page=1&pageSize=5 | 200 | page: 1, total |
| 告警筛选-级别 | GET /api/alerts?level=critical | 200 | items[].severity = critical |

**curl 测试**
```bash
curl -s http://localhost:3000/api/alerts | jq .
```

### 2.6 站点管理

| 测试项 | 请求 | 期望状态码 | 期望字段 |
|--------|------|-----------|----------|
| 站点列表 | GET /api/sites | 200 | items[].id, items[].name |
| 站点筛选-状态 | GET /api/sites?status=online | 200 | items[].status = online |

**curl 测试**
```bash
curl -s http://localhost:3000/api/sites | jq .
```

### 2.7 用户管理

| 测试项 | 请求 | 期望状态码 | 期望字段 |
|--------|------|-----------|----------|
| 用户列表 | GET /api/users | 200 | items[].id, items[].username |
| 用户分页 | GET /api/users?page=1&pageSize=10 | 200 | page: 1 |
| 用户搜索 | GET /api/users?keyword=admin | 200 | items[].username 含 admin |
| 用户角色筛选 | GET /api/users?role=admin | 200 | items[].role = admin |

**curl 测试**
```bash
curl -s http://localhost:3000/api/users | jq .
```

---

## 三、页面回归测试

### 3.1 测试目标

确认 Sprint 1 **未改变**前端页面数据源，页面仍使用原有 Mock Provider。

### 3.2 测试页面

| 页面 | URL | 测试点 |
|------|-----|--------|
| 首页 | / | Dashboard 数据正常显示 |
| 任务管理 | /tasks | 任务列表正常 |
| 盘架管理 | /racks | 盘架列表正常 |
| 站点管理 | /sites | 站点列表正常 |
| 用户管理 | /users | 用户列表正常 |
| 审计日志 | /logs | 日志列表正常 |
| 统一检索 | /search | 检索功能正常 |
| 系统设置 | /settings | 配置页面正常 |

### 3.3 测试步骤

1. 启动 `pnpm dev`
2. 访问各页面
3. 确认页面加载正常，无报错
4. 确认数据来自原有 Mock（不是 API）

### 3.4 不应发生的变化

- ❌ 页面布局变化
- ❌ 组件样式变化
- ❌ 数据字段变化
- ❌ 交互行为变化
- ❌ 数据来源变化（应仍为 Mock）

---

## 四、Mock Fallback 测试

### 4.1 测试目标

确认 API 模式关闭时，页面仍能正常使用 Mock 数据。

### 4.2 当前状态

Sprint 1 **未实现** API 模式切换。当前：
- API 端点可访问
- 前端页面仍使用原有 Provider
- 无 Mock/Api 切换逻辑

### 4.3 Sprint 2 需测试

```typescript
// NEXT_PUBLIC_API_MODE 环境变量
// "mock" - 使用 Mock Provider（默认）
// "api" - 使用真实 API

// API 失败时降级到 Mock
```

---

## 五、角色权限预留测试

### 5.1 预留角色

| 角色 | 权限 | Sprint 状态 |
|------|------|------------|
| admin | 全部功能 | 预留 |
| operator | 操作功能 | 预留 |
| viewer | 只读功能 | 预留 |

### 5.2 Sprint 2/3 需测试

| 权限 | 测试点 |
|------|--------|
| admin | 所有页面可访问，所有操作可执行 |
| operator | 系统设置不可访问，其他正常 |
| viewer | 新建任务/恢复不可用，其他正常 |

---

## 六、通过标准

### 6.1 API 测试

- [ ] 所有端点返回 200
- [ ] 响应格式符合 ApiResponse<T>
- [ ] 分页参数正常工作
- [ ] 筛选参数正常工作
- [ ] 不存在的资源返回 404

### 6.2 页面回归

- [ ] 所有页面正常加载
- [ ] 无 console.error
- [ ] 数据正常显示
- [ ] 交互功能正常

### 6.3 Mock Fallback

- [ ] Sprint 2 实现后测试

### 6.4 权限测试

- [ ] Sprint 2/3 实现后测试

---

## 七、失败判断

| 场景 | 判断标准 |
|------|----------|
| API 无响应 | curl 超时或返回非 200 |
| 字段缺失 | 响应缺少必需字段 |
| 类型错误 | 字段类型与定义不符 |
| 页面崩溃 | 页面加载报错或白屏 |
| 数据错误 | 显示的数据与 Mock 不符 |

---

*Test Plan generated: 2026-05-28*
