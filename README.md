# 统一光盘库管理平台

> 企业级光盘库设备管理前端演示系统

## 声明

本项目是企业级统一光盘库管理平台的前端 Demo + Mock 演示工程。当前重点是统一视图、统一流程、统一交互与后端替换位，不包含真实 ADFS/LDAP、真实同步链路、真实导出任务和数据库持久化。

---

## 项目阶段

| 阶段 | 状态 | 说明 |
|------|------|------|
| 前端 UI 搭建 | ✅ 完成 | 8 个页面 + 登录页全部可访问 |
| P0 业务闭环 | ✅ 完成 | 任务↔站点↔设备↔存储卷 数据联动 |
| Provider 抽象层 | ✅ 完成 | Mock 层与后端替换位分离 |
| 数据同步方案 | ✅ 完成 | 架构设计 + P0 表清单 |
| PostgreSQL 17 接入 | 🔲 待开发 | 中心库搭建 + 同步服务 |
| 真实 API 接入 | 🔲 待开发 | Mock → 真实 API |

---

## 已完成内容

### 前端 Demo

- **首页/总控台** - 站点汇总统计、任务/设备/告警概览
- **任务管理** - 任务列表、流程进度、多线程封包、SM3校验
- **盘架管理** - 设备列表、盘位视图、盘笼移位、设备模式
- **数据恢复** - 存储浏览、文件选择、恢复配置、恢复日志
- **站点管理** - 站点列表、站点详情、站点切换
- **用户权限** - 用户列表、角色管理、权限配置
- **审计日志** - 操作日志、错误码检索、导出功能
- **系统设置** - 告警配置、阈值设置、登录锁定、权限同步

### 数据同步方案

- **架构设计** - 多站点 → 中心库增量同步模式
- **P0 同步表** - 10 张核心业务表（任务、设备、告警、盘位等）
- **同步策略** - 增量同步 + 分页初始化
- **ID策略** - 统一 ID 生成（site_prefix + original_id）
- **大表处理** - 分页拉取 + 断点续传

### 汇报材料

- **方案展示站** - `docs/presentation/index.html`（双击打开）
- **汇报文件** - `统一平台方案汇报.html`（单文件，发给领导）

---

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) |
| 语言 | TypeScript 5 |
| UI | React 19 + Tailwind CSS v4 |
| 组件库 | Radix UI |
| 表单 | React Hook Form + Zod |
| 图表 | Recharts |
| Mock 持久化 | localStorage |
| 目标数据库 | PostgreSQL 17 |

---

## 架构概览

```
多站点数据库 ──增量同步──► 中心库(PostgreSQL) ──API──► 前端(Dashboard)
     │                           │
     └──离线数据提取             └──实时告警推送
```

### 核心设计

- **站点隔离**：各站点独立数据库，通过同步服务汇聚
- **增量同步**：基于 last_sync_time 游标，支持断点续传
- **统一视图**：Dashboard 展示多站点汇总数据
- **数据溯源**：每条记录带 site_prefix，追溯来源站点

---

## 快速启动

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
# 访问 http://localhost:3000

# 构建生产版本
pnpm build && pnpm start
```

### 演示账号

| 账号 | 密码 | 角色 | 站点 |
|------|------|------|------|
| admin | admin | 集团超级管理员 | 全部 |
| ops | ops | 运维管理员 | 北京、广州 |
| audit | audit | 审计管理员 | 南京、武汉 |

---

## 文档结构

```
docs/
├── architecture/           # 架构文档
│   ├── system-architecture.md
│   ├── sync-flow.md
│   ├── large-table-strategy.md
│   └── id-strategy.md
├── database-analysis/      # 数据库分析
│   ├── sync-candidates.md  # P0/P1 同步表清单
│   ├── 真实数据库接入实施方案.md
│   └── schema-inventory.json
├── presentation/           # 方案展示站
│   └── index.html          # 双击打开
├── screenshots/            # 截图
├── demo-backlog.md         # 开发 backlog
└── 后端接入清单.md          # Mock 替换映射

docs/archive/               # 归档
├── reference-site-analysis/ # 参考竞品分析
└── superpowers/            # Agent 工作流记录
```

---

## 当前 P0 Backlog

- [ ] 搭建 PostgreSQL 环境
- [ ] 创建统一平台数据库 schema
- [ ] 实现 tbl_task 增量同步
- [ ] 实现 tbl_disc_lib 增量同步
- [ ] 实现 tbl_early_warning 增量同步
- [ ] 实现 tbl_slots 增量同步
- [ ] 前端 API 层替换
- [ ] 站点筛选功能

---

## 当前限制

- 所有业务数据为 Mock（localStorage 持久化）
- 无真实数据库连接
- 无 SSO/ADFS 集成
- 无真实邮件/推送通知
- 无不可篡改审计日志
