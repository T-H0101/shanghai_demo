# Sprint 1 手动验收清单

> 日期: 2026-05-28
> 目标: 验证 API Skeleton + Mock Response + 页面无变化

---

## 一、环境准备

- [ ] `pnpm dev` 启动成功
- [ ] 浏览器访问 http://localhost:3000 正常

---

## 二、首页

### 2.1 页面加载

- [ ] 首页正常加载，无报错
- [ ] Dashboard 组件正常显示

### 2.2 数据展示

- [ ] 任务统计卡片显示
- [ ] 设备统计卡片显示
- [ ] 容量统计卡片显示
- [ ] 告警统计卡片显示

### 2.3 API 测试

- [ ] GET /api/dashboard/summary 返回 200
- [ ] 响应包含 tasks.total
- [ ] 响应包含 devices.total
- [ ] 响应包含 capacity.usagePercent

---

## 三、任务管理

### 3.1 页面加载

- [ ] 任务管理页面正常加载
- [ ] 任务列表显示正确
- [ ] 分页组件正常

### 3.2 功能测试

- [ ] 任务筛选正常
- [ ] 任务详情可查看
- [ ] 新建任务按钮存在（点击无实际效果）

### 3.3 API 测试

- [ ] GET /api/tasks 返回 200
- [ ] 返回包含 items 数组
- [ ] 返回包含 total 数量
- [ ] GET /api/tasks/t0 返回单个任务

---

## 四、盘架管理

### 4.1 页面加载

- [ ] 盘架管理页面正常加载
- [ ] 盘架列表显示正确
- [ ] 盘位可视化正常

### 4.2 功能测试

- [ ] 盘架筛选正常
- [ ] 盘架详情可查看
- [ ] 盘位列表可查看
- [ ] 同步按钮存在（点击无实际效果）

### 4.3 API 测试

- [ ] GET /api/racks 返回 200
- [ ] 返回盘架列表
- [ ] GET /api/racks/r1 返回单个盘架
- [ ] GET /api/racks/r1/slots 返回盘位列表

---

## 五、存储浏览/数据恢复

### 5.1 页面加载

- [ ] 存储浏览页面正常加载
- [ ] 文件树显示正确

### 5.2 功能测试

- [ ] 文件夹展开正常
- [ ] 文件选择正常
- [ ] 恢复配置正常

---

## 六、API Skeleton

### 6.1 Dashboard API

- [ ] GET /api/dashboard/summary 可访问
- [ ] 响应格式正确

### 6.2 Tasks API

- [ ] GET /api/tasks 可访问
- [ ] GET /api/tasks/[id] 可访问

### 6.3 Racks API

- [ ] GET /api/racks 可访问
- [ ] GET /api/racks/[id] 可访问
- [ ] GET /api/racks/[id]/slots 可访问

### 6.4 Volumes API

- [ ] GET /api/volumes 可访问

### 6.5 Alerts API

- [ ] GET /api/alerts 可访问

### 6.6 Sites API

- [ ] GET /api/sites 可访问

### 6.7 Users API

- [ ] GET /api/users 可访问

---

## 七、文档完整性

### 7.1 Sprint 1 文档

- [ ] docs/database-analysis/backend-sprint-1-summary.md 存在
- [ ] docs/database-analysis/api-contract.md 存在
- [ ] docs/testing/sprint-1-test-plan.md 存在
- [ ] docs/testing/manual-acceptance-checklist.md 存在

### 7.2 DTO 文档

- [ ] lib/api/dto/index.ts 存在
- [ ] 包含所有必需类型

### 7.3 Adapter 文档

- [ ] lib/api/adapters/ 目录存在
- [ ] 包含所有必需 Adapter

---

## 八、验收总结

### 8.1 完成项

| 模块 | 状态 |
|------|------|
| API 端点 | ✅ 完成 |
| DTO 类型 | ✅ 完成 |
| Adapter 层 | ✅ 完成 |
| Mock Response | ✅ 完成 |
| 测试文档 | ✅ 完成 |

### 8.2 遗留项

| 项 | 状态 | 说明 |
|----|------|------|
| 真实数据库连接 | 待 Sprint 2 | 不在 Sprint 1 范围 |
| API 模式切换 | 待 Sprint 2 | 不在 Sprint 1 范围 |
| 认证系统 | 待 Sprint 2/3 | 不在 Sprint 1 范围 |
| 写入操作 | 待 Sprint 2 | 不在 Sprint 1 范围 |

### 8.3 下一步

1. Sprint 2: 实现 PostgreSQL 连接
2. Sprint 2: 实现同步服务
3. Sprint 2: 实现 API 模式切换
4. Sprint 3: 实现认证系统

---

## 九、签字确认

| 角色 | 姓名 | 日期 | 签字 |
|------|------|------|------|
| 开发 | | | |
| 测试 | | | |
| 评审 | | | |

---

*Checklist generated: 2026-05-28*
