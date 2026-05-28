# Sprint 2A 测试计划

> 日期: 2026-05-28

---

## 一、环境准备

### 1.1 启动命令

```bash
pnpm dev
```

### 1.2 模式切换

创建 `.env.local` 文件:

```bash
# Mock 模式
NEXT_PUBLIC_API_MODE=mock

# API 模式
NEXT_PUBLIC_API_MODE=api
```

---

## 二、A. Mock 模式测试

### 2.1 设置

```bash
NEXT_PUBLIC_API_MODE=mock
```

### 2.2 检查项

| 测试点 | 验证方法 |
|-------|----------|
| 首页正常显示 | 访问 /, 确认 Dashboard 数据 |
| 任务管理正常 | 访问 /tasks, 确认任务列表 |
| 盘架管理正常 | 访问 /racks, 确认盘架列表 |
| 站点管理正常 | 访问 /sites, 确认站点列表 |
| API 未被调用 | DevTools Network 无 /api/* 请求 |

### 2.3 预期结果

- 所有页面正常显示
- 无 console.error
- DevTools Network 无 API 请求

---

## 三、B. API 模式测试

### 3.1 设置

```bash
NEXT_PUBLIC_API_MODE=api
```

### 3.2 检查项

| 测试点 | 验证方法 | API 端点 |
|-------|----------|----------|
| Dashboard 数据 | 访问 /, 检查 DevTools | /api/dashboard/summary |
| 任务列表 | 访问 /tasks, 检查 DevTools | /api/tasks |
| 盘架列表 | 访问 /racks, 检查 DevTools | /api/racks |
| 站点列表 | 访问 /sites, 检查 DevTools | /api/sites |
| 用户列表 | 访问 /users, 检查 DevTools | /api/users |

### 3.3 预期结果

- DevTools Network 出现 /api/* 请求
- 页面正常显示（来自 API 或 fallback）
- 无 console.error

---

## 四、C. Fallback 测试

### 4.1 测试方法

临时让 API 端点返回错误:

```typescript
// 在 app/api/tasks/route.ts 中添加
throw new Error("Simulated API Error")
```

### 4.2 检查项

| 测试点 | 验证方法 |
|-------|----------|
| console.warn 出现 | DevTools Console 检查 |
| 页面仍显示数据 | 页面不白屏 |
| 数据来自 mock | 确认是原始 mock 数据 |

### 4.3 预期结果

- Console 出现 `[API Fallback]` 提示
- 页面正常显示 mock 数据
- 无页面崩溃

### 4.4 恢复

测试后移除临时错误代码。

---

## 五、通过标准

### 5.1 Mock 模式

- [ ] 所有页面正常加载
- [ ] 数据正确显示
- [ ] DevTools 无 API 请求

### 5.2 API 模式

- [ ] DevTools 出现 API 请求
- [ ] 页面正常显示
- [ ] 无 console.error

### 5.3 Fallback

- [ ] console.warn 正常出现
- [ ] 页面 fallback 到 mock
- [ ] 页面不崩溃

---

*Test Plan generated: 2026-05-28*
