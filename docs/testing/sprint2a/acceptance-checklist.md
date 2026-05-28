# Sprint 2A 验收清单

> 日期: 2026-05-28

---

## 一、文件检查

### 1.1 新增文件

- [ ] `lib/api/index.ts` - Provider Factory
- [ ] `lib/api/fallback.ts` - Mock Fallback 工具
- [ ] `lib/api/api-providers.ts` - API Providers
- [ ] `.env.example` - 环境变量示例

### 1.2 修改文件

- [ ] `components/dashboard/stats-cards.tsx` - 导入 factory
- [ ] `components/dashboard/alert-center.tsx` - 导入 factory
- [ ] `components/dashboard/task-table.tsx` - 导入 factory
- [ ] `components/dashboard/site-health-heatmap.tsx` - 导入 factory
- [ ] `app/sites/page.tsx` - 导入 factory
- [ ] `app/tasks/page.tsx` - 导入 factory
- [ ] `app/racks/page.tsx` - 导入 factory

### 1.3 文档

- [ ] `docs/database-analysis/sprint2a/sprint2a-summary.md`
- [ ] `docs/testing/sprint2a/test-plan.md`
- [ ] `docs/testing/sprint2a/acceptance-checklist.md`

---

## 二、Mock 模式验收

### 2.1 页面加载

- [ ] 首页 `/` 正常
- [ ] 任务管理 `/tasks` 正常
- [ ] 盘架管理 `/racks` 正常
- [ ] 站点管理 `/sites` 正常
- [ ] 用户管理 `/users` 正常

### 2.2 DevTools 检查

- [ ] Network 无 /api/* 请求
- [ ] Console 无错误

---

## 三、API 模式验收

### 3.1 页面加载

- [ ] 首页 `/` 正常
- [ ] 任务管理 `/tasks` 正常
- [ ] 盘架管理 `/racks` 正常
- [ ] 站点管理 `/sites` 正常
- [ ] 用户管理 `/users` 正常

### 3.2 DevTools 检查

- [ ] Network 出现 /api/* 请求
- [ ] Console 无错误

---

## 四、Fallback 验收

### 4.1 模拟 API 失败

- [ ] console.warn 出现 `[API Fallback]`
- [ ] 页面 fallback 到 mock 数据
- [ ] 页面不白屏

---

## 五、功能完整性

### 5.1 Provider Factory

- [ ] `getApiMode()` 正确返回模式
- [ ] `isApiMode` / `isMockMode` 正确
- [ ] `siteProvider` 根据模式选择
- [ ] `taskProvider` 根据模式选择
- [ ] `rackProvider` 根据模式选择
- [ ] `userProvider` 根据模式选择

### 5.2 Fallback

- [ ] `withMockFallback()` 正常调用 API
- [ ] API 失败时 fallback 到 mock
- [ ] `fetchWithFallback()` 解包 ApiResponse

### 5.3 Dashboard 聚合

- [ ] `getDashboardSummary()` 聚合数据
- [ ] `getVolumes()` 获取卷数据
- [ ] `getAlerts()` 获取告警数据

---

## 六、约束检查

- [ ] 不连接真实 PostgreSQL
- [ ] 不实现同步服务
- [ ] 不修改页面 UI
- [ ] 不新增业务功能
- [ ] 不实现登录/权限
- [ ] 不改 DTO 契约
- [ ] 不删除 mock provider
- [ ] 不破坏 P0 demo

---

## 七、签字确认

| 角色 | 姓名 | 日期 | 签字 |
|------|------|------|------|
| 开发 | | | |
| 测试 | | | |
| 评审 | | | |

---

*Checklist generated: 2026-05-28*
