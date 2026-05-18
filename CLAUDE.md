# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目背景

**统一光盘库管理平台** 是一款用于管理光盘库设备的前端演示系统。平台支持多站点管理、机架监控、任务调度、用户权限管理、日志查询等核心功能。

## 当前阶段

**前端 Demo + Mock 数据阶段**

- 纯前端静态页面，所有数据来自 mock
- 不接入真实后端 API
- 不接入真实数据库
- 目标是完成可演示的 Demo 版本
- 所有路由已可访问

## 技术栈

- **框架**: Next.js 16 (App Router)
- **UI 库**: React 19 + Tailwind CSS v4 + 57 个通用 UI 组件
- **组件库**: Radix UI (@radix-ui/react-*)
- **表单验证**: React Hook Form + Zod
- **图表**: Recharts
- **样式**: Tailwind CSS v4 + @tailwindcss/postcss
- **日期处理**: date-fns
- **路径别名**: `@/*` → 项目根目录

## 项目结构约定

```
app/                    # 页面路由
  logs/                 # 日志查询
  racks/                # 机架管理
  search/               # 搜索
  settings/             # 设置
  sites/                # 站点管理
  tasks/                # 任务管理
  users/                # 用户管理

components/
  ui/                   # 通用 UI 组件（Radix 封装）
  dashboard/            # 仪表盘组件
  platform/             # 平台通用组件

lib/
  mock/                 # Mock 数据
  types/                # TypeScript 类型定义
  utils.ts               # 工具函数
```

## 开发禁止事项

- **禁止重构 UI 风格** — 保持现有视觉设计不变
- **禁止接入真实后端** — 仅使用 mock 数据
- **禁止接入真实数据库** — 数据层仅用 mock
- **禁止新增业务页面** — 仅维护现有页面
- **禁止修改现有页面路由** — 路由结构已定
- **禁止修改 mock 数据结构** — 如需变更类型，优先扩展而非修改

## 文档输出规范

- 除 CLAUDE.md 外，所有代码、注释、文档使用**中文**
- 变量/函数命名保持英文（代码规范）
- 提交信息使用中文，描述清楚改动内容

## 测试与验收要求

- 页面可正常加载，无路由 404
- 表单提交有对应响应反馈（mock）
- 列表数据正常显示
- 图表正常渲染
- 响应式布局在桌面端正常
- `pnpm build` 构建成功
- `pnpm lint` 无报错

## 常用命令

```bash
pnpm dev      # 开发服务器
pnpm build    # 生产构建
pnpm start    # 生产服务器
pnpm lint     # ESLint 检查
```

## 配置说明

- Next.js: `ignoreBuildErrors: true`（构建时不强制类型检查）
- 图片: `unoptimized: true`（适合静态部署）
- CSS: Tailwind v4 使用 `@tailwindcss/postcss`