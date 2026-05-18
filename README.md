# 统一光盘库管理平台

> 企业级光盘库设备管理前端演示系统

**声明：本项目为企业级统一光盘库管理平台前端 Demo + Mock 数据演示系统，不包含真实后端、数据库及真实 ADFS/同步服务。**

---

## 项目简介

统一光盘库管理平台是一款用于管理光盘库设备的前端演示系统。平台支持多站点管理、机架监控、任务调度、用户权限管理、日志查询等核心功能。

本项目为 **Demo 阶段**，所有数据来自 Mock（内存模拟），不接入真实后端 API，不接入真实数据库。

---

## 技术栈

| 层次 | 技术 | 版本 |
|------|------|------|
| 框架 | Next.js (App Router) | 16.2.6 |
| UI 库 | React | 19.x |
| 语言 | TypeScript | 5.x |
| 样式 | Tailwind CSS | v4 |
| 组件库 | Radix UI | @radix-ui/react-* |
| 表单验证 | React Hook Form + Zod | 7.x / 3.x |
| 图表 | Recharts | 2.x |
| 图标 | Lucide React | 0.564.0 |

---

## 页面清单

| 路由 | 页面名称 | 功能说明 |
|------|----------|----------|
| `/login` | 统一登录 | Mock 企业域账号演示登录（非真实 ADFS/LDAP/JWT） |
| `/` | 首页仪表盘 | 全局概览（站点/容量/任务/告警统计） |
| `/sites` | 站点管理 | 站点列表、搜索、筛选、新建、SSO 入口 |
| `/racks` | 盘架管理 | 盘架列表、槽位可视化 |
| `/tasks` | 任务管理 | 任务列表、类型 Tab、状态筛选、操作按钮（暂停/恢复/重试） |
| `/users` | 用户与权限 | 用户列表、RBAC 权限树 |
| `/logs` | 审计日志 | 多 Tab 日志、筛选器、JSON 详情、导出 |
| `/search` | 统一检索 | 全局文件检索、高级筛选、分页 |
| `/settings` | 系统设置 | 系统配置、告警设置、服务监控 |

---

## Demo 功能说明

### 已实现功能

- **站点管理**：站点列表展示、搜索过滤、状态筛选、新建站点 Dialog、SSO 跳转 Toast、禁用/启用
- **盘架管理**：盘架列表、槽位可视化
- **任务管理**：任务列表、类型 Tab 切换、状态筛选、搜索、操作按钮（暂停/恢复/重试/重置/优先执行）、新建任务 Dialog
- **用户权限**：用户列表、权限树展示
- **审计日志**：多类型 Tab 切换、站点/操作人/结果筛选、日志详情 Drawer、数字签名校验、导出 Excel/CSV/JSON
- **统一检索**：关键词搜索、高级筛选（站点/部门/文件类型/光盘编号/存储卷）、导出、发起回迁
- **系统设置**：系统配置表单修改、保存/重置/导出配置、测试告警邮件
- **通知中心**：通知列表、全部已读、单条标记已读
- **Toast 反馈**：所有操作按钮均有 Toast 反馈

### Mock Enterprise Authentication Demo（统一登录）

- 路由：`/login`；未登录访问业务页将自动跳转登录页
- **Site-based Mock Authentication Flow**：
  1. 输入账号后，自动显示该账号可访问的站点列表（Badge 风格）
  2. Site 下拉框仅显示该账号被授权的站点
  3. 点击登录后有 1.5s loading 状态，显示 "Connecting to enterprise federation service..."
  4. 验证流程：账号密码校验 + 站点权限校验
- 演示账号（`lib/mock/auth.ts`）：

| 账号 | 密码 | 角色 | 可访问站点 |
|------|------|------|-----------|
| admin | admin | 集团超级管理员 | 全部 6 个站点 |
| ops | ops | 运维管理员 | 北京、广州 |
| audit | audit | 审计管理员 | 南京、武汉 |
| operator | operator | 站点操作员 | 成都、上海 |

- 登录成功后写入 `localStorage`：`mock_token`、`mock_user`、`mock_role`、`mock_role_level`、`mock_site`、`mock_department`、`mock_login_time`
- Topbar 显示：`{站点} · {角色} · {部门}`（企业控制台风格）
- **声明**：当前系统为 Mock Enterprise Authentication Demo，根据 `mockUsers.allowedSites` 模拟企业 Site 权限隔离逻辑，不包含真实 ADFS / LDAP / OAuth / JWT / SSO Federation 服务。

