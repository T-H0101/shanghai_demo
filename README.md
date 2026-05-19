# 统一光盘库管理平台

> 企业级光盘库设备管理前端演示系统

**声明：本项目是企业级统一光盘库管理平台的前端 Demo + Mock 演示工程，当前重点是统一视图、统一流程、统一交互与后端替换位，不包含真实 ADFS/LDAP、真实同步链路、真实导出任务和数据库持久化。**

---

## 项目阶段

| 阶段 | 状态 | 说明 |
|------|------|------|
| 前端 UI 搭建 | ✅ 完成 | 8 个页面 + 登录页全部可访问 |
| Mock 数据 | ✅ 完成 | 站点/任务/用户/日志等完整 Mock 数据 |
| Mock 认证 | ✅ 完成 | Site-based 权限隔离演示 |
| 前端交互闭环 | ✅ 完成 | 任务、移位、权限、导出、日志等核心流程可演示 |
| Provider 抽象层 | ✅ 完成 | 已抽出 `lib/api/providers.ts` / `mock-providers.ts` |
| 后端接入 | 🔲 待定 | 真实能力替换见 `docs/后端接入清单.md` |

---

## 项目简介

统一光盘库管理平台是一款用于管理光盘库设备的前端演示系统。平台支持多站点管理、站点同步、盘架与盘笼管理、统一检索、任务调度、用户权限管理、日志审计和系统配置等核心功能。

本项目当前为 **Demo 阶段**，所有业务数据来自 Mock 层，页面已具备较完整的演示闭环，但 requirements 中涉及的真实认证、实时同步、后台任务、不可篡改审计和性能指标仍需后端接入。

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
| `/sites` | 站点管理 | 站点列表、搜索筛选、新建、同步、差异校验、SSO 入口 |
| `/racks` | 盘架管理 | 盘架列表、槽位可视化、移位登记、移位历史、导出 |
| `/tasks` | 任务管理 | 任务列表、状态流转、离线队列、实时日志、导出 |
| `/users` | 用户与权限 | 用户列表、创建/封禁/解锁、RBAC 权限树、同步状态 |
| `/logs` | 审计日志 | 多 Tab 日志、筛选器、JSON 详情、签名校验、导出 |
| `/search` | 统一检索 | 全局文件检索、高级筛选、分页、索引导出、回迁入口 |
| `/settings` | 系统设置 | 系统配置、告警设置、服务监控 |

---

## Demo 功能说明

### 已实现功能

- **站点管理**：站点列表、搜索过滤、状态筛选、新建站点、启停、全量同步、数据一致性校验、SSO 入口
- **盘架管理**：盘架列表、槽位可视化、移位登记、移位历史、盘架导出
- **任务管理**：任务列表、类型/状态筛选、新建任务、暂停/恢复/重试/重置/提优、离线队列、实时日志导出
- **用户权限**：用户列表、创建账号、封禁/解锁、全站点提醒、权限树切换、权限同步状态演示
- **审计日志**：多类型 Tab、站点/操作人/结果/任务类型/错误码筛选、JSON 详情、数字签名校验、登录流水导出
- **统一检索**：关键词搜索、高级筛选、分页、结果统计、索引导出（全部/当前页/分片/推送路径）、发起回迁
- **系统设置**：系统配置表单修改、保存/重置/导出配置、测试告警邮件
- **通知中心**：通知列表、全部已读、单条标记已读
- **Provider 接口层**：后端替换位已抽离，便于后续切换真实 API

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
- 无真实 WebSocket / SSE 推送
- 无真实后台异步导出任务
- 无真实不可篡改审计与签名服务

### 现状说明

- **前端 Demo 角度**：主要业务流程已可演示
- **requirements 完整系统角度**：尚未全部满足
- 详细结论见：`docs/完整版更新文档.md`

### 待后端实现（详见 `docs/后端接入清单.md`）

| 功能模块 | 说明 |
|----------|------|
| 统一身份认证 | ADFS/LDAP/JWT 企业域账号集成 |
| 数据同步引擎 | 实时/定时同步各站点设备/索引/权限/任务 |
| 分布式检索 | 千万级文件索引（≤3s 响应） |
| 任务调度 | 备份/恢复/巡检/刻录任务真实执行 |
| 邮件/推送通知 | 任务完成/失败/告警邮件推送 |
| 审计日志存储 | 不可篡改的日志存储（≥1年） |
| 导出任务中心 | 检索/日志/索引导出的后台异步任务与推送 |

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
│   ├── api/              # Provider 抽象层与 Mock Provider
│   ├── mock/             # Mock 数据
│   ├── types/            # TypeScript 类型定义
│   └── utils.ts          # 工具函数
├── hooks/                 # React Hooks
├── store/                 # 前端状态管理（通知/登录流水）
└── docs/                 # 项目文档
```

---

## 文档

当前保留的核心文档位于 `docs/` 目录：

| 文档 | 说明 |
|------|------|
| `source/requirements.md` | 需求规格说明书 |
| `完整版更新文档.md` | 当前 Demo 完成度、缺口和本轮更新总结 |
| `后端接入清单.md` | Mock 替换为真实后端的接口与实施清单 |
| `01_需求分析.md` | 需求分析文档 |
| `02_原型设计说明.md` | 原型设计说明 |
| `03_技术方案.md` | 技术栈选型说明 |
| `04_前端架构说明.md` | 前端架构文档 |
| `05_Mock数据说明.md` | Mock 数据说明 |
| `06_虚拟接口设计.md` | 虚拟接口设计 |
| `07_交互功能说明.md` | 交互说明 |
| `08_测试用例.md` | 测试用例 |
| `10_Demo演示说明.md` | Demo 演示说明 |
| `11_运行部署说明.md` | 运行部署说明 |
| `数据同步需求文档.md` | 数据同步专项说明 |
| `测试指南.md` | 演示测试与验证指南 |
| `SCREENSHOT_INDEX.md` | 截图索引 |

---

## 当前校验

- `npx tsc --noEmit`：通过
- `npm run build`：通过
- `npm run lint`：当前环境缺少 `eslint` 命令，未执行

---

*文档更新时间：2026-05-19*
