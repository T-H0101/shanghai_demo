# 截图索引

本文档提供所有 Demo 截图的索引和推荐演示顺序。

---

## 主要页面截图

| 截图文件 | 页面 | 路由 | 演示功能 |
|----------|------|------|----------|
| `dashboard.png` | 控制台总览 | `/` | 全局概览、统计卡片、图表、告警、任务列表 |
| `sites.png` | 站点管理 | `/sites` | 站点列表、搜索、状态筛选、SSO 入口 |
| `search.png` | 统一检索 | `/search` | 检索表单、高级筛选、分页 |
| `tasks.png` | 任务管理 | `/tasks` | 任务列表、类型 Tab、状态、操作按钮 |
| `racks.png` | 盘架管理 | `/racks` | 盘架列表、槽位可视化 |
| `users.png` | 用户与权限 | `/users` | 用户列表、权限树 |
| `logs.png` | 审计日志 | `/logs` | 多 Tab 日志、筛选器 |
| `settings.png` | 系统设置 | `/settings` | 配置表单、服务监控 |

---

## 交互截图

| 截图文件 | 交互场景 | 演示功能 |
|----------|----------|----------|
| `interaction_notifications.png` | 通知中心展开 | 点击通知图标、查看未读通知 |
| `interaction_task_dialog.png` | 新建任务 Dialog | 点击新建任务、填写表单 |
| `interaction_log_drawer.png` | 日志详情 Drawer | 点击日志行、查看 JSON 详情 |
| `interaction_permissions.png` | 权限树展开 | 点击用户、查看权限树 |
| `interaction_search_filter.png` | 搜索筛选结果 | 使用筛选器、查看过滤结果 |
| `interaction_toast.png` | Toast 提示状态 | 查看操作反馈 |

---

## 登录认证截图

| 截图文件 | 场景 | 演示功能 |
|----------|------|----------|
| `login.png` | 登录页默认状态 | 企业级登录 Card、Site Select、SSO 状态 |
| `login_site_permissions.png` | Site 权限联动 | audit 用户输入后、Available Sites Badge、下拉仅显示南京/武汉 |
| `login_loading.png` | 登录 Loading | "Connecting to enterprise federation service..." |
| `dashboard_authenticated.png` | 登录后 Dashboard | Topbar 显示：站点 · 角色 · 部门 |

**声明**：以上截图展示的登录流程为 Mock Enterprise Authentication Demo，不包含真实 ADFS / LDAP / OAuth / JWT / SSO Federation 服务。

---

## 推荐演示顺序

### 方式四：登录认证演示

适合演示企业登录与 Site 权限隔离：

```
1. login.png                        → 登录页默认状态
2. login_site_permissions.png       → 输入 audit 用户，展示 Site 权限联动
3. login_loading.png               → 登录 Loading 状态
4. dashboard_authenticated.png     → 登录后 Topbar 显示认证信息
```

### 方式一：功能流程演示

适合 PPT 汇报和 Demo 演示，按功能模块顺序展示：

```
1. dashboard.png       → 平台整体概览
2. sites.png          → 站点管理功能
3. racks.png          → 盘架管理功能
4. tasks.png          → 任务管理功能
5. users.png          → 用户权限功能
6. logs.png           → 审计日志功能
7. search.png         → 统一检索功能
8. settings.png       → 系统设置功能
```

### 方式二：核心交互演示

适合深度演示，突出交互能力：

```
1. dashboard.png                      → 平台概览
2. interaction_notifications.png      → 通知中心交互
3. sites.png                          → 站点管理
4. interaction_task_dialog.png        → 新建任务 Dialog
5. tasks.png                          → 任务管理
6. interaction_log_drawer.png         → 日志详情 Drawer
7. interaction_permissions.png        → 权限树展开
8. interaction_search_filter.png      → 搜索筛选
9. interaction_toast.png              → Toast 反馈
10. logs.png                          → 审计日志
11. search.png                        → 统一检索
12. settings.png                      → 系统设置
```

### 方式三：快速概览

适合快速展示主要页面：

```
1. dashboard.png
2. sites.png
3. tasks.png
4. logs.png
5. search.png
```

---

## 截图规格

- **分辨率**：1440 x 900
- **格式**：PNG
- **质量**：无压缩
- **工具**：Chrome Headless

---

## QA 验证清单

每个截图均已验证：

- [x] 页面完整加载
- [x] 无空白区域
- [x] 无 UI 错位
- [x] 无遮挡（Toast/Dialog 已关闭或自然状态）
- [x] 无浏览器 DevTools
- [x] 无浏览器菜单
- [x] 清晰可读

---

*文档生成时间：2026-05-18*