### Demo 限制

- 所有数据为 Mock 静态数据，页面刷新后恢复初始状态（登录态除外，存于 localStorage）
- 无真实后端 API 调用
- 无数据库持久化
- 无真实邮件发送
- 无 SSO 真实跳转
- 服务监控为静态展示，无实时更新

---

## 运行方式

### 环境要求

- Node.js ≥ 18.17.0
- npm ≥ 9.0.0

### 安装依赖

```bash
npm install
```

### 开发服务器

```bash
npm run dev
# 访问 http://localhost:3000
```

### 生产构建

```bash
npm run build
npm run start
```

### 代码检查

```bash
npm run lint
```

---

## 截图展示

### 主要页面

| 页面 | 截图 |
|------|------|
| 控制台总览 | `docs/screenshots/dashboard.png` |
| 站点管理 | `docs/screenshots/sites.png` |
| 统一检索 | `docs/screenshots/search.png` |
| 任务管理 | `docs/screenshots/tasks.png` |
| 盘架管理 | `docs/screenshots/racks.png` |
| 用户权限 | `docs/screenshots/users.png` |
| 审计日志 | `docs/screenshots/logs.png` |
| 系统设置 | `docs/screenshots/settings.png` |

### 交互展示

| 交互 | 截图 |
|------|------|
| 通知中心展开 | `docs/screenshots/interaction_notifications.png` |
| 新建任务 Dialog | `docs/screenshots/interaction_task_dialog.png` |
| 日志详情 Drawer | `docs/screenshots/interaction_log_drawer.png` |
| 权限树展开 | `docs/screenshots/interaction_permissions.png` |
| 搜索筛选结果 | `docs/screenshots/interaction_search_filter.png` |
| Toast 提示状态 | `docs/screenshots/interaction_toast.png` |

### 登录认证截图

| 场景 | 截图 |
|------|------|
| 登录页默认状态 | `docs/screenshots/login.png` |
| Site 权限联动（audit 用户） | `docs/screenshots/login_site_permissions.png` |
| 登录 Loading 状态 | `docs/screenshots/login_loading.png` |
| 登录后 Dashboard（认证态） | `docs/screenshots/dashboard_authenticated.png` |

**声明**：以上截图展示的登录流程为 Mock Enterprise Authentication Demo，不包含真实 ADFS / LDAP / OAuth / JWT / SSO Federation 服务。

---

## 项目结构

```
/Users/tian/Desktop/上海/
├── app/                    # Next.js App Router 页面
│   ├── page.tsx           # 首页仪表盘
│   ├── sites/page.tsx     # 站点管理
│   ├── racks/page.tsx     # 盘架管理
│   ├── tasks/page.tsx     # 任务管理
│   ├── users/page.tsx     # 用户与权限
│   ├── logs/page.tsx      # 审计日志
│   ├── search/page.tsx    # 统一检索
│   └── settings/page.tsx  # 系统设置
├── components/
│   ├── ui/               # 57 个通用 UI 组件
│   ├── dashboard/        # 仪表盘组件
│   ├── platform/         # 平台通用组件
│   └── layout/           # 布局组件
├── lib/
│   ├── mock/             # Mock 数据（7 个模块）
│   ├── types/            # TypeScript 类型定义
│   └── utils.ts          # 工具函数
├── hooks/                 # React Hooks
├── store/                 # 状态管理（通知中心）
└── docs/                 # 项目文档
```

---

## 文档

项目文档位于 `docs/` 目录：

| 文档 | 说明 |
|------|------|
| `01_需求分析.md` | 需求分析文档 |
| `02_原型设计说明.md` | 原型设计说明 |
| `03_技术方案.md` | 技术栈选型说明 |
| `04_前端架构说明.md` | 前端架构文档 |
| `05_Mock数据说明.md` | Mock 数据说明 |
| `06_虚拟接口设计.md` | 虚拟接口设计 |
| `07_交互功能说明.md` | P0 交互功能说明 |
| `08_测试用例.md` | 测试用例 |
| `09_需求覆盖矩阵.md` | 需求覆盖矩阵 |
| `10_Demo演示说明.md` | Demo 演示说明 |
| `11_运行部署说明.md` | 运行部署说明 |
| `DOCUMENTATION_AUDIT.md` | 文档审查报告 |
| `PROJECT_ANALYSIS.md` | 项目分析报告 |
| `SCREENSHOT_INDEX.md` | 截图索引 |

---

*文档生成时间：2026-05-18*